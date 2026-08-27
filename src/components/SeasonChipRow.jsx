// components/SeasonChipRow.jsx
// Shared season-selector chip stack (Session 77 — shot map history
// selector). Extracted from PWHLShotMapView.jsx's inline season-button
// stack so ShotMapView.jsx (NHL) uses the same UI/behavior rather than a
// forked copy. Styling reuses the shared `rinkBtnClasses()` helper
// (originally IceRink.css's `.rink-btn`, Phase 6) plus the overflow
// dropdown's own classes -- migrated to Tailwind here (Phase 5,
// ShotMapView.css sub-PR 6, the final sub-PR for that file).
//
// Only the recent/visible seasons show as inline chips — `archiveSeasons`
// (older seasons) live behind a "More" overflow chip instead of crowding
// the row. Passing an empty/undefined `archiveSeasons` (e.g. PWHL today,
// which only has 3 seasons total) simply omits the overflow chip.
//
// `.season-archive-dropdown` is kept as a literal marker -- Cypress
// (shot-map.cy.js) asserts on it directly. `.season-archive-wrap`/
// `.season-archive-item`/`.active` are not Cypress markers, dropped.
// `.season-archive-item`/`.active` raced on `color` (compound base+
// modifier, standard shape) -- pulled into seasonArchiveItemClasses().
// The `:hover` text-color override is only applied for the inactive
// state: in the original CSS, `.active`'s color always won over `:hover`
// regardless (equal specificity, `.active` declared later in source), so
// adding a competing `hover:text-*` utility to the active variant would
// just be dead weight, not a behavior match.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rinkBtnClasses } from '../utils/rinkBtnClasses';

const SEASON_ARCHIVE_DROPDOWN_CLASSES = 'season-archive-dropdown absolute top-[calc(100%+4px)] right-0 z-20 flex flex-col gap-0.5 p-1.5 min-w-[96px] max-h-[220px] overflow-y-auto bg-[var(--bg2)] border-[0.5px] border-[color:var(--border-2)] rounded-[var(--radius-md,10px)] shadow-[0_8px_24px_rgba(0,0,0,0.35)]';
const seasonArchiveItemClasses = (active) => {
  const base = 'py-[5px] px-2 rounded-[6px] text-[11px] text-right whitespace-nowrap bg-transparent hover:bg-[var(--bg3)]';
  return active
    ? `${base} text-[color:var(--red-bright)] font-semibold`
    : `${base} text-[color:var(--text-muted)] hover:text-[color:var(--text)]`;
};

// `disabled`/`disabledReason`/`onDisabledTap` (Session 77 follow-up — live-
// game handling): see SeasonTypeToggle.jsx's comment for why this is
// aria-disabled + a guarded onClick rather than the native `disabled`
// attribute (which would block the tap-to-reveal-tooltip path on mobile).
export default function SeasonChipRow({ seasons, archiveSeasons = [], selected, onSelect, disabled = false, disabledReason, onDisabledTap }) {
  const { t } = useTranslation();
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
          className={rinkBtnClasses({ active: selected === s.id })}
          style={chipStyle}
          aria-disabled={disabled}
          onClick={() => handleSelect(s.id)}>
          {s.label}
        </button>
      ))}
      {archiveSeasons.length > 0 && (
        <div className="relative">
          <button
            className={rinkBtnClasses({ active: !!selectedArchiveSeason })}
            style={chipStyle}
            aria-disabled={disabled}
            onClick={handleMoreClick}
            aria-label={t('seasonChipRow.moreSeasonsAriaLabel')}>
            {selectedArchiveSeason ? selectedArchiveSeason.label : '•••'}
          </button>
          {showArchive && !disabled && (
            <div className={SEASON_ARCHIVE_DROPDOWN_CLASSES}>
              {archiveSeasons.map(s => (
                <button key={s.id}
                  className={seasonArchiveItemClasses(selected === s.id)}
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
