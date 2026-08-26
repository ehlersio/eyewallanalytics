import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import {
  getCompletedGameStats, getOpponent, isHomeGame, getCarScore, getOppScore,
  formatGameDate, TEAM_COLORS,
} from '../utils/nhlApi';
import { computeShotAttempts, computePDO, computePuckLuck } from '../utils/advancedStats';
import TeamLogo from '../components/TeamLogo';
import InfoTip from '../components/InfoTip';
import { capture } from '../utils/analytics';
import { TEAM_CONFIG } from '../utils/teamConfig';


// ── Game stats popup ─────────────────────────────────────────
import { PeriodTable, SkaterTable, GoalsList } from '../components/GameStatsComponents';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

// Styling used to come from ScheduleView.css -- migrated to Tailwind here
// (Phase 6, ScheduleView.css sub-PR 3). The AI Game Summary Card block
// below (.gp-summary-*) is deliberately left untouched -- out of scope,
// migrates in sub-PR 5 alongside the rest of the AI/prediction surface.
// .game-popup { position: relative } was a second, later declaration of
// the same selector in the original CSS (the base rule earlier only set
// background/border/etc, no position) -- folded into one Tailwind
// className here rather than carried as two separate rules.
// .gp-star-row/.gp-star-num/.gp-star-name/.gp-star-team below are also
// each split across two non-adjacent sections in the original CSS with
// real value conflicts (gap, padding, width vs flex-shrink, font-size) --
// the classes here use the final cascade-resolved values (confirmed via
// the Phase 6 investigation), not either section's raw values alone.
// Fixed a real pre-existing bug along the way: the "OPP" label in the
// advanced-stats header row used a bare `.muted` class that was never
// actually defined anywhere in the app (only ever `.X.muted` compound
// modifiers existed elsewhere) -- it rendered with zero styling instead of
// the dimmed color every sibling `.muted` label in this same popup uses.
const GP_TEAM_COL_CLASSES = 'gp-team-col flex flex-col items-center gap-1 flex-1';
const GP_RESULT_BADGE_CLASSES = 'gp-result-badge font-[family-name:var(--font-display)] text-[12px] font-bold py-[3px] px-2.5 rounded-[20px]';
const GP_STAT_VAL_CLASSES = 'gp-stat-val font-[family-name:var(--font-mono)] text-[13px] font-medium text-center';
const GP_ADV_ROW_CLASSES = 'gp-adv-row grid gap-1.5 items-center text-[12px] [grid-template-columns:90px_28px_1fr_28px]';
// .dual-bar/.fill-team-primary/.fill-opp/.gp-adv-fill.team-primary-fill
// (index.css, Phase 7b) -- .dual-bar kept as a literal marker since
// index.css's `[data-theme="light"] .dual-bar {...}` override still
// targets it by name (unlayered CSS beats layered Tailwind regardless, so
// the dark bg below stays plain Tailwind while only the light override
// needs the real selector). The fill classes have no light-mode override
// and no shared-variant-function composition risk (literal per-callsite
// classNames, unlike .team-primary-text), so they convert cleanly.
const DUAL_BAR_CLASSES = 'dual-bar flex h-[5px] rounded-[3px] overflow-hidden bg-[rgba(255,255,255,0.07)]';
const FILL_TEAM_PRIMARY_CLASSES = 'h-full bg-[var(--team-primary)] opacity-[0.85]';
const FILL_OPP_CLASSES = 'bg-[var(--blue-bright)] opacity-[0.7]';
// .skater-toggle-btn:hover{color:var(--text)} and .active-car/.active-opp's
// own color are equal-specificity compound selectors in the original CSS --
// active wins on hover too since it's later in source. A plain Tailwind
// hover: utility would instead win on specificity regardless of source
// order, so the hover color only gets added for the non-active variant here
// rather than stacked unconditionally on the shared base. `bg-transparent`
// and the base border-color were also dropped from this shared base (Phase
// 6, ScheduleView.css sub-PR 4 follow-up fix) -- they had been stacked
// unconditionally alongside active-opp's own bg-[var(--blue-dim)]/
// border-color, the same "two conflicting arbitrary-value utilities in one
// class string" ambiguity caught and fixed elsewhere this same sub-PR
// (.sort-btn/.vm-btn) -- each state now supplies its own complete,
// non-competing bg/border pair instead.
const SKATER_TOGGLE_BTN_BASE = 'skater-toggle-btn flex items-center gap-[5px] py-[5px] px-3 rounded-[20px] text-[12px] font-medium border-[0.5px] cursor-pointer [transition:all_0.15s]';

