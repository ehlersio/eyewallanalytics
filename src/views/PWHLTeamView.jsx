// views/PWHLTeamView.jsx
// Mirrors NHL TeamView — tabbed layout: Overview / Stats / Splits
import React, { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import {
  fetchPWHLStandings, fetchPWHLPlayers, fetchPWHLSchedule, fetchPWHLSalaries,
  PWHL_TEAM_CONFIG, PWHL_TEAM_ID,
} from '../utils/pwhlApi';
import { PWHL_SEASONS, PWHL_PLAYOFF_SEASON_MAP } from '../utils/pwhlConfig';
import { useSport } from '../utils/SportContext';
import TeamLogo from '../components/TeamLogo';
import { MetCard } from '../components/StatBar';
import TeamComparisonPopup from '../components/TeamComparisonPopup';
import { PAGE_CLASSES } from '../utils/pageClasses';
// ShotMapView.css import removed (Phase 5, sub-PR 1) -- this file's only
// dependency on it was .metrics-grid/.metrics-grid-4, now fully migrated
// to METRICS_GRID_4_CLASSES below. ShotMapView.jsx/PWHLShotMapView.jsx
// each import the CSS file directly themselves, so its still-unmigrated
// rules stay loaded regardless of this file dropping the import.

// .view-title / .players-tabs / .players-tab (Session 97, Phase 3) -- were
// PlayersView.css's, genuinely shared with PlayersView.jsx/
// PWHLPlayersView.jsx/TeamView.jsx. Migrated here too so these rules can be
// deleted from PlayersView.css without leaving this file's usages stranded
// on dead CSS.
// METRICS_GRID_4_CLASSES (Phase 5, ShotMapView.css sub-PR 1) -- .metrics-grid
// is genuinely shared by ShotMapView.jsx/PWHLShotMapView.jsx too, but this
// file only ever uses the 4-column variant, so no need to duplicate the
// full parameterized helper from those files.
const METRICS_GRID_4_CLASSES = 'grid grid-cols-4 gap-2 mb-2'
const VIEW_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold flex items-center gap-2 mb-[2px]'
const TABS_WRAP_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-14px] mb-[14px] px-[14px]'
const TAB_BASE_CLASSES = 'flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]'
const TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent'
const TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]'
function tabClasses(isActive) {
  return `${TAB_BASE_CLASSES} ${isActive ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`
}

// ── TeamView.css-derived Tailwind class constants (Phase 4 -- TeamView.css
// deleted). Duplicated from TeamView.jsx per established per-file convention.
// .adv-stat-row/.cap-row/.split-adv-row/.rolling-avg-line kept as literal
// markers so light-mode-overrides.css's "TeamView.css additions" block keeps
// applying untouched (PWHLTeamView.jsx doesn't use .split-adv-section-title
// or .cap-row -- no Cap/Picks tabs on the PWHL side).

const VIEW_SUB_CLASSES = 'view-sub text-[12px] text-[color:var(--text-muted)] mb-3'
const TEAM_COMPARE_BTN_CLASSES = 'text-[11px] font-semibold text-[color:var(--text-muted)] bg-[var(--bg2)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius-sm)] py-[5px] px-[9px] cursor-pointer whitespace-nowrap [transition:background_0.15s,color_0.15s] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]'

const TEAM_TABS_CLASSES = 'flex gap-1 mb-[14px] overflow-x-auto pb-[2px] border-b-[0.5px] border-[var(--border)]'
// bg-transparent deliberately NOT in base -- see TeamView.jsx's comment
// (lesson #9: same-layer Tailwind utilities racing for one property).
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

const ADV_EXPLAIN_CLASSES = 'text-[11px] text-[color:var(--text-dim)] mb-[10px] italic border-l-2 border-[var(--border-2)] pl-2'
const ADV_STAT_ROW_CLASSES = 'adv-stat-row flex items-center justify-between py-[7px] border-b-[0.5px] border-[rgba(255,255,255,0.04)]'
const ADV_STAT_LABEL_CLASSES = 'text-[12px] text-[color:var(--text-muted)] flex-1'
const ADV_STAT_NOTE_CLASSES = 'text-[10px] text-[color:var(--text-dim)]'
const ADV_STAT_RIGHT_CLASSES = 'adv-stat-right flex items-center gap-[6px] flex-shrink-0 min-w-[120px] justify-end'
const ADV_STAT_VAL_BASE_CLASSES = 'font-[family-name:var(--font-mono)] text-[14px] font-semibold ml-2 min-w-[52px] text-right'
const ADV_STAT_VAL_DEFAULT_CLASSES = 'text-[color:var(--text)]'
const ADV_STAT_VAL_GOOD_CLASSES = 'text-[#4ade80]'
const ADV_STAT_VAL_BAD_CLASSES = 'text-[#f87171]'
function advStatValClasses(rating) {
  const variant = rating === 'good' ? ADV_STAT_VAL_GOOD_CLASSES : rating === 'bad' ? ADV_STAT_VAL_BAD_CLASSES : ADV_STAT_VAL_DEFAULT_CLASSES
  return `${ADV_STAT_VAL_BASE_CLASSES} ${variant}`
}
const ADV_STAT_AVG_CLASSES = 'text-[10px] text-[color:var(--text-dim)] whitespace-nowrap min-w-[48px] text-right'

