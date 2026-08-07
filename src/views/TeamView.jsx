import React, { useState, useMemo, useEffect } from 'react'
import { useFetch } from '../hooks/useFetch'
import {
  getTeamStats, getStandings,
  getPlayoffGames, buildCarPlayoffSummary,
  getTeamCorsi, getTeamRealtime, getTeamScoreState, getTeamPowerplay, getTeamPenaltyKill,
  getTeamHomeSplit, getTeamPlayoffStats, getTeamGameLog, getLiveGame,
  getTeamSeasonRankings, TEAM_CONFIG,
  getDraftOrder, getDraftPicks,
} from '../utils/nhlApi'
import { getTeamGameLog as getDbTeamGameLog, getTeamXgTrend } from '../utils/supabaseClient'
import { CONTRACTS, getCapSummary, CAP_CEILING, CURRENT_SEASON, CONTRACT_DATA_DATE } from '../utils/carContracts'
import { DraftPopup } from '../components/DraftTab'
import { seasonPDO } from '../utils/advancedStats'
import { isStandingsStale } from '../utils/standingsUtils'
import InfoTip from '../components/InfoTip'
import TeamLogo from '../components/TeamLogo'
import TeamComparisonPopup from '../components/TeamComparisonPopup'
import Sparkline from '../components/Sparkline'
import { TEAM_COLORS } from '../utils/nhlApi'

// .view-title (Session 97, Phase 3) -- was PlayersView.css's, genuinely
// shared with PlayersView.jsx/PWHLPlayersView.jsx/PWHLTeamView.jsx. Migrated
// here too so that rule can be deleted from PlayersView.css without leaving
// this file's only usage stranded on dead CSS.
const VIEW_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold flex items-center gap-2 mb-[2px]'

// ── Tailwind class constants (Phase 4 -- TeamView.css deleted) ──
// Duplicated in PWHLTeamView.jsx per established per-file convention.
// TeamView.css also had ~28% confirmed-dead CSS from replaced UI iterations
// (old .score-state-row/.ss-* system, old .split-compare/.split-col/etc
// layout, old .gd-bar-wrap/.gd-baseline chart, and an entirely-unused
// .ha-grid-header/.ha-grid-row/.ha-label/.ha-val family) -- none of that
// was migrated, matching every prior phase's handling of confirmed-dead code.
// .adv-stat-row/.cap-row/.split-adv-row/.split-adv-section-title/
// .rolling-avg-line kept as literal markers so light-mode-overrides.css's
// "TeamView.css additions" block keeps applying untouched.

const VIEW_SUB_CLASSES = 'view-sub text-[12px] text-[color:var(--text-muted)] mb-3'
const TEAM_COMPARE_BTN_CLASSES = 'text-[11px] font-semibold text-[color:var(--text-muted)] bg-[var(--bg2)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius-sm)] py-[5px] px-[9px] cursor-pointer whitespace-nowrap [transition:background_0.15s,color_0.15s] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]'

const TEAM_TABS_CLASSES = 'flex gap-1 mb-[14px] overflow-x-auto pb-[2px] border-b-[0.5px] border-[var(--border)]'
// bg-transparent deliberately NOT in base -- it and ACTIVE's bg-[var(--red-dim)]
// both target background-color unconditionally; same-layer Tailwind utility
// generation order isn't guaranteed (lesson #9), so it must live only on the
// inactive variant instead of racing with the active variant's background.
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
const RECORD_LIVE_BADGE_CLASSES = 'block text-[10px] text-[color:var(--red-bright)] opacity-80 mt-[2px] font-normal'

const STREAK_CHIP_BASE_CLASSES = 'streak-chip text-[10px] font-bold py-[1px] px-[6px] rounded-[4px]'
const STREAK_W_CLASSES = 'bg-[rgba(61,186,126,0.15)] text-[color:var(--green)] border-[0.5px] border-[rgba(61,186,126,0.3)]'
const STREAK_L_CLASSES = 'bg-[rgba(204,34,0,0.12)] text-[color:var(--red-bright)] border-[0.5px] border-[rgba(204,34,0,0.3)]'
const STREAK_OT_CLASSES = 'bg-[rgba(240,160,48,0.12)] text-[color:var(--amber)] border-[0.5px] border-[rgba(240,160,48,0.3)]'
function streakChipClasses(code) {
  const variant = code === 'W' ? STREAK_W_CLASSES : code === 'L' ? STREAK_L_CLASSES : STREAK_OT_CLASSES
  return `${STREAK_CHIP_BASE_CLASSES} ${variant}`
}

const PO_SERIES_LIST_CLASSES = 'flex flex-col gap-[3px] mt-1'
const PO_SERIES_LINE_CLASSES = 'flex items-center gap-[5px] text-[11px]'
const SERIES_WON_CLASSES = 'text-[color:var(--green)] text-[11px]'
const SERIES_ACTIVE_CLASSES = 'text-[color:var(--amber)] text-[11px]'
const SERIES_LOST_CLASSES = 'text-[color:var(--red-bright)] text-[11px]'
function seriesStateClasses(carAdvance, isActive) {
  return carAdvance ? SERIES_WON_CLASSES : isActive ? SERIES_ACTIVE_CLASSES : SERIES_LOST_CLASSES
}
const SERIES_OPP_CLASSES = 'font-[family-name:var(--font-display)] font-bold text-[11px]'
const SERIES_SCORE_SM_CLASSES = 'font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--text-muted)]'

