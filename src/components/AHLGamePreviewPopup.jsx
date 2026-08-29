// components/AHLGamePreviewPopup.jsx
//
// AHL pre-game preview popup, triggered from an upcoming game's card in
// AHLScheduleView.jsx -- port of PWHLGamePreviewPopup.jsx, sourcing from:
//   - /ahl/preview?gameId=    -- season series, all-time head-to-head,
//     streaks, team-scoped leading scorers, special teams
//   - /ahl/prediction?gameId= -- win probability, expected score, AI
//     narrative. No corsiForPct anywhere in this response -- ahl_team_
//     seasons has no shot-attempts data source (see eyewall-poller's
//     ahl.js route comment) -- so this popup never renders a shot-
//     attempt-share row at all, unlike PWHL's.
//
// AHL's raw gameCenterPreview payload has real field-NAME differences
// from PWHL's, confirmed live 2026-08-29 against a real game:
//   - overallRecord/last10Record don't exist -- use
//     teamRecord.overall.formattedRecord / teamRecord.past_10_games.formattedRecord
//   - longestStreaks/leadingScorers are nested per-team (homeTeam.longestStreaks,
//     not a top-level {home, visiting} split like PWHL's)
//   - powerPlay/penaltyKill don't exist -- use powerPlayStats.overall.percentage /
//     penaltyKillStats.overall.percentage (already a plain 0-100 number,
//     no need for PWHL's multi-field-name pctValue() guessing)
//   - seasonSeries doesn't exist -- the equivalent top-level array is
//     called previousMeetings, same per-row field names (gameId,
//     homeTeamId, homeScore, visitingScore, datePlayed)
// headToHeadRecords keeps the identical shape (previousFiveYears.formattedRecord).
//
// No prediction-share/export section (PWHLPredictionShareCanvas) -- out
// of this phase's scope.

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import { formatDate as formatDateIntl } from '../utils/formatters';
import { fetchAHLPreview, fetchAHLPrediction } from '../utils/ahlApi';
import { getAHLTeamById } from '../utils/ahlConfig';
import TeamLogo from './TeamLogo';
import { capture } from '../utils/analytics';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';
import { saveAHLPrediction, getAHLPredictionStats } from '../utils/ahlPredictionStore';

const PGP_TEAM_COL_CLASSES = 'pgp-team-col flex flex-col items-center gap-1 flex-1';
const PGP_SECTION_LABEL_CLASSES = 'pgp-section-label font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-dim)] pb-1.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2';
const PGP_STAT_GRID_ROW_CLASSES = 'pgp-stat-grid-row grid gap-2 items-center font-[family-name:var(--font-mono)] text-[13px] font-semibold [grid-template-columns:1fr_auto_1fr] [&>span:first-child]:text-right [&>span:last-child]:text-left';
const PGP_STAT_GRID_LABEL_CLASSES = 'pgp-stat-grid-label font-[family-name:var(--font-body)] text-[10px] font-medium text-[color:var(--text-dim)] text-center';

