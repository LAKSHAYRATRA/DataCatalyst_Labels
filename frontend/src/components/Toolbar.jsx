import { memo } from 'react';
import { formatTime } from '../utils/helpers';
import './Toolbar.css';

function Toolbar({
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
  onAddSegment,
  hasSelection,
  selectionDuration,
  onDeleteSegment,
  hasActiveSegment,
  onAutoDetectSegments,
  isDetecting,
  onMergeVAD,
  onFinishAndSave,
  isSaving,
  onRevertAutoDetect,
  hasAutoSegments,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
}) {
  const visibleDuration = duration > 0 ? duration / zoom : 0;

  const handleBtnClick = (action, e) => {
    e?.currentTarget?.blur();
    action?.(e);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className="toolbar-btn play-btn"
          onClick={(e) => handleBtnClick(onPlayPause, e)}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          className="toolbar-btn"
          onClick={(e) => handleBtnClick(onStop, e)}
          title="Stop"
        >
          ⏹
        </button>
      </div>

      <div className="toolbar-time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-zoom">
        <label>Zoom</label>
        <button
          className="toolbar-btn"
          onClick={(e) => handleBtnClick(onZoomOut, e)}
          title="Zoom out"
        >
          −
        </button>
        <input
          type="range"
          min={1}
          max={300}
          step="any"
          value={zoom}
          onChange={(e) => {
            onZoomChange(Number(e.target.value));
            e.target.blur();
          }}
        />
        <button
          className="toolbar-btn"
          onClick={(e) => handleBtnClick(onZoomIn, e)}
          title="Zoom in"
        >
          +
        </button>
        <span className="toolbar-zoom-value">{Number(zoom).toFixed(1)}x</span>
        <button
          className="toolbar-btn"
          onClick={(e) => handleBtnClick(onFit, e)}
          title="Fit to screen"
        >
          ⊡
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-zoom">
        <label>Speed</label>
        <button
          className="toolbar-btn"
          onClick={(e) =>
            handleBtnClick(
              () => onPlaybackRateChange(Math.max(0.5, playbackRate - 0.25)),
              e
            )
          }
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
          onChange={(e) => {
            onPlaybackRateChange(Number(e.target.value));
            e.target.blur();
          }}
          style={{ width: '80px' }}
        />
        <button
          className="toolbar-btn"
          onClick={(e) =>
            handleBtnClick(
              () => onPlaybackRateChange(Math.min(3.0, playbackRate + 0.25)),
              e
            )
          }
          title="Increase speed"
        >
          +
        </button>
        <span className="toolbar-zoom-value">{Number(playbackRate).toFixed(2)}x</span>
      </div>

      {onAutoDetectSegments && (
        <>
          <div className="toolbar-divider" />
          <button
            className="btn btn-primary btn-sm auto-detect-btn"
            onClick={(e) => handleBtnClick(onAutoDetectSegments, e)}
            disabled={isDetecting}
            title="Auto-detect combined speech segments across both tracks (max 30s)"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)',
              cursor: isDetecting ? 'wait' : 'pointer',
              opacity: isDetecting ? 0.7 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {isDetecting ? '⚡ Detecting...' : '⚡ Auto-Detect Segments'}
          </button>
        </>
      )}

      {onMergeVAD && (
        <button
          className="btn btn-secondary btn-sm merge-vad-btn"
          onClick={(e) => handleBtnClick(onMergeVAD, e)}
          title="Smart Merge: Combines overlapping Speaker 1 & Speaker 2 VAD segments into optimal unified speech turns"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
            color: '#c084fc',
            border: '1px solid rgba(168, 85, 247, 0.5)',
            boxShadow: '0 0 10px rgba(168, 85, 247, 0.25)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🔗 Merge VAD Tracks
        </button>
      )}

      {onFinishAndSave && (
        <>
          <div className="toolbar-divider" />
          <button
            className="btn btn-primary btn-sm finish-save-btn"
            onClick={(e) => handleBtnClick(onFinishAndSave, e)}
            disabled={isSaving}
            title="Finish & Save: Downloads segment-level JSON labels (start_ms, end_ms) and persists to S3 server storage"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)',
              cursor: isSaving ? 'wait' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {isSaving ? '💾 Saving...' : '💾 Finish & Save'}
          </button>
        </>
      )}

      {onAddSegment && (
        <>
          <div className="toolbar-divider" />
          <button
            className={`btn ${hasSelection ? 'btn-primary' : 'btn-secondary'} btn-sm add-segment-btn`}
            onClick={(e) => handleBtnClick(onAddSegment, e)}
            disabled={!hasSelection}
            title={
              hasSelection
                ? 'Create segment from selection (or press S)'
                : 'Drag selection on waveform to activate Add Segment'
            }
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '8px',
              background: hasSelection
                ? 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)'
                : undefined,
              boxShadow: hasSelection ? '0 0 14px rgba(99, 102, 241, 0.5)' : undefined,
              cursor: hasSelection ? 'pointer' : 'not-allowed',
              opacity: hasSelection ? 1 : 0.4,
              transition: 'all 0.2s ease',
            }}
          >
            + Add Segment {selectionDuration ? `(${selectionDuration}s)` : ''}
          </button>
        </>
      )}

      {onDeleteSegment && (
        <button
          className="btn btn-secondary btn-sm delete-segment-btn"
          onClick={(e) => handleBtnClick(onDeleteSegment, e)}
          disabled={!hasActiveSegment}
          title={
            hasActiveSegment
              ? 'Delete selected segment (or press Delete / Backspace)'
              : 'Select a segment to enable Delete'
          }
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '8px',
            background: hasActiveSegment ? 'rgba(239, 68, 68, 0.2)' : undefined,
            color: hasActiveSegment ? '#f87171' : '#64748b',
            border: hasActiveSegment ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border)',
            boxShadow: hasActiveSegment ? '0 0 10px rgba(239, 68, 68, 0.3)' : undefined,
            cursor: hasActiveSegment ? 'pointer' : 'not-allowed',
            opacity: hasActiveSegment ? 1 : 0.4,
            transition: 'all 0.2s ease',
          }}
        >
          🗑️ Delete Segment
        </button>
      )}

      {onUndo && (
        <button
          className="btn btn-secondary btn-sm undo-btn"
          onClick={(e) => handleBtnClick(onUndo, e)}
          disabled={!canUndo}
          title="Undo last action (Ctrl+Z)"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '8px',
            background: canUndo ? 'rgba(56, 189, 248, 0.15)' : undefined,
            color: canUndo ? '#38bdf8' : '#64748b',
            border: canUndo ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border)',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            opacity: canUndo ? 1 : 0.4,
            transition: 'all 0.2s ease',
          }}
        >
          ↺ Undo
        </button>
      )}

      {onRedo && (
        <button
          className="btn btn-secondary btn-sm redo-btn"
          onClick={(e) => handleBtnClick(onRedo, e)}
          disabled={!canRedo}
          title="Redo action (Ctrl+Y / Ctrl+Shift+Z)"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '8px',
            background: canRedo ? 'rgba(192, 132, 252, 0.15)' : undefined,
            color: canRedo ? '#c084fc' : '#64748b',
            border: canRedo ? '1px solid rgba(192, 132, 252, 0.4)' : '1px solid var(--border)',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            opacity: canRedo ? 1 : 0.4,
            transition: 'all 0.2s ease',
          }}
        >
          ↻ Redo
        </button>
      )}

      <span className="toolbar-hint">
        {zoom > 1
          ? `~${formatTime(visibleDuration)} visible — scroll horizontally`
          : 'Click waveform to seek • Drag label edges to adjust'}
      </span>
    </div>
  );
}

export default memo(Toolbar);
