import './HomeSelector.css';

export default function HomeSelector({ onSelectMode }) {
  return (
    <div className="home-selector-container">
      <div className="home-selector-card-wrapper">
        <div className="home-selector-header">
          <img src="/logo.png" alt="Voclara" className="home-selector-logo" />
          <h1 className="home-selector-title">Voclara Workspace</h1>
          <p className="home-selector-subtitle">
            Select a pipeline mode to start audio processing & dataset annotation
          </p>
        </div>

        <div className="home-selector-options">
          {/* Card 1: Segmentation */}
          <div
            className="home-option-card segmentation-card"
            onClick={() => onSelectMode('segmentation')}
          >
            <div className="option-badge tier-1">Tier 1 Pipeline</div>
            <div className="option-icon">✂️</div>
            <h2 className="option-title">Segmentation</h2>
            <p className="option-subtitle">Audio Segment Creation & Diarization</p>
            <p className="option-description">
              Split long audio calls into speaker turns, define 3–10s sentence boundaries, and manage multi-track speaker channels.
            </p>
            <button className="option-btn btn-segmentation">
              Open Segmentation Mode →
            </button>
          </div>

          {/* Card 2: Transcription */}
          <div
            className="home-option-card transcription-card"
            onClick={() => onSelectMode('transcription')}
          >
            <div className="option-badge tier-2">Tier 2 Pipeline</div>
            <div className="option-icon">🎙️</div>
            <h2 className="option-title">Transcription</h2>
            <p className="option-subtitle">Word-Level Timestamp & Alignment Editor</p>
            <p className="option-description">
              Fine-tune word-level timestamps, edit Indic transliterations with live suggestions, and export gold-standard datasets.
            </p>
            <button className="option-btn btn-transcription">
              Open Transcription Mode →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
