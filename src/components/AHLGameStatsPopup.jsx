// components/AHLGameStatsPopup.jsx
//
// AHL box-score popup, triggered from a completed game's card in
// AHLScheduleView.jsx -- port of PWHLGameStatsPopup.jsx. Fetches:
//   - /ahl/game-box?gameId=  -- per-player skater/goalie box score
//   - /ahl/summary?gameId=   -- period scoring + three stars
//   - /ahl/roster?teamId=    -- player_id -> name resolution
//
// Two real differences from PWHL's version:
//   - Team-stat comparison bars drop hits/blocked-shots/faceoff% entirely
//     -- ahl_skater_game_box has no columns for them (see
//     ahl_game_boxscore.py's docstring: always 0 in AHL's feed, never
//     ingested). Only shots-on-goal and penalty minutes are real here.
//   - No "View Shot Map" CTA -- AHLShotMapView.jsx is season-aggregate
//     only (no per-game drill-down/selectedGameId state exists for AHL),
//     unlike PWHLShotMapView's live per-game mode.

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import { fetchAHLGameBox, fetchAHLGameSummary, fetchAHLRoster } from '../utils/ahlApi';
import { getAHLTeamById } from '../utils/ahlConfig';
import { formatDate } from '../utils/formatters';
import TeamLogo from './TeamLogo';
import { capture } from '../utils/analytics';
import AHLBoxScoreTable from './AHLBoxScoreTable';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const PGS_TEAM_COL_CLASSES = 'pgs-team-col flex flex-col items-center gap-1 flex-1';
const PGS_SECTION_LABEL_CLASSES = 'pgs-section-label font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-dim)] pb-1.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2';
const PGS_STAT_VAL_CLASSES = 'pgs-stat-val font-[family-name:var(--font-mono)] text-[13px] font-medium text-center';
const PGS_TOGGLE_BTN_CLASSES = 'pgs-toggle-btn flex items-center gap-[5px] py-[5px] px-3 rounded-[20px] text-[12px] font-medium border-[0.5px] border-[color:var(--border-2)] bg-transparent text-[color:var(--text-muted)] cursor-pointer [transition:all_0.15s] hover:text-[color:var(--text)]';

