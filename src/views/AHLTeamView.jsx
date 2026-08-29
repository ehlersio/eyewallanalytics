// views/AHLTeamView.jsx
// Port of PWHLTeamView.jsx, scoped to the tabs buildable from data AHL
// already has: Overview / Stats / Splits / Trends. Deliberately DROPS two
// PWHL tabs that can't exist for AHL from a real data source, not a scope
// choice:
//   - Advanced (Corsi/Fenwick/PDO) -- AHL's HockeyTech feed has no
//     blocked_shot event type at all, ever (see ahlConfig.js/ahl.js
//     docstrings) -- there is no shot-attempts data to compute this from.
//   - Salaries -- no AHL salary data source exists anywhere in the stack.
// "Compare Seasons" (PWHLTeamView's TeamComparisonPopup button) is also
// omitted here, not stubbed -- TeamComparisonPopup.jsx hardcodes a binary
// nhl/pwhl branch throughout (fetch functions, logo sport, team-option
// lists); wiring it needs the /ahl/team-seasons/compare* routes and an
// AHL branch in that popup, neither of which exist yet (AHL parity plan
// Phase 4). Add the button back once that phase lands.
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import {
  fetchAHLStandings, fetchAHLPlayers, fetchAHLSchedule,
  AHL_TEAM_CONFIG, AHL_TEAM_ID,
} from '../utils/ahlApi';
import { AHL_SEASONS, AHL_PLAYOFF_SEASON_MAP, AHL_REGULAR_SEASON_MAP, isAHLPlayoffSeason } from '../utils/ahlConfig';
import { useSport } from '../utils/SportContext';
import TeamLogo from '../components/TeamLogo';
import { MetCard } from '../components/StatBar';
import { PAGE_CLASSES } from '../utils/pageClasses';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const METRICS_GRID_4_CLASSES = 'grid grid-cols-4 gap-2 mb-2'
const VIEW_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold flex items-center gap-2 mb-[2px]'
const TABS_WRAP_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-14px] mb-[14px] px-[14px]'
const TAB_BASE_CLASSES = 'flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]'
const TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent'
const TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]'
function tabClasses(isActive) {
  return `${TAB_BASE_CLASSES} ${isActive ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`
}

const VIEW_SUB_CLASSES = 'view-sub text-[12px] text-[color:var(--text-muted)] mb-3'

const TEAM_TABS_CLASSES = 'flex gap-1 mb-[14px] overflow-x-auto pb-[2px] border-b-[0.5px] border-[var(--border)]'
const TEAM_TAB_BASE_CLASSES = 'team-tab py-[6px] px-[14px] rounded-[20px] text-[12px] font-medium border-[0.5px] whitespace-nowrap cursor-pointer [transition:all_0.15s]'
const TEAM_TAB_INACTIVE_CLASSES = 'bg-transparent text-[color:var(--text-muted)] border-transparent hover:text-[color:var(--text)]'
const TEAM_TAB_ACTIVE_CLASSES = 'bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[var(--red-border)]'
function teamTabClasses(active) {
  return `${TEAM_TAB_BASE_CLASSES} ${active ? TEAM_TAB_ACTIVE_CLASSES : TEAM_TAB_INACTIVE_CLASSES}`
}

const RECORDS_ROW_CLASSES = 'records-row grid grid-cols-2 gap-[10px]'
const RECORD_BLOCK_CLASSES = 'record-block flex flex-col gap-1'
const RECORD_BLOCK_LABEL_CLASSES = 'text-[11px] text-[color:var(--text-dim)] font-semibold'
const RECORD_MAIN_ROW_CLASSES = 'flex items-baseline gap-2'
const RECORD_BIG_CLASSES = 'record-big font-[family-name:var(--font-display)] text-[22px] font-bold text-[color:var(--text)]'
const PTS_CHIP_CLASSES = 'text-[12px] text-[color:var(--amber)] font-semibold'
const RECORD_META_CLASSES = 'text-[11px] text-[color:var(--text-muted)] flex items-center gap-[5px]'
const RECORD_META_SEP_CLASSES = 'text-[color:var(--border-2)]'

const STREAK_CHIP_BASE_CLASSES = 'streak-chip text-[10px] font-bold py-[1px] px-[6px] rounded-[4px]'
const STREAK_W_CLASSES = 'bg-[rgba(61,186,126,0.15)] text-[color:var(--green)] border-[0.5px] border-[rgba(61,186,126,0.3)]'
const STREAK_L_CLASSES = 'bg-[rgba(204,34,0,0.12)] text-[color:var(--red-bright)] border-[0.5px] border-[rgba(204,34,0,0.3)]'
function streakChipClasses(positive) {
  return `${STREAK_CHIP_BASE_CLASSES} ${positive ? STREAK_W_CLASSES : STREAK_L_CLASSES}`
}

const OVERVIEW_STAT_GRID_CLASSES = 'grid grid-cols-3 gap-2'
const OVERVIEW_STAT_CELL_CLASSES = 'text-center bg-[var(--bg3)] rounded-[var(--radius-sm)] py-2 px-1'
const OVERVIEW_STAT_LABEL_CLASSES = 'text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.08em] mb-[3px]'
const OVERVIEW_STAT_VAL_CLASSES = 'font-[family-name:var(--font-display)] text-[18px] font-bold text-[color:var(--text)]'
const OVERVIEW_STAT_RANK_CLASSES = 'overview-stat-rank text-[10px] font-bold font-[family-name:var(--font-mono)] mt-[2px] block'

