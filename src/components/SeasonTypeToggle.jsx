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
export default function SeasonTypeToggle({ value, onChange, disabled = false, disabledReason, onDisabledTap }) {
  const handleClick = (type) => disabled ? onDisabledTap?.() : onChange(type);
  return (
    <div className={`season-type-toggle${disabled ? ' chip-disabled' : ''}`} title={disabled ? disabledReason : undefined}>
      <button
        className={`season-type-toggle-btn${value === 'regular' ? ' on' : ''}`}
        aria-disabled={disabled}
        onClick={() => handleClick('regular')}>
        Regular
      </button>
      <button
        className={`season-type-toggle-btn${value === 'playoffs' ? ' on' : ''}`}
        aria-disabled={disabled}
        onClick={() => handleClick('playoffs')}>
        Playoffs
      </button>
    </div>
  );
}
