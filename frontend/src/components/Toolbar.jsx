import { formatTime } from '../utils/helpers';
import './Toolbar.css';

export default function Toolbar({
  isPlaying,
  currentTime,
  duration,
  zoom,
  playbackRate,
  onPlaybackRateChange,
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
          step="any"
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
        />
        <button className="toolbar-btn" onClick={onZoomIn} title="Zoom in">
          +
        </button>
        <span className="toolbar-zoom-value">{Number(zoom).toFixed(1)}x</span>
        <button className="toolbar-btn" onClick={onFit} title="Fit to screen">
          ⊡
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-zoom">
        <label>Speed</label>
        <button
          className="toolbar-btn"
          onClick={() => onPlaybackRateChange(Math.max(0.5, playbackRate - 0.25))}
          title="Decrease speed"
        >
          −
        </button>
        <input
          type="range"
          min={0.5}
          max={3.0}
          step={0.25}
          value={playbackRate}
          onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
          style={{ width: '80px' }}
        />
        <button
          className="toolbar-btn"
          onClick={() => onPlaybackRateChange(Math.min(3.0, playbackRate + 0.25))}
          title="Increase speed"
        >
          +
        </button>
        <span className="toolbar-zoom-value">{Number(playbackRate).toFixed(2)}x</span>
      </div>

      <span className="toolbar-hint">
        {zoom > 1
          ? `~${formatTime(visibleDuration)} visible — scroll horizontally`
          : 'Click waveform to seek • Drag label edges to adjust'}
      </span>
    </div>
  );
}