const ADV_TOGGLE_CLASSES = 'adv-toggle flex gap-1 bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-[20px] p-[3px] w-fit'
// bg-transparent moved to INACTIVE, same lesson-#9 fix as teamTabClasses above.
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
// 'otw' (PWHL-only, an overtime/shootout win) had zero CSS coverage in
// TeamView.css -- .result-dot.w/.l/.otl existed but .otw never did, so these
// dots rendered with no fill/color at all. Fixed here by giving otw the same
// treatment as w (both are wins), rather than faithfully replicating the gap.
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

// padding: 28px 16px moved to index.css as real unlayered CSS -- collides
// with .card's own unlayered padding (see index.css's .empty-state comment).
const EMPTY_STATE_CLASSES = 'empty-state text-center'
const EMPTY_ICON_CLASSES = 'empty-icon text-[28px] mb-2'
const EMPTY_TITLE_CLASSES = 'empty-title text-[14px] font-semibold text-[color:var(--text)] mb-1'
const EMPTY_SUB_CLASSES = 'empty-sub text-[12px] text-[color:var(--text-muted)]'

const TABS = ['Overview', 'Advanced', 'Splits', 'Trends', 'Salaries'];

export default function PWHLTeamView() {
  const team   = PWHL_TEAM_CONFIG;
  const teamId = PWHL_TEAM_ID;
  const abbr   = team?.abbr || '—';
  const color  = team?.displayColor || 'var(--text-dim)';
  const [tab,  setTab]  = useState('Overview');
  const [compareOpen, setCompareOpen] = useState(false);

  // currentSeason is reactive (see SportContext.jsx) -- unlike reading
  // PWHL_CURRENT_SEASON directly here, which would only ever reflect
  // whatever value existed at this component's first mount: these
  // useFetch calls have no `season` state of their own to put in their
  // deps array (this view has no season picker), so without including
  // currentSeason in the deps below, none of them would ever re-fetch
  // once the live season resolves after mount.
  const { currentSeason } = useSport();

  const { data: standings, loading: sLoad } = useFetch(() => fetchPWHLStandings(currentSeason), [currentSeason]);
  const { data: players,   loading: pLoad } = useFetch(
    () => teamId ? fetchPWHLPlayers(teamId, currentSeason) : Promise.resolve(null), [teamId, currentSeason]
  );
  const { data: schedule,  loading: scLoad  } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, currentSeason) : Promise.resolve(null), [teamId, currentSeason]
  );
  const { data: poSchedule, loading: poScLoad } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, PWHL_PLAYOFF_SEASON_MAP[currentSeason] || 9) : Promise.resolve(null), [teamId, currentSeason]
  );
  const inPlayoffs = (poSchedule?.length || 0) > 0;
  const { data: salaries, loading: salLoad } = useFetch(
    () => teamId ? fetchPWHLSalaries(teamId) : Promise.resolve(null), [teamId]
  );

  const teamRow = useMemo(() => standings?.find(r => r.team_id === teamId) || null, [standings, teamId]);
  const skaters = useMemo(() => players?.skaters || [], [players]);
  const goalies = useMemo(() => players?.goalies || [], [players]);

  if (!abbr || !teamId) {
    return (
      <div className={PAGE_CLASSES}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>No PWHL team selected.</p>
        </div>
      </div>
    );
  }

  const loading = sLoad || pLoad;
  // Was a hardcoded "2025-26 season" string -- silently wrong every season
  // after this one. currentSeason is reactive (see SportContext.jsx).
  const seasonLabel = PWHL_SEASONS.find(s => s.id === currentSeason)?.label || `Season ${currentSeason}`;

  return (
    <div className={`${PAGE_CLASSES} team-view`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <TeamLogo abbr={abbr} sport="pwhl" size={28} color={color} />
        <h2 className={VIEW_TITLE_CLASSES} style={{ margin: 0 }}>{team.displayName}</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p className={VIEW_SUB_CLASSES} style={{ margin: 0 }}>{seasonLabel} season</p>
        <button className={TEAM_COMPARE_BTN_CLASSES} onClick={() => setCompareOpen(true)}>🆚 Compare Seasons</button>
      </div>

      {compareOpen && (
        <TeamComparisonPopup
          league="pwhl"
          teamValue={teamId}
          teamLabel={team.displayName}
          onClose={() => setCompareOpen(false)}
        />
      )}

      <div className={TEAM_TABS_CLASSES}>
        {TABS.map(t => (
          <button key={t} className={teamTabClasses(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Overview'  && (
        <OverviewTab teamRow={teamRow} skaters={skaters} goalies={goalies}
          schedule={schedule} teamId={teamId} abbr={abbr} color={color} loading={loading}
          standings={standings} />
      )}
      {tab === 'Advanced'  && (
        <AdvancedTab teamRow={teamRow} skaters={skaters} goalies={goalies}
          abbr={abbr} color={color} loading={sLoad || pLoad || scLoad}
          schedule={schedule} poSchedule={poSchedule} teamId={teamId}
          standings={standings} inPlayoffs={inPlayoffs} />
      )}
      {tab === 'Stats'     && (
        <StatsTab skaters={skaters} goalies={goalies} loading={pLoad} abbr={abbr} color={color} />
      )}
      {tab === 'Splits'    && (
        <SplitsTab schedule={schedule} poSchedule={poSchedule} teamId={teamId}
          abbr={abbr} color={color} loading={scLoad || poScLoad} inPlayoffs={inPlayoffs} />
      )}
      {tab === 'Trends'    && (
        <TrendsTab schedule={schedule} teamId={teamId} loading={scLoad} />
      )}
      {tab === 'Salaries'  && (
        <SalariesTab salaries={salaries} loading={salLoad} abbr={abbr} color={color} />
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ teamRow, skaters, goalies, schedule, teamId, abbr, color, loading, standings }) {

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

  // SOG/GP and SA/GP computed from player data
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

  // Last 5 results
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
        const won    = my > op;
        return { won, ot: g.ot, so: g.shootout };
      });
  }, [schedule, teamId]);

  return (
    <>
      {/* Record block — mirrors NHL record-block */}
      <div className={RECORDS_ROW_CLASSES}>
        <div className={`card ${RECORD_BLOCK_CLASSES}`}>
          <div className={RECORD_BLOCK_LABEL_CLASSES} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TeamLogo abbr={abbr} sport="pwhl" size={14} color={color} /> Regular Season
          </div>
          {loading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : (
            <div className={RECORD_MAIN_ROW_CLASSES}>
              <span className={RECORD_BIG_CLASSES}>{teamRow?.wins??0}–{teamRow?.losses??0}–{teamRow?.ot_losses??0}</span>
              <span className={PTS_CHIP_CLASSES}>{teamRow?.points??0} pts</span>
            </div>
          )}
          {teamRow && (
            <div className={RECORD_META_CLASSES}>
              <span>GF: {teamRow.goals_for??'—'}</span>
              <span className={RECORD_META_SEP_CLASSES}>·</span>
              <span>GA: {teamRow.goals_against??'—'}</span>
              {gd != null && (
                <span className={streakChipClasses(gd >= 0)}>
                  {gd >= 0 ? `+${gd}` : gd} diff
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Last 5 */}
      {last5.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>Last 5 games</div>
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
                {g.won ? 'W' : 'L'}{g.so ? '/SO' : g.ot ? '/OT' : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season stat grid — mirrors NHL overview-stat-grid */}
      {teamRow && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 10 }}>Season stats</div>
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

      {/* Points leaders */}
      {topScorers.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>{abbr} Points Leaders</div>
          {topScorers.map((p, i) => (
            <div key={p.id ?? i} className={ADV_STAT_ROW_CLASSES}>
              <span className={ADV_STAT_LABEL_CLASSES}>
                {p.player_name || `Player #${p.player_id}`}
                {p.position && <span className={ADV_STAT_NOTE_CLASSES}> · {p.position}</span>}
              </span>
              <span className={ADV_STAT_RIGHT_CLASSES}>
                <span className={advStatValClasses(null)} style={{ color }}>
                  {p.points ?? '—'} pts
                </span>
                <span className={ADV_STAT_AVG_CLASSES}>
                  {p.goals ?? 0}G {p.assists ?? 0}A
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Starting goalie */}
      {starter && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>{abbr} Starting Goalie</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 8,
              background: 'var(--bg3)', border: '0.5px solid var(--border-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🥅</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {starter.player_name || `Player #${starter.player_id}`}
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
              {starter.shutouts} shutout{starter.shutouts !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ skaters, goalies, loading, abbr: _abbr, color }) {
  const [view, setView] = useState('skaters');

  const teamTotals = useMemo(() => {
    if (!skaters.length) return null;
    return {
      goals:   skaters.reduce((s,p) => s+(p.goals??0), 0),
      assists: skaters.reduce((s,p) => s+(p.assists??0), 0),
      points:  skaters.reduce((s,p) => s+(p.points??0), 0),
      shots:   skaters.reduce((s,p) => s+(p.shots??0), 0),
      ppg:     skaters.reduce((s,p) => s+(p.pp_goals??0), 0),
    };
  }, [skaters]);

  return (
    <>
      {/* Team totals MetCards */}
      {teamTotals && (
        <div className={METRICS_GRID_4_CLASSES} style={{ marginTop: 10 }}>
          <MetCard label="Goals"   value={teamTotals.goals}   sub="Team total" />
          <MetCard label="Assists" value={teamTotals.assists} sub="Team total" />
          <MetCard label="Points"  value={teamTotals.points}  sub="Team total" color="green" />
          <MetCard label="PPG"     value={teamTotals.ppg}     sub="Power play" />
        </div>
      )}

      <div className={TABS_WRAP_CLASSES} style={{ marginTop: 8 }}>
        <button className={tabClasses(view === 'skaters')} onClick={() => setView('skaters')}>Skaters</button>
        <button className={tabClasses(view === 'goalies')} onClick={() => setView('goalies')}>Goalies</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
          {[80,65,70,55,75].map((w,i) => (
            <div key={i} className="skeleton" style={{ height: 32, width: `${w}%`, borderRadius: 6 }} />
          ))}
        </div>
      )}

      {!loading && view === 'skaters' && skaters.map((p, i) => (
        <div key={p.id ?? i} className={ADV_STAT_ROW_CLASSES}>
          <span className={ADV_STAT_LABEL_CLASSES}>
            {p.player_name || `#${p.player_id}`}
            {p.position && <span className={ADV_STAT_NOTE_CLASSES}> {p.position}</span>}
          </span>
          <span className={ADV_STAT_RIGHT_CLASSES}>
            <span className={advStatValClasses(null)} style={{ color }}>
              {p.points ?? 0} pts
            </span>
            <span className={ADV_STAT_AVG_CLASSES}>{p.goals??0}G {p.assists??0}A · {p.gp??0} GP</span>
          </span>
        </div>
      ))}

      {!loading && view === 'goalies' && goalies.map((g, i) => (
        <div key={g.id ?? i} className={ADV_STAT_ROW_CLASSES}>
          <span className={ADV_STAT_LABEL_CLASSES}>
            {g.player_name || `#${g.player_id}`}
          </span>
          <span className={ADV_STAT_RIGHT_CLASSES}>
            <span className={advStatValClasses(null)} style={{ color }}>
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
function SplitsTab({ schedule, poSchedule, teamId, abbr: _abbr, color: _color, loading, inPlayoffs }) {
  const [showPO, setShowPO] = React.useState(false);

  function calcSplits(sched) {
    if (!sched?.length || !teamId) return null;
    const final = sched.filter(g => g.game_state === 'Final');
    function calc(games) {
      let w=0, otw=0, otl=0, l=0, gf=0, ga=0;
      for (const g of games) {
        const isHome  = g.home_team_id === teamId;
        const my      = isHome ? g.home_score : g.away_score;
        const op      = isHome ? g.away_score : g.home_score;
        const isExtra = g.ot || g.shootout;
        gf += my??0; ga += op??0;
        if (my > op) { isExtra ? otw++ : w++; }
        else         { isExtra ? otl++ : l++;  }
      }
      const n = games.length || 1;
      return { w, otw, otl, l, gf, ga, gp: games.length,
        gfpg: gf/n, gapg: ga/n,
        pts: w*3+otw*2+otl, ptsPct: (w*3+otw*2+otl)/(games.length*3||1) };
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
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:80, borderRadius:10 }} />)}
    </div>
  );

  const label = showPO ? 'Playoffs' : 'Regular Season';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>

      {/* Regular Season / Playoffs toggle */}
      {inPlayoffs && (
        <div className={ADV_TOGGLE_CLASSES}>
          <button className={advToggleBtnClasses(!showPO)}
            onClick={() => setShowPO(false)}>📅 Regular Season</button>
          <button className={advToggleBtnClasses(showPO)}
            onClick={() => setShowPO(true)}>🏒 Playoffs</button>
        </div>
      )}
      {!inPlayoffs && <div className={ADV_CONTEXT_NOTE_CLASSES}>Showing Regular Season stats</div>}

      {!splits ? (
        <div className="card" style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>
          No {label.toLowerCase()} data yet.
        </div>
      ) : (
        <>
          {/* Side-by-side comparison — mirrors NHL SplitsTab */}
          <div className="card">
            <div className="sec-label" style={{ marginBottom:10 }}>Home vs Away — {label}</div>
            <div className={SPLIT_ADV_HEADER_CLASSES}>
              <span>🏠 Home</span>
              <span />
              <span>✈ Away</span>
            </div>
            <div className={SPLIT_ADV_ROW_CLASSES} style={{ fontWeight:700, fontSize:14 }}>
              <span className={splitAdvValClasses(false, false)}>
                {splits.home.gp ? `${splits.home.w}–${splits.home.otw}–${splits.home.otl}–${splits.home.l}` : '—'}
              </span>
              <span className={SPLIT_ADV_LABEL_CLASSES} style={{ color:'var(--text-dim)', fontSize:11 }}>W–OTW–OTL–L</span>
              <span className={splitAdvValClasses(false, true)}>
                {splits.away.gp ? `${splits.away.w}–${splits.away.otw}–${splits.away.otl}–${splits.away.l}` : '—'}
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


        </>
      )}
    </div>
  );
}

// ── Advanced tab ──────────────────────────────────────────────────────────────
function AdvancedTab({ teamRow, skaters, goalies, abbr, color: _color, loading, standings, inPlayoffs, teamId, schedule: _schedule, poSchedule }) {
  const [showPO, setShowPO] = React.useState(false);
  function fmt(v, dec=2)  { return v == null ? '—' : Number(v).toFixed(dec); }
  function fmtPct(v)      { return v == null ? '—' : `${(v*100).toFixed(1)}%`; }

  // ── Shared AdvStatRow ────────────────────────────────────────
  function AdvStatRow({ label, val, avg, rating, note }) {
    if (val == null || val === '—') return null;
    return (
      <div className={ADV_STAT_ROW_CLASSES}>
        <span className={ADV_STAT_LABEL_CLASSES}>
          {label}
          {note && <span className={ADV_STAT_NOTE_CLASSES}> · {note}</span>}
        </span>
        <span className={ADV_STAT_RIGHT_CLASSES}>
          <span className={advStatValClasses(rating)}>{val}</span>
          {avg && <span className={ADV_STAT_AVG_CLASSES}>avg {avg}</span>}
        </span>
      </div>
    );
  }

  // ── Derive stats from schedule for playoff toggle (must be before early return) ──
  const poSched = useMemo(() => {
    if (!poSchedule?.length || !teamId) return null;
    const done = poSchedule.filter(g => g.game_state === 'Final');
    if (!done.length) return null;
    const gf = done.reduce((s,g) => s + (g.home_team_id===teamId ? g.home_score : g.away_score)||0, 0);
    const ga = done.reduce((s,g) => s + (g.home_team_id===teamId ? g.away_score : g.home_score)||0, 0);
    return { gp: done.length, gf, ga, gfpg: gf/done.length, gapg: ga/done.length };
  }, [poSchedule, teamId]);
  const useReg = !showPO || !poSched;

  if (loading) return (
    <div className={`card ${EMPTY_STATE_CLASSES}`} style={{ marginTop: 10 }}>
      <div className={EMPTY_ICON_CLASSES}>📊</div>
      <div className={EMPTY_TITLE_CLASSES}>Loading advanced stats…</div>
    </div>
  );

  if (!teamRow) return (
    <div className={`card ${EMPTY_STATE_CLASSES}`} style={{ marginTop: 10 }}>
      <div className={EMPTY_ICON_CLASSES}>📊</div>
      <div className={EMPTY_TITLE_CLASSES}>No advanced stats yet</div>
      <div className={EMPTY_SUB_CLASSES}>{abbr} hasn't played a game yet this season.</div>
    </div>
  );

  const gp   = (showPO && poSched) ? poSched.gp   : teamRow.gp || 1;
  const gfpg = (showPO && poSched) ? poSched.gfpg : (teamRow.goals_for  ? teamRow.goals_for  / (teamRow.gp||1) : null);
  const gapg = (showPO && poSched) ? poSched.gapg : (teamRow.goals_against ? teamRow.goals_against / (teamRow.gp||1) : null);

  // ── Shot volume — regular season from player data (no playoff player stats available) ──
  const totalGoals  = skaters.reduce((s,p) => s+(p.goals??0),  0);
  const totalShots  = skaters.reduce((s,p) => s+(p.shots??0),  0);
  const totalSaves  = goalies.reduce((s,g) => s+(g.saves??0),  0);
  const totalGA     = goalies.reduce((s,g) => s+(g.goals_against??0), 0);
  const totalSA     = totalSaves + totalGA;

  // For playoffs: derive GF/GA from schedule; SOG not available
  const sogPG      = !showPO && totalShots > 0 ? totalShots / gp : null;
  const saPG       = !showPO && totalSA    > 0 ? totalSA    / gp : null;
  const shPct  = !showPO && totalShots > 0 ? totalGoals / totalShots : null;
  const svPct  = !showPO && totalSA    > 0 ? totalSaves / totalSA    : null;
  const pdo    = shPct != null && svPct != null ? (shPct + svPct) * 100 : null;


  // ── League-wide rankings ─────────────────────────────────────
  function leagueRank(key, higherBetter = true) {
    if (!standings?.length) return null;
    const sorted = [...standings].filter(r => r[key] != null)
      .sort((a,b) => higherBetter ? b[key]-a[key] : a[key]-b[key]);
    const idx = sorted.findIndex(r => r.team_id === teamId);
    return idx >= 0 ? idx + 1 : null;
  }

  // ── League averages (2025-26 PWHL approximations) ────────────
  const AVG = {
    gfpg: 3.2, gapg: 3.2,
    sogpg: 28.0, sapg: 28.0, shotForPct: 0.5,
    shPct: 0.094, svPct: 0.906, pdo: 100,
    ppPct: 0.175, pkPct: 0.825,
  };

  function rate(v, avg, higherBetter=true) {
    if (v == null || avg == null) return null;
    const diff = (v - avg) / avg;
    if (Math.abs(diff) < 0.02) return null;
    return (diff > 0) === higherBetter ? 'good' : 'bad';
  }

  function RankBadge({ r }) {
    if (!r) return null;
    const clr    = r <= 2 ? 'var(--green)' : r <= 6 ? 'var(--text-muted)' : 'var(--red-bright)';
    const suffix = r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
    return <span className={OVERVIEW_STAT_RANK_CLASSES} style={{ color: clr }}>{r}<sup className="text-[7px]">{suffix}</sup></span>;
  }


  const ppPct = teamRow.pp_pct;
  const pkPct = teamRow.pk_pct;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
      {inPlayoffs && (
        <div className={ADV_TOGGLE_CLASSES}>
          <button className={advToggleBtnClasses(!showPO)}
            onClick={() => setShowPO(false)}>📅 Regular Season</button>
          <button className={advToggleBtnClasses(showPO)}
            onClick={() => setShowPO(true)}>🏒 Playoffs</button>
        </div>
      )}
      {!inPlayoffs && <div className={ADV_CONTEXT_NOTE_CLASSES}>Showing Regular Season stats</div>}

      {/* Shot Volume & Possession */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:8 }}>Shot Volume &amp; Possession</div>
        <div className={ADV_EXPLAIN_CLASSES}>
          {useReg
            ? <>Corsi For% (CF%) counts all shot attempts (shots + goals + blocked shots) for ÷ total.
               Fenwick For% (FF%) uses shots + goals only, excluding blocked shots.
               ≥50% means {abbr} is generating more attempts than opponents.
               <em> No missed shot data in PWHL — FF% is a proxy.</em></>
            : 'Shot data only available for regular season. Showing goals for/against from playoff schedule.'}
        </div>
        {useReg && teamRow.corsi_for_pct != null ? (
          <>
            <AdvStatRow label="Corsi For% (CF%)"
              val={`${Number(teamRow.corsi_for_pct).toFixed(1)}%`}
              avg="50.0%" rating={rate(Number(teamRow.corsi_for_pct)/100, 0.5)}
              note={`${teamRow.corsi_for} CF — ${teamRow.corsi_against} CA`} />
            <AdvStatRow label="Fenwick For% (FF%)"
              val={`${Number(teamRow.fenwick_for_pct).toFixed(1)}%`}
              avg="50.0%" rating={rate(Number(teamRow.fenwick_for_pct)/100, 0.5)}
              note={`${teamRow.fenwick_for} FF — ${teamRow.fenwick_against} FA · no missed shots`} />
            <AdvStatRow label="Corsi For/GP"
              val={teamRow.corsi_for_pg != null ? fmt(teamRow.corsi_for_pg, 1) : null}
              note="shot attempts for per game" />
            <AdvStatRow label="Corsi Against/GP"
              val={teamRow.corsi_against_pg != null ? fmt(teamRow.corsi_against_pg, 1) : null}
              note="shot attempts against per game" />
          </>
        ) : useReg ? (
          <div className={ADV_EXPLAIN_CLASSES}>Run pwhl_stats.py to populate Corsi/Fenwick data.</div>
        ) : null}
        <AdvStatRow label="Shots For/GP"     val={sogPG != null ? fmt(sogPG,1) : null}
          avg={AVG.sogpg.toFixed(1)} rating={rate(sogPG, AVG.sogpg)} />
        <AdvStatRow label="Shots Against/GP" val={saPG  != null ? fmt(saPG, 1) : null}
          avg={AVG.sapg.toFixed(1)}  rating={rate(saPG,  AVG.sapg, false)} />
        <AdvStatRow label="Goals For/GP"     val={gfpg != null ? fmt(gfpg) : null}
          avg={AVG.gfpg.toFixed(2)} rating={rate(gfpg, AVG.gfpg)} />
        <AdvStatRow label="Goals Against/GP" val={gapg != null ? fmt(gapg) : null}
          avg={AVG.gapg.toFixed(2)} rating={rate(gapg, AVG.gapg, false)} />
      </div>

      {/* PDO & Puck Luck */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:8 }}>PDO &amp; Puck Luck</div>
        {showPO ? (
          <div className={ADV_EXPLAIN_CLASSES}>
            PDO requires shot-level data not available for playoffs yet.
            Showing regular season PDO for reference.
          </div>
        ) : (
          <div className={ADV_EXPLAIN_CLASSES}>
            PDO = team shooting% + save% × 100. League average = 100.
            Values above 102 suggest positive puck luck likely to regress; below 98 suggests negative luck.
          </div>
        )}
        <AdvStatRow label={showPO ? 'PDO (reg season)' : 'PDO'}
          val={pdo != null ? fmt(pdo,1) : null}
          avg="100.0" rating={rate(pdo, AVG.pdo)}
          note={pdo != null ? (pdo > 102 ? 'Positive luck — may regress' : pdo < 98 ? 'Negative luck — may improve' : 'Near league average') : null} />
        <AdvStatRow label={showPO ? 'Team SH% (reg)' : 'Team SH%'}
          val={shPct != null ? fmtPct(shPct) : null}
          avg={fmtPct(AVG.shPct)} rating={rate(shPct, AVG.shPct)}
          note={`${totalGoals}G on ${totalShots} shots`} />
        <AdvStatRow label={showPO ? 'Team SV% (reg)' : 'Team SV%'}
          val={svPct != null ? svPct.toFixed(3).replace('0.','.') : null}
          avg={AVG.svPct.toFixed(3).replace('0.','.')} rating={rate(svPct, AVG.svPct)} />
      </div>

      {/* Special Teams */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:8 }}>Special Teams</div>
        {(ppPct != null || pkPct != null) ? (
          <>
            <AdvStatRow label="PP%"
              val={ppPct != null ? fmtPct(ppPct) : null}
              avg={fmtPct(AVG.ppPct)} rating={rate(ppPct, AVG.ppPct)}
              note={teamRow.pp_goals != null && teamRow.pp_opportunities
                ? `${teamRow.pp_goals}G on ${teamRow.pp_opportunities} chances` : 'league avg ~17.5%'} />
            <AdvStatRow label="PK%"
              val={pkPct != null ? fmtPct(pkPct) : null}
              avg={fmtPct(AVG.pkPct)} rating={rate(pkPct, AVG.pkPct)}
              note={teamRow.pk_goals_against != null && teamRow.times_shorthanded
                ? `${teamRow.pk_goals_against}GA on ${teamRow.times_shorthanded} PKs` : 'league avg ~82.5%'} />
            {teamRow.sh_goals_for != null && (
              <AdvStatRow label="SHG For"  val={teamRow.sh_goals_for}  note="shorthanded goals scored" />
            )}
            {teamRow.sh_goals_against != null && (
              <AdvStatRow label="SHG Against" val={teamRow.sh_goals_against} note="shorthanded goals allowed" />
            )}
          </>
        ) : (
          <div className={ADV_EXPLAIN_CLASSES}>Running pwhl_stats.py will populate PP/PK data.</div>
        )}
      </div>


      {/* League context */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:8 }}>League Context</div>
        <div className={ADV_EXPLAIN_CLASSES}>
          Where {abbr} ranks among 8 PWHL teams this season.
        </div>
        {[
          ['Points',      teamRow.points, 'points',       true,  null],
          ['Goals For',   teamRow.goals_for, 'goals_for', true,  null],
          ['Goals Against',teamRow.goals_against,'goals_against',false,null],
        ].map(([label, val, key, hb]) => {
          const r = leagueRank(key, hb);
          return (
            <div key={label} className={ADV_STAT_ROW_CLASSES}>
              <span className={ADV_STAT_LABEL_CLASSES}>{label}: <strong>{val ?? '—'}</strong></span>
              <span className={ADV_STAT_RIGHT_CLASSES}>
                <RankBadge r={r} />
                <span className={ADV_STAT_AVG_CLASSES} style={{ marginLeft:4 }}>of 8</span>
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ── Trends tab ────────────────────────────────────────────────────────────────
function TrendsTab({ schedule, teamId, loading }) {
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
        const isExtra = g.ot || g.shootout;
        const result = won ? (isExtra ? 'OTW' : 'W') : (!won && isExtra ? 'OTL' : 'L');
        return { won, my, op, result, ot: g.ot, so: g.shootout, game_id: g.game_id };
      });
  }, [schedule, teamId]);

  if (loading) return (
    <div className={`card ${EMPTY_STATE_CLASSES}`} style={{ marginTop: 10 }}>
      <div className={EMPTY_ICON_CLASSES}>📈</div>
      <div className={EMPTY_TITLE_CLASSES}>Loading trends…</div>
    </div>
  );

  if (!gameLog.length) return (
    <div className={`card ${EMPTY_STATE_CLASSES}`} style={{ marginTop: 10 }}>
      <div className={EMPTY_ICON_CLASSES}>📈</div>
      <div className={EMPTY_TITLE_CLASSES}>No game data yet</div>
    </div>
  );

  // Rolling 10-game win %
  const rolling = gameLog.map((g, i) => {
    const window = gameLog.slice(Math.max(0, i-9), i+1);
    return { ...g, w10pct: Math.round(window.filter(x => x.won).length / window.length * 100) };
  });

  // Rolling 5-game GF/GA avg
  const rollingGF = gameLog.map((g, i) => {
    const w = gameLog.slice(Math.max(0, i-4), i+1);
    return parseFloat((w.reduce((s,x) => s+x.my, 0) / w.length).toFixed(1));
  });
  const rollingGA = gameLog.map((g, i) => {
    const w = gameLog.slice(Math.max(0, i-4), i+1);
    return parseFloat((w.reduce((s,x) => s+x.op, 0) / w.length).toFixed(1));
  });

  // Streak
  let streak = 0, streakType = '';
  for (let i = gameLog.length-1; i >= 0; i--) {
    const g = gameLog[i];
    if (i === gameLog.length-1) { streakType = g.won ? 'W' : 'L'; streak = 1; }
    else if ((g.won && streakType === 'W') || (!g.won && streakType === 'L')) streak++;
    else break;
  }

  const last10   = gameLog.slice(-10);
  const last10W  = last10.filter(g => g.won).length;
  const display  = gameLog.slice(-20); // show last 20 games
  const rollDisp = rolling.slice(-20);
  const gfDisp   = rollingGF.slice(-20);
  const gaDisp   = rollingGA.slice(-20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>

      {/* Quick stats */}
      <div className="card">
        <div className={TRENDS_QUICK_CLASSES}>
          <div className={TQ_ITEM_CLASSES}>
            <div className={TQ_LABEL_CLASSES}>Current streak</div>
            <div className={TQ_VAL_CLASSES} style={{ color: streakType === 'W' ? 'var(--green)' : 'var(--red-bright)' }}>
              {streakType}{streak}
            </div>
          </div>
          <div className={TQ_ITEM_CLASSES}>
            <div className={TQ_LABEL_CLASSES}>Last 10 games</div>
            <div className={TQ_VAL_CLASSES}>{last10W}–{10-last10W}</div>
          </div>
          <div className={TQ_ITEM_CLASSES}>
            <div className={TQ_LABEL_CLASSES}>Win% L10</div>
            <div className={TQ_VAL_CLASSES}>{Math.round(last10W/10*100)}%</div>
          </div>
        </div>
      </div>

      {/* Result dots */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Last {display.length} games</div>
        <div className={RESULT_DOTS_CLASSES}>
          {display.map((g, i) => (
            <div key={i}
              className={resultDotClasses(g.won ? (g.ot||g.so ? 'otw' : 'w') : (g.ot||g.so ? 'otl' : 'l'))}
              title={`${g.result} ${g.my}–${g.op}`}>
              {g.result === 'OTW' ? 'W' : g.result === 'OTL' ? 'O' : g.result}
            </div>
          ))}
        </div>
      </div>

      {/* Rolling 10-game win % */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Win% — rolling 10-game window</div>
        <div className={ROLLING_CHART_CLASSES}>
          {rollDisp.map((g, i) => (
            <div key={i} className={ROLLING_BAR_WRAP_CLASSES}>
              <div className={ROLLING_BAR_LABEL_CLASSES}>{g.w10pct}%</div>
              <div className={rollingBarClasses(g.w10pct)}
                style={{ height: `${g.w10pct}%` }}
                title={`${g.w10pct}% win rate`} />
              {i % 5 === 0 && <div className={ROLLING_LABEL_CLASSES}>{i+1}</div>}
            </div>
          ))}
          <div className={ROLLING_AVG_LINE_CLASSES} style={{ bottom: '50%' }} />
        </div>
        <div className={ROLLING_LEGEND_CLASSES}>
          <span className={RL_HOT_CLASSES}>■ Hot (≥60%)</span>
          <span className={RL_OK_CLASSES}>■ Average (40–60%)</span>
          <span className={RL_COLD_CLASSES}>■ Cold (&lt;40%)</span>
          <span style={{ color:'var(--text-dim)', marginLeft:'auto', fontSize:9 }}>— 50% ref</span>
        </div>
      </div>

      {/* GF/GA rolling 5-game avg */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Goals — rolling 5-game average</div>
        <div className={ROLLING_CHART_DUAL_CLASSES}>
          {gfDisp.map((gf, i) => {
            const ga = gaDisp[i];
            const maxVal = 6;
            return (
              <div key={i} className={ROLLING_BAR_WRAP_CLASSES}>
                <div className={ROLLING_BAR_LABEL_CLASSES} style={{ color: 'var(--red-bright)' }}>{gf}</div>
                <div className={ROLLING_BAR_DUAL_WRAP_CLASSES}>
                  <div className={ROLLING_BAR_GF_CLASSES} style={{ height: `${Math.min(gf/maxVal*100,100)}%` }} title={`GF avg: ${gf}`} />
                  <div className={ROLLING_BAR_GA_CLASSES} style={{ height: `${Math.min(ga/maxVal*100,100)}%` }} title={`GA avg: ${ga}`} />
                </div>
                <div className={ROLLING_BAR_LABEL_BOT_CLASSES} style={{ color: 'var(--blue-bright)' }}>{ga}</div>
                {i % 5 === 0 && <div className={ROLLING_LABEL_CLASSES}>{i+1}</div>}
              </div>
            );
          })}
        </div>
        <div className={ROLLING_LEGEND_CLASSES}>
          <span style={{ color: 'var(--red-bright)' }}>■ Goals For</span>
          <span style={{ color: 'var(--blue-bright)', marginLeft: 12 }}>■ Goals Against</span>
        </div>
      </div>

      {/* Goal differential */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 6 }}>Goal differential by game</div>
        <div className={GD_CHART_WRAP_CLASSES}>
          <div className={GD_BASELINE_LINE_CLASSES} />
          <div className={GD_BARS_CLASSES}>
            {display.map((g, i) => {
              const diff  = g.my - g.op;
              const absPx = Math.min(Math.abs(diff) * 12, 48);
              return (
                <div key={i} className={GD_BAR_COL_CLASSES} title={`${g.result} ${g.my}–${g.op}`}>
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

// ── Salaries tab ─────────────────────────────────────────────────────────────
function SalariesTab({ salaries, loading, abbr, color }) {
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:10 }}>
      {[80,65,72,58,70,63].map((w,i) => (
        <div key={i} className="skeleton" style={{ height:32, width:`${w}%`, borderRadius:6 }} />
      ))}
    </div>
  );

  if (!salaries?.length) return (
    <div className={`card ${EMPTY_STATE_CLASSES}`} style={{ marginTop:10 }}>
      <div className={EMPTY_ICON_CLASSES}>💰</div>
      <div className={EMPTY_TITLE_CLASSES}>No salary data</div>
      <div className={EMPTY_SUB_CLASSES}>Run python pwhl_salaries.py to populate.</div>
    </div>
  );

  const maxSalary  = Math.max(...salaries.map(p => p.salary || 0));
  const totalPay   = salaries.reduce((s, p) => s + (p.salary || 0), 0);
  const avgSalary  = salaries.length > 0 ? totalPay / salaries.length : 0;
  // PWHL CBA 2025-26: target average salary $58,349.50/player (±10% variance allowed)
  // Team payroll ceiling ~$1.3M USD; increases 3% annually through 2031
  const AVG_TARGET = 58_349.50;
  const CAP        = 1_300_000;
  const capPct     = Math.round((totalPay / CAP) * 100);
  const avgVsTarget = avgSalary > 0 ? ((avgSalary - AVG_TARGET) / AVG_TARGET * 100).toFixed(1) : null;

  function fmtSalary(v) {
    if (v == null) return '—';
    return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>

      {/* Cap summary */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:10 }}>2025-26 Salary Summary</div>
        <div className={OVERVIEW_STAT_GRID_CLASSES}>
          {[
            ['Total Payroll',  fmtSalary(totalPay)],
            ['Players',        salaries.length],
            ['Avg Salary',     fmtSalary(Math.round(avgSalary))],
            ['CBA Target',     fmtSalary(AVG_TARGET)],
            ['Avg vs Target',  avgVsTarget != null ? `${avgVsTarget > 0 ? '+' : ''}${avgVsTarget}%` : '—'],
            ['Cap Ceiling',    fmtSalary(CAP)],
          ].map(([label, val]) => (
            <div key={label} className={OVERVIEW_STAT_CELL_CLASSES}>
              <div className={OVERVIEW_STAT_LABEL_CLASSES}>{label}</div>
              <div className={OVERVIEW_STAT_VAL_CLASSES} style={{ fontSize:13 }}>{val}</div>
            </div>
          ))}
        </div>
        {/* Cap bar */}
        <div style={{ marginTop:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10,
            color:'var(--text-dim)', marginBottom:4 }}>
            <span>{abbr} payroll: {fmtSalary(totalPay)} ({capPct}% of ~$1.3M ceiling)</span>
            <span>CBA avg target: {fmtSalary(AVG_TARGET)}/player</span>
          </div>
          <div style={{ height:10, background:'var(--bg3)', borderRadius:5, overflow:'hidden',
            border:'0.5px solid var(--border-2)' }}>
            <div style={{
              height:'100%', borderRadius:5,
              width:`${Math.min(capPct, 100)}%`,
              background: capPct > 90 ? 'var(--red-bright)' : capPct > 75 ? 'var(--amber)' : color,
              transition:'width 0.4s ease',
            }} />
          </div>
        </div>
        <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:6 }}>
          Base salary only · Source: PWHLPA Salary Guide (Apr 2026) · CBA avg target +3%/yr through 2031
        </div>
      </div>

      {/* Player salary bars */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom:10 }}>{abbr} Player Salaries</div>
        {salaries.map((p, i) => {
          const barPct = maxSalary > 0 ? (p.salary / maxSalary) * 100 : 0;
          const name   = p.first_name && p.last_name
            ? `${p.first_name} ${p.last_name}` : '—';
          return (
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between',
                fontSize:12, marginBottom:3 }}>
                <span style={{ color:'var(--text)', fontWeight: i < 3 ? 700 : 400 }}>
                  {name}
                </span>
                <span style={{ color, fontWeight:700, fontFamily:'var(--font-mono)',
                  fontSize:11 }}>
                  {fmtSalary(p.salary)}
                </span>
              </div>
              <div style={{ height:5, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:3,
                  width:`${barPct}%`,
                  background: barPct > 80 ? color : `${color}99`,
                  transition:'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