const OVERVIEW_STAT_GRID_CLASSES = 'grid grid-cols-3 gap-2'
const OVERVIEW_STAT_CELL_CLASSES = 'text-center bg-[var(--bg3)] rounded-[var(--radius-sm)] py-2 px-1'
const OVERVIEW_STAT_LABEL_CLASSES = 'text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.08em] mb-[3px]'
const OVERVIEW_STAT_VAL_CLASSES = 'font-[family-name:var(--font-display)] text-[18px] font-bold text-[color:var(--text)]'
const OVERVIEW_STAT_RANK_CLASSES = 'overview-stat-rank text-[10px] font-bold font-[family-name:var(--font-mono)] mt-[2px] block'
const OVERVIEW_STAT_RANK_SUP_CLASSES = 'text-[7px]'

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
const ADV_STAT_INDICATOR_BASE_CLASSES = 'text-[10px] font-bold flex-shrink-0'
const ADV_STAT_INDICATOR_GOOD_CLASSES = 'text-[#4ade80]'
const ADV_STAT_INDICATOR_BAD_CLASSES = 'text-[#f87171]'

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
const SPLIT_ADV_SECTION_CLASSES = 'split-adv-section mt-[10px]'
const SPLIT_ADV_SECTION_TITLE_CLASSES = 'split-adv-section-title text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] py-1 pb-[2px] border-b-[0.5px] border-[rgba(255,255,255,0.06)] mb-[2px]'
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
function resultDotClasses(result) {
  const r = (result || '').toLowerCase()
  const variant = r === 'w' ? RESULT_DOT_W_CLASSES : r === 'l' ? RESULT_DOT_L_CLASSES : RESULT_DOT_OTL_CLASSES
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
const GD_LEGEND_CLASSES = 'flex gap-3 text-[10px] pt-[6px]'
const GD_LEG_POS_CLASSES = 'text-[color:var(--green)]'
const GD_LEG_NEG_CLASSES = 'text-[color:var(--red-bright)]'

const CAP_BAR_WRAP_CLASSES = 'relative h-[10px] bg-[var(--bg3)] rounded-[5px] overflow-hidden mb-[6px]'
const CAP_BAR_FILL_CLASSES = 'absolute inset-0 right-auto [background:linear-gradient(to_right,var(--red),#ff6030)] rounded-[5px] [transition:width_0.5s_ease]'
const CAP_BAR_TRACK_CLASSES = 'absolute inset-0'
const CAP_BAR_LABELS_CLASSES = 'flex justify-between text-[11px] font-semibold mb-[2px]'
const CAP_COMMITTED_CLASSES = 'text-[color:var(--text-muted)]'
const CAP_CEILING_LABEL_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mb-1'
const CAP_DATA_DATE_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mb-3 opacity-70'
const CAP_TABLE_CLASSES = 'flex flex-col gap-px'
const CAP_TABLE_HEADER_CLASSES = 'grid grid-cols-[1fr_32px_90px_70px_72px] gap-[6px] text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] pt-1 pb-[6px] border-b-[0.5px] border-[var(--border)]'
const CAP_ROW_BASE_CLASSES = 'cap-row grid grid-cols-[1fr_32px_90px_70px_72px] gap-[6px] items-center py-[5px] border-b-[0.5px] border-[rgba(255,255,255,0.04)] text-[12px]'
const CAP_ROW_EXPIRING_CLASSES = 'bg-[rgba(240,160,48,0.05)]'
function capRowClasses(expiring) {
  return expiring ? `${CAP_ROW_BASE_CLASSES} ${CAP_ROW_EXPIRING_CLASSES}` : CAP_ROW_BASE_CLASSES
}
const CAP_NAME_CLASSES = 'font-medium text-[color:var(--text)] whitespace-nowrap overflow-hidden text-ellipsis'
const CAP_POS_CLASSES = 'font-[family-name:var(--font-display)] text-[10px] font-bold text-[color:var(--text-dim)]'
const CAP_HIT_CELL_CLASSES = 'relative flex items-center'
const CAP_HIT_BAR_CLASSES = 'absolute left-0 top-1/2 -translate-y-1/2 h-5 bg-[rgba(204,34,0,0.18)] rounded-[3px]'
const CAP_HIT_VAL_CLASSES = 'relative font-[family-name:var(--font-mono)] text-[12px] font-semibold text-[color:var(--text)]'
const CAP_TYPE_BASE_CLASSES = 'text-[10px]'
const CAP_TYPE_UFA_CLASSES = 'text-[color:var(--amber)]'
const CAP_TYPE_RFA_CLASSES = 'text-[color:var(--green)]'
function capTypeClasses(type) {
  return `${CAP_TYPE_BASE_CLASSES} ${type === 'UFA' ? CAP_TYPE_UFA_CLASSES : CAP_TYPE_RFA_CLASSES}`
}
const CAP_EXPIRES_CLASSES = 'text-[11px] font-[family-name:var(--font-mono)]'
const CAP_EXPIRING_NOTE_CLASSES = 'mt-[10px] text-[11px] text-[color:var(--amber)] py-[6px] px-[10px] bg-[rgba(240,160,48,0.1)] rounded-[var(--radius-sm)]'

const PICKS_LOADING_CLASSES = 'text-[13px] text-[color:var(--text-dim)] py-3'
const PICKS_EMPTY_CLASSES = 'text-[13px] text-[color:var(--text-dim)] py-3'
const PICKS_NOTE_CLASSES = 'picks-note text-[10px] text-[color:var(--text-dim)] mt-2 italic'
const PICKS_SLOT_CLASSES = 'picks-slot flex items-center gap-[10px] py-2 border-b-[0.5px] border-[var(--border)] text-[13px] last-of-type:border-b-0'
const PICKS_SLOT_ROUND_CLASSES = 'picks-slot-round font-semibold text-[color:var(--text-muted)] min-w-[52px]'
const PICKS_SLOT_OVERALL_CLASSES = 'picks-slot-overall font-bold text-[color:var(--text)]'
const PICKS_SLOT_FROM_CLASSES = 'picks-slot-from text-[12px] text-[color:var(--text-dim)] ml-auto'
const PICKS_MADE_LIST_CLASSES = 'picks-made-list flex flex-col'
const PICKS_MADE_ROW_CLASSES = 'picks-made-row flex items-center gap-[10px] py-2 px-[6px] border-b-[0.5px] border-[var(--border)] text-[13px] cursor-pointer rounded-[6px] [transition:background_0.1s] last:border-b-0 hover:bg-[rgba(255,255,255,0.04)]'
const PICKS_MADE_ROUND_CLASSES = 'picks-made-round text-[11px] font-semibold text-[color:var(--text-dim)] min-w-[72px]'
const PICKS_MADE_NAME_CLASSES = 'picks-made-name font-semibold text-[color:var(--text)] flex-1'
const PICKS_MADE_POS_CLASSES = 'picks-made-pos text-[12px] text-[color:var(--text-muted)] min-w-[24px]'
const PICKS_MADE_RANK_CLASSES = 'picks-made-rank text-[11px] font-semibold text-[color:var(--text-dim)] bg-[var(--border)] rounded-[4px] py-[1px] px-[5px]'

// padding: 28px 16px moved to index.css as real unlayered CSS -- collides
// with .card's own unlayered padding (see index.css's .empty-state comment).
const EMPTY_STATE_CLASSES = 'empty-state text-center'
const EMPTY_ICON_CLASSES = 'empty-icon text-[28px] mb-2'
const EMPTY_TITLE_CLASSES = 'empty-title text-[14px] font-semibold text-[color:var(--text)] mb-1'
const EMPTY_SUB_CLASSES = 'empty-sub text-[12px] text-[color:var(--text-muted)]'

const TABS = ['Overview', 'Advanced', 'Splits', 'Trends',
  ...(TEAM_CONFIG.abbr === 'CAR' ? ['Cap'] : []),
  'Picks',
]

export default function TeamView() {
  const [tab, setTab] = useState('Overview')
  const [compareOpen, setCompareOpen] = useState(false)

  // Core data
  const { data: stats,        loading: statsLoading  } = useFetch(() => getTeamStats(TEAM_CONFIG.abbr))
  const { data: standings,    loading: standLoading  } = useFetch(getStandings)
  const { data: playoffGames, loading: poLoading     } = useFetch(getPlayoffGames)

  // Advanced stats
  const { data: corsiReg   } = useFetch(() => getTeamCorsi(2))
  const { data: realtimeReg } = useFetch(() => getTeamRealtime(2))
  const { data: ppReg      } = useFetch(() => getTeamPowerplay(2))
  const { data: pkReg      } = useFetch(() => getTeamPenaltyKill(2))
  const { data: scoreState } = useFetch(() => getTeamScoreState(2))
  const { data: homeSplit  } = useFetch(() => getTeamHomeSplit(2))
  const { data: poAdv      } = useFetch(getTeamPlayoffStats)
  const { data: gameLog    } = useFetch(() => getTeamGameLog(20))
  const { data: rankings   } = useFetch(() => getTeamSeasonRankings(2))
  const { data: xgTrend    } = useFetch(() => getTeamXgTrend(TEAM_CONFIG.abbr))

  // Same staleness risk getTeamStats() already guards against (see nhlApi.js):
  // NHL's /standings/now stays pinned to last season's finale for months
  // after our season config flips. Don't surface last season's division/
  // conference/streak as if it were this season's. Only reject on an
  // EXPLICIT mismatch — an absent seasonId (e.g. a test stub) isn't
  // evidence of staleness, the real NHL API always includes it.
  const standingsAreStale = isStandingsStale(standings, TEAM_CONFIG.season)
  const carStanding    = standingsAreStale
    ? undefined
    : standings?.find(t => t.teamAbbrev?.default === TEAM_CONFIG.abbr)
  const playoffSummary = buildCarPlayoffSummary(playoffGames || [])
  const inPlayoffs     = (playoffGames?.length || 0) > 0

  // Playoff home/away splits — only fetch when in playoffs (inPlayoffs must be defined first)
  const { data: homeSplitPO } = useFetch(() => inPlayoffs ? getTeamHomeSplit(3) : Promise.resolve(null), [inPlayoffs])

  // Fetch live game so we can exclude in-progress result from standings
  const { data: liveGame } = useFetch(getLiveGame)
  const gameIsLive = !!(liveGame)

  // Standings update in real-time during games — exclude in-progress result
  const wins   = (stats?.wins    || 0) - (gameIsLive && (stats?.wins    || 0) > 0 ? 0 : 0)
  const losses = (stats?.losses  || 0)
  const otl    = (stats?.otLosses|| 0)
  const pts    = (stats?.points  || 0)
  // Note: the standings API reflects current score, so during a live game
  // the leading team shows +1 win. We show a live indicator instead of adjusting.

  // Cap data
  const capSummary      = getCapSummary()
  const capPct          = Math.round((capSummary.committed / CAP_CEILING) * 100)
  const sortedContracts = [...CONTRACTS].sort((a, b) => b.capHit - a.capHit)

  return (
    <div className="page team-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <TeamLogo abbr={TEAM_CONFIG.abbr} size={28} />
        <h2 className={VIEW_TITLE_CLASSES} style={{ margin: 0 }}>{TEAM_CONFIG.displayName}</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p className={VIEW_SUB_CLASSES} style={{ margin: 0 }}>{TEAM_CONFIG.season.slice(0,4)}–{TEAM_CONFIG.season.slice(6)} season</p>
        <button className={TEAM_COMPARE_BTN_CLASSES} onClick={() => setCompareOpen(true)}>🆚 Compare Seasons</button>
      </div>

      {compareOpen && (
        <TeamComparisonPopup
          league="nhl"
          teamValue={TEAM_CONFIG.abbr}
          teamLabel={TEAM_CONFIG.displayName}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {/* Tab bar */}
      <div className={TEAM_TABS_CLASSES}>
        {TABS.map(t => (
          <button key={t} className={teamTabClasses(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Overview'  && <OverviewTab stats={stats} standLoading={standLoading} statsLoading={statsLoading} poLoading={poLoading} carStanding={carStanding} playoffSummary={playoffSummary} wins={wins} losses={losses} otl={otl} pts={pts} inPlayoffs={inPlayoffs} liveGame={liveGame} corsiReg={corsiReg} realtimeReg={realtimeReg} rankings={rankings} />}
      {tab === 'Advanced'  && <AdvancedTab corsiReg={corsiReg} realtimeReg={realtimeReg} ppReg={ppReg} pkReg={pkReg} scoreState={scoreState} poAdv={poAdv} inPlayoffs={inPlayoffs} homeSplit={homeSplit} xgTrend={xgTrend} />}
      {tab === 'Splits'    && <SplitsTab homeSplit={homeSplit} homeSplitPO={homeSplitPO} stats={stats} playoffSummary={playoffSummary} inPlayoffs={inPlayoffs} ppReg={ppReg} pkReg={pkReg} corsiReg={corsiReg} />}
      {tab === 'Trends'    && <TrendsTab gameLog={gameLog} />}
      {tab === 'Cap'   && <CapTab capSummary={capSummary} capPct={capPct} sortedContracts={sortedContracts} />}
      {tab === 'Picks' && <PicksTab />}
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────
function OverviewTab({ stats, standLoading, _statsLoading, poLoading, carStanding, playoffSummary, wins, losses, otl, pts, inPlayoffs, liveGame, _corsiReg, realtimeReg, rankings }) {

  function RankBadge({ r }) {
    if (!r) return null;
    const color = r <= 5 ? 'var(--green)' : r <= 15 ? 'var(--text-muted)' : 'var(--red-bright)';
    const suffix = r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
    return (
      <span className={OVERVIEW_STAT_RANK_CLASSES} style={{ color }}>
        {r}<sup className={OVERVIEW_STAT_RANK_SUP_CLASSES}>{suffix}</sup>
      </span>
    );
  }

  return (
    <>
      <div className={RECORDS_ROW_CLASSES}>
        <div className={`card ${RECORD_BLOCK_CLASSES}`}>
          <div className={RECORD_BLOCK_LABEL_CLASSES} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TeamLogo abbr={TEAM_CONFIG.abbr} size={14} /> Regular Season
          </div>
          {standLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : (
            <div className={RECORD_MAIN_ROW_CLASSES}>
              <span className={RECORD_BIG_CLASSES}>{wins}–{losses}–{otl}</span>
              {liveGame && !inPlayoffs && (
                <span className={RECORD_LIVE_BADGE_CLASSES}>🔴 LIVE — record updates after final horn</span>
              )}
              <span className={PTS_CHIP_CLASSES}>{pts} pts</span>
            </div>
          )}
          {carStanding && (
            <div className={RECORD_META_CLASSES}>
              <span>Div: {carStanding.divisionName}</span>
              <span className={RECORD_META_SEP_CLASSES}>·</span>
              <span>Conf: {carStanding.conferenceName}</span>
              {stats?.streakCode && (
                <span className={streakChipClasses(stats.streakCode)}>
                  {stats.streakCode}{stats.streakCount || ''} streak
                </span>
              )}
            </div>
          )}
        </div>

        {inPlayoffs && (
          <div className={`card ${RECORD_BLOCK_CLASSES}`}>
            <div className={RECORD_BLOCK_LABEL_CLASSES}>Playoffs</div>
            {poLoading ? <div className="skeleton" style={{ height: 28, width: '70%' }} /> : (
              <div className={RECORD_MAIN_ROW_CLASSES}>
                <span className={RECORD_BIG_CLASSES}>
                  {playoffSummary.reduce((s,x) => s+x.carWins, 0)}–
                  {playoffSummary.reduce((s,x) => s+x.oppWins, 0)}
                </span>
                {liveGame && (
                  <span className={RECORD_LIVE_BADGE_CLASSES}>🔴 LIVE — record updates after final horn</span>
                )}
              </div>
            )}
            <div className={PO_SERIES_LIST_CLASSES}>
              {playoffSummary.sort((a,b) => b.round-a.round).map((s, i) => {
                const oppColor = TEAM_COLORS[s.opponent?.abbrev] || 'var(--text-muted)'
                return (
                  <div key={i} className={PO_SERIES_LINE_CLASSES}>
                    <span className={seriesStateClasses(s.carAdvance, s.isActive)}>
                      {s.carAdvance ? '✓' : s.isActive ? '▶' : '✗'}
                    </span>
                    <TeamLogo abbr={s.opponent?.abbrev} size={14} color={oppColor} />
                    <span className={SERIES_OPP_CLASSES}>{s.opponent?.abbrev}</span>
                    <span className={SERIES_SCORE_SM_CLASSES}>{s.carWins}–{s.oppWins}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Season stat quick-hits */}
      {stats && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sec-label" style={{ marginBottom: 10 }}>Season stats</div>
          <div className={OVERVIEW_STAT_GRID_CLASSES}>
            {[
              ['Goals/GP',  (stats.goalsForPerGame??0).toFixed(2),   rankings?.goalsForPG],
              ['GA/GP',     (stats.goalsAgainstPerGame??0).toFixed(2), rankings?.goalsAgainstPG],
              ['PP%',       (stats.powerPlayPct != null ? (stats.powerPlayPct <= 1 ? (stats.powerPlayPct*100).toFixed(1) : stats.powerPlayPct.toFixed(1)) : '—') + '%', rankings?.ppPct],
              ['PK%',       (stats.penaltyKillPct != null ? (stats.penaltyKillPct <= 1 ? (stats.penaltyKillPct*100).toFixed(1) : stats.penaltyKillPct.toFixed(1)) : '—') + '%', rankings?.pkPct],
              ['SOG/GP',    stats.shotsForPerGame?.toFixed(1) ?? '—', rankings?.shotsForPG],
              ['SA/GP',     stats.shotsAgainstPerGame?.toFixed(1) ?? '—', rankings?.shotsAgainstPG],
              ['Blks/GP',   realtimeReg?.blockedShots != null ? (realtimeReg.blockedShots / (realtimeReg.gamesPlayed || 1)).toFixed(1) : '—', null],
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
    </>
  )
}

// ── Advanced tab ─────────────────────────────────────────────

// ── xGF% per-game sparkline ───────────────────────────────────
function XgfSparkline({ data }) {
  const [view, setView] = useState('last10');
  const [hover, setHover] = useState(null); // { game, idx }

  const games = view === 'last10' ? data.last10 : data.season;
  if (!games?.length) return null;

  const teamColor = getComputedStyle(document.documentElement).getPropertyValue('--team-primary').trim() || '#e63946';
  const ttGame = hover?.game;

  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="sec-label" style={{ margin: 0 }}>xGF% per game · 5v5</div>
        <div className={ADV_TOGGLE_CLASSES} style={{ gap: 0, padding: 0 }}>
          <button
            className={advToggleBtnClasses(view === 'last10')}
            style={{ padding: '3px 10px', fontSize: 12 }}
            onClick={() => setView('last10')}
          >L10</button>
          <button
            className={advToggleBtnClasses(view === 'season')}
            style={{ padding: '3px 10px', fontSize: 12 }}
            onClick={() => setView('season')}
          >Season</button>
        </div>
      </div>

      {ttGame && (
        <div style={{
          fontSize: 12, color: 'var(--text)', marginBottom: 6,
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <span style={{ fontWeight: 500 }}>{ttGame.date}</span>
          <span>vs {ttGame.opponent}</span>
          <span style={{ color: 'var(--text-dim)' }}>
            {ttGame.teamScore}–{ttGame.oppScore}
          </span>
          <span style={{
            marginLeft: 'auto', fontWeight: 500,
            color: ttGame.xgfPct >= 50 ? 'var(--good)' : 'var(--bad)',
          }}>
            {ttGame.xgfPct.toFixed(1)}%
          </span>
        </div>
      )}

      <Sparkline
        points={games.map(g => ({ value: g.xgfPct, ...g }))}
        color={teamColor}
        width={320} height={72} padding={{ left: 28, right: 8, top: 8, bottom: 8 }}
        yDomain={{ min: 0, max: 100, pad: 5 }}
        referenceValue={50}
        showAxisLabels
        formatAxisLabel={v => `${Math.round(v)}%`}
        onHover={(game, idx) => setHover(game ? { game, idx } : null)}
        hoverIndex={hover?.idx ?? null}
        ariaLabel="xGF% per game sparkline"
      />
      {/* First/last game date -- external row, same convention as LeagueView's rank sparkline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
        <span>{games[0].date.slice(5)}</span>
        <span>{games[games.length - 1].date.slice(5)}</span>
      </div>
    </div>
  );
}

function AdvancedTab({ corsiReg, realtimeReg, ppReg, pkReg, _scoreState, poAdv, inPlayoffs, _homeSplit, xgTrend }) {
  const pdoData = seasonPDO(corsiReg);
  const [showPO, setShowPO] = useState(inPlayoffs);
  function pct(v) { if (v == null) return '—'; return `${(v*100).toFixed(1)}%`; }
  function fmt(v, dec=2) { return v == null ? '—' : Number(v).toFixed(dec); }

  const corsi = showPO ? poAdv?.corsi : corsiReg
  const pp    = showPO ? poAdv?.pp    : ppReg
  const pk    = showPO ? poAdv?.pk    : pkReg

  // League average benchmarks (2024-25 season approximations)
  const LEAGUE_AVG = {
    corsiForPct:     0.500,
    fenwickForPct:   0.500,
    satForPerGame:   58.0,
    shotsForPerGame: 30.5,
    shotsAgainstPerGame: 30.5,
    blockedForPerGame:   9.5,
    blockedAgainstPerGame: 9.5,
    goalsForPerGame:     3.05,
    goalsAgainstPerGame: 3.05,
    pdo:             100,
    shPct:           10.5,
    svPct:           90.0,
    ppPct:           20.0,
    netPpPct:        19.5,
    pkPct:           80.0,
    netPkPct:        79.5,
  };

  // Returns 'good', 'bad', or null based on whether higher is better
  function rateVal(val, avg, higherIsBetter = true) {
    if (val == null || avg == null) return null;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return null;
    const diff = num - avg;
    const pctDiff = Math.abs(diff) / avg;
    if (pctDiff < 0.02) return null; // within 2% of average — neutral
    return (diff > 0) === higherIsBetter ? 'good' : 'bad';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Reg / Playoff toggle */}
      {inPlayoffs && (
        <div className={ADV_TOGGLE_CLASSES}>
          <button className={advToggleBtnClasses(!showPO)} onClick={() => setShowPO(false)} aria-pressed={!showPO}>📅 Regular Season</button>
          <button className={advToggleBtnClasses(showPO)} onClick={() => setShowPO(true)} aria-pressed={showPO}>🏒 Playoffs</button>
        </div>
      )}
      {!inPlayoffs && <div className={ADV_CONTEXT_NOTE_CLASSES}>Showing Regular Season stats</div>}

      {/* Shot differential */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 8 }}>Shot Volume &amp; Possession</div>
        <div className={ADV_EXPLAIN_CLASSES}>
          {corsi?.isProxyCorsi === false
            ? `Corsi For% (CF%) approximates all shot attempts using shots on goal + blocked shots from the NHL realtime report. Fenwick For% (FF%) uses shots on goal only, excluding blocked shots. Both measure territorial control — ≥50% means ${TEAM_CONFIG.abbr} is generating more attempts than opponents.`
            : 'Shot For% is a SOG-based proxy. Realtime blocked shot data unavailable for this game type.'}
        </div>
        {corsi?.isProxyCorsi === false ? (
          <>
            <AdvStatRow label="Corsi For% (CF%)"  val={pct(corsi?.corsiForPct)}
              rating={rateVal(corsi?.corsiForPct, LEAGUE_AVG.corsiForPct)} avg="50.0%"
              note="All shot attempts for ÷ total. ≥50% = territorial control" />
            <AdvStatRow label="Fenwick For% (FF%)" val={pct(corsi?.fenwickForPct)}
              rating={rateVal(corsi?.fenwickForPct, LEAGUE_AVG.fenwickForPct)} avg="50.0%"
              note="Unblocked attempts for ÷ total. Filters out shot-blocking luck" />
            <AdvStatRow label="Shot Attempts For/GP" val={corsi?.satForPerGame ? fmt(corsi.satForPerGame) : null}
              rating={rateVal(corsi?.satForPerGame, LEAGUE_AVG.satForPerGame)} avg={LEAGUE_AVG.satForPerGame.toFixed(1)} />
            <AdvStatRow label="Shot Attempts Against/GP" val={corsi?.satAgainstPerGame ? fmt(corsi.satAgainstPerGame) : null}
              rating={rateVal(corsi?.satAgainstPerGame, LEAGUE_AVG.satForPerGame, false)} avg={LEAGUE_AVG.satForPerGame.toFixed(1)} />
          </>
        ) : (
          <AdvStatRow label="Shot For% (proxy)" val={pct(corsi?.corsiForPct)}
            rating={rateVal(corsi?.corsiForPct, LEAGUE_AVG.corsiForPct)} avg="50.0%"
            note="SOG for ÷ total SOG. ≥50% = outshooting opponents" />
        )}
        <AdvStatRow label="Shots For/GP" val={corsi?.shotsForPerGame ? fmt(corsi.shotsForPerGame) : null}
          rating={rateVal(corsi?.shotsForPerGame, LEAGUE_AVG.shotsForPerGame)} avg={LEAGUE_AVG.shotsForPerGame.toFixed(1)} />
        <AdvStatRow label="Shots Against/GP" val={corsi?.shotsAgainstPerGame ? fmt(corsi.shotsAgainstPerGame) : null}
          rating={rateVal(corsi?.shotsAgainstPerGame, LEAGUE_AVG.shotsAgainstPerGame, false)} avg={LEAGUE_AVG.shotsAgainstPerGame.toFixed(1)} />
        <AdvStatRow label="Blocked For/GP"
          val={realtimeReg?.blockedShots != null ? fmt(realtimeReg.blockedShots / (realtimeReg.gamesPlayed || 1)) : null}
          rating={rateVal(realtimeReg?.blockedShots != null ? realtimeReg.blockedShots / (realtimeReg.gamesPlayed || 1) : null, LEAGUE_AVG.blockedForPerGame)}
          avg={LEAGUE_AVG.blockedForPerGame.toFixed(1)} note={`Shots blocked by ${TEAM_CONFIG.abbr} skaters per game`} />
        <AdvStatRow label="Blocked Against/GP"
          val={realtimeReg?.shotAttemptsBlocked != null ? fmt(realtimeReg.shotAttemptsBlocked / (realtimeReg.gamesPlayed || 1)) : null}
          rating={rateVal(realtimeReg?.shotAttemptsBlocked != null ? realtimeReg.shotAttemptsBlocked / (realtimeReg.gamesPlayed || 1) : null, LEAGUE_AVG.blockedAgainstPerGame, false)}
          avg={LEAGUE_AVG.blockedAgainstPerGame.toFixed(1)} note={`${TEAM_CONFIG.abbr} shots blocked by opponents per game`} />
        {corsi?.possessionPct != null && (
          <AdvStatRow label="Puck Possession%" val={pct(corsi.possessionPct / 100)}
            rating={rateVal(corsi.possessionPct / 100, 0.5)} avg="50.0%" note="Time with puck ÷ total play time" />
        )}
        <AdvStatRow label="Goals For/GP" val={corsi?.goalsForPerGame ? fmt(corsi.goalsForPerGame) : null}
          rating={rateVal(corsi?.goalsForPerGame, LEAGUE_AVG.goalsForPerGame)} avg={LEAGUE_AVG.goalsForPerGame.toFixed(2)} />
        <AdvStatRow label="Goals Against/GP" val={corsi?.goalsAgainstPerGame ? fmt(corsi.goalsAgainstPerGame) : null}
          rating={rateVal(corsi?.goalsAgainstPerGame, LEAGUE_AVG.goalsAgainstPerGame, false)} avg={LEAGUE_AVG.goalsAgainstPerGame.toFixed(2)} />
      </div>

      {/* xGF% per-game sparkline */}
      {xgTrend && <XgfSparkline data={xgTrend} />}

      {/* PDO & Puck Luck */}
      {pdoData && (
        <div className="card">
          <div className="sec-label" style={{ marginBottom: 8 }}>PDO &amp; Puck Luck</div>
          <div className={ADV_EXPLAIN_CLASSES}>
            PDO = team shooting% + save% × 100. League average = 100. Values above 102 suggest positive puck luck likely to regress; below 98 suggest negative luck. Useful for identifying unsustainable streaks.
          </div>
          <AdvStatRow label="PDO" val={pdoData.pdo} note={pdoData.luck}
            rating={rateVal(parseFloat(pdoData.pdo), LEAGUE_AVG.pdo)} avg="100" />
          <AdvStatRow label="Team SH%" val={`${pdoData.shPct}%`} note="Season shooting %"
            rating={rateVal(parseFloat(pdoData.shPct), LEAGUE_AVG.shPct)} avg={`${LEAGUE_AVG.shPct}%`} />
          <AdvStatRow label="Team SV%" 
            val={pdoData.svPct != null ? (pdoData.svPct / 100).toFixed(3) : null}
            note="Season save %"
            rating={rateVal(pdoData.svPct != null ? pdoData.svPct : null, LEAGUE_AVG.svPct)}
            avg=".900" />
        </div>
      )}

      {/* Power Play */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 8 }}>Power Play</div>
        <div className={ADV_EXPLAIN_CLASSES}>Net PP% excludes goals where the opposing team was also shorthanded simultaneously.</div>
        <AdvStatRow label="PP%" val={pp ? pct(pp.powerPlayPct) : null}
          rating={pp ? rateVal(pp.powerPlayPct, LEAGUE_AVG.ppPct / 100) : null} avg={`${LEAGUE_AVG.ppPct}%`}
          note="League avg ~20%" />
        <AdvStatRow label="Net PP%" val={pp ? pct(pp.powerPlayNetPct) : null}
          rating={pp ? rateVal(pp.powerPlayNetPct, LEAGUE_AVG.netPpPct / 100) : null} avg={`${LEAGUE_AVG.netPpPct}%`} />
        <AdvStatRow label="Faceoff Win%" val={pp ? pct(pp.faceoffWinPct) : null}
          rating={pp ? rateVal(pp.faceoffWinPct, 0.5) : null} avg="50.0%" note="League avg ~50%" />
      </div>

      {/* Penalty Kill */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 8 }}>Penalty Kill</div>
        <div className={ADV_EXPLAIN_CLASSES}>Net PK% excludes goals while both teams were shorthanded simultaneously.</div>
        <AdvStatRow label="PK%" val={pk ? pct(pk.penaltyKillPct) : null}
          rating={pk ? rateVal(pk.penaltyKillPct, LEAGUE_AVG.pkPct / 100) : null} avg={`${LEAGUE_AVG.pkPct}%`}
          note="League avg ~80%" />
        <AdvStatRow label="Net PK%" val={pk ? pct(pk.penaltyKillNetPct) : null}
          rating={pk ? rateVal(pk.penaltyKillNetPct, LEAGUE_AVG.netPkPct / 100) : null} avg={`${LEAGUE_AVG.netPkPct}%`} />
        <AdvStatRow label="Team Shutouts" val={pk?.teamShutouts} />
      </div>



      {!corsiReg && !ppReg && (
        <div className={`card ${EMPTY_STATE_CLASSES}`}>
          <div className={EMPTY_ICON_CLASSES}>📊</div>
          <div className={EMPTY_TITLE_CLASSES}>Loading advanced stats…</div>
          <div className={EMPTY_SUB_CLASSES}>These come from the NHL stats API and may take a moment.</div>
        </div>
      )}
    </div>
  )
}

// ── Splits tab ───────────────────────────────────────────────
function SplitsTab({ homeSplit, homeSplitPO, _stats, _playoffSummary, inPlayoffs, _ppReg, _pkReg, _corsiReg }) {
  const [showPO, setShowPO] = React.useState(false);

  const split = showPO ? homeSplitPO : homeSplit;
  const home  = split?.home;
  const away  = split?.away;

  function rec(d) {
    if (!d) return '—';
    return `${d.wins||0}–${d.losses||0}–${d.otLosses||0}`;
  }
  function fmtNum(v, dec = 2) { return v == null ? '—' : Number(v).toFixed(dec); }
  // homeSplit data has percentages as 0-1 decimals (raw from team/summary API)
  function fmtPct(v) { return v == null ? '—' : `${(v * 100).toFixed(1)}%`; }

  function SplitRow({ label, hVal, aVal, better = 'higher', fmt = fmtNum, note }) {
    if (hVal == null && aVal == null) return null;
    const hNum = typeof hVal === 'number' ? hVal : null;
    const aNum = typeof aVal === 'number' ? aVal : null;
    const hBetter = hNum != null && aNum != null
      ? (better === 'higher' ? hNum >= aNum : hNum <= aNum)
      : false;
    const aBetter = hNum != null && aNum != null ? !hBetter : false;
    return (
      <div className={SPLIT_ADV_ROW_CLASSES}>
        <span className={splitAdvValClasses(hBetter, false)}>{fmt(hVal)}</span>
        <span className={SPLIT_ADV_LABEL_CLASSES}>
          {label}
          {note && <span className={ADV_STAT_NOTE_CLASSES}> · {note}</span>}
        </span>
        <span className={splitAdvValClasses(aBetter, true)}>{fmt(aVal)}</span>
      </div>
    );
  }

  function Section({ title, children }) {
    const rows = React.Children.toArray(children).filter(Boolean);
    if (!rows.length) return null;
    return (
      <div className={SPLIT_ADV_SECTION_CLASSES}>
        <div className={SPLIT_ADV_SECTION_TITLE_CLASSES}>{title}</div>
        {rows}
      </div>
    );
  }

  const gamesLabel = showPO ? 'Playoffs' : 'Regular Season';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Toggle */}
      {inPlayoffs && (
        <div className={ADV_TOGGLE_CLASSES}>
          <button className={advToggleBtnClasses(!showPO)} onClick={() => setShowPO(false)}>📅 Regular Season</button>
          <button className={advToggleBtnClasses(showPO)}  onClick={() => setShowPO(true)}>🏒 Playoffs</button>
        </div>
      )}

      {/* Combined record + advanced stats card */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Home vs Away — {gamesLabel}</div>

        {/* Record header */}
        <div className={SPLIT_ADV_HEADER_CLASSES}>
          <span>🏠 Home</span>
          <span />
          <span>✈ Away</span>
        </div>
        <div className={SPLIT_ADV_ROW_CLASSES} style={{ fontWeight: 700, fontSize: 14 }}>
          <span className={splitAdvValClasses(false, false)}>{rec(home)}</span>
          <span className={SPLIT_ADV_LABEL_CLASSES} style={{ color: 'var(--text-dim)', fontSize: 11 }}>Record</span>
          <span className={splitAdvValClasses(false, true)}>{rec(away)}</span>
        </div>
        <div className={SPLIT_ADV_ROW_CLASSES}>
          <span className={splitAdvValClasses(false, false)}>{home?.gamesPlayed ?? '—'}</span>
          <span className={SPLIT_ADV_LABEL_CLASSES}>GP</span>
          <span className={splitAdvValClasses(false, true)}>{away?.gamesPlayed ?? '—'}</span>
        </div>
        <div className={SPLIT_ADV_ROW_CLASSES}>
          <span className={splitAdvValClasses(false, false)}>
            {home?.points != null && home?.gamesPlayed
              ? `${((home.points / (home.gamesPlayed * 2)) * 100).toFixed(1)}%` : '—'}
          </span>
          <span className={SPLIT_ADV_LABEL_CLASSES}>Pt%</span>
          <span className={splitAdvValClasses(false, true)}>
            {away?.points != null && away?.gamesPlayed
              ? `${((away.points / (away.gamesPlayed * 2)) * 100).toFixed(1)}%` : '—'}
          </span>
        </div>

        <Section title="Scoring">
          <SplitRow label="GF/GP" hVal={home?.goalsForPerGame}     aVal={away?.goalsForPerGame}     better="higher" />
          <SplitRow label="GA/GP" hVal={home?.goalsAgainstPerGame} aVal={away?.goalsAgainstPerGame} better="lower" />
        </Section>

        <Section title="Shot Volume">
          <SplitRow label="SOG/GP"    hVal={home?.shotsForPerGame}     aVal={away?.shotsForPerGame}     better="higher" fmt={v => fmtNum(v, 1)} />
          <SplitRow label="SOG-A/GP"  hVal={home?.shotsAgainstPerGame} aVal={away?.shotsAgainstPerGame} better="lower"  fmt={v => fmtNum(v, 1)} />
          <SplitRow label="Shot For%"
            hVal={home?.shotsForPerGame != null && home?.shotsAgainstPerGame != null
              ? home.shotsForPerGame / (home.shotsForPerGame + home.shotsAgainstPerGame) : null}
            aVal={away?.shotsForPerGame != null && away?.shotsAgainstPerGame != null
              ? away.shotsForPerGame / (away.shotsForPerGame + away.shotsAgainstPerGame) : null}
            better="higher" fmt={fmtPct} note="SOG proxy" />
        </Section>

        <Section title="Special Teams">
          {/* powerPlayPct in team/summary is already 0-1 decimal */}
          <SplitRow label="PP%"
            hVal={home?.powerPlayPct}
            aVal={away?.powerPlayPct}
            better="higher" fmt={fmtPct} />
          <SplitRow label="PK%"
            hVal={home?.penaltyKillPct}
            aVal={away?.penaltyKillPct}
            better="higher" fmt={fmtPct} />
          <SplitRow label="Faceoff%"
            hVal={home?.faceoffWinPct}
            aVal={away?.faceoffWinPct}
            better="higher" fmt={fmtPct} />
        </Section>

        <Section title="Efficiency">
          <SplitRow label="SH%"
            hVal={home?.shotsForPerGame && home?.goalsForPerGame != null
              ? home.goalsForPerGame / home.shotsForPerGame : null}
            aVal={away?.shotsForPerGame && away?.goalsForPerGame != null
              ? away.goalsForPerGame / away.shotsForPerGame : null}
            better="higher" fmt={fmtPct} note="shooting %" />
          <SplitRow label="SV%"
            hVal={home?.shotsAgainstPerGame && home?.goalsAgainstPerGame != null
              ? 1 - (home.goalsAgainstPerGame / home.shotsAgainstPerGame) : null}
            aVal={away?.shotsAgainstPerGame && away?.goalsAgainstPerGame != null
              ? 1 - (away.goalsAgainstPerGame / away.shotsAgainstPerGame) : null}
            better="higher" fmt={v => v != null ? v.toFixed(3) : '—'} />
          <SplitRow label="PDO"
            hVal={home?.shotsForPerGame && home?.goalsForPerGame != null && home?.shotsAgainstPerGame && home?.goalsAgainstPerGame != null
              ? ((home.goalsForPerGame / home.shotsForPerGame) + (1 - home.goalsAgainstPerGame / home.shotsAgainstPerGame)) * 100 : null}
            aVal={away?.shotsForPerGame && away?.goalsForPerGame != null && away?.shotsAgainstPerGame && away?.goalsAgainstPerGame != null
              ? ((away.goalsForPerGame / away.shotsForPerGame) + (1 - away.goalsAgainstPerGame / away.shotsAgainstPerGame)) * 100 : null}
            better="higher" fmt={v => fmtNum(v, 1)} note="SH%+SV%×100" />
        </Section>

      </div>
    </div>
  );
}

// ── Trends tab ───────────────────────────────────────────────

function TrendsTab({ gameLog }) {
  const [dbGameLog, setDbGameLog] = React.useState(null)

  React.useEffect(() => {
    getDbTeamGameLog(120, TEAM_CONFIG.season, TEAM_CONFIG.abbr).then(setDbGameLog).catch(() => {})
  }, [])

  // Build a map from gameId → dbGame for score-first and PP/PK lookup
  // Must be declared before any early returns to satisfy Rules of Hooks
  const dbGameMap = useMemo(() => {
    const m = {}
    dbGameLog?.forEach(g => { m[g.gameId] = g })
    return m
  }, [dbGameLog])

  if (!gameLog?.length) {
    return (
      <div className={`card ${EMPTY_STATE_CLASSES}`}>
        <div className={EMPTY_ICON_CLASSES}>📈</div>
        <div className={EMPTY_TITLE_CLASSES}>Loading game log…</div>
      </div>
    )
  }

  // Score-first rolling 10-game rate — aligned to gameLog (last 20 games)
  const gameLogWithSF = gameLog.map(g => ({
    ...g,
    scoredFirst: dbGameMap[g.gameId]?.scoredFirst ?? null,
  }))

  const rollingScoreFirst = gameLogWithSF.map((g, i) => {
    const w = gameLogWithSF.slice(Math.max(0, i - 9), i + 1)
    const withData = w.filter(x => x.scoredFirst != null)
    return withData.length >= 3
      ? Math.round(withData.filter(x => x.scoredFirst).length / withData.length * 100)
      : null
  })

  const hasSF = rollingScoreFirst.some(v => v != null)

  // PP/PK rolling aligned to gameLog games
  const gameLogWithPPPK = gameLog.map(g => ({
    ...g,
    ppGoals:        dbGameMap[g.gameId]?.ppGoals ?? null,
    ppOpps:         dbGameMap[g.gameId]?.ppOpps  ?? null,
    pkGoalsAgainst: dbGameMap[g.gameId]?.pkGoalsAgainst ?? null,
    pkOpps:         dbGameMap[g.gameId]?.pkOpps  ?? null,
  }))

  const rollingPP = gameLogWithPPPK.map((g, i) => {
    const w = gameLogWithPPPK.slice(Math.max(0, i - 4), i + 1).filter(x => x.ppOpps != null)
    const goals = w.reduce((s, x) => s + (x.ppGoals || 0), 0)
    const opps  = w.reduce((s, x) => s + (x.ppOpps  || 0), 0)
    return opps > 0 ? Math.round(goals / opps * 100) : null
  })

  const rollingPK = gameLogWithPPPK.map((g, i) => {
    const w = gameLogWithPPPK.slice(Math.max(0, i - 4), i + 1).filter(x => x.pkOpps != null)
    const ga   = w.reduce((s, x) => s + (x.pkGoalsAgainst || 0), 0)
    const opps = w.reduce((s, x) => s + (x.pkOpps         || 0), 0)
    return opps > 0 ? Math.round((1 - ga / opps) * 100) : null
  })

  const hasPPPK = rollingPP.some(v => v != null)

  const rollingGF = gameLog.map((g, i) => {
    const w = gameLog.slice(Math.max(0, i - 4), i + 1)
    return parseFloat((w.reduce((s, x) => s + x.carScore, 0) / w.length).toFixed(1))
  })

  const rollingGA = gameLog.map((g, i) => {
    const w = gameLog.slice(Math.max(0, i - 4), i + 1)
    return parseFloat((w.reduce((s, x) => s + x.oppScore, 0) / w.length).toFixed(1))
  })

  // Rolling 10-game win %
  const rolling = gameLog.map((g, i) => {
    const window = gameLog.slice(Math.max(0, i - 9), i + 1)
    const w10pct = Math.round((window.filter(x => x.won).length / window.length) * 100)
    return { ...g, w10pct }
  })

  // Current streak
  let streak = 0, streakType = ''
  for (let i = gameLog.length - 1; i >= 0; i--) {
    const g = gameLog[i]
    if (i === gameLog.length - 1) { streakType = g.won ? 'W' : 'L'; streak = 1 }
    else if ((g.won && streakType === 'W') || (!g.won && streakType === 'L')) streak++
    else break
  }

  const last10  = gameLog.slice(-10)
  const last10W = last10.filter(g => g.won).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

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
            <div className={TQ_VAL_CLASSES}>{last10W}–{10 - last10W}</div>
          </div>
          <div className={TQ_ITEM_CLASSES}>
            <div className={TQ_LABEL_CLASSES}>Win % L10</div>
            <div className={TQ_VAL_CLASSES}>{Math.round(last10W / 10 * 100)}%</div>
          </div>
        </div>
      </div>

      {/* Game-by-game result dots */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Last {gameLog.length} games</div>
        <div className={RESULT_DOTS_CLASSES}>
          {gameLog.map((g, i) => (
            <div
              key={i}
              className={resultDotClasses(g.result)}
              title={`${g.date?.slice(5,10)} vs ${g.opp}: ${g.result} ${g.carScore}–${g.oppScore}${g.home ? ' (Home)' : ' (Away)'}`}
            >
              {g.result === 'OTL' ? 'O' : g.result}
            </div>
          ))}
        </div>
      </div>

      {/* Rolling 10-game win % */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Win % — rolling 10-game window</div>
        <div className={ROLLING_CHART_CLASSES}>
          {rolling.map((g, i) => (
            <div key={i} className={ROLLING_BAR_WRAP_CLASSES}>
              <div className={ROLLING_BAR_LABEL_CLASSES}>{g.w10pct}%</div>
              <div
                className={rollingBarClasses(g.w10pct)}
                style={{ height: `${g.w10pct}%` }}
                title={`Game ${i+1}: ${g.w10pct}% win rate`}
              />
              {i % 5 === 0 && <div className={ROLLING_LABEL_CLASSES}>{i + 1}</div>}
            </div>
          ))}
          <div className={ROLLING_AVG_LINE_CLASSES} style={{ bottom: '50%' }} aria-label="50% reference" title="50% win rate reference" />
        </div>
        <div className={ROLLING_LEGEND_CLASSES}>
          <span className={RL_HOT_CLASSES}>■ Hot (≥60%)</span>
          <span className={RL_OK_CLASSES}>■ Average (40–60%)</span>
          <span className={RL_COLD_CLASSES}>■ Cold (&lt;40%)</span>
          <span style={{ color: 'var(--text-dim)', marginLeft: 'auto', fontSize: 9 }}>— 50% ref · each bar = 1 game</span>
        </div>
      </div>

      {/* Goals For / Against rolling 5-game avg */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 10 }}>Goals — rolling 5-game average</div>
        <div className={ROLLING_CHART_DUAL_CLASSES}>
          {gameLog.map((g, i) => {
            const gf = rollingGF[i]
            const ga = rollingGA[i]
            const maxVal = 6
            return (
              <div key={i} className={ROLLING_BAR_WRAP_CLASSES}>
                <div className={ROLLING_BAR_LABEL_CLASSES} style={{ color: 'var(--red-bright)' }}>{gf}</div>
                <div className={ROLLING_BAR_DUAL_WRAP_CLASSES}>
                  <div
                    className={ROLLING_BAR_GF_CLASSES}
                    style={{ height: `${Math.min(gf / maxVal * 100, 100)}%` }}
                    title={`GF avg: ${gf}`}
                  />
                  <div
                    className={ROLLING_BAR_GA_CLASSES}
                    style={{ height: `${Math.min(ga / maxVal * 100, 100)}%` }}
                    title={`GA avg: ${ga}`}
                  />
                </div>
                <div className={ROLLING_BAR_LABEL_BOT_CLASSES} style={{ color: 'var(--blue-bright)' }}>{ga}</div>
                {i % 5 === 0 && <div className={ROLLING_LABEL_CLASSES}>{i + 1}</div>}
              </div>
            )
          })}
        </div>
        <div className={ROLLING_LEGEND_CLASSES}>
          <span style={{ color: 'var(--red-bright)' }}>■ Goals For</span>
          <span style={{ color: 'var(--blue-bright)', marginLeft: 12 }}>■ Goals Against</span>
        </div>
      </div>

      {/* Score-first rolling rate */}
      {hasSF && (
        <div className="card">
          <div className="sec-label" style={{ marginBottom: 10 }}>
            Score-first rate — rolling 10-game window
            <InfoTip text={`How often ${TEAM_CONFIG.abbr} has scored the first goal of the game, rolling 10-game window. Each bar = one game; bar height = % of the last 10 games where ${TEAM_CONFIG.abbr} scored first.`} position="above" />
          </div>
          <div className={ROLLING_CHART_CLASSES}>
            {gameLogWithSF.map((g, i) => {
              const val = rollingScoreFirst[i]
              if (val == null) return (
                <div key={i} className={ROLLING_BAR_WRAP_CLASSES}>
                  <div className={ROLLING_BAR_LABEL_CLASSES} style={{ opacity: 0 }}>0%</div>
                  <div className={ROLLING_BAR_BASE_CLASSES} style={{ height: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} />
                  {i % 5 === 0 && <div className={ROLLING_LABEL_CLASSES}>{i + 1}</div>}
                </div>
              )
              return (
                <div key={i} className={ROLLING_BAR_WRAP_CLASSES}>
                  <div className={ROLLING_BAR_LABEL_CLASSES}>{val}%</div>
                  <div
                    className={rollingBarClasses(val)}
                    style={{ height: `${val}%` }}
                    title={`Game ${i+1}: scored first ${val}% of last 10`}
                  />
                  {i % 5 === 0 && <div className={ROLLING_LABEL_CLASSES}>{i + 1}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PP / PK rolling efficiency */}
      {hasPPPK && (
        <div className="card">
          <div className="sec-label" style={{ marginBottom: 10 }}>PP% / PK% — rolling 5-game window</div>
          <div className={ROLLING_CHART_CLASSES}>
            {gameLogWithPPPK.map((g, i) => {
              const pp = rollingPP[i]
              const pk = rollingPK[i]
              return (
                <div key={i} className={ROLLING_BAR_WRAP_CLASSES}>
                  <div className={ROLLING_BAR_LABEL_CLASSES} style={{ color: 'var(--amber)' }}>{pp != null ? `${pp}%` : ''}</div>
                  <div className={ROLLING_BAR_DUAL_WRAP_CLASSES}>
                    {pp != null && (
                      <div
                        className={`${ROLLING_BAR_BASE_CLASSES} bg-[var(--amber)] flex-1`}
                        style={{ height: `${Math.min(pp / 40 * 100, 100)}%` }}
                        title={`PP%: ${pp}%`}
                      />
                    )}
                    {pk != null && (
                      <div
                        className={`${ROLLING_BAR_BASE_CLASSES} bg-[var(--green)] flex-1`}
                        style={{ height: `${Math.min(pk / 100 * 100, 100)}%` }}
                        title={`PK%: ${pk}%`}
                      />
                    )}
                  </div>
                  <div className={ROLLING_BAR_LABEL_BOT_CLASSES} style={{ color: 'var(--green)' }}>{pk != null ? `${pk}%` : ''}</div>
                  {i % 5 === 0 && <div className={ROLLING_LABEL_CLASSES}>{i + 1}</div>}
                </div>
              )
            })}
          </div>
          <div className={ROLLING_LEGEND_CLASSES}>
            <span style={{ color: 'var(--amber)' }}>■ PP%</span>
            <span style={{ color: 'var(--green)', marginLeft: 12 }}>■ PK%</span>
          </div>
        </div>
      )}

      {/* Score differential trend */}
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 6 }}>Goal differential by game</div>
        <div className={GD_CHART_WRAP_CLASSES}>
          <div className={GD_BASELINE_LINE_CLASSES} />
          <div className={GD_BARS_CLASSES}>
            {gameLog.map((g, i) => {
              const diff  = g.carScore - g.oppScore
              const absPx = Math.min(Math.abs(diff) * 12, 48)
              return (
                <div key={i} className={GD_BAR_COL_CLASSES} title={`${g.date?.slice(5,10)} vs ${g.opp}: ${diff > 0 ? '+' : ''}${diff}`}>
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
              )
            })}
          </div>
        </div>
        <div className={GD_LEGEND_CLASSES}>
          <span className={GD_LEG_POS_CLASSES}>■ Win (positive diff)</span>
          <span className={GD_LEG_NEG_CLASSES}>■ Loss (negative diff)</span>
        </div>
      </div>
    </div>
  )
}

// ── Cap tab ───────────────────────────────────────────────────
function CapTab({ capSummary, capPct, sortedContracts }) {
  return (
    <div className="card" style={{ marginTop: 4 }}>
      <div className="sec-label" style={{ marginBottom: 10 }}>Salary Cap · {CURRENT_SEASON}</div>
      <div className={CAP_BAR_WRAP_CLASSES}>
        <div className={CAP_BAR_FILL_CLASSES} style={{ width: `${capPct}%` }} />
        <div className={CAP_BAR_TRACK_CLASSES} />
      </div>
      <div className={CAP_BAR_LABELS_CLASSES}>
        <span className={CAP_COMMITTED_CLASSES}>${(capSummary.committed/1_000_000).toFixed(1)}M committed</span>
        <span style={{ color: capSummary.space < 5_000_000 ? 'var(--red-bright)' : 'var(--green)' }}>
          ${(capSummary.space/1_000_000).toFixed(1)}M cap space
        </span>
      </div>
      <div className={CAP_CEILING_LABEL_CLASSES}>Cap ceiling: ${(CAP_CEILING/1_000_000).toFixed(1)}M</div>
      <div className={CAP_DATA_DATE_CLASSES}>Data as of {CONTRACT_DATA_DATE} · Source: PuckPedia</div>
      <div className={CAP_TABLE_CLASSES}>
        <div className={CAP_TABLE_HEADER_CLASSES}>
          <span>Player</span><span>Pos</span><span>Cap Hit</span>
          <span>Type</span><span>Expires</span>
        </div>
        {sortedContracts.map((c, i) => {
          const barPct = Math.round((c.capHit / CAP_CEILING) * 100)
          const isExpiring = c.yearsLeft === 0
          return (
            <div key={i} className={capRowClasses(isExpiring)}>
              <span className={CAP_NAME_CLASSES}>{c.name}</span>
              <span className={CAP_POS_CLASSES}>{c.pos}</span>
              <div className={CAP_HIT_CELL_CLASSES}>
                <div className={CAP_HIT_BAR_CLASSES} style={{ width: `${Math.min(barPct * 3, 100)}%` }} />
                <span className={CAP_HIT_VAL_CLASSES}>${(c.capHit/1_000_000).toFixed(2)}M</span>
              </div>
              <span className={capTypeClasses(c.type)}>
                {c.type}{c.note ? ` · ${c.note}` : ''}
              </span>
              <span className={CAP_EXPIRES_CLASSES} style={{ color: isExpiring ? 'var(--amber)' : 'var(--text-dim)' }}>
                {c.expiresAfter}
              </span>
            </div>
          )
        })}
      </div>
      {capSummary.expiring.length > 0 && (
        <div className={CAP_EXPIRING_NOTE_CLASSES}>
          ⚠ {capSummary.ufa.length} UFA{capSummary.ufa.length !== 1 ? 's' : ''} and {capSummary.rfa.length} RFA{capSummary.rfa.length !== 1 ? 's' : ''} expiring this summer
        </div>
      )}
    </div>
  )
}

// ── Picks tab ─────────────────────────────────────────────────
function PicksTab({ overridePicks = null, overrideOrder = null, _devTeamAbbr = null }) {
  const [order, setOrder]     = useState(null);
  const [picks, setPicks]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected]     = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);

  const teamAbbr = _devTeamAbbr || TEAM_CONFIG.abbr;

  useEffect(() => {
    if (overrideOrder !== null || overridePicks !== null) {
      setOrder(Array.isArray(overrideOrder) ? overrideOrder : []);
      setPicks(Array.isArray(overridePicks) ? overridePicks : []);
      setLoading(false);
      return;
    }
    Promise.all([
      getDraftOrder(teamAbbr),
      getDraftPicks(teamAbbr),
    ]).then(([orderData, picksData]) => {
      setOrder(Array.isArray(orderData) ? orderData : []);
      const allPicks = Array.isArray(picksData) ? picksData : [];
      // Worker filters by team, but guard client-side in case stub returns all picks
      const teamPicks = allPicks.filter(p => !p.team_abbrev || p.team_abbrev === teamAbbr);
      setPicks(teamPicks);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamAbbr, overrideOrder, overridePicks]);

  const draftStarted = picks !== null && picks.length > 0;

  function openPick(item, mode) {
    setSelected(item);
    setSelectedMode(mode);
  }

  function closePopup() {
    setSelected(null);
    setSelectedMode(null);
  }

  return (
    <>
      {/* 2026 Draft */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="sec-label" style={{ marginBottom: 10 }}>2026 NHL Draft</div>

        {loading && (
          <div className={PICKS_LOADING_CLASSES}>Loading…</div>
        )}

        {/* Pre-draft: R1 slot(s) from confirmed order */}
        {!loading && !draftStarted && order !== null && (
          <>
            {order.length === 0 ? (
              <div className={PICKS_EMPTY_CLASSES}>No confirmed picks found for {teamAbbr}.</div>
            ) : (
              <>
                {order.map((slot) => (
                  <div key={slot.pick_overall} className={PICKS_SLOT_CLASSES}>
                    <span className={PICKS_SLOT_ROUND_CLASSES}>Round {slot.round}</span>
                    <span className={PICKS_SLOT_OVERALL_CLASSES}>Pick #{slot.pick_overall}</span>
                    {slot.original_team && (
                      <span className={PICKS_SLOT_FROM_CLASSES}>via {slot.original_team}</span>
                    )}
                  </div>
                ))}
                <div className={PICKS_NOTE_CLASSES} style={{ marginTop: 8 }}>
                  Draft begins June 26 · Buffalo · 7 pm ET
                </div>
              </>
            )}
          </>
        )}

        {/* Live/post-draft: actual picks made */}
        {!loading && draftStarted && (
          <div className={PICKS_MADE_LIST_CLASSES}>
            {picks.map((pick) => (
              <div
                key={pick.pick_overall}
                className={PICKS_MADE_ROW_CLASSES}
                onClick={() => openPick(pick, 'pick')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && openPick(pick, 'pick')}
              >
                <span className={PICKS_MADE_ROUND_CLASSES}>R{pick.round} · #{pick.pick_overall}</span>
                <span className={PICKS_MADE_NAME_CLASSES}>{pick.prospect_first} {pick.prospect_last}</span>
                <span className={PICKS_MADE_POS_CLASSES}>{pick.position_code}</span>
                {pick.final_rank && (
                  <span className={PICKS_MADE_RANK_CLASSES}>CS #{pick.final_rank}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <DraftPopup item={selected} mode={selectedMode} onClose={closePopup} />
      )}
    </>
  );
}

// ── Shared sub-components ────────────────────────────────────
function AdvStatRow({ label, val, note, rating, avg }) {
  const indicator = rating === 'good' ? '▲' : rating === 'bad' ? '▼' : null;
  return (
    <div className={ADV_STAT_ROW_CLASSES}>
      <span className={ADV_STAT_LABEL_CLASSES}>
        {label}
        {note && <span className={ADV_STAT_NOTE_CLASSES}> · {note}</span>}
      </span>
      <span className={ADV_STAT_RIGHT_CLASSES}>
        {indicator && (
          <span className={`${ADV_STAT_INDICATOR_BASE_CLASSES} ${rating === 'good' ? ADV_STAT_INDICATOR_GOOD_CLASSES : ADV_STAT_INDICATOR_BAD_CLASSES}`}>{indicator}</span>
        )}
        <span className={advStatValClasses(rating)}>{val ?? '—'}</span>
        {avg != null && val && val !== '—' && (
          <span className={ADV_STAT_AVG_CLASSES}>avg {avg}</span>
        )}
      </span>
    </div>
  );
}

// ─── Dev export ──────────────────────────────────────────────────────────────
// PicksTabDev — exported for DevDraftView simulator. Accepts teamAbbr as a prop
// rather than reading from TEAM_CONFIG, so the simulator can switch teams.
export function PicksTabDev({ teamAbbr, overridePicks = null, overrideOrder = null }) {
  return (
    <PicksTab
      overridePicks={overridePicks}
      overrideOrder={overrideOrder}
      _devTeamAbbr={teamAbbr}
    />
  );
}
