import './Header.css';

export default function Header({
  projectName,
  onExport,
  hasLabels,
  suggestionMode,
  onSuggestionModeChange,
  suggestionLang,
  onSuggestionLangChange,
}) {
  return (
    <header className="header">
      <div className="header-brand">
        <img src="/logo.png" alt="Voclara" className="header-logo" />
        <h1 className="header-title">Voclara</h1>
        <span className="header-subtitle">Audio Timestamp Editor</span>
      </div>
      <div className="header-actions">
        <div className="suggestion-toggle-container">
          <span className="suggestion-toggle-label">Suggestions Mode</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={suggestionMode}
              onChange={(e) => onSuggestionModeChange(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>
        {suggestionMode && (
          <div className="suggestion-lang-select-container">
            <select
              value={suggestionLang}
              onChange={(e) => onSuggestionLangChange(e.target.value)}
              className="suggestion-lang-select"
            >
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="te">Telugu (తెలుగు)</option>
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="bn">Bengali (বাংলা)</option>
              <option value="mr">Marathi (मराठी)</option>
              <option value="kn">Kannada (ಕನ್ನಡ)</option>
              <option value="ml">Malayalam (മലയാളம்)</option>
              <option value="gu">Gujarati (ગુજરાતી)</option>
              <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
              <option value="ur">Urdu (اردو)</option>
            </select>
          </div>
        )}

        {hasLabels && (
          <>
            <button className="btn btn-secondary" onClick={() => onExport('audacity')}>
              Export Labels (.txt)
            </button>
            <button className="btn btn-primary" onClick={() => onExport('json')}>
              Export JSON
            </button>
          </>
        )}
      </div>
    </header>
  );
}

