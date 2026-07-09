// components/PWHLBoxScoreTable.jsx
//
// Per-player skater/goalie table for PWHLGameStatsPopup (Session 50).
// PWHL port of GameStatsComponents.jsx's SkaterTable -- key differences:
//   - Reads pwhl_skater_game_box/pwhl_goalie_game_box's flat snake_case
//     field names (plus_minus, toi_seconds, blocked_shots, faceoff_attempts/
//     faceoff_wins) instead of the NHL API's camelCase nested shape.
//   - Box rows only carry player_id + jersey_number, no display name --
//     PWHLGameStatsPopup resolves names via /pwhl/roster and passes a
//     playerNames map down; falls back to "#<jersey>" if a player isn't
//     found there (e.g. a call-up not yet in pwhl_players).
//   - Goalie decision (W/L/OT) intentionally omitted -- no reliable source
//     field on pwhl_goalie_game_box (see SESSION_50_B1_IMPLEMENTATION.md).

import React from 'react';

function fmtToi(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtFOPct(attempts, wins) {
  if (!attempts) return '—';
  return `${Math.round((wins / attempts) * 100)}%`;
}

function fmtSvPct(shotsAgainst, saves) {
  if (!shotsAgainst) return '—';
  return (saves / shotsAgainst).toFixed(3).replace(/^0/, '');
}

export default function PWHLBoxScoreTable({ skaters, goalies, playerNames }) {
  const nameFor = (playerId, jersey) => playerNames?.[playerId] || `#${jersey ?? '—'}`;

  const sortedSkaters = [...skaters].sort((a, b) =>
    (b.points ?? 0) - (a.points ?? 0) || (b.goals ?? 0) - (a.goals ?? 0)
  );

  return (
    <>
      <div className="pbs-table">
        <div className="pbs-header">
          <span className="col-name">Player</span>
          <span title="Goals">G</span>
          <span title="Assists">A</span>
          <span title="Points">PTS</span>
          <span title="Plus/Minus">+/−</span>
          <span title="Shots on Goal">SOG</span>
          <span title="Hits">HIT</span>
          <span title="Blocked Shots">BLK</span>
          <span title="Faceoff Win %">FO%</span>
          <span title="Time on Ice">TOI</span>
        </div>
        {sortedSkaters.map(p => {
          const pm      = p.plus_minus;
          const pmStr   = pm != null ? (pm >= 0 ? `+${pm}` : `${pm}`) : '—';
          const pmColor = pm > 0 ? 'var(--green)' : pm < 0 ? 'var(--red-bright)' : 'var(--text-muted)';
          return (
            <div key={p.player_id} className={`pbs-row${(p.points ?? 0) > 0 ? ' has-points' : ''}`}>
              <span className="col-name">
                <span className="pbs-player-name">{nameFor(p.player_id, p.jersey_number)}</span>
                <span className="pbs-player-num">#{p.jersey_number ?? '—'}</span>
              </span>
              <span>{p.goals ?? 0}</span>
              <span>{p.assists ?? 0}</span>
              <span className={(p.points ?? 0) > 0 ? 'pbs-pts-highlight' : ''}>{p.points ?? 0}</span>
              <span style={{ color: pmColor }}>{pmStr}</span>
              <span>{p.shots ?? 0}</span>
              <span>{p.hits ?? 0}</span>
              <span>{p.blocked_shots ?? 0}</span>
              <span>{fmtFOPct(p.faceoff_attempts, p.faceoff_wins)}</span>
              <span className="pbs-toi">{fmtToi(p.toi_seconds)}</span>
            </div>
          );
        })}
        {!sortedSkaters.length && <div className="pbs-empty">No skater stats available for this game.</div>}
      </div>

      {goalies.map(g => (
        <div key={g.player_id} className="pbs-goalie-row">
          <span className="pbs-player-name">{nameFor(g.player_id, g.jersey_number)}</span>
          <div className="pbs-goalie-stats">
            <span className="pbs-goalie-stat"><span className="pbs-goalie-label">SA</span>{g.shots_against ?? '—'}</span>
            <span className="pbs-goalie-stat"><span className="pbs-goalie-label">SV</span>{g.saves ?? '—'}</span>
            <span className="pbs-goalie-stat"><span className="pbs-goalie-label">SV%</span>{fmtSvPct(g.shots_against, g.saves)}</span>
            <span className="pbs-goalie-stat"><span className="pbs-goalie-label">GA</span>{g.goals_against ?? '—'}</span>
            <span className="pbs-goalie-stat"><span className="pbs-goalie-label">TOI</span>{fmtToi(g.toi_seconds)}</span>
          </div>
        </div>
      ))}
    </>
  );
}

export { fmtToi, fmtFOPct, fmtSvPct };