const ADV_STAT_ROW_CLASSES = 'adv-stat-row flex items-center justify-between py-[7px] border-b-[0.5px] border-[rgba(255,255,255,0.04)]'
const ADV_STAT_LABEL_CLASSES = 'text-[12px] text-[color:var(--text-muted)] flex-1'
const ADV_STAT_NOTE_CLASSES = 'text-[10px] text-[color:var(--text-dim)]'
const ADV_STAT_RIGHT_CLASSES = 'adv-stat-right flex items-center gap-[6px] flex-shrink-0 min-w-[120px] justify-end'
const ADV_STAT_VAL_BASE_CLASSES = 'font-[family-name:var(--font-mono)] text-[14px] font-semibold ml-2 min-w-[52px] text-right'
const ADV_STAT_VAL_DEFAULT_CLASSES = 'text-[color:var(--text)]'
function advStatValClasses() {
  return `${ADV_STAT_VAL_BASE_CLASSES} ${ADV_STAT_VAL_DEFAULT_CLASSES}`
}
const ADV_STAT_AVG_CLASSES = 'text-[10px] text-[color:var(--text-dim)] whitespace-nowrap min-w-[48px] text-right'

const ADV_TOGGLE_CLASSES = 'adv-toggle flex gap-1 bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-[20px] p-[3px] w-fit'
const ADV_TOGGLE_BTN_BASE_CLASSES = 'py-[5px] px-[14px] rounded-[16px] text-[12px] font-medium border-none cursor-pointer [transition:all_0.15s]'
const ADV_TOGGLE_BTN_INACTIVE_CLASSES = 'bg-transparent text-[color:var(--text-muted)]'
const ADV_TOGGLE_BTN_ACTIVE_CLASSES = 'bg-[var(--bg4)] text-[color:var(--text)] shadow-[0_1px_4px_rgba(0,0,0,0.3)]'
function advToggleBtnClasses(active) {
  return `${ADV_TOGGLE_BTN_BASE_CLASSES} ${active ? ADV_TOGGLE_BTN_ACTIVE_CLASSES : ADV_TOGGLE_BTN_INACTIVE_CLASSES}`
}
const ADV_CONTEXT_NOTE_CLASSES = 'adv-context-note text-[11px] text-[color:var(--text-dim)] italic mb-1'

const SPLIT_ADV_HEADER_CLASSES = 'grid grid-cols-[1fr_auto_1fr] text-[11px] font-bold text-[color:var(--text-dim)] py-[8px] pb-[6px] text-center [&>span:first-child]:text-left [&>span:last-child]:text-right'
const SPLIT_ADV_ROW_CLASSES = 'split-adv-row grid grid-cols-[60px_1fr_60px] items-center py-[5px] border-b-[0.5px] border-[rgba(255,255,255,0.03)] gap-1'
const SPLIT_ADV_VAL_BASE_CLASSES = 'font-[family-name:var(--font-mono)] text-[13px] font-semibold'
const SPLIT_ADV_VAL_DEFAULT_CLASSES = 'text-[color:var(--text-muted)]'
const SPLIT_ADV_VAL_GOOD_CLASSES = 'text-[#4ade80]'
function splitAdvValClasses(good, right) {
  const base = `${SPLIT_ADV_VAL_BASE_CLASSES} ${good ? SPLIT_ADV_VAL_GOOD_CLASSES : SPLIT_ADV_VAL_DEFAULT_CLASSES}`
  return right ? `${base} text-right` : base
}
const SPLIT_ADV_LABEL_CLASSES = 'text-[11px] text-[color:var(--text-dim)] text-center'

const TRENDS_QUICK_CLASSES = 'grid grid-cols-3 gap-2'
const TQ_ITEM_CLASSES = 'text-center bg-[var(--bg3)] rounded-[var(--radius-sm)] py-[10px] px-1'
const TQ_LABEL_CLASSES = 'text-[10px] text-[color:var(--text-dim)] uppercase tracking-[0.06em] mb-1'
const TQ_VAL_CLASSES = 'font-[family-name:var(--font-display)] text-[22px] font-bold text-[color:var(--text)]'

const RESULT_DOTS_CLASSES = 'result-dots flex gap-1 flex-wrap'
const RESULT_DOT_BASE_CLASSES = 'result-dot relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold cursor-default'
const RESULT_DOT_W_CLASSES = 'bg-[rgba(61,186,126,0.2)] text-[color:var(--green)] border border-[rgba(61,186,126,0.4)]'
const RESULT_DOT_L_CLASSES = 'bg-[rgba(204,34,0,0.15)] text-[color:var(--red-bright)] border border-[rgba(204,34,0,0.3)]'
const RESULT_DOT_OTL_CLASSES = 'bg-[rgba(240,160,48,0.15)] text-[color:var(--amber)] border border-[rgba(240,160,48,0.3)]'
function resultDotClasses(state) {
  const s = (state || '').toLowerCase()
  const variant = (s === 'w' || s === 'otw') ? RESULT_DOT_W_CLASSES : s === 'l' ? RESULT_DOT_L_CLASSES : RESULT_DOT_OTL_CLASSES
  return `${RESULT_DOT_BASE_CLASSES} ${variant}`
}