function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(d)) return dateStr;
  return `${formatDateIntl(d, { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatMeetingDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00Z');
  if (isNaN(d)) return dateStr;
  return `${formatDateIntl(d, { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`;
}

function statLine(stats) {
  if (!stats) return '—';
  const pts = stats.points ?? stats.pts;
  const g   = stats.goals ?? stats.g;
  const a   = stats.assists ?? stats.a;
  if (pts != null) return `${pts} PTS`;
  if (g != null || a != null) return `${g ?? 0}G ${a ?? 0}A`;
  return '—';
}

function streakPlayerName(player) {
  if (!player) return '—';
  if (typeof player === 'string') return player;
  return `${player.firstName || ''} ${player.lastName || ''}`.trim() || '—';
}

export default function AHLGamePreviewPopup({ game, teamId, abbr, color, onClose }) {
  const { t } = useTranslation();
  const isHome   = game.home_team_id === teamId;
  const oppId    = isHome ? game.away_team_id : game.home_team_id;
  const oppTeam  = getAHLTeamById(oppId);
  const oppAbbr  = oppTeam?.abbr || String(oppId);
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';

  useEffect(() => {
    capture('ahl_game_preview_opened', { gameId: game?.game_id, opponent: oppAbbr });
  }, []);

  const { data: preview,    loading: previewLoading }    = useFetch(() => fetchAHLPreview(game.game_id), [game.game_id]);
  const { data: prediction, loading: predictionLoading } = useFetch(() => fetchAHLPrediction(game.game_id), [game.game_id]);

  // Auto-save this prediction for track-record tallying once the game
  // completes -- recordAHLOutcome() is called from AHLScheduleView.jsx's
  // completed-games sweep, keyed by the same game_id.
  useEffect(() => {
    if (!game?.game_id || !prediction) return;
    saveAHLPrediction({
      gameId:              game.game_id,
      gameDate:            game.game_date,
      opponent:            oppAbbr,
      predictedTeamWin:    (isHome ? prediction.homeWinPct : prediction.awayWinPct) >=
                           (isHome ? prediction.awayWinPct : prediction.homeWinPct),
      predictedTeamScore:  isHome ? prediction.expHome : prediction.expAway,
      predictedOppScore:   isHome ? prediction.expAway : prediction.expHome,
    });
  }, [game?.game_id, prediction]);

  const predStats = getAHLPredictionStats();

  const myWinPct  = prediction ? (isHome ? prediction.homeWinPct  : prediction.awayWinPct)  : null;
  const oppWinPct = prediction ? (isHome ? prediction.awayWinPct  : prediction.homeWinPct)  : null;
  const myExp     = prediction ? (isHome ? prediction.expHome     : prediction.expAway)     : null;
  const oppExp    = prediction ? (isHome ? prediction.expAway     : prediction.expHome)     : null;
  const myStreak  = prediction ? (isHome ? prediction.homeStreak  : prediction.awayStreak)  : null;
  const oppStreak = prediction ? (isHome ? prediction.awayStreak  : prediction.homeStreak)  : null;

  const myPreviewTeam  = preview ? (isHome ? preview.homeTeam : preview.visitingTeam) : null;
  const oppPreviewTeam = preview ? (isHome ? preview.visitingTeam : preview.homeTeam) : null;
  const myH2H  = preview?.headToHeadRecords ? (isHome ? preview.headToHeadRecords.homeTeam : preview.headToHeadRecords.visitingTeam) : null;
  const oppH2H = preview?.headToHeadRecords ? (isHome ? preview.headToHeadRecords.visitingTeam : preview.headToHeadRecords.homeTeam) : null;
  const myStreaksList  = myPreviewTeam?.longestStreaks;
  const oppStreaksList = oppPreviewTeam?.longestStreaks;

  const seasonSeries = preview?.previousMeetings || [];

  return (
    <div className="pgp-backdrop fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-end justify-center z-[200] min-[560px]:items-center min-[560px]:p-4" onClick={onClose}>
      <div className="pgp-card bg-[var(--bg1)] border-[0.5px] border-[color:var(--border-2)] rounded-t-[var(--radius-lg)] w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.5)] min-[560px]:rounded-[var(--radius-lg)]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="pgp-header p-4 border-b-[0.5px] border-b-[color:var(--border)] relative">
          <div className="pgp-header-inner flex items-center justify-between gap-3">
            <div className={PGP_TEAM_COL_CLASSES}>
              <TeamLogo abbr={abbr} sport="ahl" size={36} color={color} />
              <span className="pgp-abbr font-[family-name:var(--font-display)] text-[14px] font-bold tracking-[0.06em]" style={{ color }}>{abbr}</span>
              {prediction && <span className="pgp-winpct font-[family-name:var(--font-display)] text-[22px] font-bold leading-none" style={{ color }}>{myWinPct}%</span>}
            </div>
            <div className="pgp-center-col flex flex-col items-center gap-1">
              <div className="pgp-vs font-[family-name:var(--font-display)] text-[11px] font-bold tracking-[0.08em] uppercase text-[color:var(--text-dim)]">{t('pwhlGamePreview.header.previewLabel')}</div>
              <div className="pgp-date text-[11px] text-[color:var(--text-muted)]">{formatDateLong(game.game_date)}</div>
              <div className="pgp-venue text-[10px] text-[color:var(--text-dim)]">{isHome ? '📍' : '✈'} {game.venue_name || (isHome ? t('scheduleView.resultCard.home') : t('scheduleView.resultCard.away'))}</div>
            </div>
            <div className={`${PGP_TEAM_COL_CLASSES} right`}>
              <TeamLogo abbr={oppAbbr} sport="ahl" size={36} color={oppColor} />
              <span className="pgp-abbr font-[family-name:var(--font-display)] text-[14px] font-bold tracking-[0.06em]" style={{ color: oppColor }}>{oppAbbr}</span>
              {prediction && <span className="pgp-winpct font-[family-name:var(--font-display)] text-[22px] font-bold leading-none" style={{ color: oppColor }}>{oppWinPct}%</span>}
            </div>
          </div>
          <button className="pgp-close absolute top-3 right-3 w-7 h-7 rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]" onClick={onClose} aria-label={t('pwhlGamePreview.header.closeAriaLabel')}>✕</button>
        </div>

        <div className="pgp-body pt-4 px-4 pb-6">
          {/* Prediction */}
          <div className="pgp-section mt-4.5 first:mt-0">
            <div className={PGP_SECTION_LABEL_CLASSES}>{t('pwhlGamePreview.prediction.sectionLabel')}</div>
            {predStats.total > 0 && (
              <div className="pgp-track-record text-[10px] text-[color:var(--text-muted)] mb-2 -mt-0.5">
                {t('common.trackRecordLine', { correct: predStats.correct, total: predStats.total, pct: predStats.pct })}
              </div>
            )}
            {predictionLoading && !prediction && (
              <div className="pgp-loading py-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={SKELETON_CLASSES} style={{ height: 12, marginBottom: 10, width: `${60 + i * 8}%` }} />
                ))}
              </div>
            )}
            {!predictionLoading && !prediction && (
              <div className="pgp-no-data text-[12px] text-[color:var(--text-dim)] text-center py-3 italic">{t('pwhlGamePreview.prediction.notAvailable')}</div>
            )}
            {prediction && (
              <>
                <div className="pgp-winbar flex h-2 rounded overflow-hidden bg-[var(--bg3)] mb-2">
                  <div className="pgp-winbar-fill h-full" style={{ width: `${myWinPct}%`, background: color }} />
                  <div className="pgp-winbar-fill h-full" style={{ width: `${oppWinPct}%`, background: oppColor }} />
                </div>
                <div className="pgp-exp-row grid gap-2 items-center font-[family-name:var(--font-mono)] text-[16px] font-semibold text-center mb-2.5 [grid-template-columns:1fr_auto_1fr] [&>span:first-child]:text-right [&>span:last-child]:text-left">
                  <span style={{ color }}>{myExp}</span>
                  <span className="pgp-exp-label font-[family-name:var(--font-body)] text-[9px] font-semibold text-[color:var(--text-dim)] uppercase tracking-[0.06em]">{t('pwhlGamePreview.prediction.expectedScoreLabel')}</span>
                  <span style={{ color: oppColor }}>{oppExp}</span>
                </div>
                <p className="pgp-narrative text-[13px] leading-[1.5] text-[color:var(--text-muted)] my-0 mb-3">{prediction.narrative}</p>
                <div className="pgp-stat-grid flex flex-col gap-2">
                  <div className={PGP_STAT_GRID_ROW_CLASSES}>
                    <span style={{ color }}>{myStreak}</span>
                    <span className={PGP_STAT_GRID_LABEL_CLASSES}>{t('pwhlGamePreview.prediction.streakLabel')}</span>
                    <span style={{ color: oppColor }}>{oppStreak}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Season series */}
          {previewLoading && !preview && (
            <div className="pgp-section mt-4.5">
              <div className="pgp-loading py-3">
                <div className={SKELETON_CLASSES} style={{ height: 12, width: '50%' }} />
              </div>
            </div>
          )}
          {preview && (
            <div className="pgp-section mt-4.5">
              <div className={PGP_SECTION_LABEL_CLASSES}>{t('pwhlGamePreview.seasonSeries.header')}</div>
              {seasonSeries.length === 0 && <div className="pgp-no-data text-[12px] text-[color:var(--text-dim)] text-center py-3 italic">{t('pwhlGamePreview.seasonSeries.empty')}</div>}
              {seasonSeries.length > 0 && (
                <div className="pgp-series-list flex flex-col gap-0.5 max-h-[140px] overflow-y-auto">
                  {seasonSeries.map(m => {
                    const meetingMyIsHome = Number(m.homeTeamId) === teamId;
                    const meetingMyScore  = Number(meetingMyIsHome ? m.homeScore : m.visitingScore);
                    const meetingOppScore = Number(meetingMyIsHome ? m.visitingScore : m.homeScore);
                    const won = meetingMyScore > meetingOppScore;
                    return (
                      <div key={m.gameId} className="pgp-series-row grid gap-2.5 items-center text-[12px] py-1 border-b-[0.5px] border-b-[color:var(--border)] [grid-template-columns:1fr_auto_auto]">
                        <span className="pgp-series-date text-[color:var(--text-dim)]">{formatMeetingDate(m.datePlayed)}</span>
                        <span className={`pgp-series-result font-[family-name:var(--font-display)] font-bold text-[11px] ${won ? 'win text-[color:var(--green)]' : 'loss text-[color:var(--red-bright)]'}`}>{won ? 'W' : 'L'}</span>
                        <span className="pgp-series-score font-[family-name:var(--font-mono)] text-[color:var(--text-muted)]">{meetingMyScore}–{meetingOppScore}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* All-time head-to-head */}
              {(myH2H?.previousFiveYears?.formattedRecord || oppH2H?.previousFiveYears?.formattedRecord) && (
                <div className="pgp-h2h-row grid gap-2 items-center font-[family-name:var(--font-mono)] text-[12px] font-semibold mt-2.5 [grid-template-columns:auto_1fr_auto]">
                  <span style={{ color }}>{myH2H?.previousFiveYears?.formattedRecord || '—'}</span>
                  <span className="pgp-h2h-label font-[family-name:var(--font-body)] text-[9px] font-medium text-[color:var(--text-dim)] text-center uppercase tracking-[0.04em]">{t('pwhlGamePreview.seasonSeries.last5SeasonsVs', { oppAbbr })}</span>
                  <span style={{ color: oppColor }}>{oppH2H?.previousFiveYears?.formattedRecord || '—'}</span>
                </div>
              )}
            </div>
          )}

          {/* Team form */}
          {preview && (myPreviewTeam?.teamRecord?.overall || oppPreviewTeam?.teamRecord?.overall) && (
            <div className="pgp-section mt-4.5">
              <div className={PGP_SECTION_LABEL_CLASSES}>{t('pwhlGamePreview.teamForm.header')}</div>
              <div className="pgp-form-row flex justify-between">
                <div className="pgp-form-col flex flex-col gap-0.5">
                  <span className="pgp-form-record font-[family-name:var(--font-mono)] text-[14px] font-bold" style={{ color }}>{myPreviewTeam?.teamRecord?.overall?.formattedRecord || '—'}</span>
                  <span className="pgp-form-sub text-[10px] text-[color:var(--text-dim)]">{t('pwhlGamePreview.teamForm.last10', { record: myPreviewTeam?.teamRecord?.past_10_games?.formattedRecord || '—' })}</span>
                </div>
                <div className="pgp-form-col right flex flex-col gap-0.5 items-end">
                  <span className="pgp-form-record font-[family-name:var(--font-mono)] text-[14px] font-bold" style={{ color: oppColor }}>{oppPreviewTeam?.teamRecord?.overall?.formattedRecord || '—'}</span>
                  <span className="pgp-form-sub text-[10px] text-[color:var(--text-dim)]">{t('pwhlGamePreview.teamForm.last10', { record: oppPreviewTeam?.teamRecord?.past_10_games?.formattedRecord || '—' })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Player hot streaks */}
          {preview && ((myStreaksList?.points?.length > 0) || (oppStreaksList?.points?.length > 0)) && (
            <div className="pgp-section mt-4.5">
              <div className={PGP_SECTION_LABEL_CLASSES}>{t('pwhlGamePreview.hotStreaks.header')}</div>
              <div className="pgp-streaks-cols flex gap-4">
                <div className="pgp-streaks-col flex-1 flex flex-col gap-1.5 min-w-0">
                  {(myStreaksList?.points || []).slice(0, 2).map((s, i) => (
                    <div key={i} className="pgp-streak-item flex flex-col gap-px">
                      <span className="pgp-streak-name text-[12px] text-[color:var(--text)] overflow-hidden text-ellipsis whitespace-nowrap max-w-full">{streakPlayerName(s.player)}</span>
                      <span className="pgp-streak-val font-[family-name:var(--font-mono)] text-[11px] font-semibold" style={{ color }}>{t('pwhlGamePreview.hotStreaks.streakLine', { n: s.length })}</span>
                    </div>
                  ))}
                </div>
                <div className="pgp-streaks-col right flex-1 flex flex-col gap-1.5 min-w-0 items-end">
                  {(oppStreaksList?.points || []).slice(0, 2).map((s, i) => (
                    <div key={i} className="pgp-streak-item right flex flex-col gap-px items-end">
                      <span className="pgp-streak-val font-[family-name:var(--font-mono)] text-[11px] font-semibold" style={{ color: oppColor }}>{t('pwhlGamePreview.hotStreaks.streakLine', { n: s.length })}</span>
                      <span className="pgp-streak-name text-[12px] text-[color:var(--text)] overflow-hidden text-ellipsis whitespace-nowrap max-w-full">{streakPlayerName(s.player)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Team leaders */}
          {preview && ((myPreviewTeam?.leadingScorers?.length > 0) || (oppPreviewTeam?.leadingScorers?.length > 0)) && (
            <div className="pgp-section mt-4.5">
              <div className={PGP_SECTION_LABEL_CLASSES}>{t('pwhlGamePreview.teamLeaders.header')}</div>
              <div className="pgp-leaders-cols flex gap-4">
                <div className="pgp-leaders-col flex-1 flex flex-col gap-1.5 min-w-0">
                  {(myPreviewTeam?.leadingScorers || []).slice(0, 3).map((p, i) => {
                    const name = `${p.info?.firstName || ''} ${p.info?.lastName || ''}`.trim();
                    return (
                      <div key={i} className="pgp-leader-row flex flex-col gap-px">
                        <span className="pgp-leader-name text-[12px] text-[color:var(--text)] overflow-hidden text-ellipsis whitespace-nowrap max-w-full">{name || '—'}</span>
                        <span className="pgp-leader-stat font-[family-name:var(--font-mono)] text-[11px] font-semibold" style={{ color }}>{statLine(p.stats)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="pgp-leaders-col right flex-1 flex flex-col gap-1.5 min-w-0 items-end">
                  {(oppPreviewTeam?.leadingScorers || []).slice(0, 3).map((p, i) => {
                    const name = `${p.info?.firstName || ''} ${p.info?.lastName || ''}`.trim();
                    return (
                      <div key={i} className="pgp-leader-row right flex flex-col gap-px items-end">
                        <span className="pgp-leader-stat font-[family-name:var(--font-mono)] text-[11px] font-semibold" style={{ color: oppColor }}>{statLine(p.stats)}</span>
                        <span className="pgp-leader-name text-[12px] text-[color:var(--text)] overflow-hidden text-ellipsis whitespace-nowrap max-w-full">{name || '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Special teams */}
          {preview && (myPreviewTeam?.powerPlayStats || oppPreviewTeam?.powerPlayStats) && (
            <div className="pgp-section mt-4.5">
              <div className={PGP_SECTION_LABEL_CLASSES}>{t('pwhlGamePreview.specialTeams.header')}</div>
              <div className="pgp-stat-grid flex flex-col gap-1.5">
                <div className={PGP_STAT_GRID_ROW_CLASSES}>
                  <span style={{ color }}>{myPreviewTeam?.powerPlayStats?.overall?.percentage != null ? `${myPreviewTeam.powerPlayStats.overall.percentage.toFixed(1)}%` : '—'}</span>
                  <span className={PGP_STAT_GRID_LABEL_CLASSES}>{t('pwhlGamePreview.specialTeams.powerPlayLabel')}</span>
                  <span style={{ color: oppColor }}>{oppPreviewTeam?.powerPlayStats?.overall?.percentage != null ? `${oppPreviewTeam.powerPlayStats.overall.percentage.toFixed(1)}%` : '—'}</span>
                </div>
                <div className={PGP_STAT_GRID_ROW_CLASSES}>
                  <span style={{ color }}>{myPreviewTeam?.penaltyKillStats?.overall?.percentage != null ? `${myPreviewTeam.penaltyKillStats.overall.percentage.toFixed(1)}%` : '—'}</span>
                  <span className={PGP_STAT_GRID_LABEL_CLASSES}>{t('pwhlGamePreview.specialTeams.penaltyKillLabel')}</span>
                  <span style={{ color: oppColor }}>{oppPreviewTeam?.penaltyKillStats?.overall?.percentage != null ? `${oppPreviewTeam.penaltyKillStats.overall.percentage.toFixed(1)}%` : '—'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