// AI Game Summary Card (Phase 6, ScheduleView.css sub-PR 5, the final
// sub-PR -- ScheduleView.css is now fully deleted). Deferred from sub-PR 3
// since it's a self-contained AI/prediction feature, migrated together
// with MatchupDetail.jsx's own AI/prediction surface here.
const GP_SUMMARY_CARD_CLASSES = 'gp-summary-card rounded-[12px] py-4 px-4 pb-3 mb-4 border-[0.5px] border-[rgba(204,34,0,0.25)] bg-[linear-gradient(135deg,var(--bg2)_0%,rgba(204,34,0,0.06)_100%)]';
const GP_SUMMARY_CHIP_CLASSES = 'gp-summary-chip text-[11px] font-semibold bg-[var(--bg3)] text-[color:var(--text-muted)] py-[3px] px-2 rounded-[6px]';

function GameStatsPopup({ game, onClose }) {
  const { t } = useTranslation();
  const { data, loading } = useFetch(() => getCompletedGameStats(game.id), [game.id]);
  const [skaterTeam, setSkaterTeam] = useState('car');
  const [summary, setSummary]       = useState(null);
  const [showTop, setShowTop]       = useState(false);
  const modalRef = useRef(null);

  // Fetch AI-generated summary from Worker KV
  useEffect(() => {
    capture('game_stats_opened', { gameId: game?.id, opponent: getOpponent(game)?.abbrev });
  }, []);

  useEffect(() => {
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    if (!workerUrl || !game?.id) return;
    fetch(`${workerUrl}/cache/${encodeURIComponent(`summary:${game.id}`)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.narrative) setSummary(d); })
      .catch(() => {});
  }, [game?.id]);

  const opp      = getOpponent(game);
  const oppAbbr  = opp?.abbrev || 'OPP';
  const oppColor = TEAM_COLORS[oppAbbr] || '#7a8899';
  const carScore = getCarScore(game);
  const oppScore = getOppScore(game);
  const won      = carScore != null && oppScore != null && carScore > oppScore;
  const home     = isHomeGame(game);

  // Pull team stats from right-rail
  const rr         = data?.rightRail;
  const pbpPlays   = data?.pbp?.plays || [];
  const isCarHome  = data?.homeTeamId === TEAM_CONFIG.teamId;
  const advStats   = pbpPlays.length ? computeShotAttempts(pbpPlays) : null;
  const pdoStats   = pbpPlays.length ? computePDO(pbpPlays) : null;
  const luckStats  = pbpPlays.length ? computePuckLuck(pbpPlays) : null;
  const teamStats  = rr?.teamGameStats || [];

  // Pull scoring summary from boxscore
  const bs         = data?.boxscore;
  const scoring    = bs?.summary?.scoring || bs?.linescore?.periods || [];
  const starsList  = bs?.summary?.threeStars || [];

  // Boxscore player stats — use isCarHome from actual API data, fallback to schedule
  const pbg        = bs?.playerByGameStats;
  const carIsHome  = data ? isCarHome : home; // use schedule until data arrives
  const carKey     = carIsHome ? 'homeTeam' : 'awayTeam';
  const oppKey     = carIsHome ? 'awayTeam' : 'homeTeam';
  const carPlayers = pbg ? [
    ...(pbg[carKey]?.forwards || []),
    ...(pbg[carKey]?.defense  || pbg[carKey]?.defensemen || []),
  ].map(p => ({ ...p, shots: p.sog ?? 0 })) : [];
  const carGoalies = pbg?.[carKey]?.goalies || [];

  // Opponent skaters + goalies
  const oppPlayers_raw = pbg ? [
    ...(pbg[oppKey]?.forwards || []),
    ...(pbg[oppKey]?.defense  || pbg[oppKey]?.defensemen || []),
  ].map(p => ({ ...p, shots: p.sog ?? 0 })) : [];
  const oppPlayers = [...oppPlayers_raw]
    .sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goals || 0) - (a.goals || 0));
  const oppGoalies = pbg?.[oppKey]?.goalies || [];

  // All CAR skaters sorted by points desc, then toi
  const carPlayers_sorted = [...carPlayers]
    .sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goals || 0) - (a.goals || 0));
  // reassign for use below (override earlier carPlayers with sorted version)
  carPlayers.length = 0;
  carPlayers_sorted.forEach(p => carPlayers.push(p));

  // Helper: find a team stat value by category
  // Map every raw NHL API category key -> human label + optional value transformer
  // The right-rail returns camelCase keys like "sog", "faceoffWinningPctg", "blockedShots", etc.
  const STAT_CONFIG = {
    // key (lowercase)            label                                              formatter
    sog:                        { label: t('gameStatsPopup.teamStats.shotsOnGoal'),  fmt: null },
    hits:                       { label: t('gameStatsPopup.teamStats.hits'),         fmt: null },
    blockedshots:               { label: t('gameStatsPopup.teamStats.blockedShots'), fmt: null },
    blockedshot:                { label: t('gameStatsPopup.teamStats.blockedShots'), fmt: null },
    blocked:                    { label: t('gameStatsPopup.teamStats.blockedShots'), fmt: null },
    faceoffwinningpctg:         { label: t('gameStatsPopup.teamStats.faceoffWinPct'), fmt: v => `${(parseFloat(v)*100).toFixed(1)}%` },
    faceoffwinpct:              { label: t('gameStatsPopup.teamStats.faceoffWinPct'), fmt: v => `${parseFloat(v).toFixed(1)}%` },
    faceoffpct:                 { label: t('gameStatsPopup.teamStats.faceoffWinPct'), fmt: v => {
      const n = parseFloat(v);
      return n <= 1 ? `${(n*100).toFixed(1)}%` : `${n.toFixed(1)}%`;
    }},
    powerplaypctg:              { label: t('gameStatsPopup.teamStats.powerPlayPct'), fmt: v => `${(parseFloat(v)*100).toFixed(1)}%` },
    powerplay:                  { label: t('gameStatsPopup.teamStats.powerPlay'),    fmt: null },
    pim:                        { label: t('gameStatsPopup.teamStats.penaltyMinutes'), fmt: null },
    penaltyminutes:             { label: t('gameStatsPopup.teamStats.penaltyMinutes'), fmt: null },
    giveaways:                  { label: t('gameStatsPopup.teamStats.giveaways'),    fmt: null },
    takeaways:                  { label: t('gameStatsPopup.teamStats.takeaways'),    fmt: null },
    shots:                      { label: t('gameStatsPopup.teamStats.shotsOnGoal'),  fmt: null },
  };

  function getStatConfig(rawCategory) {
    if (!rawCategory) return null;
    const key = rawCategory.toLowerCase().replace(/[^a-z]/g, '');
    return STAT_CONFIG[key] || null;
  }

  function formatStatValue(rawCategory, value) {
    if (value == null) return '—';
    const cfg = getStatConfig(rawCategory);
    if (cfg?.fmt) return cfg.fmt(value);
    return String(value);
  }

  function getStatLabel(rawCategory) {
    const cfg = getStatConfig(rawCategory);
    // If we have a known label use it; otherwise convert camelCase to Title Case
    if (cfg?.label) return cfg.label;
    return rawCategory
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="game-popup relative bg-[var(--bg1)] border-[0.5px] border-[color:var(--border-2)] rounded-t-[var(--radius-lg)] w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.5)] animate-[slide-up_0.2s_cubic-bezier(0.34,1.2,0.64,1)] min-[560px]:rounded-[var(--radius-lg)] min-[560px]:animate-[pop-in_0.2s_cubic-bezier(0.34,1.2,0.64,1)]" ref={modalRef} onClick={e => e.stopPropagation()}
        onScroll={e => setShowTop(e.target.scrollTop > 200)}>
        {showTop && (
          <button className="gsp-top-btn sticky top-2 float-right mt-2 mr-3 py-[5px] px-3 bg-[var(--bg3)] border-[0.5px] border-[color:var(--border)] rounded-[20px] text-[11px] font-semibold text-[color:var(--text-muted)] cursor-pointer z-10 hover:text-[color:var(--text)] hover:bg-[var(--bg2)]" onClick={() => modalRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
            {t('gameStatsPopup.header.scrollTopButton')}
          </button>
        )}

        {/* Header */}
        <div className={`gp-header p-4 border-b-[0.5px] border-b-[color:var(--border)] relative ${won ? 'gp-win bg-[rgba(61,186,126,0.06)]' : 'gp-loss bg-[rgba(204,34,0,0.06)]'}`}>
          <div className="gp-header-inner flex items-center justify-between gap-3">
            <div className={GP_TEAM_COL_CLASSES}>
              <TeamLogo abbr={TEAM_CONFIG.abbr} size={36} />
              <span className="gp-abbr font-[family-name:var(--font-display)] text-[14px] font-bold tracking-[0.06em]" style={{ color: 'var(--team-primary)' }}>{TEAM_CONFIG.abbr}</span>
              <span className="gp-score-big font-[family-name:var(--font-display)] text-[42px] font-bold leading-none" style={{ color: 'var(--team-primary)' }}>{carScore ?? '—'}</span>
            </div>
            <div className="gp-center-col flex flex-col items-center gap-1">
              <div className={`${GP_RESULT_BADGE_CLASSES} ${won ? 'win bg-[rgba(61,186,126,0.2)] text-[color:var(--green)]' : 'loss bg-[rgba(204,34,0,0.15)] text-[color:var(--red-bright)]'}`}>{won ? t('gameStatsPopup.header.resultWin') : t('gameStatsPopup.header.resultLoss')}</div>
              <div className="gp-date text-[11px] text-[color:var(--text-muted)]">{formatGameDate(game.gameDate)}</div>
              <div className="gp-venue text-[10px] text-[color:var(--text-dim)]">{home ? `📍 ${t('scheduleView.resultCard.home')}` : `✈ ${t('scheduleView.resultCard.away')}`}</div>
            </div>
            <div className={`${GP_TEAM_COL_CLASSES} right`}>
              <TeamLogo abbr={oppAbbr} size={36} color={oppColor} />
              <span className="gp-abbr font-[family-name:var(--font-display)] text-[14px] font-bold tracking-[0.06em]" style={{ color: oppColor }}>{oppAbbr}</span>
              <span className="gp-score-big font-[family-name:var(--font-display)] text-[42px] font-bold leading-none" style={{ color: oppColor }}>{oppScore ?? '—'}</span>
            </div>
          </div>
          <button className="gp-close absolute top-3 right-3 w-7 h-7 rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]" onClick={onClose} aria-label={t('gameStatsPopup.header.closeAriaLabel')}>✕</button>
        </div>

        <div className="gp-body pt-4 px-4 pb-6">
          {/* ── AI Game Summary Card ── */}
          {summary && (
            <div className={GP_SUMMARY_CARD_CLASSES}>
              <div className="gp-summary-header flex justify-between items-center mb-2.5">
                <span className="gp-summary-label text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)]">{t('gameStatsPopup.summary.label')}</span>
                <span className="gp-summary-badge text-[9px] font-bold bg-[rgba(204,34,0,0.15)] text-[color:var(--red-bright)] py-[2px] px-[7px] rounded-[10px] tracking-[0.04em]">{t('gameStatsPopup.summary.badge')}</span>
              </div>
              <p className="gp-summary-narrative text-[13px] leading-[1.65] text-[color:var(--text)] mt-0 mb-3">{summary.narrative}</p>
              <div className="gp-summary-chips flex gap-1.5 flex-wrap justify-center items-center mb-2.5">
                <span className={GP_SUMMARY_CHIP_CLASSES} style={{color: summary.cfPct >= 50 ? 'var(--green)' : 'var(--red-bright)'}}>
                  {t('gameStatsPopup.summary.cfPctChip', { pct: summary.cfPct })}
                </span>
                {summary.topScorer && summary.topScorer !== 'Unknown' && (
                  <span className={GP_SUMMARY_CHIP_CLASSES}>🚨 {summary.topScorer}</span>
                )}
                {summary.carGoalie && summary.carGoalie.svPct != null && (
                  <span className={GP_SUMMARY_CHIP_CLASSES}>
                    🥅 {summary.carGoalie.name.split(' ').pop()}{' '}
                    {typeof summary.carGoalie.svPct === 'number'
                      ? (summary.carGoalie.svPct <= 1
                          ? summary.carGoalie.svPct.toFixed(3)
                          : (summary.carGoalie.svPct / 100).toFixed(3))
                      : summary.carGoalie.svPct}
                  </span>
                )}
                <span className={GP_SUMMARY_CHIP_CLASSES} style={{color: summary.won ? 'var(--green)' : 'var(--red-bright)'}}>
                  {summary.won ? t('gameStatsPopup.summary.resultChipWin') : t('gameStatsPopup.summary.resultChipLoss')} {summary.carScore}–{summary.oppScore}
                </span>
              </div>
              <button
                className="gp-summary-share block mx-auto bg-none border-[0.5px] border-[color:var(--border-2)] text-[color:var(--text-muted)] text-[11px] font-semibold py-[5px] px-[18px] rounded-[6px] cursor-pointer min-h-0 min-w-0 [transition:all_0.15s] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]"
                onClick={() => {
                  const text = t('gameStatsPopup.summary.shareText', {
                    abbr: TEAM_CONFIG.abbr,
                    car: summary.carScore,
                    opp: summary.oppScore,
                    oppAbbr: summary.oppAbbr,
                    narrative: summary.narrative,
                  });
                  if (navigator.share) {
                    navigator.share({ title: t('gameStatsPopup.summary.shareTitle'), text }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).then(() =>
                      alert(t('gameStatsPopup.summary.shareCopiedAlert'))
                    ).catch(() => {});
                  }
                }}
              >
                {t('gameStatsPopup.summary.shareButton')}
              </button>
            </div>
          )}

          {loading && (
            <div className="gp-loading pt-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={SKELETON_CLASSES} style={{ height: 12, marginBottom: 10, width: `${60 + i * 8}%` }} />
              ))}
            </div>
          )}

          {!loading && data && (
            <>
              {/* Period table + three stars side by side */}
              {scoring.length > 0 && (
                <div className="gp-period-stars-row grid gap-4 items-start [grid-template-columns:1fr_1fr] max-[420px]:[grid-template-columns:1fr]">
                  <div className="gp-section gp-period-col mt-4.5 min-w-0">
                    <div className="gp-section-label font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-dim)] pb-1.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2">{t('gameStatsPopup.sections.scoringByPeriod')}</div>
                    <PeriodTable scoring={scoring} home={home} carAbbr={TEAM_CONFIG.abbr} oppAbbr={oppAbbr} />
                  </div>
                  {starsList.length > 0 && (
                    <div className="gp-section gp-stars-col mt-4.5 min-w-0 max-[420px]:border-t-[0.5px] max-[420px]:border-t-[color:var(--border)] max-[420px]:pt-3">
                      <div className="gp-section-label font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-dim)] pb-1.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2">{t('gameStatsPopup.sections.threeStars')}</div>
                      {starsList.map((s, i) => (
                        <div key={i} className="gp-star-row flex items-center gap-2 py-[5px] border-b-[0.5px] border-b-[color:var(--border)] text-[13px]">
                          <span className="gp-star-num text-[13px] w-[50px] shrink-0">
                            {i === 0 ? '⭐' : i === 1 ? '⭐⭐' : '⭐⭐⭐'}
                          </span>
                          <div className="gp-star-info flex flex-col gap-[1px] min-w-0">
                            <span className="gp-star-name flex-1 text-[color:var(--text)] font-medium text-[12px] whitespace-nowrap overflow-hidden text-ellipsis">{s.name?.default || s.player}</span>
                            <span className="gp-star-team text-[10px] font-[family-name:var(--font-display)] font-bold" style={{ color: TEAM_COLORS[s.teamAbbrev?.default || s.teamAbbrev] || 'var(--text-muted)' }}>
                              {s.teamAbbrev?.default || s.teamAbbrev}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Goals — CAR on left, opponent on right */}
              {scoring.length > 0 && (
                <div className="gp-section mt-4.5">
                  <div className="gp-section-label font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-dim)] pb-1.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2">{t('gameStatsPopup.sections.goals')}</div>
                  <GoalsList scoring={scoring} carAbbr={TEAM_CONFIG.abbr} oppAbbr={oppAbbr} oppColor={oppColor} />
                </div>
              )}

              {/* Team stats comparison */}
              {teamStats.length > 0 && (
                <div className="gp-section mt-4.5">
                  <div className="gp-section-label font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-dim)] pb-1.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2">{t('gameStatsPopup.sections.teamStats')}</div>
                  <div className="gp-team-stat-header grid gap-2 text-[11px] font-semibold text-center mb-1.5 [grid-template-columns:48px_1fr_48px]">
                    <span style={{ color: 'var(--team-primary)' }}>{TEAM_CONFIG.abbr}</span>
                    <span />
                    <span style={{ color: oppColor }}>{oppAbbr}</span>
                  </div>
                  {teamStats.map((row, i) => {
                    const rawCarVal = home ? row.homeValue : row.awayValue;
                    const rawOppVal = home ? row.awayValue : row.homeValue;
                    const carDisplay = formatStatValue(row.category, rawCarVal);
                    const oppDisplay = formatStatValue(row.category, rawOppVal);
                    const label      = getStatLabel(row.category);
                    // For bar sizing always use raw numeric (strip % if present)
                    const carNum = parseFloat(String(rawCarVal).replace('%','')) || 0;
                    const oppNum = parseFloat(String(rawOppVal).replace('%','')) || 0;
                    const total  = carNum + oppNum || 1;
                    const carPct = Math.round((carNum / total) * 100);
                    return (
                      <div key={i} className="gp-stat-row grid gap-2 items-center mb-2 [grid-template-columns:48px_1fr_48px]">
                        <span className={`${GP_STAT_VAL_CLASSES} car team-primary-text`}>{carDisplay}</span>
                        <div className="gp-stat-center flex flex-col gap-[3px]">
                          <div className="gp-stat-label text-[10px] text-[color:var(--text-muted)] text-center">{label}</div>
                          <div className={DUAL_BAR_CLASSES}>
                            <div className={FILL_TEAM_PRIMARY_CLASSES} style={{ width: `${carPct}%` }} />
                            <div className={FILL_OPP_CLASSES}          style={{ width: `${100 - carPct}%` }} />
                          </div>
                        </div>
                        <span className={`${GP_STAT_VAL_CLASSES} opp text-[color:var(--text-muted)]`}>{oppDisplay}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Skater table with team toggle */}
              {/* ── Corsi / Fenwick / PDO / Puck Luck ── */}
              {advStats && (
                <div className="gp-section mt-4.5">
                  <div className="gp-section-label font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-dim)] pb-1.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2">
                    {t('gameStatsPopup.sections.shotAttemptsPuckLuck')}
                    <InfoTip position="above" text={t('gameStatsPopup.sections.shotAttemptsTip')} />
                  </div>
                  <div className="gp-adv-grid flex flex-col gap-[5px]">
                    <div className={`${GP_ADV_ROW_CLASSES} header text-[9px] font-bold uppercase tracking-[0.05em] text-[color:var(--text-dim)] mb-0.5`}>
                      <span /><span className="team-primary-text">{TEAM_CONFIG.abbr}</span><span /><span className="text-[color:var(--text-muted)]">{t('gameStatsPopup.teamStats.oppLabel')}</span>
                    </div>
                    {[
                      [t('gameStatsPopup.advStats.corsi'),   advStats.carCorsi,   advStats.oppCorsi,   'All shot attempts incl. blocked'],
                      [t('gameStatsPopup.advStats.fenwick'), advStats.carFenwick, advStats.oppFenwick, 'Unblocked shot attempts (excl. blocks)'],
                      [t('gameStatsPopup.teamStats.shotsOnGoal'),advStats.car.goals+advStats.car.sog, advStats.opp.goals+advStats.opp.sog, 'Shots that reached the goalie'],
                      [t('gameStatsPopup.advStats.missedShots'), advStats.car.missed, advStats.opp.missed, 'Attempts that missed the net'],
                      [t('gameStatsPopup.teamStats.blockedShots'),advStats.car.blocked,advStats.opp.blocked,'Attempts blocked by a skater'],
                    ].map(([label, car, opp, _help]) => {
                      const tot = car + opp || 1;
                      return (
                        <div key={label} className={GP_ADV_ROW_CLASSES}>
                          <span className="gp-adv-label text-[11px] text-[color:var(--text-muted)]">{label}</span>
                          <span className="team-primary-text">{car}</span>
                          <div className="gp-adv-bar h-1.5 rounded-[3px] bg-[var(--bg3)] flex overflow-hidden">
                            <div className={`gp-adv-fill ${FILL_TEAM_PRIMARY_CLASSES}`} style={{width:`${Math.round(car/tot*100)}%`}} />
                            <div className="gp-adv-fill muted h-full bg-[color:var(--text-dim)] rounded-[0_3px_3px_0]" style={{width:`${Math.round(opp/tot*100)}%`}} />
                          </div>
                          <span className="text-[color:var(--text-muted)]">{opp}</span>
                        </div>
                      );
                    })}
                    <div className="gp-adv-chips flex gap-1.5 flex-wrap mt-2 justify-center">
                      <span className="gp-adv-chip text-[11px] font-semibold bg-[var(--bg3)] py-[3px] px-2 rounded-[5px] cursor-help"
                        style={{color: advStats.corsiForPct>=50?'var(--green)':'var(--team-primary)'}}>
                        {t('gameStatsPopup.advStats.cfPctChip', { pct: advStats.corsiForPct })}
                      <InfoTip text={t('gameStatsPopup.advStats.cfPctTip', { abbr: TEAM_CONFIG.abbr })} position="above" /></span>
                      <span className="gp-adv-chip text-[11px] font-semibold bg-[var(--bg3)] py-[3px] px-2 rounded-[5px] cursor-help"
                        style={{color: advStats.fenwickForPct>=50?'var(--green)':'var(--team-primary)'}}>
                        {t('gameStatsPopup.advStats.ffPctChip', { pct: advStats.fenwickForPct })}
                      <InfoTip text={t('gameStatsPopup.advStats.ffPctTip', { abbr: TEAM_CONFIG.abbr })} position="above" /></span>
                      {pdoStats && (
                        <span className="gp-adv-chip text-[11px] font-semibold bg-[var(--bg3)] py-[3px] px-2 rounded-[5px] cursor-help"
                          style={{color: pdoStats.pdo>102?'var(--amber)':pdoStats.pdo<98?'var(--blue-bright)':'var(--text-muted)'}}>
                          {t('gameStatsPopup.advStats.pdoChip', { pdo: pdoStats.pdo })}
                          <InfoTip text={t('gameStatsPopup.advStats.pdoTip', { luck: pdoStats.luck })} position="above" />
                        </span>
                      )}
                      {luckStats && (
                        <span className="gp-adv-chip text-[11px] font-semibold bg-[var(--bg3)] py-[3px] px-2 rounded-[5px] cursor-help"
                          style={{color: luckStats.color}}>
                          {t('gameStatsPopup.advStats.luckChip', { sign: luckStats.luckDelta>=0?'+':'', delta: luckStats.luckDelta })}
                        <InfoTip text={t('gameStatsPopup.advStats.luckTip', { label: luckStats.label, expectedGF: luckStats.expectedGF, pct: luckStats.fenwickForPct })} position="above" /></span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Skater table with team toggle */}
              {(carPlayers.length > 0 || oppPlayers.length > 0) && (
                <div className="gp-section mt-4.5">
                  <div className="gp-skater-toggle flex gap-1.5 mb-2.5">
                    <button
                      className={SKATER_TOGGLE_BTN_BASE + (skaterTeam === "car" ? " active-car bg-transparent border-[color:var(--team-primary)] text-[color:var(--team-primary)]" : " bg-transparent border-[color:var(--border-2)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]")}
                      onClick={() => setSkaterTeam("car")}
                    >
                      <TeamLogo abbr={TEAM_CONFIG.abbr} size={14} />
                      {t('gameStatsPopup.skaters.toggleButton', { abbr: TEAM_CONFIG.abbr })}
                    </button>
                    <button
                      className={SKATER_TOGGLE_BTN_BASE + (skaterTeam === "opp" ? " active-opp bg-[var(--blue-dim)] border-[rgba(68,119,238,0.35)] text-[color:var(--blue-bright)]" : " bg-transparent border-[color:var(--border-2)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]")}
                      onClick={() => setSkaterTeam("opp")}
                    >
                      <TeamLogo abbr={oppAbbr} size={14} color={oppColor} />
                      {t('gameStatsPopup.skaters.toggleButton', { abbr: oppAbbr })}
                    </button>
                  </div>
                  <SkaterTable
                    players={skaterTeam === "car" ? carPlayers : oppPlayers}
                    goalies={(skaterTeam === "car" ? carGoalies : oppGoalies).filter(
                      g => (g.toi && g.toi !== "00:00") || (g.shotsAgainst ?? 0) > 0
                    )}
                  />
                </div>
              )}

              {!teamStats.length && !carPlayers.length && !scoring.length && (
                <div className="gp-no-data text-[12px] text-[color:var(--text-dim)] text-center py-4 italic">
                  {t('gameStatsPopup.emptyState')}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Period scoring table ─────────────────────────────────────

export { GameStatsPopup };
