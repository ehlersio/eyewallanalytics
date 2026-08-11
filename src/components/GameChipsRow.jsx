// components/GameChipsRow.jsx
// Shared game-selector chip row (Session 77 — shot map history selector).
// Extracted from PWHLShotMapView.jsx's original GameChip/GameChipsRow/
// LiveGameChip so ShotMapView.jsx (NHL) can use the exact same UI/behavior
// instead of forking a parallel copy. Styling used to come from
// ShotMapView.css's `.game-chip*` rules -- migrated to Tailwind here
// (Phase 5, ShotMapView.css sub-PR 6, the final sub-PR for that file).
//
// Each sport's view maps its own schedule-row shape into this component's
// normalized `games` prop before rendering:
//   games: [{ id, opponentAbbr, opponentColor, myScore, oppScore, isHome }]
// `sport` ('nhl' | 'pwhl') is passed through to TeamLogo for the right logo set.
//
// `.game-chip`/`.game-chip-active` are kept as literal markers -- heavily
// asserted on by Cypress (shot-map.cy.js/pwhl-shot-map.cy.js/
// pwhl-shots-live.cy.js: `cy.get('.game-chip-active')`,
// `.should('have.class', 'game-chip-active')`, `.not('.game-chip-all')`)
// -- AND because this pair was flagged as a deliberate fix target back in
// the original Phase 5 investigation (lesson #18): `.game-chip`/
// `.game-chip-active` are two separate classes of equal specificity that
// resolved correctly today only via CSS source order, a collision waiting
// to happen the moment either side migrated. gameChipClasses() below
// converts them into a single function returning a complete, non-
// competing utility set per state, closing that out for good.
//
// The full resolved-state math (worth recording, since it's not obvious
// from the original CSS alone): `.game-chip-all`'s `color: text-muted`
// was declared AFTER `.game-chip-active`'s `color: text` in the original
// file, so the "All" chip's text color always stayed muted even while
// selected -- preserved here as the `all` variant always winning on text
// color regardless of `active`. `.game-chip-active`'s `border-color`
// carried `!important`, which (per the CSS spec) beats a plain inline
// style -- so a selected LiveGameChip's border reverted to the neutral
// active-state gray instead of staying red, while its inline-styled text
// color (not `!important`) stayed red -- an odd but real pre-existing
// asymmetry, faithfully preserved below rather than "fixed" as a bug
// nobody asked to change. `.game-chip-live` itself carried zero CSS
// (confirmed dead in the original investigation) and is dropped entirely
// -- not a Cypress marker either.
import TeamLogo from './TeamLogo';

const GAME_CHIP_BASE = 'game-chip flex items-center gap-[5px] py-[5px] px-[10px] border rounded-[20px] whitespace-nowrap cursor-pointer [transition:border-color_0.12s,background_0.12s] shrink-0 text-[11px]';
function gameChipClasses({ active = false, live = false, all = false } = {}) {
  const bg = active ? 'bg-[var(--bg2)]' : 'bg-transparent';
  const borderColor = active
    ? 'border-[color:var(--text-dim)]'
    : live
      ? 'border-[color:var(--red-bright)]'
      : 'border-[color:var(--border)] hover:border-[color:var(--text-dim)]';
  let textColor;
  if (all) textColor = 'text-[color:var(--text-muted)] font-semibold';
  else if (active) textColor = 'text-[color:var(--text)]';
  else if (live) textColor = 'text-[color:var(--red-bright)]';
  else textColor = 'text-[color:var(--text-dim)]';
  const markers = `${all ? ' game-chip-all' : ''}${active ? ' game-chip-active' : ''}`;
  return `${GAME_CHIP_BASE}${markers} ${bg} ${borderColor} ${textColor}`;
}
const GAME_CHIP_OPP_CLASSES = 'font-semibold text-[color:var(--text)]';
const GAME_CHIP_SCORE_CLASSES = 'text-[10px]';
const GAME_CHIP_VENUE_CLASSES = 'opacity-60';
const GAME_CHIPS_WRAP_CLASSES = "flex gap-[6px] overflow-x-auto pt-1 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden";

function GameChip({ game, sport, selected, onClick }) {
  const won = game.myScore > game.oppScore;
  return (
    <button className={gameChipClasses({ active: selected })} onClick={onClick}>
      <TeamLogo abbr={game.opponentAbbr} sport={sport} size={18} color={game.opponentColor} />
      <span className={GAME_CHIP_OPP_CLASSES}>{game.opponentAbbr}</span>
      <span className={GAME_CHIP_SCORE_CLASSES} style={{ color: won ? 'var(--green)' : 'var(--red-bright)' }}>
        {won ? 'W' : 'L'} {game.myScore}–{game.oppScore}
      </span>
      <span className={GAME_CHIP_VENUE_CLASSES}>{game.isHome ? 'H' : 'A'}</span>
    </button>
  );
}

export function LiveGameChip({ liveGame, sport, selected, onSelect }) {
  if (!liveGame) return null;
  return (
    <button
      className={gameChipClasses({ active: selected, live: true })}
      onClick={onSelect}
    >
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em' }}>🔴 LIVE</span>
      <TeamLogo abbr={liveGame.opponentAbbr} sport={sport} size={18} color={liveGame.opponentColor} />
      <span className={GAME_CHIP_OPP_CLASSES}>{liveGame.opponentAbbr}</span>
      <span className={GAME_CHIP_SCORE_CLASSES}>{liveGame.myScore}–{liveGame.oppScore}</span>
    </button>
  );
}

// `disabled`/`disabledReason`/`onDisabledTap` (Session 77 follow-up — live-
// game handling): see SeasonTypeToggle.jsx's comment for why this is
// aria-disabled + a guarded onClick rather than the native `disabled`
// attribute (which would block the tap-to-reveal-tooltip path on mobile).
export default function GameChipsRow({ games, sport = 'nhl', selectedGameId, onSelect, onAll, disabled = false, disabledReason, onDisabledTap }) {
  const attachWheel = el => {
    if (!el) return;
    el.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }, { passive: false });
  };
  const handleSelect = (id) => disabled ? onDisabledTap?.() : onSelect(id);
  const handleAll    = ()   => disabled ? onDisabledTap?.() : onAll();
  return (
    <div className={`${GAME_CHIPS_WRAP_CLASSES}${disabled ? ' chip-disabled' : ''}`} ref={attachWheel} title={disabled ? disabledReason : undefined}>
      <button className={gameChipClasses({ active: !selectedGameId, all: true })}
        aria-disabled={disabled} onClick={handleAll}>
        All {games.length}
      </button>
      {games.map(g => (
        <GameChip key={g.id} game={g} sport={sport}
          selected={selectedGameId === g.id}
          onClick={() => handleSelect(g.id)} />
      ))}
    </div>
  );
}
