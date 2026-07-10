export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const ms = Math.round((secs - whole) * 1000);
  return `${mins}:${String(whole).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function parseLabelsClient(content, filename = '') {
  const trimmed = content.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[') || filename.endsWith('.json')) {
    try {
      const data = JSON.parse(trimmed);
      let words = [];
      if (Array.isArray(data)) words = data;
      else if (data.words) words = data.words;
      else if (data.segments) words = data.segments;
      else if (data.labels) words = data.labels;

      return words.map((w, i) => ({
        id: w.id || `label-${i}-${Date.now()}`,
        start: Number(w.start ?? w.start_time ?? w.begin ?? 0),
        end: Number(w.end ?? w.end_time ?? w.finish ?? 0.1),
        text: String(w.text ?? w.word ?? w.label ?? ''),
      }));
    } catch {
      /* fall through */
    }
  }

  return trimmed.split(/\r?\n/).filter(Boolean).map((line, i) => {
    const parts = line.split('\t');
    return {
      id: `label-${i}-${Date.now()}`,
      start: parseFloat(parts[0]) || 0,
      end: parseFloat(parts[1]) || 0,
      text: parts.slice(2).join('\t').trim(),
    };
  });
}