const ROLLING_CHART_CLASSES = 'rolling-chart h-[90px] flex items-end gap-[3px] relative border-b-[0.5px] border-[var(--border)] mb-2'
const ROLLING_CHART_DUAL_CLASSES = 'rolling-chart rolling-chart-dual h-[120px] flex items-center gap-[3px] relative border-b-[0.5px] border-[var(--border)] mb-2'
const ROLLING_BAR_WRAP_CLASSES = 'rolling-bar-wrap flex-1 h-full flex flex-col justify-end relative'
const ROLLING_BAR_BASE_CLASSES = 'rolling-bar w-full rounded-t-[2px] min-h-[2px] [transition:height_0.3s]'
const ROLLING_BAR_HOT_CLASSES = 'bg-[var(--green)]'
const ROLLING_BAR_OK_CLASSES = 'bg-[var(--amber)]'
const ROLLING_BAR_COLD_CLASSES = 'bg-[var(--red)]'
function rollingBarClasses(pct) {
  const variant = pct >= 60 ? ROLLING_BAR_HOT_CLASSES : pct >= 40 ? ROLLING_BAR_OK_CLASSES : ROLLING_BAR_COLD_CLASSES
  return `${ROLLING_BAR_BASE_CLASSES} ${variant}`
}
const ROLLING_BAR_GF_CLASSES = 'rolling-bar bg-[var(--red-bright)] flex-1'
const ROLLING_BAR_GA_CLASSES = 'rolling-bar bg-[var(--blue-bright)] flex-1'
const ROLLING_BAR_DUAL_WRAP_CLASSES = 'rolling-bar-dual flex gap-px h-[60px] items-end w-full'
const ROLLING_LABEL_CLASSES = 'rolling-label absolute bottom-[-16px] text-[9px] text-[color:var(--text-dim)] text-center w-full'
const ROLLING_AVG_LINE_CLASSES = 'rolling-avg-line absolute left-0 right-0 h-px bg-[rgba(255,255,255,0.2)] pointer-events-none'
const ROLLING_LEGEND_CLASSES = 'rolling-legend flex gap-3 text-[10px] flex-wrap pt-5'
const RL_HOT_CLASSES = 'text-[color:var(--green)]'
const RL_OK_CLASSES = 'text-[color:var(--amber)]'
const RL_COLD_CLASSES = 'text-[color:var(--red-bright)]'
const ROLLING_BAR_LABEL_CLASSES = 'text-[10px] font-[family-name:var(--font-mono)] text-[color:var(--text-dim)] text-center leading-none mb-[2px] min-h-[12px] flex items-end justify-center'
const ROLLING_BAR_LABEL_BOT_CLASSES = 'text-[10px] font-[family-name:var(--font-mono)] text-center leading-none mt-[2px] min-h-[12px] flex items-start justify-center'

const GD_CHART_WRAP_CLASSES = 'relative h-[100px] mb-1'
const GD_BASELINE_LINE_CLASSES = 'absolute top-1/2 left-0 right-0 h-px bg-[var(--border-2)] z-[1]'
const GD_BARS_CLASSES = 'flex gap-[3px] h-full items-stretch relative'
const GD_BAR_COL_CLASSES = 'flex-1 flex flex-col'
const GD_TOP_CLASSES = 'flex-1 flex flex-col justify-end'
const GD_BOT_CLASSES = 'flex-1 flex flex-col justify-start'
const GD_BAR_POS_CLASSES = 'w-full min-h-[4px] rounded-[2px] bg-[var(--green)]'
const GD_BAR_NEG_CLASSES = 'w-full min-h-[4px] rounded-[2px] bg-[var(--red)]'
const GD_BAR_INLINE_LABEL_POS_CLASSES = 'text-[8px] font-[family-name:var(--font-mono)] text-center leading-none text-[color:var(--green)] mb-[1px]'
const GD_BAR_INLINE_LABEL_NEG_CLASSES = 'text-[8px] font-[family-name:var(--font-mono)] text-center leading-none text-[color:var(--red-bright)] mt-[1px]'

const EMPTY_STATE_CLASSES = 'empty-state text-center'
const EMPTY_ICON_CLASSES = 'empty-icon text-[28px] mb-2'
const EMPTY_TITLE_CLASSES = 'empty-title text-[14px] font-semibold text-[color:var(--text)] mb-1'

// TABS holds internal English state ids -- NOT display text, mirrors
// PWHLTeamView.jsx's same TAB_LABEL_KEYS pattern.
const TABS = ['Overview', 'Stats', 'Splits', 'Trends'];
const TAB_LABEL_KEYS = {
  Overview: 'ahlTeamView.tabs.overview',
  Stats:    'ahlTeamView.tabs.stats',
  Splits:   'ahlTeamView.tabs.splits',
  Trends:   'ahlTeamView.tabs.trends',
}

