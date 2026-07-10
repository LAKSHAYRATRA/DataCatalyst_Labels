import { useRef, useState } from 'react';

export default function UploadZone({ title, hint, accept, icon, hasFile, filename, onFile, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file) => {
    if (file) onFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`upload-zone ${hasFile ? 'has-file' : ''} ${dragOver ? 'dragover' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
        disabled={disabled}
      />
      <div className="upload-zone-icon">{icon}</div>
      <div className="upload-zone-title">{title}</div>
      <div className="upload-zone-hint">{hint}</div>
      {filename && <div className="upload-zone-filename">{filename}</div>}
    </div>
  );
}
