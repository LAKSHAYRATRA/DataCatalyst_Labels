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
  const [uploading, setUploading] = useState('');
  const wavesurferRef = useRef(null);
  const saveLabelsTimer = useRef(null);

  useEffect(() => {
    createProject('VocLara Session')
      .then((p) => {
        setProject(p);
        setLabels(p.labels || []);
        setTranscription(p.transcription || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  const handlePlayPause = () => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.playPause();
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

  const audioUrl = project?.audioFile ? getAudioUrl(project.audioFile) : null;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading VocLara...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        projectName={project?.name}
        hasLabels={labels.length > 0}
        onExport={handleExport}
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
                activeLabelId={activeLabelId}
                onLabelsChange={handleLabelsChange}
                onActiveLabelChange={setActiveLabelId}
                onTimeUpdate={setCurrentTime}
                onDurationChange={setDuration}
                wavesurferRef={wavesurferRef}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
              />
            </>
          ) : (
            <div className="empty-state">
              <h2>Welcome to VocLara</h2>
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
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