export default function AHLTeamView() {
  const { t } = useTranslation();
  const team   = AHL_TEAM_CONFIG;
  const teamId = AHL_TEAM_ID;
  const abbr   = team?.abbr || '—';
  const color  = team?.displayColor || 'var(--text-dim)';
  const [tab, setTab] = useState('Overview');

  // currentSeason is reactive (see SportContext.jsx) -- same reasoning as
  // PWHLTeamView.jsx's identical currentSeason usage: this view has no
  // season picker of its own, so without reading it from useSport() these
  // useFetch calls would never re-fetch once the live season resolves
  // after mount.
  const { currentSeason } = useSport();

  // currentSeason can itself be a playoffs id -- true right now, for most
  // of AHL's long off-season (see AHL_REGULAR_SEASON_MAP's comment in
  // ahlConfig.js). Resolve both a regular-season id and a playoffs id
  // from whichever currentSeason actually is, rather than assuming it's
  // always regular-season the way naively reading AHL_PLAYOFF_SEASON_MAP
  // [currentSeason] would (that returns undefined when currentSeason is
  // ALREADY the playoffs id, silently re-fetching the same data twice).
  const regSeasonId = isAHLPlayoffSeason(currentSeason)
    ? (AHL_REGULAR_SEASON_MAP[currentSeason] ?? currentSeason)
    : currentSeason;
  const poSeasonId = isAHLPlayoffSeason(currentSeason)
    ? currentSeason
    : AHL_PLAYOFF_SEASON_MAP[currentSeason];

  const { data: standings, loading: sLoad } = useFetch(() => fetchAHLStandings(regSeasonId), [regSeasonId]);
  const { data: players,   loading: pLoad } = useFetch(
    () => teamId ? fetchAHLPlayers(teamId, regSeasonId) : Promise.resolve(null), [teamId, regSeasonId]
  );
  const { data: schedule,  loading: scLoad  } = useFetch(
    () => teamId ? fetchAHLSchedule(teamId, regSeasonId) : Promise.resolve(null), [teamId, regSeasonId]
  );
  const { data: poSchedule, loading: poScLoad } = useFetch(
    () => (teamId && poSeasonId) ? fetchAHLSchedule(teamId, poSeasonId) : Promise.resolve(null), [teamId, poSeasonId]
  );
  const inPlayoffs = (poSchedule?.length || 0) > 0;

  const teamRow = useMemo(() => standings?.find(r => r.team_id === teamId) || null, [standings, teamId]);
  const skaters = useMemo(() => players?.skaters || [], [players]);
  const goalies = useMemo(() => players?.goalies || [], [players]);

  if (!abbr || !teamId) {
    return (
      <div className={PAGE_CLASSES}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>{t('ahlTeamView.noTeamSelected')}</p>
        </div>
      </div>
    );
  }

  const loading = sLoad || pLoad;
  const seasonLabel = AHL_SEASONS.find(s => s.id === regSeasonId)?.label || `Season ${regSeasonId}`;

  return (
    <div className={`${PAGE_CLASSES} team-view`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <TeamLogo abbr={abbr} sport="ahl" size={28} color={color} />
        <h2 className={VIEW_TITLE_CLASSES} style={{ margin: 0 }}>{team.displayName}</h2>
      </div>
      <p className={VIEW_SUB_CLASSES} style={{ margin: 0 }}>{t('teamView.seasonSubtitle', { years: seasonLabel })}</p>

      <div className={TEAM_TABS_CLASSES}>
        {TABS.map(tabId => (
          <button key={tabId} className={teamTabClasses(tab === tabId)} onClick={() => setTab(tabId)}>{t(TAB_LABEL_KEYS[tabId])}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <OverviewTab teamRow={teamRow} skaters={skaters} goalies={goalies}
          schedule={schedule} teamId={teamId} abbr={abbr} color={color} loading={loading}
          standings={standings} />
      )}
      {tab === 'Stats' && (
        <StatsTab skaters={skaters} goalies={goalies} loading={pLoad} color={color} />
      )}
      {tab === 'Splits' && (
        <SplitsTab schedule={schedule} poSchedule={poSchedule} teamId={teamId}
          loading={scLoad || poScLoad} inPlayoffs={inPlayoffs} />
      )}
      {tab === 'Trends' && (
        <TrendsTab schedule={schedule} teamId={teamId} loading={scLoad} />
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ teamRow, skaters, goalies, schedule, teamId, abbr, color, loading, standings }) {
  const { t } = useTranslation();

  const gd = teamRow ? (teamRow.goals_for ?? 0) - (teamRow.goals_against ?? 0) : null;

  const topScorers = useMemo(
    () => [...skaters].sort((a,b) => (b.points??0)-(a.points??0)).slice(0,5),
    [skaters]
  );
  const starter = useMemo(
    () => [...goalies].sort((a,b) => (b.gp??0)-(a.gp??0))[0] || null,
    [goalies]
  );

  // Rankings computed from all-team standings
  const rankings = useMemo(() => {
    if (!standings?.length || !teamRow) return {};
    function rank(arr, key, higherBetter=true) {
      const sorted = [...arr].filter(r => r[key] != null)
        .sort((a,b) => higherBetter ? b[key]-a[key] : a[key]-b[key]);
      const idx = sorted.findIndex(r => r.team_id === teamId);
      return idx >= 0 ? idx + 1 : null;
    }
    const withPG = standings.map(r => ({
      ...r,
      gfpg: r.gp ? (r.goals_for??0)/r.gp : 0,
      gapg: r.gp ? (r.goals_against??0)/r.gp : 0,
    }));
    const withDiff = standings.map(r => ({
      ...r,
      gd: (r.goals_for??0) - (r.goals_against??0),
    }));
    return {
      gfpg:  rank(withPG,   'gfpg', true),
      gapg:  rank(withPG,   'gapg', false),
      diff:  rank(withDiff, 'gd',   true),
      ppPct: teamRow.pp_pct != null ? rank(standings, 'pp_pct', true)  : null,
      pkPct: teamRow.pk_pct != null ? rank(standings, 'pk_pct', true)  : null,
    };
  }, [standings, teamRow, teamId]);

  const sogPG = useMemo(() => {
    if (!skaters.length || !teamRow?.gp) return null;
    return (skaters.reduce((s,p) => s+(p.shots??0), 0) / teamRow.gp).toFixed(1);
  }, [skaters, teamRow]);

  const saPG = useMemo(() => {
    if (!goalies.length || !teamRow?.gp) return null;
    return (goalies.reduce((s,g) => s+(g.saves??0)+(g.goals_against??0), 0) / teamRow.gp).toFixed(1);
  }, [goalies, teamRow]);

  function RankBadge({ r }) {
    if (!r) return null;
    const clr    = r <= 2 ? 'var(--green)' : r <= 6 ? 'var(--text-muted)' : 'var(--red-bright)';
    const suffix = r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
    return <span className={OVERVIEW_STAT_RANK_CLASSES} style={{ color: clr }}>{r}<sup className="text-[7px]">{suffix}</sup></span>;
  }

  // AHL's game_log has no ot/shootout boolean columns (see ahl.js's
  // docstring) -- every non-win here counts as a plain loss, no OT split.
  const last5 = useMemo(() => {
    if (!schedule?.length || !teamId) return [];
    return [...schedule]
      .filter(g => g.game_state === 'Final')
      .sort((a,b) => b.game_id - a.game_id)
      .slice(0, 5)
      .map(g => {
        const isHome = g.home_team_id === teamId;
        const my     = isHome ? g.home_score : g.away_score;
        const op     = isHome ? g.away_score : g.home_score;
        return { won: my > op };
      });
  }, [schedule, teamId]);

  return (
    <>
      <div className={RECORDS_ROW_CLASSES}>
        <div className={`card ${RECORD_BLOCK_CLASSES}`}>
          <div className={RECORD_BLOCK_LABEL_CLASSES} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TeamLogo abbr={abbr} sport="ahl" size={14} color={color} /> {t('team.regularSeason')}
          </div>
          {loading ? <div className={SKELETON_CLASSES} style={{ height: 28, width: '70%' }} /> : (
            <div className={RECORD_MAIN_ROW_CLASSES}>
              <span className={RECORD_BIG_CLASSES}>{teamRow?.wins??0}–{teamRow?.losses??0}–{teamRow?.ot_losses??0}–{teamRow?.shootout_losses??0}</span>
              <span className={PTS_CHIP_CLASSES}>{teamRow?.points??0} pts</span>
            </div>
          )}
          {teamRow && (
            <div className={RECORD_META_CLASSES}>
              <span>{t('ahlTeamView.overview.gfLabel', { val: teamRow.goals_for??'—' })}</span>
              <span className={RECORD_META_SEP_CLASSES}>·</span>
              <span>{t('ahlTeamView.overview.gaLabel', { val: teamRow.goals_against??'—' })}</span>
              {gd != null && (
                <span className={streakChipClasses(gd >= 0)}>
                  {t('ahlTeamView.overview.diffSuffix', { sign: gd >= 0 ? '+' : '', gd })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {last5.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>{t('ahlTeamView.overview.last5Title')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {last5.map((g, i) => (
              <div key={i} style={{
                width: 36, height: 36, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                background: g.won ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)',
                color: g.won ? 'var(--green)' : 'var(--red-bright)',
                border: `0.5px solid ${g.won ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
              }}>
                {g.won ? 'W' : 'L'}
              </div>
            ))}
          </div>
        </div>
      )}

      {teamRow && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 10 }}>{t('team.seasonStats')}</div>
          <div className={OVERVIEW_STAT_GRID_CLASSES}>
            {[
              ['GF/GP',  teamRow.gp ? ((teamRow.goals_for??0)/teamRow.gp).toFixed(2) : '—', rankings.gfpg],
              ['GA/GP',  teamRow.gp ? ((teamRow.goals_against??0)/teamRow.gp).toFixed(2) : '—', rankings.gapg],
              ['Diff',   gd != null ? (gd >= 0 ? `+${gd}` : gd) : '—', rankings.diff],
              ['PP%',    teamRow.pp_pct != null ? `${(teamRow.pp_pct*100).toFixed(1)}%` : '—', rankings.ppPct],
              ['PK%',    teamRow.pk_pct != null ? `${(teamRow.pk_pct*100).toFixed(1)}%` : '—', rankings.pkPct],
              ['SOG/GP', sogPG ?? '—', null],
              ['SA/GP',  saPG  ?? '—', null],
            ].map(([label, val, rank]) => (
              <div key={label} className={OVERVIEW_STAT_CELL_CLASSES}>
                <div className={OVERVIEW_STAT_LABEL_CLASSES}>{label}</div>
                <div className={OVERVIEW_STAT_VAL_CLASSES}>{val}</div>
                <RankBadge r={rank} />
              </div>
            ))}
          </div>
        </div>
      )}

      {topScorers.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>{t('ahlTeamView.overview.pointsLeadersTitle', { abbr })}</div>
          {topScorers.map((p, i) => (
            <div key={p.player_id ?? i} className={ADV_STAT_ROW_CLASSES}>
              <span className={ADV_STAT_LABEL_CLASSES}>
                {p.player_name || t('ahlTeamView.overview.playerFallbackName', { id: p.player_id })}
                {p.position && <span className={ADV_STAT_NOTE_CLASSES}> · {p.position}</span>}
              </span>
              <span className={ADV_STAT_RIGHT_CLASSES}>
                <span className={advStatValClasses()} style={{ color }}>
                  {p.points ?? '—'} {t('ahlTeamView.overview.ptsSuffix')}
                </span>
                <span className={ADV_STAT_AVG_CLASSES}>
                  {p.goals ?? 0}G {p.assists ?? 0}A
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {starter && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>{t('ahlTeamView.overview.startingGoalieTitle', { abbr })}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 8,
              background: 'var(--bg3)', border: '0.5px solid var(--border-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🥅</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {starter.player_name || t('ahlTeamView.overview.playerFallbackName', { id: starter.player_id })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                {starter.gp ?? 0} GP · {starter.wins ?? 0}W–{starter.losses ?? 0}L–{starter.ot_losses ?? 0}OTL
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>
                {starter.sv_pct != null ? starter.sv_pct.toFixed(3).replace('0.', '.') : '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>SV%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {starter.gaa != null ? starter.gaa.toFixed(2) : '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>GAA</div>
            </div>
          </div>
          {starter.shutouts > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', paddingLeft: 60 }}>
              {t('ahlTeamView.overview.shutoutNote', { count: starter.shutouts })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ skaters, goalies, loading, color }) {
  const { t } = useTranslation();
  const [view, setView] = useState('skaters');

  const teamTotals = useMemo(() => {
    if (!skaters.length) return null;
    return {
      goals:   skaters.reduce((s,p) => s+(p.goals??0), 0),
      assists: skaters.reduce((s,p) => s+(p.assists??0), 0),
      points:  skaters.reduce((s,p) => s+(p.points??0), 0),
      ppg:     skaters.reduce((s,p) => s+(p.pp_goals??0), 0),
    };
  }, [skaters]);

  return (
    <>
      {teamTotals && (
        <div className={METRICS_GRID_4_CLASSES} style={{ marginTop: 10 }}>
          <MetCard label={t('ahlTeamView.stats.metGoals')}   value={teamTotals.goals}   sub={t('ahlTeamView.stats.subTeamTotal')} />
          <MetCard label={t('ahlTeamView.stats.metAssists')} value={teamTotals.assists} sub={t('ahlTeamView.stats.subTeamTotal')} />
          <MetCard label={t('ahlTeamView.stats.metPoints')}  value={teamTotals.points}  sub={t('ahlTeamView.stats.subTeamTotal')} color="green" />
          <MetCard label={t('ahlTeamView.stats.metPpg')}     value={teamTotals.ppg}     sub={t('ahlTeamView.stats.subPowerPlay')} />
        </div>
      )}

      <div className={TABS_WRAP_CLASSES} style={{ marginTop: 8 }}>
        <button className={tabClasses(view === 'skaters')} onClick={() => setView('skaters')}>{t('ahlTeamView.stats.viewSkaters')}</button>
        <button className={tabClasses(view === 'goalies')} onClick={() => setView('goalies')}>{t('ahlTeamView.stats.viewGoalies')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
          {[80,65,70,55,75].map((w,i) => (
            <div key={i} className={SKELETON_CLASSES} style={{ height: 32, width: `${w}%`, borderRadius: 6 }} />
          ))}
        </div>
      )}

      {!loading && view === 'skaters' && skaters.map((p, i) => (
        <div key={p.player_id ?? i} className={ADV_STAT_ROW_CLASSES}>
          <span className={ADV_STAT_LABEL_CLASSES}>
            {p.player_name || t('ahlTeamView.stats.playerFallbackShort', { id: p.player_id })}
            {p.position && <span className={ADV_STAT_NOTE_CLASSES}> {p.position}</span>}
          </span>
          <span className={ADV_STAT_RIGHT_CLASSES}>
            <span className={advStatValClasses()} style={{ color }}>
              {p.points ?? 0} pts
            </span>
            <span className={ADV_STAT_AVG_CLASSES}>{p.goals??0}G {p.assists??0}A · {p.gp??0} GP</span>
          </span>
        </div>
      ))}

      {!loading && view === 'goalies' && goalies.map((g, i) => (
        <div key={g.player_id ?? i} className={ADV_STAT_ROW_CLASSES}>
          <span className={ADV_STAT_LABEL_CLASSES}>
            {g.player_name || t('ahlTeamView.stats.playerFallbackShort', { id: g.player_id })}
          </span>
          <span className={ADV_STAT_RIGHT_CLASSES}>
            <span className={advStatValClasses()} style={{ color }}>
              {g.sv_pct != null ? g.sv_pct.toFixed(3).replace('0.','.') : '—'}
            </span>
            <span className={ADV_STAT_AVG_CLASSES}>{g.gaa?.toFixed(2)??'—'} GAA · {g.wins??0}W</span>
          </span>
        </div>
      ))}
    </>
  );
}

// ── Splits tab ────────────────────────────────────────────────────────────────
function SplitsTab({ schedule, poSchedule, teamId, loading, inPlayoffs }) {
  const { t } = useTranslation();
  const [showPO, setShowPO] = React.useState(false);

  // AHL schedule rows have no ot/shootout boolean columns (see ahl.js's
  // docstring) -- every non-win counts as a plain loss, no W/OTW/OTL/L
  // split the way PWHL's SplitsTab can do.
  function calcSplits(sched) {
    if (!sched?.length || !teamId) return null;
    const final = sched.filter(g => g.game_state === 'Final');
    function calc(games) {
      let w=0, l=0, gf=0, ga=0;
      for (const g of games) {
        const isHome  = g.home_team_id === teamId;
        const my      = isHome ? g.home_score : g.away_score;
        const op      = isHome ? g.away_score : g.home_score;
        gf += my??0; ga += op??0;
        if (my > op) w++; else l++;
      }
      const n = games.length || 1;
      return { w, l, gf, ga, gp: games.length,
        gfpg: gf/n, gapg: ga/n,
        ptsPct: (w*2)/(games.length*2||1) };
    }
    return {
      home: calc(final.filter(g => g.home_team_id === teamId)),
      away: calc(final.filter(g => g.away_team_id === teamId)),
    };
  }

  const regSplits = useMemo(() => calcSplits(schedule),   [schedule, teamId]);
  const poSplits  = useMemo(() => calcSplits(poSchedule), [poSchedule, teamId]);
  const splits    = showPO ? poSplits : regSplits;

  function fmt(v, dec=2)  { return v == null ? '—' : Number(v).toFixed(dec); }
  function fmtPct(v)      { return v == null ? '—' : `${(v*100).toFixed(1)}%`; }

  function SplitRow({ label, hVal, aVal, better='higher', fmtFn }) {
    const fn = fmtFn || (v => fmt(v));
    if (hVal == null && aVal == null) return null;
    const hBetter = hVal != null && aVal != null
      ? (better === 'higher' ? hVal >= aVal : hVal <= aVal) : false;
    const aBetter = hVal != null && aVal != null ? !hBetter : false;
    return (
      <div className={SPLIT_ADV_ROW_CLASSES}>
        <span className={splitAdvValClasses(hBetter, false)}>{fn(hVal)}</span>
        <span className={SPLIT_ADV_LABEL_CLASSES}>{label}</span>
        <span className={splitAdvValClasses(aBetter, true)}>{fn(aVal)}</span>
      </div>
    );
  }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
      {[1,2,3].map(i => <div key={i} className={SKELETON_CLASSES} style={{ height:80, borderRadius:10 }} />)}
    </div>
  );

  const label = showPO ? t('team.playoffs') : t('team.regularSeason');

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>

      {inPlayoffs && (
        <div className={ADV_TOGGLE_CLASSES}>
          <button className={advToggleBtnClasses(!showPO)}
            onClick={() => setShowPO(false)}>{t('team.regularSeasonToggle')}</button>
          <button className={advToggleBtnClasses(showPO)}
            onClick={() => setShowPO(true)}>{t('team.playoffsToggle')}</button>
        </div>
      )}
      {!inPlayoffs && <div className={ADV_CONTEXT_NOTE_CLASSES}>{t('team.showingRegularSeason')}</div>}

      {!splits ? (
        <div className="card" style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>
          {t('ahlTeamView.splits.noDataYet', { label: label.toLowerCase() })}
        </div>
      ) : (
        <div className="card">
          <div className="sec-label" style={{ marginBottom:10 }}>{t('team.homeVsAwayTitle', { label })}</div>
          <div className={SPLIT_ADV_HEADER_CLASSES}>
            <span>{t('team.homeLabel')}</span>
            <span />
            <span>{t('team.awayLabel')}</span>
          </div>
          <div className={SPLIT_ADV_ROW_CLASSES} style={{ fontWeight:700, fontSize:14 }}>
            <span className={splitAdvValClasses(false, false)}>
              {splits.home.gp ? `${splits.home.w}–${splits.home.l}` : '—'}
            </span>
            <span className={SPLIT_ADV_LABEL_CLASSES} style={{ color:'var(--text-dim)', fontSize:11 }}>W–L</span>
            <span className={splitAdvValClasses(false, true)}>
              {splits.away.gp ? `${splits.away.w}–${splits.away.l}` : '—'}
            </span>
          </div>
          <SplitRow label="GP"     hVal={splits.home.gp||null}    aVal={splits.away.gp||null}    fmtFn={v=>String(v)} />
          <SplitRow label="Pts%"   hVal={splits.home.ptsPct}       aVal={splits.away.ptsPct}       better="higher" fmtFn={v=>fmtPct(v)} />
          <SplitRow label="GF/GP"  hVal={splits.home.gp ? splits.home.gfpg : null} aVal={splits.away.gp ? splits.away.gfpg : null} better="higher" fmtFn={v=>fmt(v)} />
          <SplitRow label="GA/GP"  hVal={splits.home.gp ? splits.home.gapg : null} aVal={splits.away.gp ? splits.away.gapg : null} better="lower"  fmtFn={v=>fmt(v)} />
          <SplitRow label="Diff"
            hVal={splits.home.gp ? splits.home.gf - splits.home.ga : null}
            aVal={splits.away.gp ? splits.away.gf - splits.away.ga : null}
            better="higher" fmtFn={v => v >= 0 ? `+${v}` : String(v)} />
        </div>
      )}
    </div>
  );
}

// ── Trends tab ────────────────────────────────────────────────────────────────
function TrendsTab({ schedule, teamId, loading }) {
  const { t } = useTranslation();
  const gameLog = useMemo(() => {
    if (!schedule?.length || !teamId) return [];
    return [...schedule]
      .filter(g => g.game_state === 'Final')
      .sort((a,b) => a.game_id - b.game_id)
      .map(g => {
        const isHome = g.home_team_id === teamId;
        const my     = isHome ? g.home_score : g.away_score;
        const op     = isHome ? g.away_score : g.home_score;
        const won    = my > op;
        return { won, my, op, result: won ? 'W' : 'L', game_id: g.game_id };
      });
  }, [schedule, teamId]);

  if (loading) return (
    <div className={`card ${EMPTY_STATE_CLASSES}`} style={{ marginTop: 10 }}>
      <div className={EMPTY_ICON_CLASSES}>📈</div>
      <div className={EMPTY_TITLE_CLASSES}>{t('ahlTeamView.trends.loadingTitle')}</div>
    </div>
  );

  if (!gameLog.length) return (
    <div className={`card ${EMPTY_STATE_CLASSES}`} style={{ marginTop: 10 }}>
      <div className={EMPTY_ICON_CLASSES}>📈</div>
      <div className={EMPTY_TITLE_CLASSES}>{t('ahlTeamView.trends.noDataTitle')}</div>
    </div>
  );

  const rolling = gameLog.map((g, i) => {
    const window = gameLog.slice(Math.max(0, i-9), i+1);
    return { ...g, w10pct: Math.round(window.filter(x => x.won).length / window.length * 100) };
  });

  const rollingGF = gameLog.map((g, i) => {
    const w = gameLog.slice(Math.max(0, i-4), i+1);
    return parseFloat((w.reduce((s,x) => s+x.my, 0) / w.length).toFixed(1));
  });
  const rollingGA = gameLog.map((g, i) => {
    const w = gameLog.slice(Math.max(0, i-4), i+1);
    return parseFloat((w.reduce((s,x) => s+x.op, 0) / w.length).toFixed(1));
  });

  let streak = 0, streakType = '';
  for (let i = gameLog.length-1; i >= 0; i--) {
    const g = gameLog[i];
    if (i === gameLog.length-1) { streakType = g.won ? 'W' : 'L'; streak = 1; }
    else if ((g.won && streakType === 'W') || (!g.won && streakType === 'L')) streak++;
    else break;
  }

  const last10   = gameLog.slice(-10);
  const last10W  = last10.filter(g => g.won).length;
  const display  = gameLog.slice(-20);
  const rollDisp = rolling.slice(-20);
  const gfDisp   = rollingGF.slice(-20);
  const gaDisp   = rollingGA.slice(-20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>

      <div className="card">
        <div className={TRENDS_QUICK_CLASSES}>
          <div className={TQ_ITEM_CLASSES}>
            <div className={TQ_LABEL_CLASSES}>{t('team.currentStreak')}</div>
            <div className={TQ_VAL_CLASSES} style={{ color: streakType === 'W' ? 'var(--green)' : 'var(--red-bright)' }}>
              {streakType}{streak}
            </div>
          </div>
          <div className={TQ_ITEM_CLASSES}>
            <div className={TQ_LABEL_CLASSES}>{t('team.last10Games')}</div>
            <div className={TQ_VAL_CLASSES}>{last10W}–{10-last10W}</div>
          </div>
          <div className={TQ_ITEM_CLASSES}>
            <div className={TQ_LABEL_CLASSES}>{t('ahlTeamView.trends.winPctL10')}</div>
            <div className={TQ_VAL_CLASSES}>{Math.round(last10W/10*100)}%</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>{t('team.lastNGames', { count: display.length })}</div>
        <div className={RESULT_DOTS_CLASSES}>
          {display.map((g, i) => (
            <div key={i}
              className={resultDotClasses(g.won ? 'w' : 'l')}
              title={t('ahlTeamView.trends.simpleDotTooltip', { result: g.result, my: g.my, op: g.op })}>
              {g.result}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>{t('ahlTeamView.trends.rollingWinPctTitle')}</div>
        <div className={ROLLING_CHART_CLASSES}>
          {rollDisp.map((g, i) => (
            <div key={i} className={ROLLING_BAR_WRAP_CLASSES}>
              <div className={ROLLING_BAR_LABEL_CLASSES}>{g.w10pct}%</div>
              <div className={rollingBarClasses(g.w10pct)}
                style={{ height: `${g.w10pct}%` }}
                title={t('ahlTeamView.trends.simpleBarTooltip', { pct: g.w10pct })} />
              {i % 5 === 0 && <div className={ROLLING_LABEL_CLASSES}>{i+1}</div>}
            </div>
          ))}
          <div className={ROLLING_AVG_LINE_CLASSES} style={{ bottom: '50%' }} />
        </div>
        <div className={ROLLING_LEGEND_CLASSES}>
          <span className={RL_HOT_CLASSES}>{t('team.legendHot')}</span>
          <span className={RL_OK_CLASSES}>{t('team.legendAverage')}</span>
          <span className={RL_COLD_CLASSES}>{t('team.legendCold')}</span>
          <span style={{ color:'var(--text-dim)', marginLeft:'auto', fontSize:9 }}>{t('ahlTeamView.trends.legendFootnoteShort')}</span>
        </div>
      </div>

      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>{t('team.rollingGoalsAvgTitle')}</div>
        <div className={ROLLING_CHART_DUAL_CLASSES}>
          {gfDisp.map((gf, i) => {
            const ga = gaDisp[i];
            const maxVal = 6;
            return (
              <div key={i} className={ROLLING_BAR_WRAP_CLASSES}>
                <div className={ROLLING_BAR_LABEL_CLASSES} style={{ color: 'var(--red-bright)' }}>{gf}</div>
                <div className={ROLLING_BAR_DUAL_WRAP_CLASSES}>
                  <div className={ROLLING_BAR_GF_CLASSES} style={{ height: `${Math.min(gf/maxVal*100,100)}%` }} title={t('team.gfAvgTooltip', { gf })} />
                  <div className={ROLLING_BAR_GA_CLASSES} style={{ height: `${Math.min(ga/maxVal*100,100)}%` }} title={t('team.gaAvgTooltip', { ga })} />
                </div>
                <div className={ROLLING_BAR_LABEL_BOT_CLASSES} style={{ color: 'var(--blue-bright)' }}>{ga}</div>
                {i % 5 === 0 && <div className={ROLLING_LABEL_CLASSES}>{i+1}</div>}
              </div>
            );
          })}
        </div>
        <div className={ROLLING_LEGEND_CLASSES}>
          <span style={{ color: 'var(--red-bright)' }}>{t('team.legendGoalsFor')}</span>
          <span style={{ color: 'var(--blue-bright)', marginLeft: 12 }}>{t('team.legendGoalsAgainst')}</span>
        </div>
      </div>

      <div className="card">
        <div className="sec-label" style={{ marginBottom: 6 }}>{t('team.goalDiffTitle')}</div>
        <div className={GD_CHART_WRAP_CLASSES}>
          <div className={GD_BASELINE_LINE_CLASSES} />
          <div className={GD_BARS_CLASSES}>
            {display.map((g, i) => {
              const diff  = g.my - g.op;
              const absPx = Math.min(Math.abs(diff) * 12, 48);
              return (
                <div key={i} className={GD_BAR_COL_CLASSES} title={t('ahlTeamView.trends.simpleDotTooltip', { result: g.result, my: g.my, op: g.op })}>
                  <div className={GD_TOP_CLASSES}>
                    {diff > 0 && (
                      <>
                        <div className={GD_BAR_INLINE_LABEL_POS_CLASSES}>+{diff}</div>
                        <div className={GD_BAR_POS_CLASSES} style={{ height: absPx }} />
                      </>
                    )}
                  </div>
                  <div className={GD_BOT_CLASSES}>
                    {diff < 0 && (
                      <>
                        <div className={GD_BAR_NEG_CLASSES} style={{ height: absPx }} />
                        <div className={GD_BAR_INLINE_LABEL_NEG_CLASSES}>{diff}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
