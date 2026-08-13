/**
 * Parse various label formats into unified { id, start, end, text }[]
 * Supports: Audacity labels, JSON word-level timestamps
 */
function parseLabels(content, filename = '') {
  const trimmed = content.trim();
  if (!trimmed) return [];

  // Try JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || filename.endsWith('.json')) {
    try {
      const data = JSON.parse(trimmed);
      return parseJsonLabels(data);
    } catch {
      // fall through to text parsing
    }
  }

  return parseAudacityLabels(trimmed);
}

function parseJsonLabels(data) {
  let words = [];

  if (Array.isArray(data)) {
    words = data;
  } else if (data.words && Array.isArray(data.words)) {
    words = data.words;
  } else if (data.segments && Array.isArray(data.segments)) {
    words = data.segments;
  } else if (data.labels && Array.isArray(data.labels)) {
    words = data.labels;
  }

  return words.map((w, i) => ({
    id: w.id || `label-${i}`,
    start: Number(w.start ?? w.start_time ?? w.begin ?? 0),
    end: Number(w.end ?? w.end_time ?? w.finish ?? w.start + 0.1),
    text: String(w.text ?? w.word ?? w.label ?? w.content ?? ''),
  }));
}

function parseAudacityLabels(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const labels = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    let parts = line.split('\t');
    if (parts.length < 2) {
      parts = line.split(/\s+/);
    }
    if (parts.length >= 2) {
      const start = parseFloat(parts[0]);
      const end = parseFloat(parts[1]);
      const labelText = parts.slice(2).join(' ').trim();
      if (!isNaN(start) && !isNaN(end)) {
        labels.push({
          id: `label-${i}-${Math.random().toString(36).substr(2, 6)}`,
          start,
          end,
          text: labelText,
        });
      }
    }
  }

  return labels;
}

function labelsToAudacity(labels) {
  return labels
    .sort((a, b) => a.start - b.start)
    .map((l) => `${l.start.toFixed(6)}\t${l.end.toFixed(6)}\t${l.text}`)
    .join('\n');
}

function labelsToJson(labels) {
  return JSON.stringify(
    {
      words: labels.map((l) => ({
        start: l.start,
        end: l.end,
        text: l.text,
        word: l.text,
      })),
    },
    null,
    2
  );
}

module.exports = { parseLabels, labelsToAudacity, labelsToJson };
