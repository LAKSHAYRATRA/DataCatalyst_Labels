import './Header.css';

export default function Header({ projectName, onExport, hasLabels }) {
  return (
    <header className="header">
      <div className="header-brand">
        <img src="/favicon.svg" alt="VocLara" className="header-logo" />
        <h1 className="header-title">
          Voc<span>Lara</span>
        </h1>
        <span className="header-subtitle">Audio Timestamp Editor</span>
      </div>
      <div className="header-actions">
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
