import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Toolbar from './Toolbar';
import { formatTime } from '../utils/helpers';
import { detectDualTrackSegments, resolveOverlappingSegments, mergeDualTrackVADSegments } from '../utils/audioVAD';
import { saveSegmentation } from '../api/client';
import './SegmentationCanvas.css';

const BASE_PX_PER_SEC = 75;

export default function SegmentationCanvas({
  audio1Url,
  audio2Url,
  audio1Name,
  audio2Name,
  meta1Name,
  meta2Name,
  meta1Data,
  meta2Data,
  zoom = 1,
  playbackRate = 1.0,
  onZoomChange,
  onPlaybackRateChange,
}) {
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const rulerRef = useRef(null);

  const container1Ref = useRef(null);
  const container2Ref = useRef(null);

  const ws1Ref = useRef(null);
  const ws2Ref = useRef(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted1, setIsMuted1] = useState(false);
  const [isMuted2, setIsMuted2] = useState(false);
  const [isSolo1, setIsSolo1] = useState(false);
  const [isSolo2, setIsSolo2] = useState(false);
  const [pan1, setPan1] = useState(0);
  // Selection & Segment State
  const [selectionRange, setSelectionRange] = useState(null);
  const [segments, setSegments] = useState([]);
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [previousSegments, setPreviousSegments] = useState(null);

  // 10-Step Undo/Redo History Stack
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);

  // Push current segments snapshot into past history stack (Max 10 steps)
  const pushHistory = useCallback((currentSegs) => {
    const snapshot = JSON.parse(JSON.stringify(currentSegs));
    setHistoryPast((prev) => {
      const next = [...prev, snapshot];
      if (next.length > 10) {
        return next.slice(next.length - 10);
      }
      return next;
    });
    setHistoryFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    setHistoryPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const lastState = prevPast[prevPast.length - 1];
      const remainingPast = prevPast.slice(0, prevPast.length - 1);

      setSegments((currSegments) => {
        setHistoryFuture((prevFuture) => [
          ...prevFuture,
          JSON.parse(JSON.stringify(currSegments)),
        ]);
        return lastState;
      });

      return remainingPast;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const nextState = prevFuture[prevFuture.length - 1];
      const remainingFuture = prevFuture.slice(0, prevFuture.length - 1);

      setSegments((currSegments) => {
        setHistoryPast((prevPast) => {
          const nextPast = [...prevPast, JSON.parse(JSON.stringify(currSegments))];
          if (nextPast.length > 10) {
            return nextPast.slice(nextPast.length - 10);
          }
          return nextPast;
        });
        return nextState;
      });

      return remainingFuture;
    });
  }, []);

  const playheadRef = useRef(null);
  const updatePlayheadRef = useRef(null);
  const lastTimeUpdateRef = useRef(0);
  const pendingZoomRef = useRef(null);
  const targetZoomRef = useRef(zoom);
  const zoomDebounceTimer = useRef(null);
  const onZoomChangeRef = useRef(null);
  const isSyncingRef = useRef(false);

  const activeSegmentRef = useRef(null);
  useEffect(() => {
    activeSegmentRef.current = segments.find((s) => s.segment_id === activeSegmentId) || null;
  }, [activeSegmentId, segments]);

  const selectionRangeRef = useRef(null);
  useEffect(() => {
    selectionRangeRef.current = selectionRange;
  }, [selectionRange]);

  const draggingRef = useRef(null);
  const selectionDragRef = useRef(null);

  useEffect(() => {
    targetZoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  // Layout calculations
  const containerWidth = scrollRef.current?.clientWidth || 800;
  const basePxPerSec = duration > 0 && isFinite(duration) ? containerWidth / duration : BASE_PX_PER_SEC;
  const pxPerSec = basePxPerSec * zoom;
  const validDuration = isFinite(duration) && duration > 0 ? duration : 0;
  const totalWidth = Math.max(validDuration * pxPerSec, containerWidth);

  const [viewportBounds, setViewportBounds] = useState({ start: 0, end: 1000 });

  const updateViewportBounds = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const scrollLeft = scroll.scrollLeft;
    const clientWidth = scroll.clientWidth || 1000;
    // 800px buffer on each side for smooth virtualization without flickering
    const bufferPx = 800;
    const vStart = Math.max(0, (scrollLeft - bufferPx) / pxPerSec);
    const vEnd = (scrollLeft + clientWidth + bufferPx) / pxPerSec;
    setViewportBounds((prev) => {
      if (Math.abs(prev.start - vStart) > 0.5 || Math.abs(prev.end - vEnd) > 0.5) {
        return { start: vStart, end: vEnd };
      }
      return prev;
    });
  }, [pxPerSec]);

  const syncScroll = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (rulerRef.current) {
      rulerRef.current.scrollLeft = scroll.scrollLeft;
    }
    updateViewportBounds();
  }, [updateViewportBounds]);

  // Update playhead DOM position cleanly
  const updatePlayhead = useCallback(
    (time) => {
      const x = time * pxPerSec;
      if (playheadRef.current) {
        playheadRef.current.style.left = `${x}px`;
      }

      // Auto-scroll viewport if playhead moves near edge
      const scroll = scrollRef.current;
      if (scroll && duration) {
        const viewLeft = scroll.scrollLeft;
        const viewRight = viewLeft + scroll.clientWidth;
        if (x < viewLeft + 50 || x > viewRight - 50) {
          scroll.scrollLeft = Math.max(0, x - scroll.clientWidth / 3);
          syncScroll();
        }
      }
    },
    [pxPerSec, duration, syncScroll]
  );

  useEffect(() => {
    updatePlayheadRef.current = updatePlayhead;
  }, [updatePlayhead]);

  // Keep playhead updated on zoom changes
  useEffect(() => {
    updatePlayheadRef.current?.(currentTime);
  }, [currentTime, pxPerSec]);

  // Trackpad pinch-to-zoom & two-finger scroll listener
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();

        const delta = Math.max(-50, Math.min(50, e.deltaY));
        const factor = Math.pow(1.003, -delta);

        targetZoomRef.current = Math.max(1, Math.min(300, targetZoomRef.current * factor));

        if (!pendingZoomRef.current) {
          pendingZoomRef.current = requestAnimationFrame(() => {
            pendingZoomRef.current = null;
            onZoomChangeRef.current?.(targetZoomRef.current);
          });
        }
      } else {
        e.preventDefault();
        const scroll = scrollRef.current;
        if (!scroll) return;

        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          scroll.scrollLeft += e.deltaX * 0.8;
        } else {
          scroll.scrollLeft += e.deltaY * 0.8;
        }
        syncScroll();
      }
    };

    rootEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      rootEl.removeEventListener('wheel', handleWheel);
      if (pendingZoomRef.current) {
        cancelAnimationFrame(pendingZoomRef.current);
      }
    };
  }, [syncScroll]);

  // Init Track 1 (Speaker 1)
  useEffect(() => {
    if (!audio1Url || !container1Ref.current) return;

    const ws1 = WaveSurfer.create({
      container: container1Ref.current,
      waveColor: '#38bdf8',
      progressColor: '#0284c7',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 160,
      normalize: true,
      minPxPerSec: pxPerSec,
      fillParent: false,
      interact: false, // Handle interaction customly for dual-waveform selection
      hideScrollbar: true,
    });

    ws1Ref.current = ws1;
    ws1.load(audio1Url);

    ws1.on('ready', () => {
      const dur = ws1.getDuration();
      setDuration((prev) => Math.max(prev, dur));
      ws1.zoom(pxPerSec);
    });

    const getClampedTime = (time) => {
      const selRange = selectionRangeRef.current;
      const activeSeg = activeSegmentRef.current;
      if (selRange && selRange.end - selRange.start > 0.1) {
        return Math.min(time, selRange.end);
      }
      if (activeSeg) {
        return Math.min(time, activeSeg.end);
      }
      return time;
    };

    ws1.on('audioprocess', (time) => {
      const selRange = selectionRangeRef.current;
      const activeSeg = activeSegmentRef.current;

      // Priority 1: Draft Selection active -> Loop draft selection with 60ms predictive buffer
      if (selRange && selRange.end - selRange.start > 0.1) {
        if (time >= selRange.end - 0.06) {
          ws1.setTime(selRange.start);
          if (ws2Ref.current) ws2Ref.current.setTime(selRange.start);
          updatePlayheadRef.current?.(selRange.start);
          setCurrentTime(selRange.start);
          return;
        }
      } else if (activeSeg) {
        // Priority 2: Enforce active segment playback boundaries with 60ms predictive buffer
        if (time >= activeSeg.end - 0.06) {
          ws1.pause();
          if (ws2Ref.current) ws2Ref.current.pause();
          ws1.setTime(activeSeg.start);
          if (ws2Ref.current) ws2Ref.current.setTime(activeSeg.start);
          updatePlayheadRef.current?.(activeSeg.start);
          setCurrentTime(activeSeg.start);
          setIsPlaying(false);
          return;
        }
      }

      const clampedTime = getClampedTime(time);
      updatePlayheadRef.current?.(clampedTime);

      if (ws2Ref.current && Math.abs(ws2Ref.current.getCurrentTime() - time) > 0.3) {
        ws2Ref.current.setTime(time);
      }
      const now = Date.now();
      if (now - lastTimeUpdateRef.current > 100) {
        lastTimeUpdateRef.current = now;
        setCurrentTime(clampedTime);
      }
    });

    ws1.on('timeupdate', (time) => {
      const clampedTime = getClampedTime(time);
      updatePlayheadRef.current?.(clampedTime);
    });

    ws1.on('seeking', (time) => {
      updatePlayheadRef.current?.(time);
      setCurrentTime(time);
      if (!isSyncingRef.current && ws2Ref.current) {
        isSyncingRef.current = true;
        ws2Ref.current.setTime(time);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 50);
      }
    });

    ws1.on('play', () => {
      setIsPlaying(true);
      if (ws2Ref.current && !ws2Ref.current.isPlaying()) {
        ws2Ref.current.play();
      }
    });

    ws1.on('pause', () => {
      setIsPlaying(false);
      if (ws2Ref.current && ws2Ref.current.isPlaying()) {
        ws2Ref.current.pause();
      }
    });

    return () => {
      ws1.destroy();
      ws1Ref.current = null;
    };
  }, [audio1Url]);

  // Init Track 2 (Speaker 2)
  useEffect(() => {
    if (!audio2Url || !container2Ref.current) return;

    const ws2 = WaveSurfer.create({
      container: container2Ref.current,
      waveColor: '#c084fc',
      progressColor: '#7c3aed',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 160,
      normalize: true,
      minPxPerSec: pxPerSec,
      fillParent: false,
      interact: false,
      hideScrollbar: true,
    });

    ws2Ref.current = ws2;
    ws2.load(audio2Url);

    ws2.on('ready', () => {
      const dur = ws2.getDuration();
      setDuration((prev) => Math.max(prev, dur));
      ws2.zoom(pxPerSec);
    });

    ws2.on('audioprocess', (time) => {
      const selRange = selectionRangeRef.current;
      const activeSeg = activeSegmentRef.current;

      if (selRange && selRange.end - selRange.start > 0.1) {
        if (time >= selRange.end - 0.06) {
          ws2.setTime(selRange.start);
          if (ws1Ref.current) ws1Ref.current.setTime(selRange.start);
          updatePlayheadRef.current?.(selRange.start);
          setCurrentTime(selRange.start);
          return;
        }
      } else if (activeSeg) {
        if (time >= activeSeg.end - 0.06) {
          ws2.pause();
          if (ws1Ref.current) ws1Ref.current.pause();
          ws2.setTime(activeSeg.start);
          if (ws1Ref.current) ws1Ref.current.setTime(activeSeg.start);
          updatePlayheadRef.current?.(activeSeg.start);
          setCurrentTime(activeSeg.start);
          setIsPlaying(false);
          return;
        }
      }

      let clampedTime = time;
      if (selRange && selRange.end - selRange.start > 0.1) {
        clampedTime = Math.min(time, selRange.end);
      } else if (activeSeg) {
        clampedTime = Math.min(time, activeSeg.end);
      }
      updatePlayheadRef.current?.(clampedTime);
    });

    ws2.on('timeupdate', (time) => {
      const selRange = selectionRangeRef.current;
      const activeSeg = activeSegmentRef.current;
      let clampedTime = time;
      if (selRange && selRange.end - selRange.start > 0.1) {
        clampedTime = Math.min(time, selRange.end);
      } else if (activeSeg) {
        clampedTime = Math.min(time, activeSeg.end);
      }
      updatePlayheadRef.current?.(clampedTime);
    });

    ws2.on('seeking', (time) => {
      updatePlayheadRef.current?.(time);
      setCurrentTime(time);
      if (!isSyncingRef.current && ws1Ref.current) {
        isSyncingRef.current = true;
        ws1Ref.current.setTime(time);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 50);
      }
    });

    return () => {
      ws2.destroy();
      ws2Ref.current = null;
    };
  }, [audio2Url]);

  // Debounced Zoom Update
  useEffect(() => {
    if (zoomDebounceTimer.current) clearTimeout(zoomDebounceTimer.current);

    zoomDebounceTimer.current = setTimeout(() => {
      zoomDebounceTimer.current = null;
      if (ws1Ref.current) ws1Ref.current.zoom(pxPerSec);
      if (ws2Ref.current) ws2Ref.current.zoom(pxPerSec);
    }, 100);

    return () => {
      if (zoomDebounceTimer.current) clearTimeout(zoomDebounceTimer.current);
    };
  }, [zoom, duration, pxPerSec]);

  // Sync playback rates
  useEffect(() => {
    if (ws1Ref.current) ws1Ref.current.setPlaybackRate(playbackRate);
    if (ws2Ref.current) ws2Ref.current.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  // Synchronized Play/Pause
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      ws1Ref.current?.pause();
      ws2Ref.current?.pause();
    } else {
      ws1Ref.current?.play();
      ws2Ref.current?.play();
    }
  }, [isPlaying]);

  // Synchronized Stop
  const handleStop = useCallback(() => {
    ws1Ref.current?.stop();
    ws2Ref.current?.stop();
    setIsPlaying(false);
    setCurrentTime(0);
    updatePlayheadRef.current?.(0);
  }, []);

  // Mute / Unmute Track Handlers
  const handleToggleMute1 = useCallback(() => {
    setIsMuted1((prev) => {
      const next = !prev;
      ws1Ref.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleMute2 = useCallback(() => {
    setIsMuted2((prev) => {
      const next = !prev;
      ws2Ref.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleSolo1 = useCallback(() => {
    setIsSolo1((prev) => {
      const nextSolo = !prev;
      if (nextSolo) {
        setIsSolo2(false);
        setIsMuted1(false);
        setIsMuted2(true);
        ws1Ref.current?.setMuted(false);
        ws2Ref.current?.setMuted(true);
      } else {
        setIsMuted1(false);
        setIsMuted2(false);
        ws1Ref.current?.setMuted(false);
        ws2Ref.current?.setMuted(false);
      }
      return nextSolo;
    });
  }, []);

  const handleToggleSolo2 = useCallback(() => {
    setIsSolo2((prev) => {
      const nextSolo = !prev;
      if (nextSolo) {
        setIsSolo1(false);
        setIsMuted2(false);
        setIsMuted1(true);
        ws2Ref.current?.setMuted(false);
        ws1Ref.current?.setMuted(true);
      } else {
        setIsMuted1(false);
        setIsMuted2(false);
        ws1Ref.current?.setMuted(false);
        ws2Ref.current?.setMuted(false);
      }
      return nextSolo;
    });
  }, []);

  // Extract call_id dynamically from uploaded CSV / JSON metadata object or filename base
  const getCallId = useCallback(() => {
    const extractFromText = (text) => {
      if (!text || typeof text !== 'string') return null;
      // Match explicit call_id pattern e.g. call_id,aac512d3... or "call_id": "aac512d3..."
      const match = text.match(/(?:call_id|callid|call_name|callId)["']?\s*[:=,]\s*["']?([a-zA-Z0-9_-]{8,})/i);
      if (match && match[1]) {
        return match[1].trim();
      }
      // Match UUID pattern (e.g. aac512d3-5af2-4066-a5b5-ccba4539c718)
      const uuidMatch = text.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (uuidMatch && uuidMatch[1]) {
        return uuidMatch[1].trim();
      }
      return null;
    };

    const extractFromObj = (obj) => {
      if (!obj) return null;

      if (Array.isArray(obj)) {
        for (const item of obj) {
          const res = extractFromObj(item);
          if (res) return res;
        }
        return null;
      }

      if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        for (const k of keys) {
          if (k === '_raw') continue;
          const lower = k.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (
            lower === 'call_id' ||
            lower === 'callid' ||
            lower === 'call_name' ||
            lower === 'callname'
          ) {
            if (obj[k]) return String(obj[k]).trim();
          }
        }
        for (const k of keys) {
          if (k === '_raw') continue;
          const lower = k.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (lower === 'id' || lower === 'call') {
            if (obj[k]) return String(obj[k]).trim();
          }
        }
        if (obj.metadata) {
          const res = extractFromObj(obj.metadata);
          if (res) return res;
        }
        if (obj._raw) {
          const res = extractFromText(obj._raw);
          if (res) return res;
        }
      }

      if (typeof obj === 'string') {
        return extractFromText(obj);
      }

      return null;
    };

    const idFrom1 = extractFromObj(meta1Data);
    if (idFrom1) return idFrom1;

    const idFrom2 = extractFromObj(meta2Data);
    if (idFrom2) return idFrom2;

    // Check audio/meta filenames for embedded UUID if present (e.g. spk_old_02-aac512d3-5af2-4066-a5b5-ccba4539c718.wav -> aac512d3-5af2-4066-a5b5-ccba4539c718)
    const checkNameForUUID = (name) => {
      if (!name) return null;
      const uuidMatch = name.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      return uuidMatch ? uuidMatch[1] : null;
    };

    const uuid1 = checkNameForUUID(audio1Name) || checkNameForUUID(meta1Name) || checkNameForUUID(audio2Name) || checkNameForUUID(meta2Name);
    if (uuid1) return uuid1;

    if (meta1Name) return meta1Name.replace(/\.[^/.]+$/, '');
    if (meta2Name) return meta2Name.replace(/\.[^/.]+$/, '');
    if (audio1Name) return audio1Name.replace(/\.[^/.]+$/, '');
    if (audio2Name) return audio2Name.replace(/\.[^/.]+$/, '');
    return 'call001';
  }, [meta1Data, meta2Data, meta1Name, meta2Name, audio1Name, audio2Name]);

  // Zoom Button Handlers
  const handleZoomIn = useCallback(() => onZoomChange?.(Math.min(300, zoom * 1.5)), [onZoomChange, zoom]);
  const handleZoomOut = useCallback(() => onZoomChange?.(Math.max(1, zoom / 1.5)), [onZoomChange, zoom]);
  const handleFit = useCallback(() => onZoomChange?.(1), [onZoomChange]);

  // Create Segment from active selection (Schema: callid_segmentid starting from 1)
  const handleAddSegmentFromSelection = useCallback(() => {
    let start = currentTime;
    let end = Math.min(duration, start + 5.0);

    if (selectionRange) {
      start = Number(selectionRange.start.toFixed(3));
      const rawEnd = Number(selectionRange.end.toFixed(3));
      end = Math.min(rawEnd, start + 30.000); // Strict hardcap at 30.000s max
    }

    const calcDur = Number((end - start).toFixed(3));
    const finalDur = Math.min(30.000, calcDur);
    const finalEnd = Number((start + finalDur).toFixed(3));

    // Overlap Resolution Rule: Keep the bigger segment, delete the smaller segment!
    const overlappingSegs = segments.filter((s) => start < s.end && finalEnd > s.start);

    if (overlappingSegs.length > 0) {
      const isNewBigger = overlappingSegs.every((s) => finalDur > (s.end - s.start));

      if (isNewBigger) {
        // Proposed segment is bigger: Delete smaller overlapping existing segments!
        pushHistory(segments);
        const nonOverlapping = segments.filter((s) => !(start < s.end && finalEnd > s.start));
        const callId = getCallId();
        const segNumber = nonOverlapping.length + 1;
        const segment_id = `${callId}_${segNumber}`;
        const newSeg = {
          segment_id,
          speaker: 'SPEAKER_01',
          start,
          end: finalEnd,
          duration: finalDur,
          has_overlap: false,
        };
        const resolved = resolveOverlappingSegments([...nonOverlapping, newSeg]);
        setSegments(resolved);
        setActiveSegmentId(segment_id);
        setSelectionRange(null);
        return;
      } else {
        // Existing segment is bigger: Keep existing segment
        alert(
          `Overlap Resolution: Keeping the bigger existing segment (${(overlappingSegs[0].end - overlappingSegs[0].start).toFixed(2)}s vs proposed ${finalDur}s).`
        );
        return;
      }
    }

    const callId = getCallId();
    const segNumber = segments.length + 1;
    const segment_id = `${callId}_${segNumber}`;

    const newSeg = {
      segment_id,
      speaker: 'SPEAKER_01',
      start,
      end: finalEnd,
      duration: finalDur,
      has_overlap: false,
    };

    pushHistory(segments);
    setSegments((prev) => resolveOverlappingSegments([...prev, newSeg]));
    setActiveSegmentId(segment_id);
    setSelectionRange(null); // Clear selection box after segment is created
  }, [selectionRange, currentTime, duration, segments, pushHistory, getCallId]);

  // Delete segment
  const handleDeleteSegment = useCallback((id) => {
    pushHistory(segments);
    setSegments((prev) => prev.filter((s) => s.segment_id !== id));
    setActiveSegmentId((curr) => (curr === id ? null : curr));
  }, [segments, pushHistory]);

  const [showAutoDetectModal, setShowAutoDetectModal] = useState(false);

  // Smart Merge Dual-Track VAD Segments (Merges overlapping Speaker 1 and Speaker 2 VAD segments)
  const handleMergeVADTracks = useCallback(() => {
    if (segments.length === 0) return;
    pushHistory(segments);
    const callId = getCallId();
    const merged = mergeDualTrackVADSegments(segments, callId);
    setSegments(merged);
    if (merged.length > 0) {
      setActiveSegmentId(merged[0].segment_id);
    }
  }, [segments, pushHistory, getCallId]);

  const [isSaving, setIsSaving] = useState(false);

  // Finish & Save Handler: Converts segments into millisecond precision format (start_ms, end_ms),
  // downloads local JSON file, and saves to S3 server storage.
  const handleFinishAndSave = useCallback(async () => {
    if (segments.length === 0) {
      alert('No segments available to save.');
      return;
    }

    setIsSaving(true);
    try {
      const callId = getCallId();

      // Format segments into millisecond precision schema (without speaker field)
      const formattedSegments = segments.map((s, index) => {
        const start_ms = Math.round((s.start || 0) * 1000);
        const end_ms = Math.round((s.end || 0) * 1000);
        const duration_ms = Math.max(0, end_ms - start_ms);

        return {
          segment_id: `${callId}_${index + 1}`,
          start_ms,
          end_ms,
          duration_ms,
          start_formatted: formatTime(s.start || 0),
          end_formatted: formatTime(s.end || 0),
        };
      });

      const payload = {
        call_id: callId,
        audio1Name,
        audio2Name,
        total_segments: formattedSegments.length,
        created_at: new Date().toISOString(),
        segments: formattedSegments,
      };

      // 1. Download JSON file locally for user
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${callId}_segmentation_labels.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 2. Persist payload to S3 / Backend server storage endpoint
      const response = await saveSegmentation(payload);

      alert(
        `✓ Success! Saved ${formattedSegments.length} segments to S3 server storage.\n\n` +
        `S3 Storage Key:\n${response.s3_key || `s3://voclara-labels-bucket/segmentations/${callId}_segmentation_labels.json`}`
      );
    } catch (err) {
      console.error('Error saving segmentation to S3 server:', err);
      alert(`Downloaded JSON file locally!`);
    } finally {
      setIsSaving(false);
    }
  }, [segments, audio1Name, audio2Name, getCallId]);

  // Execute VAD auto-detection, wiping previous work and clearing undo history
  const executeAutoDetect = useCallback(() => {
    setIsDetecting(true);

    setTimeout(() => {
      try {
        const callId = getCallId();
        const autoSegs = detectDualTrackSegments(
          ws1Ref.current,
          ws2Ref.current,
          callId,
          { maxSegmentDuration: 30.0 }
        );

        if (autoSegs.length > 0) {
          setSegments(autoSegs);
          setActiveSegmentId(autoSegs[0].segment_id);
          // Clear history stack so auto-detection wipes previous work and is non-undoable
          setHistoryPast([]);
          setHistoryFuture([]);
        } else {
          alert('No speech segments detected with current thresholds.');
        }
      } catch (err) {
        console.error('Error auto-detecting segments:', err);
      } finally {
        setIsDetecting(false);
      }
    }, 50);
  }, [getCallId]);

  // Auto-Detect Combined Speech Segments across both audio tracks
  const handleAutoDetectSegments = useCallback(() => {
    if (!ws1Ref.current && !ws2Ref.current) return;

    if (segments.length > 0) {
      setShowAutoDetectModal(true);
    } else {
      executeAutoDetect();
    }
  }, [segments.length, executeAutoDetect]);

  // Keyboard Shortcuts from CONTROLS.md: Spacebar, Left/Right 3s Seek, Up/Down Speed, +/- Zoom, S to Add Segment, Ctrl+Z Undo, Ctrl+Y Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
        handlePlayPause();
      } else if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (selectionRange || duration > 0) {
          handleAddSegmentFromSelection();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const newTime = Math.min(duration, currentTime + 3);
        if (ws1Ref.current) ws1Ref.current.setTime(newTime);
        if (ws2Ref.current) ws2Ref.current.setTime(newTime);
        setCurrentTime(newTime);
        updatePlayheadRef.current?.(newTime);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const newTime = Math.max(0, currentTime - 3);
        if (ws1Ref.current) ws1Ref.current.setTime(newTime);
        if (ws2Ref.current) ws2Ref.current.setTime(newTime);
        setCurrentTime(newTime);
        updatePlayheadRef.current?.(newTime);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        onPlaybackRateChange?.(Math.min(3.0, Number((playbackRate + 0.25).toFixed(2))));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        onPlaybackRateChange?.(Math.max(0.5, Number((playbackRate - 0.25).toFixed(2))));
      } else if ((e.code === 'Delete' || e.code === 'Backspace' || e.key === 'Delete') && activeSegmentId) {
        e.preventDefault();
        handleDeleteSegment(activeSegmentId);
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePlayPause,
    handleZoomIn,
    handleZoomOut,
    currentTime,
    duration,
    playbackRate,
    onPlaybackRateChange,
    selectionRange,
    handleAddSegmentFromSelection,
    activeSegmentId,
    handleDeleteSegment,
    handleUndo,
    handleRedo,
  ]);

  // Waveform Click-and-Drag Selection Handler
  const handleCanvasMouseDown = (e) => {
    // If click originated on a segment region or handle, ignore selection drag!
    if (
      e.target.closest('.seg-combined-region') ||
      e.target.closest('.seg-handle') ||
      e.target.closest('.seg-sel-handle') ||
      e.target.closest('.seg-del-btn') ||
      e.target.closest('.seg-speaker-select') ||
      e.target.closest('.seg-mute-btn') ||
      e.target.closest('.seg-track-header')
    ) {
      return;
    }

    const canvasInner = e.currentTarget;
    const rect = canvasInner.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const startTime = Math.max(0, Math.min(duration, clickX / pxPerSec));

    selectionDragRef.current = {
      startX: clickX,
      startTime,
      hasMoved: false,
    };

    const handleMouseMove = (moveEvent) => {
      if (!selectionDragRef.current) return;
      const currentX = moveEvent.clientX - rect.left;
      const currentTimeVal = Math.max(0, Math.min(duration, currentX / pxPerSec));

      if (Math.abs(currentX - selectionDragRef.current.startX) > 4) {
        selectionDragRef.current.hasMoved = true;
        let rawStart = Math.min(selectionDragRef.current.startTime, currentTimeVal);
        let rawEnd = Math.max(selectionDragRef.current.startTime, currentTimeVal);

        // Enforce strict 30.000s max selection drag box
        if (rawEnd - rawStart > 30.000) {
          if (currentTimeVal > selectionDragRef.current.startTime) {
            rawEnd = rawStart + 30.000;
          } else {
            rawStart = rawEnd - 30.000;
          }
        }
        setSelectionRange({ start: rawStart, end: rawEnd });
      }
    };

    const handleMouseUp = () => {
      if (selectionDragRef.current) {
        if (!selectionDragRef.current.hasMoved) {
          // Simple click -> Seek playhead
          const seekTime = selectionDragRef.current.startTime;
          if (ws1Ref.current) ws1Ref.current.setTime(seekTime);
          if (ws2Ref.current) ws2Ref.current.setTime(seekTime);
          setCurrentTime(seekTime);
          updatePlayheadRef.current?.(seekTime);
          setSelectionRange(null); // Clear selection on simple click
        } else if (selectionRangeRef.current) {
          // Draft selection created -> Auto-play in a loop!
          const startT = selectionRangeRef.current.start;
          if (ws1Ref.current) ws1Ref.current.setTime(startT);
          if (ws2Ref.current) ws2Ref.current.setTime(startT);
          updatePlayheadRef.current?.(startT);
          setCurrentTime(startT);
          ws1Ref.current?.play();
          ws2Ref.current?.play();
          setIsPlaying(true);
        }
      }
      selectionDragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Update speaker attribution
  const handleUpdateSpeaker = (id, speaker) => {
    setSegments((prev) =>
      prev.map((s) => (s.segment_id === id ? { ...s, speaker } : s))
    );
  };

  // Dragging DRAFT SELECTION handles (Adjusting selection box before adding segment)
  const handleSelectionHandleMouseDown = (e, handleType) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectionRange) return;

    const startX = e.clientX;
    const initialStart = selectionRange.start;
    const initialEnd = selectionRange.end;

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / pxPerSec;

      if (handleType === 'left') {
        // Dragging front selection edge (start)
        const minStart = Math.max(0, initialEnd - 30.000);
        const maxStart = initialEnd - 0.2;
        const newStart = Number(
          Math.max(minStart, Math.min(maxStart, initialStart + deltaTime)).toFixed(3)
        );
        setSelectionRange({ start: newStart, end: initialEnd });
      } else if (handleType === 'right') {
        // Dragging back selection edge (end)
        const minEnd = initialStart + 0.2;
        const maxEnd = Math.min(duration, initialStart + 30.000);
        const newEnd = Number(
          Math.max(minEnd, Math.min(maxEnd, initialEnd + deltaTime)).toFixed(3)
        );
        setSelectionRange({ start: initialStart, end: newEnd });
      }
    };

    const handleMouseUp = (upEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Dragging CREATED SEGMENT handles (Front / Start & Back / End edges)
  const handleSegmentMouseDown = (e, segmentId, handleType) => {
    e.stopPropagation();
    e.preventDefault();
    const targetSeg = segments.find((s) => s.segment_id === segmentId);
    if (!targetSeg) return;

    const initialSegmentsSnapshot = JSON.parse(JSON.stringify(segments));

    // Find neighboring segment boundaries to prevent overlap
    const otherSegs = segments.filter((s) => s.segment_id !== segmentId);
    const prevSeg = otherSegs.filter((s) => s.end <= targetSeg.start).sort((a, b) => b.end - a.end)[0];
    const nextSeg = otherSegs.filter((s) => s.start >= targetSeg.end).sort((a, b) => a.start - b.start)[0];

    const prevBound = prevSeg ? prevSeg.end : 0;
    const nextBound = nextSeg ? nextSeg.start : duration;

    const startX = e.clientX;
    const initialStart = targetSeg.start;
    const initialEnd = targetSeg.end;
    let hasMoved = false;

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaX) > 2) hasMoved = true;
      const deltaTime = deltaX / pxPerSec;

      setSegments((prev) =>
        prev.map((s) => {
          if (s.segment_id !== segmentId) return s;
          if (handleType === 'left') {
            // Front edge drag (Adjust start): cannot overlap prevSeg, cap at 30s max
            const minStart = Math.max(prevBound, initialEnd - 30.000);
            const maxStart = initialEnd - 0.1;
            let newStart = Number(
              Math.max(minStart, Math.min(maxStart, initialStart + deltaTime)).toFixed(3)
            );
            if (initialEnd - newStart > 30.000) {
              newStart = Number((initialEnd - 30.000).toFixed(3));
            }
            const newDur = Number((initialEnd - newStart).toFixed(3));
            return { ...s, start: newStart, duration: Math.min(30.000, newDur) };
          } else if (handleType === 'right') {
            // Back edge drag (Adjust end): cannot overlap nextSeg, cap at 30s max
            const minEnd = initialStart + 0.1;
            const maxEnd = Math.min(nextBound, initialStart + 30.000);
            let newEnd = Number(
              Math.max(minEnd, Math.min(maxEnd, initialEnd + deltaTime)).toFixed(3)
            );
            if (newEnd - initialStart > 30.000) {
              newEnd = Number((initialStart + 30.000).toFixed(3));
            }
            const newDur = Number((newEnd - initialStart).toFixed(3));
            return { ...s, end: newEnd, duration: Math.min(30.000, newDur) };
          }
          return s;
        })
      );
    };

    const handleMouseUp = (upEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();
      if (hasMoved) {
        pushHistory(initialSegmentsSnapshot);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Dragging ENTIRE CREATED SEGMENT BODY (Moving segment in time cleanly without overlap)
  const handleSegmentBodyMouseDown = (e, segmentId) => {
    if (
      e.target.closest('.seg-handle') ||
      e.target.closest('.seg-del-btn') ||
      e.target.closest('.seg-speaker-select')
    ) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    setActiveSegmentId(segmentId);

    const targetSeg = segments.find((s) => s.segment_id === segmentId);
    if (!targetSeg) return;

    const initialSegmentsSnapshot = JSON.parse(JSON.stringify(segments));

    const otherSegs = segments.filter((s) => s.segment_id !== segmentId);
    const prevSeg = otherSegs.filter((s) => s.end <= targetSeg.start).sort((a, b) => b.end - a.end)[0];
    const nextSeg = otherSegs.filter((s) => s.start >= targetSeg.end).sort((a, b) => a.start - b.start)[0];

    const prevBound = prevSeg ? prevSeg.end : 0;
    const nextBound = nextSeg ? nextSeg.start : duration;

    const startX = e.clientX;
    const initialStart = targetSeg.start;
    const initialEnd = targetSeg.end;
    const segDuration = initialEnd - initialStart;

    let hasMoved = false;

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaX) > 3) hasMoved = true;
      const deltaTime = deltaX / pxPerSec;

      const minStart = prevBound;
      const maxStart = Math.max(minStart, nextBound - segDuration);
      const newStart = Number(
        Math.max(minStart, Math.min(maxStart, initialStart + deltaTime)).toFixed(3)
      );
      const newEnd = Number((newStart + segDuration).toFixed(3));

      setSegments((prev) =>
        prev.map((s) => (s.segment_id === segmentId ? { ...s, start: newStart, end: newEnd } : s))
      );
    };

    const handleMouseUp = (upEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();
      if (hasMoved) {
        pushHistory(initialSegmentsSnapshot);
      } else {
        // Simple click -> Play segment
        if (ws1Ref.current) ws1Ref.current.setTime(targetSeg.start);
        if (ws2Ref.current) ws2Ref.current.setTime(targetSeg.start);
        updatePlayheadRef.current?.(targetSeg.start);
        setCurrentTime(targetSeg.start);
        ws1Ref.current?.play();
        ws2Ref.current?.play();
        setIsPlaying(true);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Timeline ticks
  const ticks = [];
  if (validDuration > 0) {
    let interval = 1;
    if (pxPerSec < 15) interval = 30;
    else if (pxPerSec < 40) interval = 10;
    else if (pxPerSec < 100) interval = 5;
    else if (pxPerSec < 300) interval = 2;

    for (let t = 0; t <= validDuration; t += interval) {
      ticks.push(t);
    }
  }

  const selectionDurSec = selectionRange
    ? Number((selectionRange.end - selectionRange.start).toFixed(2))
    : 0;

  return (
    <div className="segmentation-workspace" ref={rootRef}>
      {/* Full Control Bar with + Add Segment right next to Speed */}
      <Toolbar
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        zoom={zoom}
        playbackRate={playbackRate}
        onPlaybackRateChange={onPlaybackRateChange}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onZoomChange={onZoomChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onAddSegment={handleAddSegmentFromSelection}
        hasSelection={!!selectionRange || duration > 0}
        selectionDuration={selectionDurSec}
        onDeleteSegment={() => activeSegmentId && handleDeleteSegment(activeSegmentId)}
        hasActiveSegment={!!activeSegmentId}
        onAutoDetectSegments={handleAutoDetectSegments}
        isDetecting={isDetecting}
        onMergeVAD={handleMergeVADTracks}
        onFinishAndSave={handleFinishAndSave}
        isSaving={isSaving}
        onUndo={handleUndo}
        canUndo={historyPast.length > 0}
        onRedo={handleRedo}
        canRedo={historyFuture.length > 0}
      />

      {/* Minimal Audacity-Style Track Control Panel (TCP) */}
      <div className="seg-workspace-body">
        <div className="seg-tcp-panel">
          <div className="seg-tcp-ruler-space">
            <span className="seg-tcp-title">CONTROLS</span>
          </div>

          {/* Track 1 Control Box */}
          <div className="seg-tcp-box track-1">
            <span className="seg-track-tag tag-spk1">Speaker 1</span>
            <button
              className={`seg-tcp-btn mute-btn ${isMuted1 ? 'active' : ''}`}
              onClick={handleToggleMute1}
              title={isMuted1 ? 'Unmute Track 1' : 'Mute Track 1'}
            >
              {isMuted1 ? '🔇 Muted' : '🔊 Mute'}
            </button>
          </div>

          {/* Track 2 Control Box */}
          <div className="seg-tcp-box track-2">
            <span className="seg-track-tag tag-spk2">Speaker 2</span>
            <button
              className={`seg-tcp-btn mute-btn ${isMuted2 ? 'active' : ''}`}
              onClick={handleToggleMute2}
              title={isMuted2 ? 'Unmute Track 2' : 'Mute Track 2'}
            >
              {isMuted2 ? '🔇 Muted' : '🔊 Mute'}
            </button>
          </div>
        </div>

        {/* Main Stacked Dual-Track Waveform Canvas with Drag Selection */}
        <div className="seg-canvas-scroll" ref={scrollRef} onScroll={syncScroll}>
          <div
            className="seg-canvas-inner"
            style={{ width: totalWidth }}
            onMouseDown={handleCanvasMouseDown}
          >
            {/* Shared Timeline Ruler */}
            <div className="timeline-ruler" ref={rulerRef}>
              <div className="timeline-ruler-inner" style={{ width: totalWidth }}>
                {ticks.map((t) => (
                  <div key={t} className="timeline-tick" style={{ left: t * pxPerSec }}>
                    {formatTime(t)}
                  </div>
                ))}
              </div>
            </div>

            {/* Track 1: Speaker 1 (Top Waveform) */}
            <div className="seg-track-container track-1">
              <div className="seg-waveform-box" ref={container1Ref} />
            </div>

            {/* Track 2: Speaker 2 (Bottom Waveform) */}
            <div className="seg-track-container track-2">
              <div className="seg-waveform-box" ref={container2Ref} />
            </div>

          {/* Active Selection Highlight Overlay Across BOTH Waveforms */}
          {selectionRange && (
            <div
              className="seg-selection-overlay"
              style={{
                left: selectionRange.start * pxPerSec,
                width: Math.max(16, (selectionRange.end - selectionRange.start) * pxPerSec),
              }}
            >
              <div
                className="seg-sel-handle left"
                onMouseDown={(e) => handleSelectionHandleMouseDown(e, 'left')}
                title="Drag front selection edge"
              />
              <div className="seg-selection-badge">
                Selection: {selectionDurSec}s
              </div>
              <div
                className="seg-sel-handle right"
                onMouseDown={(e) => handleSelectionHandleMouseDown(e, 'right')}
                title="Drag back selection edge"
              />
            </div>
          )}

          {/* Combined Segments Overlay Spanning Across BOTH Tracks (Viewport Virtualized) */}
          <div className="seg-combined-overlay">
            {segments
              .filter((seg) => seg.end >= viewportBounds.start && seg.start <= viewportBounds.end)
              .map((seg, idx) => {
                const left = seg.start * pxPerSec;
                const width = Math.max(16, (seg.end - seg.start) * pxPerSec);
                const isActive = seg.segment_id === activeSegmentId;
                const segDuration = seg.end - seg.start;

                return (
                  <div
                    key={seg.segment_id}
                    className={`seg-combined-region ${seg.speaker.toLowerCase()} ${
                      isActive ? 'active' : ''
                    }`}
                    style={{ left, width }}
                    onMouseDown={(e) => handleSegmentBodyMouseDown(e, seg.segment_id)}
                  >
                    <div
                      className="seg-handle left"
                      onMouseDown={(e) => handleSegmentMouseDown(e, seg.segment_id, 'left')}
                      title="Drag front edge to resize start time"
                    />
                    <div className="seg-combined-header">
                      <span className="seg-dur-text" title={seg.segment_id}>
                        #{seg.segment_id.includes('_') ? seg.segment_id.split('_').pop() : idx + 1} ({formatTime(seg.start)} – {formatTime(seg.end)})
                      </span>

                      <button
                        className="seg-del-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSegment(seg.segment_id);
                        }}
                        title="Delete segment"
                      >
                        ✕
                      </button>
                    </div>

                    {/* TOP 100ms Micro-Scale GPU CSS Ruler with +200ms Start & -200ms End Padding Markers */}
                    <div
                      className="seg-chunk-scale top"
                      style={{ '--tick-gap': `${(0.1 * pxPerSec).toFixed(2)}px` }}
                    >
                      {segDuration >= 0.2 && (
                        <div
                          className="seg-200ms-bound start"
                          style={{ left: (0.2 * pxPerSec).toFixed(2) + 'px' }}
                          title="200ms recommended start padding"
                        >
                          <span className="seg-200ms-label">+200ms</span>
                        </div>
                      )}
                      {segDuration >= 0.4 && (
                        <div
                          className="seg-200ms-bound end"
                          style={{ right: (0.2 * pxPerSec).toFixed(2) + 'px' }}
                          title="200ms recommended end padding"
                        >
                          <span className="seg-200ms-label">-200ms</span>
                        </div>
                      )}
                    </div>

                    {/* BOTTOM 100ms Micro-Scale GPU CSS Ruler with +200ms Start & -200ms End Padding Markers */}
                    <div
                      className="seg-chunk-scale bottom"
                      style={{ '--tick-gap': `${(0.1 * pxPerSec).toFixed(2)}px` }}
                    >
                      {segDuration >= 0.2 && (
                        <div
                          className="seg-200ms-bound start"
                          style={{ left: (0.2 * pxPerSec).toFixed(2) + 'px' }}
                          title="200ms recommended start padding"
                        >
                          <span className="seg-200ms-label">+200ms</span>
                        </div>
                      )}
                      {segDuration >= 0.4 && (
                        <div
                          className="seg-200ms-bound end"
                          style={{ right: (0.2 * pxPerSec).toFixed(2) + 'px' }}
                          title="200ms recommended end padding"
                        >
                          <span className="seg-200ms-label">-200ms</span>
                        </div>
                      )}
                    </div>

                    <div
                      className="seg-handle right"
                      onMouseDown={(e) => handleSegmentMouseDown(e, seg.segment_id, 'right')}
                      title="Drag back edge to resize end time"
                    />
                  </div>
                );
              })}
          </div>

          {/* Synchronized Playhead Line */}
          <div
            className="playhead-line"
            ref={playheadRef}
            style={{ left: currentTime * pxPerSec, height: '100%' }}
          />
        </div>
      </div>
    </div>

      {/* Custom In-Screen Auto-Detect Overwrite Warning Modal */}
      {showAutoDetectModal && (
        <div className="seg-modal-backdrop" onClick={() => setShowAutoDetectModal(false)}>
          <div className="seg-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="seg-modal-header">
              <div className="seg-modal-icon-badge">⚠️</div>
              <div className="seg-modal-title">Overwrite Existing Work?</div>
            </div>

            <div className="seg-modal-body">
              Running <strong>Auto-Detect Segments</strong> will delete all current segments and previous edits.
            </div>

            <div className="seg-modal-alert-box">
              ⚠️ This action cannot be undone and will clear the undo history.
            </div>

            <div className="seg-modal-actions">
              <button
                className="seg-modal-btn cancel"
                onClick={() => setShowAutoDetectModal(false)}
              >
                Cancel
              </button>
              <button
                className="seg-modal-btn confirm-danger"
                onClick={() => {
                  setShowAutoDetectModal(false);
                  executeAutoDetect();
                }}
              >
                ⚡ Overwrite & Auto-Detect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
