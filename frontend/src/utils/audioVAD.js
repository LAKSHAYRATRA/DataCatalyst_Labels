/**
 * Utility to perform RMS energy-based Voice Activity Detection (VAD)
 * across dual audio tracks (Speaker 1 / Track A and Speaker 2 / Track B).
 *
 * Automatically merges consecutive speech frames, caps segments at 30 seconds max,
 * and formats segments compatible with SegmentationCanvas.jsx.
 */

export function detectDualTrackSegments(ws1, ws2, callId = 'call001', options = {}) {
  return detectIndependentTrackSegments(ws1, ws2, callId, options);
}

/**
 * Run VAD independently on Speaker 1 (Track 1) and Speaker 2 (Track 2),
 * generating separate top (Speaker 1) and bottom (Speaker 2) track segments.
 */
export function detectIndependentTrackSegments(ws1, ws2, callId = 'call001', options = {}) {
  const {
    energyThreshold = 0.018,
    frameDurationMs = 50,
    minSpeechDuration = 0.3,
    minPauseDuration = 0.4,
    maxSegmentDuration = 30.0,
  } = options;

  const buffer1 = ws1?.getDecodedData?.() || ws1?.backend?.buffer;
  const buffer2 = ws2?.getDecodedData?.() || ws2?.backend?.buffer;

  if (!buffer1 && !buffer2) return [];

  const data1 = buffer1 ? buffer1.getChannelData(0) : null;
  const data2 = buffer2 ? buffer2.getChannelData(0) : null;
  const sampleRate1 = buffer1?.sampleRate || 44100;
  const sampleRate2 = buffer2?.sampleRate || 44100;

  const dur1 = buffer1?.duration || 0;
  const dur2 = buffer2?.duration || 0;
  const totalDuration = Math.max(dur1, dur2);
  if (totalDuration <= 0) return [];

  const frameSec = frameDurationMs / 1000;
  const numFrames = Math.ceil(totalDuration / frameSec);

  const runChannelVAD = (data, sampleRate, speakerTag) => {
    if (!data) return [];
    const frameSize = Math.floor((sampleRate * frameDurationMs) / 1000);
    const rmsList = [];

    for (let i = 0; i < numFrames; i++) {
      const time = i * frameSec;
      const startSample = Math.floor(time * sampleRate);
      const endSample = Math.min(startSample + frameSize, data.length);
      if (startSample >= data.length) {
        rmsList.push(0);
        continue;
      }
      let sum = 0;
      for (let s = startSample; s < endSample; s++) {
        sum += data[s] * data[s];
      }
      const count = endSample - startSample;
      rmsList.push(count > 0 ? Math.sqrt(sum / count) : 0);
    }

    const sorted = [...rmsList].sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.25)] || 0;
    const threshold = Math.max(energyThreshold, noiseFloor * 2.5 + 0.008);

    const intervals = [];
    let current = null;

    for (let i = 0; i < rmsList.length; i++) {
      const time = i * frameSec;
      const isSpeech = rmsList[i] >= threshold;

      if (isSpeech) {
        if (!current) {
          current = { start: time, end: time + frameSec };
        } else {
          current.end = time + frameSec;
        }
      } else if (current) {
        intervals.push(current);
        current = null;
      }
    }
    if (current) intervals.push(current);

    const merged = [];
    for (const inter of intervals) {
      const prev = merged[merged.length - 1];
      if (prev && (inter.start - prev.end) < minPauseDuration) {
        prev.end = inter.end;
      } else {
        merged.push({ ...inter });
      }
    }

    const segs = [];
    let count = 1;
    let lastEnd = 0;

    for (const inter of merged) {
      let start = Math.max(inter.start, lastEnd + 0.050);
      let end = inter.end;
      if (end - start < minSpeechDuration) continue;

      while (end - start > 0.050) {
        const segDur = Math.min(maxSegmentDuration, end - start);
        const segEnd = start + segDur;
        const fStart = Number(start.toFixed(3));
        const fEnd = Number(segEnd.toFixed(3));
        const fDur = Number((fEnd - fStart).toFixed(3));

        if (fDur >= 0.1) {
          segs.push({
            segment_id: `${callId}_${count++}`,
            speaker: speakerTag,
            start: fStart,
            end: fEnd,
            duration: fDur,
            has_overlap: false,
            is_auto: true,
          });
          lastEnd = fEnd;
        }
        start = Number((segEnd + 0.050).toFixed(3));
      }
    }

    return segs;
  };

  const segs1 = runChannelVAD(data1, sampleRate1, 'SPEAKER_01');
  const segs2 = runChannelVAD(data2, sampleRate2, 'SPEAKER_02');

  return [...segs1, ...segs2].sort((a, b) => a.start - b.start);
}

/**
 * Smart Merge Option: Merges overlapping or adjacent Track 1 & Track 2 VAD segments,
 * picking optimal timestamps (earliest start, latest end) and resolving residual overlaps.
 */
export function mergeDualTrackVADSegments(segments, callId = 'call001') {
  if (!segments || segments.length <= 1) return segments || [];

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged = [];

  for (const seg of sorted) {
    if (merged.length === 0) {
      merged.push({ ...seg });
      continue;
    }

    const prev = merged[merged.length - 1];

    // Check if seg overlaps with prev (start < prev.end) or pause is small (< 0.35s)
    if (seg.start < prev.end || (seg.start - prev.end) < 0.350) {
      // Pick best combined timestamps: earlier start, later end!
      prev.start = Math.min(prev.start, seg.start);
      prev.end = Math.max(prev.end, seg.end);
      prev.duration = Number((prev.end - prev.start).toFixed(3));
      if (prev.speaker !== seg.speaker) {
        prev.speaker = 'BOTH';
      }
    } else {
      merged.push({ ...seg });
    }
  }

  // Cap at 30s max and enforce 50ms min clearance gap
  const finalMerged = [];
  let count = 1;
  let lastEnd = 0;

  for (const seg of merged) {
    let start = Math.max(seg.start, lastEnd + 0.050);
    let end = seg.end;
    if (end - start < 0.2) continue;

    while (end - start > 0.050) {
      const segDur = Math.min(30.0, end - start);
      const segEnd = start + segDur;
      const fStart = Number(start.toFixed(3));
      const fEnd = Number(segEnd.toFixed(3));
      const fDur = Number((fEnd - fStart).toFixed(3));

      if (fDur >= 0.1) {
        finalMerged.push({
          segment_id: `${callId}_${count++}`,
          speaker: seg.speaker,
          start: fStart,
          end: fEnd,
          duration: fDur,
          has_overlap: seg.speaker === 'BOTH',
          is_auto: true,
        });
        lastEnd = fEnd;
      }
      start = Number((segEnd + 0.050).toFixed(3));
    }
  }

  return resolveOverlappingSegments(finalMerged);
}

/**
 * Resolves overlapping segments by comparing durations:
 * Keeps the bigger (longer duration) segment and deletes/discards the smaller one.
 */
export function resolveOverlappingSegments(segments) {
  if (!segments || segments.length <= 1) return segments || [];

  const sortedByDuration = [...segments].sort((a, b) => {
    const durA = Number((a.end - a.start).toFixed(3));
    const durB = Number((b.end - b.start).toFixed(3));
    return durB - durA;
  });

  const kept = [];

  for (const candidate of sortedByDuration) {
    const candStart = candidate.start;
    const candEnd = candidate.end;

    const isOverlapping = kept.some(
      (existing) => candStart < existing.end && candEnd > existing.start
    );

    if (!isOverlapping) {
      kept.push(candidate);
    }
  }

  return kept.sort((a, b) => a.start - b.start);
}
