import { formatTime } from '../utils/helpers';
import './Toolbar.css';

export default function Toolbar({
  isPlaying,
  currentTime,
  duration,
  zoom,
  onPlayPause,
  onStop,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onFit,
}) {
  const visibleDuration = duration > 0 ? duration / zoom : 0;

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className="toolbar-btn play-btn"
          onClick={onPlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="toolbar-btn" onClick={onStop} title="Stop">
          ⏹
        </button>
      </div>

      <div className="toolbar-time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-zoom">
        <label>Zoom</label>
        <button className="toolbar-btn" onClick={onZoomOut} title="Zoom out">
          −
        </button>
        <input
          type="range"
          min={1}
          max={200}
          step={1}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
        />
        <button className="toolbar-btn" onClick={onZoomIn} title="Zoom in">
          +
        </button>
        <span className="toolbar-zoom-value">{zoom}x</span>
        <button className="toolbar-btn" onClick={onFit} title="Fit to screen">
          ⊡
        </button>
      </div>

      <span className="toolbar-hint">
        {zoom > 1
          ? `~${formatTime(visibleDuration)} visible — scroll horizontally`
          : 'Click waveform to seek • Drag label edges to adjust'}
      </span>
    </div>
  );
}
