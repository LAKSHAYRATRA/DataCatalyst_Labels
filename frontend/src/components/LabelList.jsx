import { useState } from 'react';
import { formatTime } from '../utils/helpers';
import './LabelList.css';

export default function LabelList({ labels, activeLabelId, onSelect, onPlay }) {
  const [search, setSearch] = useState('');

  const filtered = labels.filter(
    (l) =>
      !search ||
      l.text.toLowerCase().includes(search.toLowerCase())
  );

  if (!labels.length) {
    return (
      <div className="label-empty">
        Upload a labels file (Audacity .txt or JSON) to see word-level segments
      </div>
    );
  }

  return (
    <div>
      <div className="label-stats">
        {labels.length} word{labels.length !== 1 ? 's' : ''} labeled
      </div>
      <input
        className="label-search"
        type="text"
        placeholder="Search words..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="label-list">
        {filtered.map((label, i) => (
          <div
            key={label.id}
            className={`label-item ${label.id === activeLabelId ? 'active' : ''}`}
            onClick={() => onSelect(label.id)}
          >
            <span className="label-item-index">{i + 1}</span>
            <span className="label-item-text">{label.text || '(empty)'}</span>
            <span className="label-item-time">
              {formatTime(label.start)} – {formatTime(label.end)}
            </span>
            <button
              className="label-item-play"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(label);
              }}
              title="Play segment"
            >
              ▶
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
