import { useState, useEffect } from 'react';
import { formatTime } from '../utils/helpers';
import './LabelList.css';

export default function LabelList({ labels, activeLabelId, onSelect, onPlay, onLabelsChange }) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);

  const filtered = labels.filter(
    (l) =>
      !search ||
      l.text.toLowerCase().includes(search.toLowerCase())
  );

  // Reset limit when search query changes
  useEffect(() => {
    setLimit(100);
  }, [search]);

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
        {filtered.slice(0, limit).map((label, i) => (
          <div
            key={label.id}
            className={`label-item ${label.id === activeLabelId ? 'active' : ''}`}
            onClick={() => onSelect(label.id)}
          >
            <span className="label-item-index">{i + 1}</span>
            {label.id === activeLabelId ? (
              <input
                type="text"
                className="label-item-edit-input"
                value={label.text || ''}
                onChange={(e) => {
                  const updated = labels.map((l) =>
                    l.id === label.id ? { ...l, text: e.target.value } : l
                  );
                  onLabelsChange(updated);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="label-item-text">{label.text || '(empty)'}</span>
            )}
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
      {filtered.length > limit && (
        <button
          className="btn btn-secondary load-more-btn"
          onClick={() => setLimit((prev) => prev + 100)}
          style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }}
        >
          Load More (+100 words)
        </button>
      )}
    </div>
  );
}
