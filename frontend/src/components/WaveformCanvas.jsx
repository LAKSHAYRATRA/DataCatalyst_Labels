import { useEffect, useRef, useCallback, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { formatTime } from '../utils/helpers';
import './WaveformCanvas.css';

const BASE_PX_PER_SEC = 50;

export default function WaveformCanvas({
  audioUrl,
  labels,
  zoom,
  playbackRate,
  onZoomChange,
  activeLabelId,
  onLabelsChange,
  onActiveLabelChange,
  onTimeUpdate,
  onDurationChange,
  onReady,
  wavesurferRef,
  isPlaying,
  setIsPlaying,
  suggestionMode,
  suggestions = [],
  activeWord = '',
  onSelectSuggestion,
  loadingSuggestions,
}) {


  const rootRef = useRef(null);
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const rulerRef = useRef(null);
  const labelsTrackRef = useRef(null);
  const wsRef = useRef(null);
  const draggingRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const onZoomChangeRef = useRef(null);
  const rulerPlayheadRef = useRef(null);
  const trackPlayheadRef = useRef(null);
  const updatePlayheadRef = useRef(null);

  // Derived state & view boundaries
  const containerWidth = scrollRef.current?.clientWidth || 800;
  const basePxPerSec = duration > 0 && isFinite(duration) ? containerWidth / duration : BASE_PX_PER_SEC;
  const pxPerSec = basePxPerSec * zoom;
  const validDuration = isFinite(duration) && duration > 0 ? duration : 0;
  const totalWidth = Math.max(validDuration * pxPerSec, containerWidth);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 100 });

  // Use refs to make callbacks completely stable and prevent rendering/listener loops during zoom
  const pxPerSecRef = useRef(pxPerSec);
  const durationRef = useRef(duration);
  
  useEffect(() => {
    pxPerSecRef.current = pxPerSec;
  }, [pxPerSec]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const activeLabelIdRef = useRef(activeLabelId);
  const labelsRef = useRef(labels);

  useEffect(() => {
    activeLabelIdRef.current = activeLabelId;
  }, [activeLabelId]);

  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [selection, setSelection] = useState(null);
  const selectionRef = useRef(null);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const selectionDragRef = useRef(null);
  const selectionResizeRef = useRef(null);
  const syncScroll = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (rulerRef.current) {
      rulerRef.current.scrollLeft = scroll.scrollLeft;
    }
    if (labelsTrackRef.current) {
      labelsTrackRef.current.scrollLeft = scroll.scrollLeft;
    }

    const left = scroll.scrollLeft;
    const width = scroll.clientWidth || 800;
    const padding = 200; // px margin
    setVisibleRange({
      start: Math.max(0, (left - padding) / pxPerSecRef.current),
      end: (left + width + padding) / pxPerSecRef.current,
    });
  }, []);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();

        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        onZoomChangeRef.current?.((z) => {
          const nextZoom = z * factor;
          return Math.max(1, Math.min(200, nextZoom));
        });
      } else {
        // Intercept all wheel/scroll events on the waveform to block trackpad history gestures
        e.preventDefault();

        const scroll = scrollRef.current;
        if (!scroll) return;

        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          // Horizontal swipe (two-finger scroll left/right on trackpad)
          scroll.scrollLeft += e.deltaX * 0.8;
        } else {
          // Vertical swipe/scroll -> translate to horizontal scroll
          scroll.scrollLeft += e.deltaY * 0.8;
        }
        syncScroll();
      }
    };

    rootEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      rootEl.removeEventListener('wheel', handleWheel);
    };
  }, [syncScroll]);

  // Keep visibleRange updated on duration changes (like on load)
  useEffect(() => {
    syncScroll();
  }, [duration, syncScroll]);

  const updatePlayhead = useCallback((time) => {
    const x = time * pxPerSecRef.current;
    if (rulerPlayheadRef.current) {
      rulerPlayheadRef.current.style.left = `${x}px`;
    }
    if (trackPlayheadRef.current) {
      trackPlayheadRef.current.style.left = `${x}px`;
    }

    // Auto-scroll to playhead when playing
    const scroll = scrollRef.current;
    if (scroll && durationRef.current) {
      const viewLeft = scroll.scrollLeft;
      const viewRight = viewLeft + scroll.clientWidth;

      if (x < viewLeft + 50 || x > viewRight - 50) {
        scroll.scrollLeft = Math.max(0, x - scroll.clientWidth / 3);
        syncScroll();
      }
    }
  }, [syncScroll]);

  useEffect(() => {
    updatePlayheadRef.current = updatePlayhead;
  }, [updatePlayhead]);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!audioUrl || !containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4f46e5',
      progressColor: '#a5b4fc',
      cursorColor: '#ef4444',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 160,
      normalize: true,
      minPxPerSec: pxPerSec,
      fillParent: false,
      interact: true,
      hideScrollbar: true,
    });

    wsRef.current = ws;
    if (wavesurferRef) wavesurferRef.current = ws;

    ws.load(audioUrl);

    ws.on('ready', () => {
      const dur = ws.getDuration();
      setDuration(dur);
      onDurationChange?.(dur);
      ws.zoom(pxPerSec);
      ws.setPlaybackRate(playbackRate);
      onReady?.();
    });

    ws.on('audioprocess', (time) => {
      updatePlayheadRef.current?.(time);
      onTimeUpdate?.(time);

      // Loop selection if active, otherwise loop active label region
      if (selectionRef.current) {
        const start = selectionRef.current.start;
        const end = selectionRef.current.end;
        if (end > start && time >= end) {
          ws.setTime(start);
        }
      } else if (activeLabelIdRef.current) {
        const drag = draggingRef.current;
        let start = 0;
        let end = 0;

        if (drag && drag.labelId === activeLabelIdRef.current) {
          start = drag.currentStart;
          end = drag.currentEnd;
        } else {
          const activeLabel = labelsRef.current.find((l) => l.id === activeLabelIdRef.current);
          if (activeLabel) {
            start = activeLabel.start;
            end = activeLabel.end;
          }
        }

        if (end > start && time >= end) {
          ws.setTime(start);
        }
      }
    });

    ws.on('seeking', (time) => {
      updatePlayheadRef.current?.(time);
      onTimeUpdate?.(time);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    return () => {
      ws.destroy();
      wsRef.current = null;
      if (wavesurferRef) wavesurferRef.current = null;
    };
  }, [audioUrl]);

  // Update zoom
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !duration) return;
    ws.zoom(pxPerSec);
    const inner = containerRef.current?.parentElement;
    if (inner) {
      inner.style.width = `${duration * pxPerSec}px`;
    }
  }, [zoom, duration, pxPerSec]);

  // Update playback rate (speed)
  useEffect(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  const timeToX = (time) => time * pxPerSec;

  const xToTime = (x) => Math.max(0, Math.min(duration, x / pxPerSec));

  const getTimestampFromEvent = (e) => {
    const scroll = scrollRef.current;
    if (!scroll) return 0;
    const rect = scroll.getBoundingClientRect();
    const clickX = e.clientX - rect.left + scroll.scrollLeft;
    const durVal = durationRef.current || duration;
    return Math.max(0, Math.min(durVal > 0 ? durVal : 0, clickX / pxPerSec));
  };

  const handleLabelMouseDown = (e, labelId, edge) => {
    e.stopPropagation();
    e.preventDefault();
    const regionEl = e.currentTarget.parentElement;
    const label = labels.find((l) => l.id === labelId);
    if (!label || !regionEl) return;

    draggingRef.current = {
      labelId,
      edge,
      startX: e.clientX,
      labelStart: label.start,
      labelEnd: label.end,
      regionEl,
      currentStart: label.start,
      currentEnd: label.end,
    };
    onActiveLabelChange(labelId);
  };

  const handleSelectionResizeStart = (e, edge) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selection) return;
    selectionResizeRef.current = {
      edge,
      startX: e.clientX,
      startSel: { ...selection }
    };
  };

  const handleMouseMove = useCallback(
    (e) => {
      // 1. Selection boundary resizing
      const resize = selectionResizeRef.current;
      if (resize && selectionRef.current) {
        const deltaX = e.clientX - resize.startX;
        const deltaTime = deltaX / pxPerSec;
        let newStart = resize.startSel.start;
        let newEnd = resize.startSel.end;

        if (resize.edge === 'left') {
          newStart = Math.min(resize.startSel.end - 0.01, resize.startSel.start + deltaTime);
          newStart = Math.max(0, newStart);
        } else if (resize.edge === 'right') {
          newEnd = Math.max(resize.startSel.start + 0.01, resize.startSel.end + deltaTime);
          newEnd = Math.min(durationRef.current, newEnd);
        }

        setSelection({ start: newStart, end: newEnd });
        return;
      }

      // 2. Waveform custom area drawing
      const selDrag = selectionDragRef.current;
      if (selDrag) {
        const currentTime = getTimestampFromEvent(e);
        selDrag.hasDragged = true;
        setSelection({
          start: Math.min(selDrag.start, currentTime),
          end: Math.max(selDrag.start, currentTime)
        });
        return;
      }

      // 3. Normal label region dragging
      const drag = draggingRef.current;
      if (!drag || !labelsTrackRef.current) return;

      const deltaX = e.clientX - drag.startX;
      const deltaTime = deltaX / pxPerSec;

      let newStart = drag.labelStart;
      let newEnd = drag.labelEnd;

      if (drag.edge === 'left') {
        newStart = Math.min(drag.labelEnd - 0.01, drag.labelStart + deltaTime);
        newStart = Math.max(0, newStart);
      } else if (drag.edge === 'right') {
        newEnd = Math.max(drag.labelStart + 0.01, drag.labelEnd + deltaTime);
        newEnd = Math.min(durationRef.current, newEnd);
      } else if (drag.edge === 'move') {
        const width = drag.labelEnd - drag.labelStart;
        newStart = drag.labelStart + deltaTime;
        newStart = Math.max(0, Math.min(durationRef.current - width, newStart));
        newEnd = newStart + width;
      }

      drag.currentStart = newStart;
      drag.currentEnd = newEnd;

      const left = timeToX(newStart);
      const width = Math.max(4, timeToX(newEnd) - left);
      drag.regionEl.style.left = `${left}px`;
      drag.regionEl.style.width = `${width}px`;
    },
    [pxPerSec]
  );

  const handleMouseUp = useCallback(() => {
    // 1. Selection boundary resize complete
    if (selectionResizeRef.current) {
      selectionResizeRef.current = null;
      return;
    }

    // 2. Timeline ruler drawing drag complete
    const selDrag = selectionDragRef.current;
    if (selDrag) {
      selectionDragRef.current = null;

      const sel = selectionRef.current;
      if (selDrag.hasDragged && sel && (sel.end - sel.start > 0.05)) {
        // Deselect active label to prioritize selection loop
        onActiveLabelChange(null);
        const ws = wsRef.current;
        if (ws) {
          ws.setTime(sel.start);
          ws.play();
        }
      } else if (!selDrag.hasDragged) {
        // Clear selection on single click seek
        setSelection(null);
        if (ws) {
          ws.setTime(selDrag.start);
          updatePlayhead(selDrag.start);
        }
      }
      return;
    }

    // 3. Normal label drag complete
    const drag = draggingRef.current;
    if (drag) {
      if (drag.currentStart !== undefined && drag.currentEnd !== undefined && 
          (drag.currentStart !== drag.labelStart || drag.currentEnd !== drag.labelEnd)) {
        const updated = labelsRef.current.map((l) => {
          if (l.id === drag.labelId) {
            return { ...l, start: drag.currentStart, end: drag.currentEnd };
          }
          return l;
        });
        onLabelsChange(updated);
      }
      draggingRef.current = null;
    }
  }, [onLabelsChange, onActiveLabelChange]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const playLabel = (label) => {
    const ws = wsRef.current;
    if (!ws) return;
    onActiveLabelChange(label.id);
    ws.play(label.start, label.end);
  };

  const handleLabelMoveStart = (e, labelId) => {
    if (e.target.classList.contains('label-handle')) return;
    const regionEl = e.currentTarget;
    const label = labels.find((l) => l.id === labelId);
    if (!label || !regionEl) return;

    draggingRef.current = {
      labelId,
      edge: 'move',
      startX: e.clientX,
      labelStart: label.start,
      labelEnd: label.end,
      regionEl,
      currentStart: label.start,
      currentEnd: label.end,
    };
    onActiveLabelChange(labelId);
  };

  const handleRulerClick = (e) => {
    const ws = wsRef.current;
    if (!ws || !duration) return;
    const targetTime = getTimestampFromEvent(e);
    ws.setTime(targetTime);
    updatePlayhead(targetTime);
    setSelection(null); // Clear selection on clicking the ruler
  };

  const handleWaveformMouseDown = (e) => {
    // Ignore if click is on selection overlay or handles
    if (e.target.closest('.waveform-selection-overlay')) return;

    const ws = wsRef.current;
    if (!ws || !duration) return;

    const targetTime = getTimestampFromEvent(e);
    selectionDragRef.current = { start: targetTime, hasDragged: false };
  };

  const ticks = [];
  if (duration > 0 && isFinite(duration)) {
    let interval = 1;
    if (pxPerSec < 20) interval = 60;
    else if (pxPerSec < 50) interval = 30;
    else if (pxPerSec < 100) interval = 10;
    else if (pxPerSec < 200) interval = 5;

    for (let t = 0; t <= duration; t += interval) {
      ticks.push({ time: t, x: timeToX(t) });
    }
  }

  const getCurrentTime = () => {
    try {
      return wsRef.current ? wsRef.current.getCurrentTime() : 0;
    } catch {
      return 0;
    }
  };
  const activeTime = getCurrentTime();

  if (!audioUrl) {
    return (
      <div className="waveform-placeholder">
        Upload an audio file to see the waveform
      </div>
    );
  }

  return (
    <div className="waveform-container" ref={rootRef}>
      <div
        className="timeline-ruler"
        ref={rulerRef}
        onScroll={syncScroll}
        style={{ overflowX: 'hidden' }}
      >
        <div
          className="timeline-ruler-inner"
          style={{ width: totalWidth }}
          onClick={handleRulerClick}
        >
          {ticks.map((tick) => (
            <div
              key={tick.time}
              className="timeline-tick"
              style={{ left: tick.x }}
            >
              {formatTime(tick.time)}
            </div>
          ))}
          <div
            className="playhead-line"
            ref={rulerPlayheadRef}
            style={{ left: timeToX(activeTime) }}
          />
        </div>
      </div>

      <div
        className="waveform-scroll"
        ref={scrollRef}
        onScroll={syncScroll}
      >
        <div
          className="waveform-inner"
          style={{ width: totalWidth, position: 'relative' }}
          onMouseDown={handleWaveformMouseDown}
        >
          <div ref={containerRef} className="waveform-canvas" />
          {selection && (
            <div
              className="waveform-selection-overlay"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: timeToX(selection.start),
                width: Math.max(4, timeToX(selection.end) - timeToX(selection.start)),
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                borderLeft: '2px dashed #ef4444',
                borderRight: '2px dashed #ef4444',
                zIndex: 10,
              }}
            >
              <div
                className="selection-handle left"
                onMouseDown={(e) => handleSelectionResizeStart(e, 'left')}
                style={{
                  position: 'absolute',
                  left: -5,
                  top: 0,
                  bottom: 0,
                  width: 10,
                  cursor: 'ew-resize',
                }}
              />
              <div
                className="selection-handle right"
                onMouseDown={(e) => handleSelectionResizeStart(e, 'right')}
                style={{
                  position: 'absolute',
                  right: -5,
                  top: 0,
                  bottom: 0,
                  width: 10,
                  cursor: 'ew-resize',
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div
        className="labels-track"
        ref={labelsTrackRef}
        onScroll={syncScroll}
        style={{ overflowX: 'hidden' }}
      >
        <div className="labels-track-inner" style={{ width: totalWidth }}>
          {labels
            .filter((label) => label.end >= visibleRange.start && label.start <= visibleRange.end)
            .map((label) => {
            const left = timeToX(label.start);
            const width = Math.max(4, timeToX(label.end) - left);
            const isActive = label.id === activeLabelId;

            return (
              <div
                key={label.id}
                className={`label-region ${isActive ? 'active' : ''}`}
                style={{ left, width }}
                onMouseDown={(e) => handleLabelMoveStart(e, label.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  playLabel(label);
                }}
                title={`${label.text} (${formatTime(label.start)} – ${formatTime(label.end)})`}
              >
                <div
                  className="label-handle left"
                  onMouseDown={(e) => handleLabelMouseDown(e, label.id, 'left')}
                />
                <span className="label-region-text">{label.text}</span>
                <div
                  className="label-handle right"
                  onMouseDown={(e) => handleLabelMouseDown(e, label.id, 'right')}
                />
              </div>
            );
          })}
          <div
            className="playhead-line"
            ref={trackPlayheadRef}
            style={{ left: timeToX(activeTime), height: '100%' }}
          />
        </div>
      </div>
      {suggestionMode && (
        <div className={`suggestions-bar ${suggestions.length > 0 ? 'active' : ''}`}>
          <div className="suggestions-status">
            {activeWord ? (
              <>
                Suggestions for <span className="active-word-highlight">"{activeWord}"</span>:
              </>
            ) : (
              'Start typing (Hinglish keyboard)...'
            )}
          </div>
          <div className="suggestions-list">
            {suggestions.map((suggestion, index) => {
              const hotkeyDisplay = index === 9 ? 'Ctrl+0' : `Ctrl+${index + 1}`;
              return (
                <button
                  key={index}
                  className="suggestion-item"
                  onClick={() => onSelectSuggestion(suggestion)}
                >
                  <span className="suggestion-text">{suggestion}</span>
                  <span className="suggestion-badge">{hotkeyDisplay}</span>
                </button>
              );
            })}
            {loadingSuggestions && (
              <span className="suggestions-loading">Fetching suggestions...</span>
            )}
            {activeWord && !loadingSuggestions && suggestions.length === 0 && (
              <span className="suggestions-loading">No suggestions found</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

