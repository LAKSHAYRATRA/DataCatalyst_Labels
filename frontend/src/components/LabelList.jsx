import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { formatTime } from '../utils/helpers';
import './LabelList.css';

function LabelList({ labels, activeLabelId, onSelect, onPlay, onLabelsChange }) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const activeItemRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search) return labels;
    const s = search.toLowerCase();
    return labels.filter((l) => l.text && l.text.toLowerCase().includes(s));
  }, [labels, search]);

  // Reset limit when search query changes
  useEffect(() => {
    setLimit(100);
  }, [search]);

  // Auto-scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeLabelId]);

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
        {filtered.slice(0, limit).map((label, i) => {
          const isActive = label.id === activeLabelId;
          return (
            <div
              key={label.id}
              ref={isActive ? activeItemRef : null}
              className={`label-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(label.id)}
            >
              <span className="label-item-index">{i + 1}</span>
              {isActive ? (
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
          );
        })}
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

export default memo(LabelList);
