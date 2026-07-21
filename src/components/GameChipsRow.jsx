// components/GameChipsRow.jsx
// Shared game-selector chip row (Session 77 — shot map history selector).
// Extracted from PWHLShotMapView.jsx's original GameChip/GameChipsRow/
// LiveGameChip so ShotMapView.jsx (NHL) can use the exact same UI/behavior
// instead of forking a parallel copy. Styling comes from the existing
// `.game-chip*` rules in ShotMapView.css, already shared by both views —
// no new CSS needed.
//
// Each sport's view maps its own schedule-row shape into this component's
// normalized `games` prop before rendering:
//   games: [{ id, opponentAbbr, opponentColor, myScore, oppScore, isHome }]
// `sport` ('nhl' | 'pwhl') is passed through to TeamLogo for the right logo set.

import TeamLogo from './TeamLogo';

function GameChip({ game, sport, selected, onClick }) {
  const won = game.myScore > game.oppScore;
  return (
    <button className={`game-chip${selected ? ' game-chip-active' : ''}`} onClick={onClick}>
      <TeamLogo abbr={game.opponentAbbr} sport={sport} size={18} color={game.opponentColor} />
      <span className="game-chip-opp">{game.opponentAbbr}</span>
      <span className="game-chip-score" style={{ color: won ? 'var(--green)' : 'var(--red-bright)' }}>
        {won ? 'W' : 'L'} {game.myScore}–{game.oppScore}
      </span>
      <span className="game-chip-venue">{game.isHome ? 'H' : 'A'}</span>
    </button>
  );
}

export function LiveGameChip({ liveGame, sport, selected, onSelect }) {
  if (!liveGame) return null;
  return (
    <button
      className={`game-chip game-chip-live${selected ? ' game-chip-active' : ''}`}
      onClick={onSelect}
      style={{ borderColor: 'var(--red-bright)', color: 'var(--red-bright)' }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em' }}>🔴 LIVE</span>
      <TeamLogo abbr={liveGame.opponentAbbr} sport={sport} size={18} color={liveGame.opponentColor} />
      <span className="game-chip-opp">{liveGame.opponentAbbr}</span>
      <span className="game-chip-score">{liveGame.myScore}–{liveGame.oppScore}</span>
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
    <div className={`game-chips-wrap${disabled ? ' chip-disabled' : ''}`} ref={attachWheel} title={disabled ? disabledReason : undefined}>
      <button className={`game-chip game-chip-all${!selectedGameId ? ' game-chip-active' : ''}`}
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
