import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import WaveformCanvas from './components/WaveformCanvas';
import TranscriptionEditor from './components/TranscriptionEditor';
import LabelList from './components/LabelList';
import UploadZone from './components/UploadZone';
import {
  createProject,
  uploadAudio,
  uploadTranscription,
  uploadLabels,
  updateTranscription,
  updateLabels,
  getAudioUrl,
  getExportUrl,
  transliterate,
} from './api/client';

import HomeSelector from './components/HomeSelector';
import SegmentationCanvas from './components/SegmentationCanvas';
import './App.css';

export default function App() {
  const [mode, setMode] = useState('home');
  const [loading, setLoading] = useState(true);

  // Segmentation Mode Dual Audio & Metadata State
  const [audio1File, setAudio1File] = useState(null);
  const [audio1Name, setAudio1Name] = useState('');
  const [audio1Url, setAudio1Url] = useState('');
  const [meta1File, setMeta1File] = useState(null);
  const [meta1Name, setMeta1Name] = useState('');
  const [meta1Data, setMeta1Data] = useState(null);

  const [audio2File, setAudio2File] = useState(null);
  const [audio2Name, setAudio2Name] = useState('');
  const [audio2Url, setAudio2Url] = useState('');
  const [meta2File, setMeta2File] = useState(null);
  const [meta2Name, setMeta2Name] = useState('');
  const [meta2Data, setMeta2Data] = useState(null);
  const [project, setProject] = useState(null);
  const [labels, setLabels] = useState([]);
  const [transcription, setTranscription] = useState('');
  const [activeTab, setActiveTab] = useState('upload');
  const [activeLabelId, setActiveLabelId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [uploading, setUploading] = useState('');
  const wavesurferRef = useRef(null);
  const saveLabelsTimer = useRef(null);
  const segmentListenerRef = useRef(null);

  const [suggestionMode, setSuggestionMode] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeWord, setActiveWord] = useState('');
  const [suggestionLang, setSuggestionLang] = useState('hi');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const activeInputRef = useRef(null);



  const activeSegmentRef = useRef(null);

  const clearSegmentListener = useCallback(() => {
    activeSegmentRef.current = null;
    const ws = wavesurferRef.current;
    if (ws && segmentListenerRef.current) {
      ws.un('audioprocess', segmentListenerRef.current);
      ws.un('timeupdate', segmentListenerRef.current);
      segmentListenerRef.current = null;
    }
  }, []);

  const handlePlayLabel = useCallback(
    (targetLabel) => {
      const ws = wavesurferRef.current;
      if (!ws || !targetLabel) return;

      const label = labels.find((l) => l.id === targetLabel.id) || targetLabel;

      setActiveLabelId(label.id);
      clearSegmentListener();

      const start = Number(label.start) || 0;
      const end = Number(label.end) || 0;

      if (end <= start) return;

      const seg = { start, end, hasStarted: false };
      activeSegmentRef.current = seg;

      ws.setTime(start);
      ws.play();

      const checkStop = (t) => {
        if (!activeSegmentRef.current || activeSegmentRef.current !== seg) return;
        const time = typeof t === 'number' ? t : ws.getCurrentTime();

        if (!seg.hasStarted) {
          if (time >= start - 0.08 && time <= end + 0.08) {
            seg.hasStarted = true;
          }
          return;
        }

        if (time >= end - 0.05) {
          ws.pause();
          ws.setTime(start);
          clearSegmentListener();
        }
      };

      segmentListenerRef.current = checkStop;
      ws.on('audioprocess', checkStop);
      ws.on('timeupdate', checkStop);
    },
    [labels, clearSegmentListener]
  );

  const handlePlayPause = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    // If a label is selected, pressing spacebar always restarts & replays that label from start
    if (activeLabelId) {
      const selectedLabel = labels.find((l) => l.id === activeLabelId);
      if (selectedLabel) {
        handlePlayLabel(selectedLabel);
        return;
      }
    }

    if (isPlaying) {
      clearSegmentListener();
      ws.pause();
    } else {
      clearSegmentListener();
      ws.play();
    }
  }, [isPlaying, activeLabelId, labels, handlePlayLabel, clearSegmentListener]);

  useEffect(() => {
    createProject('Voclara Session')
      .then((p) => {
        setProject(p);
        setLabels(p.labels || []);
        setTranscription(p.transcription || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const active = document.activeElement;
      const isTextInput =
        active &&
        (active.tagName === 'TEXTAREA' ||
          active.isContentEditable ||
          (active.tagName === 'INPUT' &&
            active.type !== 'range' &&
            active.type !== 'checkbox' &&
            active.type !== 'radio' &&
            active.type !== 'button' &&
            active.type !== 'submit'));

      if (isTextInput) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const ws = wavesurferRef.current;
        if (ws) {
          const newTime = Math.min(ws.getDuration(), ws.getCurrentTime() + 3);
          ws.setTime(newTime);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const ws = wavesurferRef.current;
        if (ws) {
          const newTime = Math.max(0, ws.getCurrentTime() - 3);
          ws.setTime(newTime);
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setPlaybackRate((prev) => Math.min(3.0, prev + 0.25));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setPlaybackRate((prev) => Math.max(0.5, prev - 0.25));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePlayPause]);

  const handleSelectSuggestion = useCallback((suggestion) => {
    const inputElement = activeInputRef.current;
    if (!inputElement) return;

    const text = inputElement.value;
    const caretPos = inputElement.selectionStart;
    if (caretPos === null) return;

    let start = caretPos;
    while (start > 0 && !/\s/.test(text[start - 1])) {
      start--;
    }
    let end = caretPos;
    while (end < text.length && !/\s/.test(text[end])) {
      end++;
    }

    const prefix = text.slice(0, start);
    const suffix = text.slice(end);
    const newText = prefix + suggestion + suffix;

    const inputProto = window.HTMLInputElement.prototype;
    const textAreaProto = window.HTMLTextAreaElement.prototype;
    const prototype = inputElement.tagName === 'TEXTAREA' ? textAreaProto : inputProto;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    if (valueSetter) {
      valueSetter.call(inputElement, newText);
    } else {
      inputElement.value = newText;
    }

    const event = new Event('input', { bubbles: true });
    inputElement.dispatchEvent(event);

    const newCaretPos = start + suggestion.length;
    setTimeout(() => {
      try {
        inputElement.focus();
        inputElement.setSelectionRange(newCaretPos, newCaretPos);
      } catch (e) {
        console.error(e);
      }
    }, 10);

    setSuggestions([]);
    setActiveWord('');
  }, []);

  useEffect(() => {
    if (!suggestionMode) {
      setSuggestions([]);
      setActiveWord('');
      setLoadingSuggestions(false);
      return;
    }

    let debounceTimer = null;

    const handleInput = (e) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          (target.tagName === 'INPUT' && target.type === 'text' && !target.classList.contains('label-search')))
      ) {
        activeInputRef.current = target;
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const text = target.value;
          const caret = target.selectionStart;
          if (caret === null) return;

          let start = caret;
          while (start > 0 && !/\s/.test(text[start - 1])) {
            start--;
          }
          let end = caret;
          while (end < text.length && !/\s/.test(text[end])) {
            end++;
          }

          const word = text.slice(start, end).trim();
          if (word && /^[a-zA-Z]+$/.test(word)) {
            setActiveWord(word);
            setLoadingSuggestions(true);
            try {
              const data = await transliterate(word, suggestionLang);
              setSuggestions(data.suggestions || []);
            } catch (err) {
              console.error(err);
              setSuggestions([]);
            } finally {
              setLoadingSuggestions(false);
            }
          } else {
            setSuggestions([]);
            setActiveWord('');
            setLoadingSuggestions(false);
          }
        }, 150);
      }
    };

    document.addEventListener('input', handleInput);
    document.addEventListener('keyup', handleInput);
    document.addEventListener('click', handleInput);

    return () => {
      clearTimeout(debounceTimer);
      document.removeEventListener('input', handleInput);
      document.removeEventListener('keyup', handleInput);
      document.removeEventListener('click', handleInput);
    };
  }, [suggestionMode, suggestionLang]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!suggestionMode || suggestions.length === 0) return;

      if (e.ctrlKey && ((e.key >= '1' && e.key <= '9') || e.key === '0')) {
        e.preventDefault();
        const idx = e.key === '0' ? 9 : parseInt(e.key) - 1;
        if (idx < suggestions.length) {
          handleSelectSuggestion(suggestions[idx]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [suggestionMode, suggestions, handleSelectSuggestion]);

  const debouncedSaveLabels = useCallback(
    (newLabels) => {
      if (!project) return;
      clearTimeout(saveLabelsTimer.current);
      saveLabelsTimer.current = setTimeout(() => {
        updateLabels(project._id, newLabels).catch(console.error);
      }, 500);
    },
    [project]
  );

  const handleLabelsChange = (newLabels) => {
    setLabels(newLabels);
    debouncedSaveLabels(newLabels);
  };

  const handleAudio1Upload = (file) => {
    if (!file) return;
    setUploading('audio1');
    try {
      const url = URL.createObjectURL(file);
      setAudio1File(file);
      setAudio1Name(file.name);
      setAudio1Url(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading('');
    }
  };

  const handleAudio2Upload = (file) => {
    if (!file) return;
    setUploading('audio2');
    try {
      const url = URL.createObjectURL(file);
      setAudio2File(file);
      setAudio2Name(file.name);
      setAudio2Url(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading('');
    }
  };

  const parseMetadataFile = (text) => {
    const trimmed = text.trim();
    try {
      const jsonParsed = JSON.parse(trimmed);
      if (jsonParsed && typeof jsonParsed === 'object' && !jsonParsed._raw) {
        jsonParsed._raw = trimmed;
      }
      return jsonParsed;
    } catch {
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length >= 2) {
        const firstLine = lines[0];
        const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';
        const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
        const values = lines[1].split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ''));
        const obj = { _raw: trimmed };
        headers.forEach((h, i) => {
          if (h) obj[h] = values[i] || '';
        });
        return obj;
      } else if (lines.length === 1) {
        const line = lines[0];
        const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
        const pairs = line.split(delimiter);
        const obj = { _raw: trimmed };
        pairs.forEach((p) => {
          const parts = p.split(/[:=]/);
          if (parts.length >= 2) {
            const k = parts[0].trim().replace(/^["']|["']$/g, '');
            const v = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
            if (k) obj[k] = v;
          }
        });
        return Object.keys(obj).length > 1 ? obj : { _raw: trimmed };
      }
    }
    return { _raw: trimmed };
  };

  const handleMeta1Upload = async (file) => {
    if (!file) return;
    setUploading('meta1');
    try {
      const text = await file.text();
      const parsed = parseMetadataFile(text);
      setMeta1File(file);
      setMeta1Name(file.name);
      setMeta1Data(parsed);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading('');
    }
  };

  const handleMeta2Upload = async (file) => {
    if (!file) return;
    setUploading('meta2');
    try {
      const text = await file.text();
      const parsed = parseMetadataFile(text);
      setMeta2File(file);
      setMeta2Name(file.name);
      setMeta2Data(parsed);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading('');
    }
  };

  const handleAudioUpload = async (file) => {
    if (!project) return;
    setUploading('audio');
    try {
      const updated = await uploadAudio(project._id, file);
      setProject(updated);
      setActiveTab('transcription');
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading('');
    }
  };

  const handleTranscriptionUpload = async (file) => {
    if (!project) return;
    setUploading('transcription');
    try {
      const updated = await uploadTranscription(project._id, file);
      setProject(updated);
      setTranscription(updated.transcription);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading('');
    }
  };

  const handleLabelsUpload = async (file) => {
    if (!project) return;
    setUploading('labels');
    try {
      const updated = await uploadLabels(project._id, file);
      setProject(updated);
      setLabels(updated.labels || []);
      setActiveTab('labels');
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading('');
    }
  };

  const handleTranscriptionSave = async (text) => {
    if (!project) return;
    try {
      const updated = await updateTranscription(project._id, text);
      setProject(updated);
      setTranscription(updated.transcription);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStop = () => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    clearSegmentListener();
    ws.stop();
    setIsPlaying(false);
  };

  const handleZoomChange = (z) => setZoom(z);
  const handleZoomIn = () => setZoom((z) => Math.min(300, z + 5));
  const handleZoomOut = () => setZoom((z) => Math.max(1, z - 5));
  const handleFit = () => setZoom(1);



  const handleExport = (format) => {
    if (!project) return;
    debouncedSaveLabels(labels);
    setTimeout(() => {
      window.open(getExportUrl(project._id, format), '_blank');
    }, 600);
  };

  const audioUrl = project?.audioFile ? getAudioUrl(project._id) : null;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading Voclara...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        projectName={project?.name}
        mode={mode}
        onGoHome={() => setMode('home')}
        onSelectMode={setMode}
        hasLabels={labels.length > 0}
        onExport={handleExport}
        suggestionMode={suggestionMode}
        onSuggestionModeChange={setSuggestionMode}
        suggestionLang={suggestionLang}
        onSuggestionLangChange={setSuggestionLang}
      />

      {mode === 'home' ? (
        <HomeSelector onSelectMode={(selectedMode) => setMode(selectedMode)} />
      ) : mode === 'segmentation' ? (
        <div className="app-main">
          <div className="editor-layout">
            <SegmentationCanvas
              audio1Url={audio1Url}
              audio2Url={audio2Url}
              audio1Name={audio1Name}
              audio2Name={audio2Name}
              meta1Name={meta1Name}
              meta2Name={meta2Name}
              meta1Data={meta1Data}
              meta2Data={meta2Data}
              zoom={zoom}
              playbackRate={playbackRate}
              onZoomChange={handleZoomChange}
              onPlaybackRateChange={setPlaybackRate}
            />
          </div>

          <aside className="side-panel">
            <div className="panel-content" style={{ padding: '16px' }}>
              {/* Speaker 1 Vertical Panel (Top) */}
              <div
                className="section"
                style={{
                  marginBottom: '20px',
                  background: 'rgba(30, 41, 59, 0.5)',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                <div
                  className="section-title"
                  style={{ color: '#38bdf8', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}
                >
                  🎙️ Speaker 1 (Top Track)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <UploadZone
                    title="Upload Speaker 1 Audio"
                    hint="WAV, MP3, FLAC, M4A"
                    accept="audio/*"
                    icon="🎵"
                    hasFile={!!audio1File}
                    filename={audio1Name}
                    onFile={handleAudio1Upload}
                    disabled={uploading === 'audio1'}
                  />
                  <UploadZone
                    title="Upload Speaker 1 Metadata"
                    hint="CSV, JSON, or TXT (demographics, speaker ID)"
                    accept=".csv,.json,.txt"
                    icon="📄"
                    hasFile={!!meta1File}
                    filename={meta1Name}
                    onFile={handleMeta1Upload}
                    disabled={uploading === 'meta1'}
                  />
                </div>
              </div>

              {/* Speaker 2 Vertical Panel (Bottom) */}
              <div
                className="section"
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(192, 132, 252, 0.3)',
                }}
              >
                <div
                  className="section-title"
                  style={{ color: '#c084fc', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}
                >
                  🎧 Speaker 2 (Bottom Track)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <UploadZone
                    title="Upload Speaker 2 Audio"
                    hint="WAV, MP3, FLAC, M4A"
                    accept="audio/*"
                    icon="🎵"
                    hasFile={!!audio2File}
                    filename={audio2Name}
                    onFile={handleAudio2Upload}
                    disabled={uploading === 'audio2'}
                  />
                  <UploadZone
                    title="Upload Speaker 2 Metadata"
                    hint="CSV, JSON, or TXT (demographics, speaker ID)"
                    accept=".csv,.json,.txt"
                    icon="📄"
                    hasFile={!!meta2File}
                    filename={meta2Name}
                    onFile={handleMeta2Upload}
                    disabled={uploading === 'meta2'}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="app-main">
          <div className="editor-layout">
            {audioUrl ? (
              <>
                <Toolbar
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  zoom={zoom}
                  playbackRate={playbackRate}
                  onPlaybackRateChange={setPlaybackRate}
                  onPlayPause={handlePlayPause}
                  onStop={handleStop}
                  onZoomChange={handleZoomChange}
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onFit={handleFit}
                />
                <WaveformCanvas
                  audioUrl={audioUrl}
                  labels={labels}
                  zoom={zoom}
                  playbackRate={playbackRate}
                  onPlaybackRateChange={setPlaybackRate}
                  onPlayPause={handlePlayPause}
                  onZoomChange={handleZoomChange}
                  activeLabelId={activeLabelId}
                  onLabelsChange={handleLabelsChange}
                  onActiveLabelChange={setActiveLabelId}
                  onTimeUpdate={setCurrentTime}
                  onDurationChange={setDuration}
                  wavesurferRef={wavesurferRef}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  suggestionMode={suggestionMode}
                  suggestions={suggestions}
                  activeWord={activeWord}
                  onSelectSuggestion={handleSelectSuggestion}
                  loadingSuggestions={loadingSuggestions}
                  onPlayLabel={handlePlayLabel}
                />
              </>
            ) : (
              <div className="empty-state">
                <h2>Transcription Workspace</h2>
                <p>
                  Upload an audio file from the panel on the right to start editing
                  word-level timestamps. Zoom, scroll, and drag label boundaries.
                </p>
              </div>
            )}
          </div>

          <aside className="side-panel">
            <div className="panel-tabs">
              <button
                className={`panel-tab ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                Upload
              </button>
              <button
                className={`panel-tab ${activeTab === 'transcription' ? 'active' : ''}`}
                onClick={() => setActiveTab('transcription')}
              >
                Transcription
              </button>
              <button
                className={`panel-tab ${activeTab === 'labels' ? 'active' : ''}`}
                onClick={() => setActiveTab('labels')}
              >
                Labels
              </button>
            </div>

            <div className="panel-content">
              {activeTab === 'upload' && (
                <>
                  <div className="section">
                    <div className="section-title">Audio File</div>
                    <UploadZone
                      title="Upload Audio"
                      hint="WAV, MP3, OGG, FLAC, M4A"
                      accept="audio/*"
                      icon="🎵"
                      hasFile={!!project?.audioFile}
                      filename={project?.audioOriginalName}
                      onFile={handleAudioUpload}
                      disabled={uploading === 'audio'}
                    />
                  </div>
                  <div className="section">
                    <div className="section-title">Paragraph Transcription</div>
                    <UploadZone
                      title="Upload Transcription"
                      hint="Plain text file (.txt)"
                      accept=".txt,text/plain"
                      icon="📝"
                      hasFile={!!transcription}
                      filename={transcription ? 'Transcription loaded' : null}
                      onFile={handleTranscriptionUpload}
                      disabled={uploading === 'transcription'}
                    />
                  </div>
                  <div className="section">
                    <div className="section-title">Word Labels</div>
                    <UploadZone
                      title="Upload Labels"
                      hint="Audacity labels (.txt) or JSON"
                      accept=".txt,.json,.label"
                      icon="🏷️"
                      hasFile={labels.length > 0}
                      filename={labels.length > 0 ? `${labels.length} labels loaded` : null}
                      onFile={handleLabelsUpload}
                      disabled={uploading === 'labels'}
                    />
                  </div>
                </>
              )}

              {activeTab === 'transcription' && (
                <TranscriptionEditor
                  transcription={transcription}
                  onSave={handleTranscriptionSave}
                  disabled={!project}
                />
              )}

              {activeTab === 'labels' && (
                <LabelList
                  labels={labels}
                  activeLabelId={activeLabelId}
                  onSelect={setActiveLabelId}
                  onPlay={handlePlayLabel}
                  onLabelsChange={handleLabelsChange}
                />
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
