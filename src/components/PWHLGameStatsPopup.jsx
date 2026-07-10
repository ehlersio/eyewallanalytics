// components/PWHLGameStatsPopup.jsx
//
// PWHL box-score popup (Session 50) -- triggered from a completed game's
// result-card in PWHLScheduleView.jsx, replacing the old lightweight
// PWHLGamePopup at that click point. Mirrors the NHL side's
// GameStatsPopup.jsx layout (score header, period scoring, three stars,
// team-stat comparison bars, skater/goalie table) but is NOT a port of
// that component -- GameStatsPopup fetches straight from live NHL
// endpoints (landing/boxscore/right-rail/PBP), which have no PWHL
// equivalent, so this fetches PWHL's own Worker routes instead:
//   - /pwhl/game-box?gameId=   -- per-player skater/goalie box score
//     (pwhl_skater_game_box/pwhl_goalie_game_box, Session 41/50)
//   - /pwhl/summary?gameId=    -- period scoring + three stars (already
//     built for PWHLPeriodSummary's shot-map game summary, Session 37-ish)
//   - /pwhl/roster?teamId=     -- player_id -> name resolution (box rows
//     only carry player_id + jersey_number)
//
// Deliberately does NOT fetch/generate an AI narrative -- that stays
// exclusive to the shot-map's PWHLPeriodSummary (isGameSummary mode),
// which already owns it and is one tap away via the CTA below. This popup
// is the lightweight box-score layer; the shot map is the deeper-analytics
// layer. Confirmed with Matt (Session 50): team-level stat-comparison bars
// DO belong inline here, summed client-side from the skater box rows.

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLGameBox, fetchPWHLGameSummary, fetchPWHLRoster } from '../utils/pwhlApi';
import { getPWHLTeamById } from '../utils/pwhlConfig';
import TeamLogo from './TeamLogo';
import { capture } from '../utils/analytics';
import PWHLBoxScoreTable from './PWHLBoxScoreTable';
import './PWHLGameStatsPopup.css';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(d)) return dateStr;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
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

