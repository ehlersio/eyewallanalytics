// components/SeasonTypeToggle.jsx
// Regular Season / Playoffs segmented toggle (Session 77 — shot map
// history selector). New capability for BOTH sports, not NHL-only parity
// — PWHL's shot map couldn't select playoffs before this either.
//
// Purely a dumb, controlled two-state toggle: `value` is 'regular' |
// 'playoffs', `onChange` fires with the new value. What toggling *does*
// is wired differently per sport by the caller:
//   PWHL — switches which season_id gets fetched (PWHL_REGULAR_SEASONS
//          vs PWHL_PLAYOFF_SEASONS both exist as real season_ids already).
//   NHL  — filters the already-fetched season's games by `gameType`
//          (GAME_TYPE.REGULAR vs GAME_TYPE.PLAYOFFS in nhlApi.js) — the
//          same season string covers both, there's no second season to fetch.
// See SHOT_MAP_HISTORY_BRIEF.md for why these aren't unified further.

// `disabled` (Session 77 follow-up — live-game handling) grays the toggle
// out and reroutes both buttons' clicks to `onDisabledTap` instead of
// `onChange`. Deliberately NOT the native `disabled` HTML attribute —
// that suppresses click/touch events entirely, which would make it
// impossible for the caller to show a tap-triggered "why" tooltip on
// mobile (native `title` alone doesn't reliably respond to a tap).
// `aria-disabled` + a guarded onClick keeps the element genuinely
// interactive while still reading as non-functional.
//
// Styling used to come from ShotMapView.css -- migrated to Tailwind here
// (Phase 5, ShotMapView.css sub-PR 6, the final sub-PR for that file).
// `.season-type-toggle`/`.season-type-toggle-btn`/`.on`/`.chip-disabled`
// are all kept as literal markers -- heavily asserted on by Cypress
// (shot-map.cy.js/pwhl-shot-map.cy.js: `.season-type-toggle-btn.on`,
// `cy.get('.season-type-toggle').should('have.class', 'chip-disabled')`).
// `.season-type-toggle-btn`/`.on` raced on background+color (standard
// compound base+modifier shape) -- pulled into seasonTypeToggleBtnClasses().
// `.chip-disabled`'s own descendant-selector rule (grays out `.rink-btn`/
// `.game-chip`/`.season-type-toggle-btn` together, spanning IceRink.css's
// `.rink-btn` too) stays real CSS, hoisted to index.css now that
// ShotMapView.css is fully retired -- see that file for the reasoning.
import { useTranslation } from 'react-i18next';

const SEASON_TYPE_TOGGLE_CLASSES = 'season-type-toggle flex border-[0.5px] border-[color:var(--border-2)] rounded-[20px] overflow-hidden w-fit';
const seasonTypeToggleBtnClasses = (on) => {
  const base = 'season-type-toggle-btn py-0.5 px-2 text-[10px] font-medium whitespace-nowrap min-h-0 min-w-0';
  return on
    ? `${base} on bg-[var(--red-dim)] text-[color:var(--red-bright)]`
    : `${base} bg-transparent text-[color:var(--text-muted)]`;
};

export default function SeasonTypeToggle({ value, onChange, disabled = false, disabledReason, onDisabledTap }) {
  const { t } = useTranslation();
  const handleClick = (type) => disabled ? onDisabledTap?.() : onChange(type);
  return (
    <div className={`${SEASON_TYPE_TOGGLE_CLASSES}${disabled ? ' chip-disabled' : ''}`} title={disabled ? disabledReason : undefined}>
      <button
        className={seasonTypeToggleBtnClasses(value === 'regular')}
        aria-disabled={disabled}
        onClick={() => handleClick('regular')}>
        {t('seasonTypeToggle.regular')}
      </button>
      <button
        className={seasonTypeToggleBtnClasses(value === 'playoffs')}
        aria-disabled={disabled}
        onClick={() => handleClick('playoffs')}>
        {t('seasonTypeToggle.playoffs')}
      </button>
    </div>
  );
}
