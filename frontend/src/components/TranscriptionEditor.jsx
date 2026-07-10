import { useState, useEffect } from 'react';
import './TranscriptionEditor.css';

export default function TranscriptionEditor({ transcription, onSave, disabled }) {
  const [text, setText] = useState(transcription || '');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setText(transcription || '');
    setDirty(false);
  }, [transcription]);

  const handleChange = (e) => {
    setText(e.target.value);
    setDirty(true);
  };

  const handleSave = () => {
    onSave(text);
    setDirty(false);
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="transcription-editor">
      <p className="transcription-hint">
        Match this paragraph against the audio. Edit freely — add missing words,
        fix errors, or correct punctuation.
      </p>
      <textarea
        className="transcription-textarea"
        value={text}
        onChange={handleChange}
        placeholder="Paste or type the paragraph transcription here..."
        disabled={disabled}
      />
      <div className="transcription-meta">
        <span>{wordCount} words · {text.length} characters</span>
        {dirty && <span style={{ color: 'var(--warning)' }}>Unsaved changes</span>}
      </div>
      <button
        className="btn btn-primary transcription-save"
        onClick={handleSave}
        disabled={disabled || !dirty}
      >
        Save Transcription
      </button>
    </div>
  );
}