export default function PWHLGameStatsPopup({ game, teamId, abbr, color, onClose, onViewShotMap }) {
  const navigate = useNavigate();
  const [skaterTeam, setSkaterTeam] = useState('car');

  const isHome  = game.home_team_id === teamId;
  const my      = isHome ? game.home_score : game.away_score;
  const op      = isHome ? game.away_score : game.home_score;
  const oppId   = isHome ? game.away_team_id : game.home_team_id;
  const oppTeam = getPWHLTeamById(oppId);
  const oppAbbr = oppTeam?.abbr || String(oppId);
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';
  const won     = my > op;
  const suffix  = game.shootout ? ' (SO)' : game.ot ? ' (OT)' : '';

  useEffect(() => {
    capture('pwhl_game_stats_opened', { gameId: game?.game_id, opponent: oppAbbr });
  }, []);

  const { data: box,     loading: boxLoading }     = useFetch(() => fetchPWHLGameBox(game.game_id), [game.game_id]);
  const { data: summary, loading: summaryLoading }  = useFetch(() => fetchPWHLGameSummary(game.game_id), [game.game_id]);
  const { data: rosters } = useFetch(
    () => Promise.all([fetchPWHLRoster(teamId), fetchPWHLRoster(oppId)]),
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

  // Team-level comparison bars -- summed client-side from skater box rows
  // (confirmed with Matt: belongs inline here, not shot-map-exclusive).
  // PP% intentionally omitted -- no per-game source field on either table.
  const teamStats = useMemo(() => {
    const sum = (rows, field) => rows.reduce((s, r) => s + (r[field] ?? 0), 0);
    const foPct = (rows) => {
      const att = sum(rows, 'faceoff_attempts');
      const win = sum(rows, 'faceoff_wins');
      return att > 0 ? Math.round((win / att) * 100) : null;
    };
    return [
      { label: 'Shots on Goal', car: sum(carSkaters, 'shots'),        opp: sum(oppSkaters, 'shots') },
      { label: 'Hits',          car: sum(carSkaters, 'hits'),         opp: sum(oppSkaters, 'hits') },
      { label: 'Blocked Shots', car: sum(carSkaters, 'blocked_shots'),opp: sum(oppSkaters, 'blocked_shots') },
      { label: 'Penalty Minutes', car: sum(carSkaters, 'penalty_minutes'), opp: sum(oppSkaters, 'penalty_minutes') },
      { label: 'Faceoff Win %', car: foPct(carSkaters), opp: foPct(oppSkaters), isPct: true },
    ];
  }, [carSkaters, oppSkaters]);

  const periods = summary?.periods || [];
  const mvps    = summary?.mvps || [];

  return (
    <div className="pgs-backdrop" onClick={onClose}>
      <div className="pgs-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`pgs-header ${won ? 'pgs-win' : 'pgs-loss'}`}>
          <div className="pgs-header-inner">
            <div className="pgs-team-col">
              <TeamLogo abbr={abbr} sport="pwhl" size={36} color={color} />
              <span className="pgs-abbr" style={{ color }}>{abbr}</span>
              <span className="pgs-score-big" style={{ color }}>{my ?? '—'}</span>
            </div>
            <div className="pgs-center-col">
              <div className={`pgs-result-badge ${won ? 'win' : 'loss'}`}>{won ? 'W' : 'L'}{suffix}</div>
              <div className="pgs-date">{formatDateLong(game.game_date)}</div>
              <div className="pgs-venue">{isHome ? '📍 Home' : '✈ Away'}</div>
            </div>
            <div className="pgs-team-col right">
              <TeamLogo abbr={oppAbbr} sport="pwhl" size={36} color={oppColor} />
              <span className="pgs-abbr" style={{ color: oppColor }}>{oppAbbr}</span>
              <span className="pgs-score-big" style={{ color: oppColor }}>{op ?? '—'}</span>
            </div>
          </div>
          <button className="pgs-close" onClick={onClose} aria-label="Close game details">✕</button>
        </div>

        <div className="pgs-body">
          {/* Period scoring + three stars */}
          {(periods.length > 0 || mvps.length > 0) && (
            <div className="pgs-period-stars-row">
              {periods.length > 0 && (
                <div className="pgs-section pgs-period-col">
                  <div className="pgs-section-label">Scoring by period</div>
                  <div className="pgs-period-table">
                    <div className="pgs-period-row header">
                      <span />
                      {periods.map((p, i) => <span key={i}>{periodLabel(p.info?.id, i)}</span>)}
                      <span>T</span>
                    </div>
                    <div className="pgs-period-row">
                      <span style={{ color }}>{abbr}</span>
                      {periods.map((p, i) => (
                        <span key={i}>{isHome ? (p.stats?.homeGoals ?? 0) : (p.stats?.visitingGoals ?? 0)}</span>
                      ))}
                      <span className="pgs-period-total">{my ?? '—'}</span>
                    </div>
                    <div className="pgs-period-row">
                      <span style={{ color: oppColor }}>{oppAbbr}</span>
                      {periods.map((p, i) => (
                        <span key={i}>{isHome ? (p.stats?.visitingGoals ?? 0) : (p.stats?.homeGoals ?? 0)}</span>
                      ))}
                      <span className="pgs-period-total">{op ?? '—'}</span>
                    </div>
                  </div>
                </div>
              )}
              {mvps.length > 0 && (
                <div className="pgs-section pgs-stars-col">
                  <div className="pgs-section-label">Three stars</div>
                  {mvps.slice(0, 3).map((mvp, i) => {
                    const name = `${mvp.player?.info?.firstName || ''} ${mvp.player?.info?.lastName || ''}`.trim();
                    const isCarStar = mvp.team?.id === teamId;
                    return (
                      <div key={i} className="pgs-star-row">
                        <span className="pgs-star-num">{i === 0 ? '⭐' : i === 1 ? '⭐⭐' : '⭐⭐⭐'}</span>
                        <div className="pgs-star-info">
                          <span className="pgs-star-name">{name || '—'}</span>
                          <span className="pgs-star-team" style={{ color: isCarStar ? color : oppColor }}>
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
            <div className="pgs-loading">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 12, marginBottom: 10, width: `${60 + i * 8}%` }} />
              ))}
            </div>
          )}

          {/* Team stats comparison */}
          {!boxLoading && skaters.length > 0 && (
            <div className="pgs-section">
              <div className="pgs-section-label">Team stats</div>
              <div className="pgs-team-stat-header">
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
                  <div key={i} className="pgs-stat-row">
                    <span className="pgs-stat-val" style={{ color }}>{row.car == null ? '—' : row.isPct ? `${row.car}%` : row.car}</span>
                    <div className="pgs-stat-center">
                      <div className="pgs-stat-label">{row.label}</div>
                      <div className="pgs-dual-bar">
                        <div className="pgs-fill-car" style={{ width: `${carPct}%`, background: color }} />
                        <div className="pgs-fill-opp" style={{ width: `${100 - carPct}%`, background: oppColor }} />
                      </div>
                    </div>
                    <span className="pgs-stat-val opp" style={{ color: oppColor }}>{row.opp == null ? '—' : row.isPct ? `${row.opp}%` : row.opp}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Skater/goalie box score with team toggle */}
          {boxLoading && (
            <div className="pgs-loading">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 12, marginBottom: 10, width: `${60 + i * 8}%` }} />
              ))}
            </div>
          )}
          {!boxLoading && (skaters.length > 0 || goalies.length > 0) && (
            <div className="pgs-section">
              <div className="pgs-skater-toggle">
                <button
                  className={`pgs-toggle-btn${skaterTeam === 'car' ? ' active' : ''}`}
                  style={skaterTeam === 'car' ? { borderColor: color, color } : undefined}
                  onClick={() => setSkaterTeam('car')}
                >
                  <TeamLogo abbr={abbr} sport="pwhl" size={14} color={color} />
                  {abbr} Skaters
                </button>
                <button
                  className={`pgs-toggle-btn${skaterTeam === 'opp' ? ' active' : ''}`}
                  style={skaterTeam === 'opp' ? { borderColor: oppColor, color: oppColor } : undefined}
                  onClick={() => setSkaterTeam('opp')}
                >
                  <TeamLogo abbr={oppAbbr} sport="pwhl" size={14} color={oppColor} />
                  {oppAbbr} Skaters
                </button>
              </div>
              <PWHLBoxScoreTable
                skaters={skaterTeam === 'car' ? carSkaters : oppSkaters}
                goalies={skaterTeam === 'car' ? carGoalies : oppGoalies}
                playerNames={playerNames}
              />
            </div>
          )}
          {!boxLoading && !skaters.length && !goalies.length && (
            <div className="pgs-no-data">Box score not available for this game yet.</div>
          )}

          {/* Shot map CTA */}
          <div className="pgs-cta-wrap">
            <button
              className="pgs-cta-btn"
              style={{ background: color }}
              onClick={() => {
                if (onViewShotMap) { onViewShotMap(); return; }
                onClose?.();
                navigate('/pwhl/shots', { state: { selectedGameId: game.game_id } });
              }}
            >
              View Shot Map &amp; Stats →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
