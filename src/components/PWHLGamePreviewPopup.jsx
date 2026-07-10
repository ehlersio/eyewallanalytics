// components/PWHLGamePreviewPopup.jsx
//
// PWHL pre-game preview popup (Session 51) -- triggered from an upcoming
// game's card in PWHLScheduleView.jsx, mirroring PWHLGameStatsPopup's
// trigger pattern for completed games but sourcing from two new routes:
//   - /pwhl/preview?gameId=    -- season series, all-time head-to-head,
//     streaks, team-scoped leading scorers, special teams (live HockeyTech
//     gameCenterPreview passthrough)
//   - /pwhl/prediction?gameId= -- win probability, Pythagorean expected
//     score, and an AI narrative. This is the PWHL analog of NHL's
//     /prediction/analyze FALLBACK tier (nhl.js:2228), not NHL's preferred
//     DB-first Tier-1 system (ai_predictions.py, RAPM/WAR-driven) -- that
//     one needs shift-level PWHL data that doesn't exist yet. Don't present
//     this as full parity with NHL's "real" prediction system.
//
// corsiForPct is all-situations shot-attempt share (goals+SOG+blocked),
// NOT 5-on-5 filtered -- more complete than NHL's own SOG-share-only proxy
// (includes blocked shots), but not a true 5v5 possession stat. Always
// shown with the response's own corsiCaveat text, never bare.

import React, { useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLPreview, fetchPWHLPrediction } from '../utils/pwhlApi';
import { getPWHLTeamById } from '../utils/pwhlConfig';
import TeamLogo from './TeamLogo';
import { capture } from '../utils/analytics';
import './PWHLGamePreviewPopup.css';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(d)) return dateStr;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatMeetingDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00Z');
  if (isNaN(d)) return dateStr;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// HockeyTech leadingScorers[].stats field names aren't fully confirmed
// (docs/hockeytech-api-notes.md calls it just "full stat line") -- render
// defensively from whatever's actually present rather than assuming a shape.
function statLine(stats) {
  if (!stats) return '—';
  const pts = stats.points ?? stats.pts;
  const g   = stats.goals ?? stats.g;
  const a   = stats.assists ?? stats.a;
  if (pts != null) return `${pts} PTS`;
  if (g != null || a != null) return `${g ?? 0}G ${a ?? 0}A`;
  return '—';
}

// longestStreaks[].player is a full player object ({firstName, lastName,
// id, jerseyNumber, ...}), not a plain name string -- confirmed live
// (Session 51, game 329). Rendering it raw crashed the popup with "Objects
// are not valid as a React child."
function streakPlayerName(player) {
  if (!player) return '—';
  if (typeof player === 'string') return player;
  return `${player.firstName || ''} ${player.lastName || ''}`.trim() || '—';
}

// Same defensiveness as statLine above -- powerPlayStats/penaltyKillStats'
// "pre-computed percentage" field name isn't confirmed in
// docs/hockeytech-api-notes.md, only that one exists. Try the plausible
// names rather than assume; renders '—' if none match instead of guessing.
function pctValue(splitStats) {
  if (!splitStats) return null;
  const v = splitStats.pct ?? splitStats.percentage ?? splitStats.percent ??
    splitStats.power_play_pct ?? splitStats.penalty_kill_pct;
  if (v == null) return null;
  const n = parseFloat(String(v).replace('%', ''));
  if (isNaN(n)) return null;
  return n <= 1 ? n * 100 : n;
}

