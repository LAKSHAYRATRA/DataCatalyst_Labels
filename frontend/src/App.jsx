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

import './App.css';

export default function App() {
  const [loading, setLoading] = useState(true);
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

  const [suggestionMode, setSuggestionMode] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeWord, setActiveWord] = useState('');
  const [suggestionLang, setSuggestionLang] = useState('hi');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const activeInputRef = useRef(null);



  const handlePlayPause = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.playPause();
  }, []);

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

    // Find the word bounds around the caret
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

    // Use React value setting trick to trigger controlled updates
    const inputProto = window.HTMLInputElement.prototype;
    const textAreaProto = window.HTMLTextAreaElement.prototype;
    const prototype = inputElement.tagName === 'TEXTAREA' ? textAreaProto : inputProto;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    if (valueSetter) {
      valueSetter.call(inputElement, newText);
    } else {
      inputElement.value = newText;
    }

    // Trigger synthetic input event
    const event = new Event('input', { bubbles: true });
    inputElement.dispatchEvent(event);

    // Reposition cursor
    const newCaretPos = start + suggestion.length;
    setTimeout(() => {
      try {
        inputElement.focus();
        inputElement.setSelectionRange(newCaretPos, newCaretPos);
      } catch (e) {
        console.error(e);
      }
    }, 10);

    // Clear suggestions
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
        
        // Debounce fetching suggestions to avoid overwhelming the server on every keystroke
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const text = target.value;
          const caret = target.selectionStart;
          if (caret === null) return;

          // Find the word boundaries containing caret
          let start = caret;
          while (start > 0 && !/\s/.test(text[start - 1])) {
            start--;
          }
          let end = caret;
          while (end < text.length && !/\s/.test(text[end])) {
            end++;
          }

          const word = text.slice(start, end).trim();
          // Fetch suggestions if it contains only English/Hinglish characters
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

      // Ctrl + [1-9] or Ctrl + 0 hotkeys (supports up to 10 suggestions)
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
    ws.stop();
    setIsPlaying(false);
  };

  const handleZoomChange = (z) => setZoom(z);
  const handleZoomIn = () => setZoom((z) => Math.min(200, z + 5));
  const handleZoomOut = () => setZoom((z) => Math.max(1, z - 5));
  const handleFit = () => setZoom(1);

  const handlePlayLabel = (label) => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    setActiveLabelId(label.id);
    ws.setTime(label.start);
    ws.play();
    const stopAtEnd = (time) => {
      if (time >= label.end) {
        ws.pause();
        ws.setTime(label.end);
        ws.un('timeupdate', stopAtEnd);
      }
    };
    ws.on('timeupdate', stopAtEnd);
  };

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
        hasLabels={labels.length > 0}
        onExport={handleExport}
        suggestionMode={suggestionMode}
        onSuggestionModeChange={setSuggestionMode}
        suggestionLang={suggestionLang}
        onSuggestionLangChange={setSuggestionLang}
      />

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
              />
            </>
          ) : (
            <div className="empty-state">
              <h2>Welcome to Voclara</h2>
              <p>
                Upload an audio file from the panel on the right to start editing
                word-level timestamps. Zoom, scroll, and drag label boundaries
                just like in Audacity.
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

    </div>
  );
}
