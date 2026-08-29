// components/AHLBoxScoreTable.jsx
//
// Per-player skater/goalie table for AHLGameStatsPopup -- port of
// PWHLBoxScoreTable.jsx. Drops HIT/BLK/FO% columns entirely: confirmed
// live (eyewall-pipeline#95's ahl_game_boxscore.py docstring) that AHL's
// gameSummary reports hits/faceoffAttempts/faceoffWins/blockedShots as
// exactly 0 for every skater regardless of real ice time, so
// ahl_skater_game_box was never given those columns at all -- there's
// nothing to render, not a formatting choice. Skater TOI is dropped for
// the same reason (always "0:00" in the source feed). Goalie TOI/SA/SV/
// SV%/GA ARE real per-game numbers and are kept, same as PWHL's table.

import React from 'react';
import { useTranslation } from 'react-i18next';

const PBS_GRID_COLS = '[grid-template-columns:1fr_28px_28px_36px_40px_36px] max-[400px]:text-[10px] max-[400px]:[grid-template-columns:1fr_22px_22px_30px_34px_30px]';
const PBS_COL_NAME_CLASSES = 'col-name text-left';
const PBS_GOALIE_STAT_CLASSES = 'pbs-goalie-stat flex flex-col items-center gap-[1px] text-[13px] font-medium';
const PBS_GOALIE_LABEL_CLASSES = 'pbs-goalie-label text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]';

function fmtToi(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtSvPct(shotsAgainst, saves) {
  if (!shotsAgainst) return '—';
  return (saves / shotsAgainst).toFixed(3).replace(/^0/, '');
}

export default function AHLBoxScoreTable({ skaters, goalies, playerNames }) {
  const { t } = useTranslation();
  const nameFor = (playerId, jersey) => playerNames?.[playerId] || `#${jersey ?? '—'}`;

  const sortedSkaters = [...skaters].sort((a, b) =>
    (b.points ?? 0) - (a.points ?? 0) || (b.goals ?? 0) - (a.goals ?? 0)
  );

  return (
    <>
      <div className="pbs-table flex flex-col">
        <div className={`pbs-header grid gap-1 items-center text-center text-[11px] text-[color:var(--text-dim)] text-[10px] mb-1 ${PBS_GRID_COLS}`}>
          <span className={PBS_COL_NAME_CLASSES}>{t('gameStatsPopup.table.player')}</span>
          <span title={t('gameStatsPopup.table.tipGoals')}>G</span>
          <span title={t('gameStatsPopup.table.tipAssists')}>A</span>
          <span title={t('gameStatsPopup.table.tipPoints')}>PTS</span>
          <span title={t('gameStatsPopup.table.tipPlusMinus')}>+/−</span>
          <span title={t('gameStatsPopup.teamStats.shotsOnGoal')}>SOG</span>
        </div>
        {sortedSkaters.map(p => {
          const pm      = p.plus_minus;
          const pmStr   = pm != null ? (pm >= 0 ? `+${pm}` : `${pm}`) : '—';
          const pmColor = pm > 0 ? 'var(--green)' : pm < 0 ? 'var(--red-bright)' : 'var(--text-muted)';
          const hasPoints = (p.points ?? 0) > 0;
          return (
            <div key={p.player_id} className={`pbs-row grid gap-1 items-center text-center text-[11px] py-1.5 border-b-[0.5px] border-b-[color:var(--border)] ${hasPoints ? 'has-points bg-[rgba(255,255,255,0.02)]' : ''} ${PBS_GRID_COLS}`}>
              <span className={PBS_COL_NAME_CLASSES}>
                <span className="pbs-player-name block text-[color:var(--text)] text-[12px]">{nameFor(p.player_id, p.jersey_number)}</span>
                <span className="pbs-player-num block text-[color:var(--text-dim)] text-[10px]">#{p.jersey_number ?? '—'}</span>
              </span>
              <span>{p.goals ?? 0}</span>
              <span>{p.assists ?? 0}</span>
              <span className={hasPoints ? 'pbs-pts-highlight text-[color:var(--green)] font-semibold' : ''}>{p.points ?? 0}</span>
              <span style={{ color: pmColor }}>{pmStr}</span>
              <span>{p.shots ?? 0}</span>
            </div>
          );
        })}
        {!sortedSkaters.length && <div className="pbs-empty text-[12px] text-[color:var(--text-dim)] text-center py-3 italic">{t('pwhlGameStats.table.emptyState')}</div>}
      </div>

      {goalies.map(g => (
        <div key={g.player_id} className="pbs-goalie-row flex items-center justify-between py-2 border-b-[0.5px] border-b-[color:var(--border)] flex-wrap gap-2">
          <span className="pbs-player-name flex items-center gap-1.5 text-[color:var(--text)] text-[12px]">
            {nameFor(g.player_id, g.jersey_number)}
            {g.starting && <span className="pbs-goalie-starter-badge text-[8px] font-bold uppercase tracking-[0.04em] text-[color:var(--text-dim)] border-[0.5px] border-[color:var(--border-2)] rounded-[3px] px-1 py-[1px]">{t('gameStatsPopup.gameInfo.starter')}</span>}
          </span>
          <div className="pbs-goalie-stats flex gap-3">
            <span className={PBS_GOALIE_STAT_CLASSES}><span className={PBS_GOALIE_LABEL_CLASSES}>SA</span>{g.shots_against ?? '—'}</span>
            <span className={PBS_GOALIE_STAT_CLASSES}><span className={PBS_GOALIE_LABEL_CLASSES}>SV</span>{g.saves ?? '—'}</span>
            <span className={PBS_GOALIE_STAT_CLASSES}><span className={PBS_GOALIE_LABEL_CLASSES}>SV%</span>{fmtSvPct(g.shots_against, g.saves)}</span>
            <span className={PBS_GOALIE_STAT_CLASSES}><span className={PBS_GOALIE_LABEL_CLASSES}>GA</span>{g.goals_against ?? '—'}</span>
            <span className={PBS_GOALIE_STAT_CLASSES}><span className={PBS_GOALIE_LABEL_CLASSES}>TOI</span>{fmtToi(g.toi_seconds)}</span>
          </div>
        </div>
      ))}
    </>
  );
}

export { fmtToi, fmtSvPct };