export default function PWHLGamePreviewPopup({ game, teamId, abbr, color, onClose }) {
  const isHome   = game.home_team_id === teamId;
  const oppId    = isHome ? game.away_team_id : game.home_team_id;
  const oppTeam  = getPWHLTeamById(oppId);
  const oppAbbr  = oppTeam?.abbr || String(oppId);
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';

  useEffect(() => {
    capture('pwhl_game_preview_opened', { gameId: game?.game_id, opponent: oppAbbr });
  }, []);

  const { data: preview,    loading: previewLoading }    = useFetch(() => fetchPWHLPreview(game.game_id), [game.game_id]);
  const { data: prediction, loading: predictionLoading } = useFetch(() => fetchPWHLPrediction(game.game_id), [game.game_id]);

  // Both routes are keyed by home/away, not by "my team" -- remap once here.
  const myWinPct  = prediction ? (isHome ? prediction.homeWinPct  : prediction.awayWinPct)  : null;
  const oppWinPct = prediction ? (isHome ? prediction.awayWinPct  : prediction.homeWinPct)  : null;
  const myExp     = prediction ? (isHome ? prediction.expHome     : prediction.expAway)     : null;
  const oppExp    = prediction ? (isHome ? prediction.expAway     : prediction.expHome)     : null;
  const myStreak  = prediction ? (isHome ? prediction.homeStreak  : prediction.awayStreak)  : null;
  const oppStreak = prediction ? (isHome ? prediction.awayStreak  : prediction.homeStreak)  : null;
  const myCorsi   = prediction ? (isHome ? prediction.corsiForPct?.home : prediction.corsiForPct?.away) : null;
  const oppCorsi  = prediction ? (isHome ? prediction.corsiForPct?.away : prediction.corsiForPct?.home) : null;

  const myPreviewTeam  = preview ? (isHome ? preview.homeTeam : preview.visitingTeam) : null;
  const oppPreviewTeam = preview ? (isHome ? preview.visitingTeam : preview.homeTeam) : null;
  const myH2H  = preview?.headToHeadRecords ? (isHome ? preview.headToHeadRecords.homeTeam : preview.headToHeadRecords.visitingTeam) : null;
  const oppH2H = preview?.headToHeadRecords ? (isHome ? preview.headToHeadRecords.visitingTeam : preview.headToHeadRecords.homeTeam) : null;
  const myStreaksList  = preview ? (isHome ? preview.longestStreaks?.home : preview.longestStreaks?.visiting) : null;
  const oppStreaksList = preview ? (isHome ? preview.longestStreaks?.visiting : preview.longestStreaks?.home) : null;

  const seasonSeries = preview?.seasonSeries || [];

  return (
    <div className="pgp-backdrop" onClick={onClose}>
      <div className="pgp-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="pgp-header">
          <div className="pgp-header-inner">
            <div className="pgp-team-col">
              <TeamLogo abbr={abbr} sport="pwhl" size={36} color={color} />
              <span className="pgp-abbr" style={{ color }}>{abbr}</span>
              {prediction && <span className="pgp-winpct" style={{ color }}>{myWinPct}%</span>}
            </div>
            <div className="pgp-center-col">
              <div className="pgp-vs">Preview</div>
              <div className="pgp-date">{formatDateLong(game.game_date)}</div>
              <div className="pgp-venue">{isHome ? '📍 Home' : '✈ Away'}</div>
            </div>
            <div className="pgp-team-col right">
              <TeamLogo abbr={oppAbbr} sport="pwhl" size={36} color={oppColor} />
              <span className="pgp-abbr" style={{ color: oppColor }}>{oppAbbr}</span>
              {prediction && <span className="pgp-winpct" style={{ color: oppColor }}>{oppWinPct}%</span>}
            </div>
          </div>
          <button className="pgp-close" onClick={onClose} aria-label="Close game preview">✕</button>
        </div>

        <div className="pgp-body">
          {/* Prediction */}
          <div className="pgp-section">
            <div className="pgp-section-label">Prediction</div>
            {predictionLoading && !prediction && (
              <div className="pgp-loading">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 12, marginBottom: 10, width: `${60 + i * 8}%` }} />
                ))}
              </div>
            )}
            {!predictionLoading && !prediction && (
              <div className="pgp-no-data">Prediction not available for this game.</div>
            )}
            {prediction && (
              <>
                <div className="pgp-winbar">
                  <div className="pgp-winbar-fill" style={{ width: `${myWinPct}%`, background: color }} />
                  <div className="pgp-winbar-fill" style={{ width: `${oppWinPct}%`, background: oppColor }} />
                </div>
                <div className="pgp-exp-row">
                  <span style={{ color }}>{myExp}</span>
                  <span className="pgp-exp-label">Expected score</span>
                  <span style={{ color: oppColor }}>{oppExp}</span>
                </div>
                <p className="pgp-narrative">{prediction.narrative}</p>
                <div className="pgp-stat-grid">
                  <div className="pgp-stat-grid-row">
                    <span style={{ color }}>{myStreak}</span>
                    <span className="pgp-stat-grid-label">Streak</span>
                    <span style={{ color: oppColor }}>{oppStreak}</span>
                  </div>
                  <div className="pgp-stat-grid-row">
                    <span style={{ color }}>{myCorsi != null ? `${myCorsi.toFixed(1)}%` : '—'}</span>
                    <span className="pgp-stat-grid-label">Shot-attempt share</span>
                    <span style={{ color: oppColor }}>{oppCorsi != null ? `${oppCorsi.toFixed(1)}%` : '—'}</span>
                  </div>
                </div>
                {prediction.corsiCaveat && <div className="pgp-caveat">Shot-attempt share is {prediction.corsiCaveat.toLowerCase()}</div>}
              </>
            )}
          </div>

          {/* Season series */}
          {previewLoading && !preview && (
            <div className="pgp-section">
              <div className="pgp-loading">
                <div className="skeleton" style={{ height: 12, width: '50%' }} />
              </div>
            </div>
          )}
          {preview && (
            <div className="pgp-section">
              <div className="pgp-section-label">Season Series</div>
              {seasonSeries.length === 0 && <div className="pgp-no-data">First meeting this season.</div>}
              {seasonSeries.length > 0 && (
                <div className="pgp-series-list">
                  {seasonSeries.map(m => {
                    const meetingMyIsHome = m.homeTeamId === teamId;
                    const meetingMyScore  = meetingMyIsHome ? m.homeScore : m.visitingScore;
                    const meetingOppScore = meetingMyIsHome ? m.visitingScore : m.homeScore;
                    const won = meetingMyScore > meetingOppScore;
                    return (
                      <div key={m.gameId} className="pgp-series-row">
                        <span className="pgp-series-date">{formatMeetingDate(m.datePlayed)}</span>
                        <span className={`pgp-series-result ${won ? 'win' : 'loss'}`}>{won ? 'W' : 'L'}</span>
                        <span className="pgp-series-score">{meetingMyScore}–{meetingOppScore}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* All-time head-to-head */}
              {(myH2H?.previousFiveYears?.formattedRecord || oppH2H?.previousFiveYears?.formattedRecord) && (
                <div className="pgp-h2h-row">
                  <span style={{ color }}>{myH2H?.previousFiveYears?.formattedRecord || '—'}</span>
                  <span className="pgp-h2h-label">Last 5 seasons vs {oppAbbr}</span>
                  <span style={{ color: oppColor }}>{oppH2H?.previousFiveYears?.formattedRecord || '—'}</span>
                </div>
              )}
            </div>
          )}

          {/* Team form */}
          {preview && (myPreviewTeam?.overallRecord || oppPreviewTeam?.overallRecord) && (
            <div className="pgp-section">
              <div className="pgp-section-label">Team Form</div>
              <div className="pgp-form-row">
                <div className="pgp-form-col">
                  <span className="pgp-form-record" style={{ color }}>{myPreviewTeam?.overallRecord || '—'}</span>
                  <span className="pgp-form-sub">Last 10: {myPreviewTeam?.last10Record || '—'}</span>
                </div>
                <div className="pgp-form-col right">
                  <span className="pgp-form-record" style={{ color: oppColor }}>{oppPreviewTeam?.overallRecord || '—'}</span>
                  <span className="pgp-form-sub">Last 10: {oppPreviewTeam?.last10Record || '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Player hot streaks — top entries only, per category, tight by design */}
          {preview && ((myStreaksList?.points?.length > 0) || (oppStreaksList?.points?.length > 0)) && (
            <div className="pgp-section">
              <div className="pgp-section-label">Hot Streaks</div>
              <div className="pgp-streaks-cols">
                <div className="pgp-streaks-col">
                  {(myStreaksList?.points || []).slice(0, 2).map((s, i) => (
                    <div key={i} className="pgp-streak-item">
                      <span className="pgp-streak-name">{streakPlayerName(s.player)}</span>
                      <span className="pgp-streak-val" style={{ color }}>{s.length}-game pt streak</span>
                    </div>
                  ))}
                </div>
                <div className="pgp-streaks-col right">
                  {(oppStreaksList?.points || []).slice(0, 2).map((s, i) => (
                    <div key={i} className="pgp-streak-item right">
                      <span className="pgp-streak-val" style={{ color: oppColor }}>{s.length}-game pt streak</span>
                      <span className="pgp-streak-name">{streakPlayerName(s.player)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Team leaders */}
          {preview && ((myPreviewTeam?.leadingScorers?.length > 0) || (oppPreviewTeam?.leadingScorers?.length > 0)) && (
            <div className="pgp-section">
              <div className="pgp-section-label">Team Leaders</div>
              <div className="pgp-leaders-cols">
                <div className="pgp-leaders-col">
                  {(myPreviewTeam?.leadingScorers || []).slice(0, 3).map((p, i) => (
                    <div key={i} className="pgp-leader-row">
                      <span className="pgp-leader-name">{p.name || '—'}</span>
                      <span className="pgp-leader-stat" style={{ color }}>{statLine(p.stats)}</span>
                    </div>
                  ))}
                </div>
                <div className="pgp-leaders-col right">
                  {(oppPreviewTeam?.leadingScorers || []).slice(0, 3).map((p, i) => (
                    <div key={i} className="pgp-leader-row right">
                      <span className="pgp-leader-stat" style={{ color: oppColor }}>{statLine(p.stats)}</span>
                      <span className="pgp-leader-name">{p.name || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Special teams */}
          {preview && (myPreviewTeam?.powerPlay || oppPreviewTeam?.powerPlay) && (
            <div className="pgp-section">
              <div className="pgp-section-label">Special Teams</div>
              <div className="pgp-stat-grid">
                <div className="pgp-stat-grid-row">
                  <span style={{ color }}>{pctValue(myPreviewTeam?.powerPlay) != null ? `${pctValue(myPreviewTeam.powerPlay).toFixed(1)}%` : '—'}</span>
                  <span className="pgp-stat-grid-label">Power Play</span>
                  <span style={{ color: oppColor }}>{pctValue(oppPreviewTeam?.powerPlay) != null ? `${pctValue(oppPreviewTeam.powerPlay).toFixed(1)}%` : '—'}</span>
                </div>
                <div className="pgp-stat-grid-row">
                  <span style={{ color }}>{pctValue(myPreviewTeam?.penaltyKill) != null ? `${pctValue(myPreviewTeam.penaltyKill).toFixed(1)}%` : '—'}</span>
                  <span className="pgp-stat-grid-label">Penalty Kill</span>
                  <span style={{ color: oppColor }}>{pctValue(oppPreviewTeam?.penaltyKill) != null ? `${pctValue(oppPreviewTeam.penaltyKill).toFixed(1)}%` : '—'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