function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(d)) return dateStr;
  return formatDate(d, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function periodLabel(id, i) {
  const num = id || i + 1;
  if (num <= 3) return `P${num}`;
  return num === 4 ? 'OT' : `OT${num - 3}`;
}

function playerFullName(p) {
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return name || null;
}

export default function AHLGameStatsPopup({ game, teamId, abbr, color, onClose }) {
  const { t } = useTranslation();
  const [skaterTeam, setSkaterTeam] = useState('car');

  const isHome  = game.home_team_id === teamId;
  const my      = isHome ? game.home_score : game.away_score;
  const op      = isHome ? game.away_score : game.home_score;
  const oppId   = isHome ? game.away_team_id : game.home_team_id;
  const oppTeam = getAHLTeamById(oppId);
  const oppAbbr = oppTeam?.abbr || String(oppId);
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';
  const won     = my > op;

  useEffect(() => {
    capture('ahl_game_stats_opened', { gameId: game?.game_id, opponent: oppAbbr });
  }, []);

  const { data: box,     loading: boxLoading }     = useFetch(() => fetchAHLGameBox(game.game_id), [game.game_id]);
  const { data: summary, loading: summaryLoading }  = useFetch(() => fetchAHLGameSummary(game.game_id), [game.game_id]);
  const { data: rosters } = useFetch(
    () => Promise.all([fetchAHLRoster(teamId), fetchAHLRoster(oppId)]),
    [teamId, oppId]
  );

  const playerNames = useMemo(() => {
    const map = {};
    (rosters || []).forEach(roster => {
      (roster || []).forEach(p => {
        const name = playerFullName(p);
        if (name) map[p.player_id] = name;
      });
    });
    return map;
  }, [rosters]);

  const skaters = box?.skaters || [];
  const goalies = box?.goalies || [];

  const carSkaters = useMemo(() => skaters.filter(p => p.team_id === teamId), [skaters, teamId]);
  const oppSkaters = useMemo(() => skaters.filter(p => p.team_id === oppId),  [skaters, oppId]);
  const carGoalies = useMemo(() => goalies.filter(g => g.team_id === teamId), [goalies, teamId]);
  const oppGoalies = useMemo(() => goalies.filter(g => g.team_id === oppId),  [goalies, oppId]);

  // Team-level comparison bars -- SOG + PIM only. No hits/blocked-shots/
  // faceoff% here, unlike PWHL's: ahl_skater_game_box has no columns for
  // those (see module docstring).
  const teamStats = useMemo(() => {
    const sum = (rows, field) => rows.reduce((s, r) => s + (r[field] ?? 0), 0);
    return [
      { label: t('gameStatsPopup.teamStats.shotsOnGoal'), car: sum(carSkaters, 'shots'), opp: sum(oppSkaters, 'shots') },
      { label: t('gameStatsPopup.teamStats.penaltyMinutes'), car: sum(carSkaters, 'penalty_minutes'), opp: sum(oppSkaters, 'penalty_minutes') },
    ];
  }, [carSkaters, oppSkaters, t]);

  const periods = summary?.periods || [];
  const mvps    = summary?.mvps || [];

  const venueName = summary?.venue || null;
  const myCoach   = isHome ? summary?.coaches?.home : summary?.coaches?.away;
  const oppCoach  = isHome ? summary?.coaches?.away : summary?.coaches?.home;
  const officials = [
    ...(summary?.officials?.referees || []),
    ...(summary?.officials?.linesmen || []),
  ];

  return (
    <div className="pgs-backdrop fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-end justify-center z-[200] min-[560px]:items-center min-[560px]:p-4" onClick={onClose}>
      <div className="pgs-card bg-[var(--bg1)] border-[0.5px] border-[color:var(--border-2)] rounded-t-[var(--radius-lg)] w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.5)] min-[560px]:rounded-[var(--radius-lg)]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`pgs-header p-4 border-b-[0.5px] border-b-[color:var(--border)] relative ${won ? 'pgs-win bg-[rgba(61,186,126,0.06)]' : 'pgs-loss bg-[rgba(255,68,34,0.06)]'}`}>
          <div className="pgs-header-inner flex items-center justify-between gap-3">
            <div className={PGS_TEAM_COL_CLASSES}>
              <TeamLogo abbr={abbr} sport="ahl" size={36} color={color} />
              <span className="pgs-abbr font-[family-name:var(--font-display)] text-[14px] font-bold tracking-[0.06em]" style={{ color }}>{abbr}</span>
              <span className="pgs-score-big font-[family-name:var(--font-display)] text-[42px] font-bold leading-none" style={{ color }}>{my ?? '—'}</span>
            </div>
            <div className="pgs-center-col flex flex-col items-center gap-1">
              <div className={`pgs-result-badge font-[family-name:var(--font-display)] text-[12px] font-bold py-[3px] px-2.5 rounded-[20px] ${won ? 'win bg-[rgba(61,186,126,0.2)] text-[color:var(--green)]' : 'loss bg-[rgba(255,68,34,0.15)] text-[color:var(--red-bright)]'}`}>{won ? t('gameStatsPopup.header.resultWin') : t('gameStatsPopup.header.resultLoss')}</div>
              <div className="pgs-date text-[11px] text-[color:var(--text-muted)]">{formatDateLong(game.game_date)}</div>
              <div className="pgs-venue text-[10px] text-[color:var(--text-dim)]">{isHome ? '📍' : '✈'} {venueName || (isHome ? t('scheduleView.resultCard.home') : t('scheduleView.resultCard.away'))}</div>
            </div>
            <div className={`${PGS_TEAM_COL_CLASSES} right`}>
              <TeamLogo abbr={oppAbbr} sport="ahl" size={36} color={oppColor} />
              <span className="pgs-abbr font-[family-name:var(--font-display)] text-[14px] font-bold tracking-[0.06em]" style={{ color: oppColor }}>{oppAbbr}</span>
              <span className="pgs-score-big font-[family-name:var(--font-display)] text-[42px] font-bold leading-none" style={{ color: oppColor }}>{op ?? '—'}</span>
            </div>
          </div>
          <button className="pgs-close absolute top-3 right-3 w-7 h-7 rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]" onClick={onClose} aria-label={t('gameStatsPopup.header.closeAriaLabel')}>✕</button>
        </div>

        <div className="pgs-body pt-4 px-4 pb-6">
          {/* Period scoring + three stars */}
          {(periods.length > 0 || mvps.length > 0) && (
            <div className="pgs-period-stars-row flex gap-4 flex-wrap">
              {periods.length > 0 && (
                <div className="pgs-section pgs-period-col mt-4.5 flex-1 min-w-[140px]">
                  <div className={PGS_SECTION_LABEL_CLASSES}>{t('gameStatsPopup.sections.scoringByPeriod')}</div>
                  <div className="pgs-period-table flex flex-col gap-1">
                    <div className="pgs-period-row header grid gap-1 text-[13px] text-center text-[10px] text-[color:var(--text-dim)] [grid-template-columns:40px_repeat(auto-fill,minmax(24px,1fr))] [&>span:first-child]:text-left [&>span:first-child]:font-semibold">
                      <span />
                      {periods.map((p, i) => <span key={i}>{periodLabel(p.info?.id, i)}</span>)}
                      <span>{t('shotMapView.boxscore.total')}</span>
                    </div>
                    <div className="pgs-period-row grid gap-1 text-[13px] text-center [grid-template-columns:40px_repeat(auto-fill,minmax(24px,1fr))] [&>span:first-child]:text-left [&>span:first-child]:font-semibold">
                      <span style={{ color }}>{abbr}</span>
                      {periods.map((p, i) => (
                        <span key={i}>{isHome ? (p.stats?.homeGoals ?? 0) : (p.stats?.visitingGoals ?? 0)}</span>
                      ))}
                      <span className="pgs-period-total font-bold text-[color:var(--text)]">{my ?? '—'}</span>
                    </div>
                    <div className="pgs-period-row grid gap-1 text-[13px] text-center [grid-template-columns:40px_repeat(auto-fill,minmax(24px,1fr))] [&>span:first-child]:text-left [&>span:first-child]:font-semibold">
                      <span style={{ color: oppColor }}>{oppAbbr}</span>
                      {periods.map((p, i) => (
                        <span key={i}>{isHome ? (p.stats?.visitingGoals ?? 0) : (p.stats?.homeGoals ?? 0)}</span>
                      ))}
                      <span className="pgs-period-total font-bold text-[color:var(--text)]">{op ?? '—'}</span>
                    </div>
                  </div>
                </div>
              )}
              {mvps.length > 0 && (
                <div className="pgs-section pgs-stars-col mt-4.5 flex-1 min-w-[140px]">
                  <div className={PGS_SECTION_LABEL_CLASSES}>{t('gameStatsPopup.sections.threeStars')}</div>
                  {mvps.slice(0, 3).map((mvp, i) => {
                    const name = `${mvp.player?.info?.firstName || ''} ${mvp.player?.info?.lastName || ''}`.trim();
                    const isCarStar = mvp.team?.id === teamId;
                    return (
                      <div key={i} className="pgs-star-row flex items-center gap-2.5 py-1.5 border-b-[0.5px] border-b-[color:var(--border)] text-[13px]">
                        <span className="pgs-star-num text-[12px] w-11">{i === 0 ? '⭐' : i === 1 ? '⭐⭐' : '⭐⭐⭐'}</span>
                        <div className="pgs-star-info flex-1 flex flex-col">
                          <span className="pgs-star-name text-[color:var(--text)] font-medium">{name || '—'}</span>
                          <span className="pgs-star-team font-[family-name:var(--font-display)] text-[11px] font-bold" style={{ color: isCarStar ? color : oppColor }}>
                            {mvp.team?.abbreviation || ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {summaryLoading && !summary && (
            <div className="pgs-loading py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={SKELETON_CLASSES} style={{ height: 12, marginBottom: 10, width: `${60 + i * 8}%` }} />
              ))}
            </div>
          )}

          {/* Team stats comparison */}
          {!boxLoading && skaters.length > 0 && (
            <div className="pgs-section mt-4.5">
              <div className={PGS_SECTION_LABEL_CLASSES}>{t('gameStatsPopup.sections.teamStats')}</div>
              <div className="pgs-team-stat-header grid gap-2 text-[11px] font-semibold text-center mb-1.5 [grid-template-columns:48px_1fr_48px]">
                <span style={{ color }}>{abbr}</span>
                <span />
                <span style={{ color: oppColor }}>{oppAbbr}</span>
              </div>
              {teamStats.map((row, i) => {
                const carVal = row.car ?? 0;
                const oppVal = row.opp ?? 0;
                const total  = carVal + oppVal || 1;
                const carPct = Math.round((carVal / total) * 100);
                return (
                  <div key={i} className="pgs-stat-row grid gap-2 items-center mb-2 [grid-template-columns:48px_1fr_48px]">
                    <span className={PGS_STAT_VAL_CLASSES} style={{ color }}>{row.car ?? '—'}</span>
                    <div className="pgs-stat-center flex flex-col gap-[3px]">
                      <div className="pgs-stat-label text-[10px] text-[color:var(--text-muted)] text-center">{row.label}</div>
                      <div className="pgs-dual-bar flex h-[5px] rounded-[3px] overflow-hidden bg-[var(--bg3)]">
                        <div className="pgs-fill-car h-full" style={{ width: `${carPct}%`, background: color }} />
                        <div className="pgs-fill-opp h-full" style={{ width: `${100 - carPct}%`, background: oppColor }} />
                      </div>
                    </div>
                    <span className={`${PGS_STAT_VAL_CLASSES} opp`} style={{ color: oppColor }}>{row.opp ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Skater/goalie box score with team toggle */}
          {boxLoading && (
            <div className="pgs-loading py-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={SKELETON_CLASSES} style={{ height: 12, marginBottom: 10, width: `${60 + i * 8}%` }} />
              ))}
            </div>
          )}
          {!boxLoading && (skaters.length > 0 || goalies.length > 0) && (
            <div className="pgs-section mt-4.5">
              <div className="pgs-skater-toggle flex gap-2 mb-2.5">
                <button
                  className={`${PGS_TOGGLE_BTN_CLASSES}${skaterTeam === 'car' ? ' active' : ''}`}
                  style={skaterTeam === 'car' ? { borderColor: color, color } : undefined}
                  onClick={() => setSkaterTeam('car')}
                >
                  <TeamLogo abbr={abbr} sport="ahl" size={14} color={color} />
                  {t('gameStatsPopup.skaters.toggleButton', { abbr })}
                </button>
                <button
                  className={`${PGS_TOGGLE_BTN_CLASSES}${skaterTeam === 'opp' ? ' active' : ''}`}
                  style={skaterTeam === 'opp' ? { borderColor: oppColor, color: oppColor } : undefined}
                  onClick={() => setSkaterTeam('opp')}
                >
                  <TeamLogo abbr={oppAbbr} sport="ahl" size={14} color={oppColor} />
                  {t('gameStatsPopup.skaters.toggleButton', { abbr: oppAbbr })}
                </button>
              </div>
              <AHLBoxScoreTable
                skaters={skaterTeam === 'car' ? carSkaters : oppSkaters}
                goalies={skaterTeam === 'car' ? carGoalies : oppGoalies}
                playerNames={playerNames}
              />
            </div>
          )}
          {!boxLoading && !skaters.length && !goalies.length && (
            <div className="pgs-no-data text-[12px] text-[color:var(--text-dim)] text-center py-4 italic">{t('pwhlGameStats.emptyState')}</div>
          )}

          {/* Game info: officials + coaches */}
          {(officials.length > 0 || myCoach || oppCoach) && (
            <div className="pgs-section mt-4.5">
              <div className={PGS_SECTION_LABEL_CLASSES}>{t('gameStatsPopup.sections.gameInfo')}</div>
              <div className="pgs-game-info flex flex-col gap-1.5 text-[11px] text-[color:var(--text-muted)]">
                {officials.length > 0 && (
                  <div className="pgs-officials">
                    <span className="font-semibold text-[color:var(--text)]">{t('gameStatsPopup.gameInfo.officials')}: </span>
                    {officials.map(o => `${o.firstName} ${o.lastName}${o.jerseyNumber ? ` #${o.jerseyNumber}` : ''}`).join(', ')}
                  </div>
                )}
                {(myCoach || oppCoach) && (
                  <div className="pgs-coaches">
                    <span className="font-semibold text-[color:var(--text)]">{t('gameStatsPopup.gameInfo.coaches')}: </span>
                    {[myCoach, oppCoach].filter(Boolean).map(c => `${c.firstName} ${c.lastName}`).join(' vs. ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
