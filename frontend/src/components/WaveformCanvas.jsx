import { useEffect, useRef, useCallback, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { formatTime } from '../utils/helpers';
import './WaveformCanvas.css';

const BASE_PX_PER_SEC = 50;

export default function WaveformCanvas({
  audioUrl,
  labels,
  zoom,
  activeLabelId,
  onLabelsChange,
  onActiveLabelChange,
  onTimeUpdate,
  onDurationChange,
  onReady,
  wavesurferRef,
  isPlaying,
  setIsPlaying,
}) {
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const rulerRef = useRef(null);
  const labelsTrackRef = useRef(null);
  const wsRef = useRef(null);
  const draggingRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const pxPerSec = BASE_PX_PER_SEC * zoom;
  const totalWidth = Math.max(duration * pxPerSec, scrollRef.current?.clientWidth || 800);

  const syncScroll = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (rulerRef.current) {
      rulerRef.current.scrollLeft = scroll.scrollLeft;
    }
    if (labelsTrackRef.current) {
      labelsTrackRef.current.scrollLeft = scroll.scrollLeft;
    }
  }, []);

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
      onReady?.();
    });

    ws.on('audioprocess', (time) => {
      setCurrentTime(time);
      onTimeUpdate?.(time);
    });

    ws.on('seeking', (time) => {
      setCurrentTime(time);
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

  // Auto-scroll to playhead when playing
  useEffect(() => {
    if (!isPlaying || !scrollRef.current || !duration) return;
    const scroll = scrollRef.current;
    const playheadX = currentTime * pxPerSec;
    const viewLeft = scroll.scrollLeft;
    const viewRight = viewLeft + scroll.clientWidth;

    if (playheadX < viewLeft + 50 || playheadX > viewRight - 50) {
      scroll.scrollLeft = Math.max(0, playheadX - scroll.clientWidth / 3);
      syncScroll();
    }
  }, [currentTime, isPlaying, pxPerSec, duration, syncScroll]);

  const timeToX = (time) => time * pxPerSec;

  const xToTime = (x) => Math.max(0, Math.min(duration, x / pxPerSec));

  const handleLabelMouseDown = (e, labelId, edge) => {
    e.stopPropagation();
    e.preventDefault();
    draggingRef.current = { labelId, edge, startX: e.clientX };
    onActiveLabelChange(labelId);
  };

  const handleMouseMove = useCallback(
    (e) => {
      const drag = draggingRef.current;
      if (!drag || !labelsTrackRef.current) return;

      const rect = labelsTrackRef.current.getBoundingClientRect();
      const scrollLeft = labelsTrackRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const time = xToTime(x);

      const updated = labels.map((l) => {
        if (l.id !== drag.labelId) return l;
        if (drag.edge === 'left') {
          const newStart = Math.min(time, l.end - 0.01);
          return { ...l, start: Math.max(0, newStart) };
        }
        if (drag.edge === 'right') {
          const newEnd = Math.max(time, l.start + 0.01);
          return { ...l, end: Math.min(duration, newEnd) };
        }
        if (drag.edge === 'move') {
          const width = l.end - l.start;
          const newStart = Math.max(0, Math.min(duration - width, time - width / 2));
          return { ...l, start: newStart, end: newStart + width };
        }
        return l;
      });

      onLabelsChange(updated);
    },
    [labels, duration, pxPerSec, onLabelsChange]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

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
    draggingRef.current = { labelId, edge: 'move', startX: e.clientX };
    onActiveLabelChange(labelId);
  };

  // Generate timeline ticks
  const ticks = [];
  if (duration > 0) {
    let interval = 1;
    if (pxPerSec < 20) interval = 60;
    else if (pxPerSec < 50) interval = 30;
    else if (pxPerSec < 100) interval = 10;
    else if (pxPerSec < 200) interval = 5;

    for (let t = 0; t <= duration; t += interval) {
      ticks.push({ time: t, x: timeToX(t) });
    }
  }

  if (!audioUrl) {
    return (
      <div className="waveform-placeholder">
        Upload an audio file to see the waveform
      </div>
    );
  }

  return (
    <div className="waveform-container">
      <div
        className="timeline-ruler"
        ref={rulerRef}
        onScroll={syncScroll}
        style={{ overflowX: 'hidden' }}
      >
        <div className="timeline-ruler-inner" style={{ width: totalWidth }}>
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
            style={{ left: timeToX(currentTime) }}
          />
        </div>
      </div>

      <div
        className="waveform-scroll"
        ref={scrollRef}
        onScroll={syncScroll}
      >
        <div className="waveform-inner" style={{ width: totalWidth }}>
          <div ref={containerRef} className="waveform-canvas" />
        </div>
      </div>

      <div
        className="labels-track"
        ref={labelsTrackRef}
        onScroll={syncScroll}
        style={{ overflowX: 'hidden' }}
      >
        <div className="labels-track-inner" style={{ width: totalWidth }}>
          {labels.map((label) => {
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
            style={{ left: timeToX(currentTime), height: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
