// components/SeasonChipRow.jsx
// Shared season-selector chip stack (Session 77 — shot map history
// selector). Extracted from PWHLShotMapView.jsx's inline season-button
// stack so ShotMapView.jsx (NHL) uses the same UI/behavior rather than a
// forked copy. Styling reuses the existing `.rink-btn` class (IceRink.css,
// already loaded by both shot map views) plus a small amount of new CSS
// for the overflow dropdown (ShotMapView.css, shared by both sports).
//
// Only the recent/visible seasons show as inline chips — `archiveSeasons`
// (older seasons) live behind a "More" overflow chip instead of crowding
// the row. Passing an empty/undefined `archiveSeasons` (e.g. PWHL today,
// which only has 3 seasons total) simply omits the overflow chip.

import { useEffect, useRef, useState } from 'react';

// `disabled`/`disabledReason`/`onDisabledTap` (Session 77 follow-up — live-
// game handling): see SeasonTypeToggle.jsx's comment for why this is
// aria-disabled + a guarded onClick rather than the native `disabled`
// attribute (which would block the tap-to-reveal-tooltip path on mobile).
export default function SeasonChipRow({ seasons, archiveSeasons = [], selected, onSelect, disabled = false, disabledReason, onDisabledTap }) {
  const [showArchive, setShowArchive] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!showArchive) return;
    function handleOutsideClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowArchive(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showArchive]);

  const chipStyle = { padding: '2px 8px', fontSize: 10, minHeight: 'unset', minWidth: 'unset' };
  const selectedArchiveSeason = archiveSeasons.find(s => s.id === selected);

  const handleSelect = (id) => disabled ? onDisabledTap?.() : onSelect(id);
  const handleMoreClick = () => disabled ? onDisabledTap?.() : setShowArchive(o => !o);

  return (
    <div
      className={disabled ? 'chip-disabled' : ''}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
      ref={wrapRef}
      title={disabled ? disabledReason : undefined}>
      {seasons.map(s => (
        <button key={s.id}
          className={`rink-btn${selected === s.id ? ' on' : ''}`}
          style={chipStyle}
          aria-disabled={disabled}
          onClick={() => handleSelect(s.id)}>
          {s.label}
        </button>
      ))}
      {archiveSeasons.length > 0 && (
        <div className="season-archive-wrap">
          <button
            className={`rink-btn${selectedArchiveSeason ? ' on' : ''}`}
            style={chipStyle}
            aria-disabled={disabled}
            onClick={handleMoreClick}
            aria-label="More seasons">
            {selectedArchiveSeason ? selectedArchiveSeason.label : '•••'}
          </button>
          {showArchive && !disabled && (
            <div className="season-archive-dropdown">
              {archiveSeasons.map(s => (
                <button key={s.id}
                  className={`season-archive-item${selected === s.id ? ' active' : ''}`}
                  onClick={() => { onSelect(s.id); setShowArchive(false); }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
