// utils/pwhlPlayerStats.js
// PWHL skater/goalie stat definitions + formatters, extracted from
// PWHLPlayerPopup.jsx (Session 91) so PlayerComparisonPopup.jsx can reuse
// them without a circular import -- same reasoning as nhlPlayerStats.js.

// `perGame`/`perGameKey` (Session 70) mark which stats have a real
// per-game source in pwhl_skater_game_box/pwhl_goalie_game_box (via the
// poller's /pwhl/player-game-log route) for the Compare tab's trend chart.
// PP/SH/GW goal breakdowns and win/loss/shutout aren't in the box score at
// all (aggregate-only, no per-game path); shot_pct/sv_pct/gaa are left
// tile-only too even though technically derivable, to match exactly the
// 6/11 skater and 2/9 goalie counts scoped and decided on for this pass —
// see SESSION_70_DECISION_compare_tab_layout.md.
export const SKATER_STATS = [
  { key: 'goals',      label: 'Goals',  group: 'Scoring', perGame: true,
    tip: 'Total goals scored.',
    why: 'The most direct measure of finishing ability and offensive contribution.' },
  { key: 'assists',    label: 'Assists', group: 'Scoring', perGame: true,
    tip: 'Points credited for setting up a goal.',
    why: 'Reflects playmaking and vision.' },
  { key: 'points',     label: 'Points', group: 'Scoring', perGame: true,
    tip: 'Goals + Assists.',
    why: 'Primary measure of offensive production.' },
  { key: 'plus_minus', label: '+/−',    group: 'Scoring', perGame: true,
    tip: '+1 when on ice for a goal for; −1 for a goal against at even strength.',
    why: 'Rough proxy for two-way effectiveness.' },
  { key: 'gp',         label: 'GP',     group: 'Scoring',
    tip: 'Games played.',
    why: 'Context for all counting stats.' },
  { key: 'pp_goals',   label: 'PPG',    group: 'Special Teams',
    tip: 'Goals scored on the power play.',
    why: 'Indicates value on the man-advantage unit.' },
  { key: 'sh_goals',   label: 'SHG',    group: 'Special Teams',
    tip: 'Goals scored while shorthanded.',
    why: 'Rare and opportunistic — indicates speed and instinct.' },
  { key: 'gw_goals',   label: 'GWG',    group: 'Special Teams',
    tip: 'The goal that proved to be the winning margin.',
    why: 'A measure of clutch scoring.' },
  { key: 'shots',      label: 'Shots',  group: 'Shot Quality', perGame: true,
    tip: 'Shots on goal.',
    why: 'High shot volume indicates offensive presence even when not scoring.' },
  { key: 'shot_pct',   label: 'S%',     group: 'Shot Quality',
    tip: 'Goals ÷ Shots on Goal × 100.',
    calc: 'S% = (Goals / Shots) × 100',
    why: 'Sustained high S% indicates elite finishing; extreme values often regress.' },
  { key: 'pim',        label: 'PIM',    group: 'Discipline', perGame: true, perGameKey: 'penalty_minutes',
    tip: 'Penalty minutes.',
    why: 'High PIM hurts the team; compare to physical impact for full picture.' },
]

// Box-score stat keys with a backing percentile column in
// /pwhl/player/percentiles -- same small-subset pattern as NHL's
// STAT_PCT_MAP (pwhl_percentiles.py only computes these 4 categories
// today; assists maps to a1/primary-assists rate, not the raw all-assist
// count, same caveat as NHL's own 'assists' tile).
export const PWHL_STAT_PCT_MAP = {
  goals:    'goals',
  assists:  'a1',
  pim:      'penalties',
  shot_pct: 'finishing',
}

export const GOALIE_STATS = [
  { key: 'gp',           label: 'GP',  group: 'Record',
    tip: 'Games played.', why: 'Context for all other stats.' },
  { key: 'wins',         label: 'W',   group: 'Record',
    tip: 'Wins.', why: 'Primary measure of team contribution.' },
  { key: 'losses',       label: 'L',   group: 'Record',
    tip: 'Regulation losses.', why: 'Combined with OTL gives the full record.' },
  { key: 'ot_losses',    label: 'OTL', group: 'Record',
    tip: 'Overtime/shootout losses (1 point for the team).',
    why: 'Goalies with many OTL often faced close games.' },
  { key: 'sv_pct',       label: 'SV%', group: 'Performance',
    tip: 'Saves ÷ Shots Against.',
    calc: 'SV% = Saves / Shots Against',
    why: 'The most important goalie stat. Even small differences are significant.' },
  { key: 'gaa',          label: 'GAA', group: 'Performance',
    tip: 'Goals allowed per 60 minutes.',
    calc: 'GAA = (Goals Against / Minutes Played) × 60',
    why: 'Best read alongside SV% for full context.' },
  { key: 'shutouts',     label: 'SO',  group: 'Performance',
    tip: 'Games where the goalie allowed zero goals.',
    why: 'A prestigious milestone.' },
  { key: 'saves',        label: 'SV',  group: 'Performance', perGame: true,
    tip: 'Total saves made.', why: 'Combined with shots against gives SV%.' },
  { key: 'goals_against',label: 'GA',  group: 'Performance', perGame: true,
    tip: 'Total goals allowed.', why: 'Context for GAA and SV%.' },
]

export function posLabel(code) {
  return { C:'Centre', LW:'Left Wing', RW:'Right Wing', D:'Defence',
           LD:'Left Defence', RD:'Right Defence', G:'Goalie', F:'Forward' }[code] || code
}

// PWHL's own version of NHL's groupStats(), keyed on this file's field
// names (shot_pct/sv_pct/gaa/plus_minus rather than NHL's
// shootingPctg/savePctg/goalsAgainstAvg/plusMinus) -- same {group, items:
// [{def, fmt}]} output shape StatTileGrid (shared with NHL) expects.
export function groupStats(defs, stats) {
  const groups = {}
  defs.forEach(def => {
    const raw = stats?.[def.key]
    if (raw == null) return
    let fmt
    if (def.key === 'shot_pct') fmt = `${Number(raw).toFixed(1)}%`
    else if (def.key === 'sv_pct') fmt = Number(raw).toFixed(3).replace(/^0\./, '.')
    else if (def.key === 'gaa') fmt = Number(raw).toFixed(2)
    else if (def.key === 'plus_minus') { const n = Number(raw); fmt = n > 0 ? `+${n}` : String(n) }
    else fmt = raw
    if (!groups[def.group]) groups[def.group] = []
    groups[def.group].push({ def, fmt })
  })
  return Object.entries(groups).map(([group, items]) => ({ group, items }))
}

// PWHL skater radar axes -- the 4 raw percentile categories
// pwhl_percentiles.py computes today (no composite squeeze needed or
// possible, unlike NHL's 5-from-10). New for Session 91: PWHL had no radar
// anywhere in the app before player-vs-player comparison (confirmed via
// investigation -- PWHLPlayerPopup.jsx never rendered a radar, only a 2x2
// percentile-tile grid). Deliberately thinner than NHL's 5-axis set per
// Matt's decision to ship PWHL now rather than block on more pipeline work.
export function computeRadarAxes(percentiles) {
  const p = percentiles || {}
  return [
    { axis: 'Goals',      value: p.goals?.pct ?? null },
    { axis: '1st Assists', value: p.a1?.pct ?? null },
    { axis: 'Finishing',  value: p.finishing?.pct ?? null },
    { axis: 'Penalties',  value: p.penalties?.pct ?? null },
  ].map(d => ({ ...d, hasData: d.value != null, value: d.value ?? 0 }))
}

export const RADAR_AXIS_ABBR = {
  'Goals':        'G',
  '1st Assists':  'A1',
  'Finishing':    'FIN',
  'Penalties':    'PIM',
  'GSAX':         'GSAX',
  'GSAX/60':      'G60',
  '5v5 SV%':      '5v5',
  'HD SV%':       'HD',
  'MD SV%':       'MD',
  'PK SV%':       'PK',
}

// PWHL goalie radar axes -- 6 raw percentile categories, no compositing
// needed (same shape as NHL's own computeGoalieRadarAxes in
// nhlPlayerStats.js). Added alongside eyewall-poller's new
// /pwhl/goalie/percentiles route and eyewall-pipeline's
// pwhl_goalie_percentiles.py (2026-08) -- PWHL goalies had zero percentile
// data of any kind before this; pwhl_percentiles.py (skaters) explicitly
// excludes them. `percentiles` here is /pwhl/goalie/percentiles' own
// shape (gsax/gsax60/evSv/hdSv/mdSv/pkSv keys), matching NHL's
// getGoalieAnalytics() percentile shape exactly -- no key-name
// translation needed between this function and its NHL counterpart.
export function computeGoalieRadarAxes(percentiles) {
  const p = percentiles || {}
  return [
    { axis: 'GSAX',        value: p.gsax?.pct ?? null },
    { axis: 'GSAX/60',     value: p.gsax60?.pct ?? null },
    { axis: '5v5 SV%',     value: p.evSv?.pct ?? null },
    { axis: 'HD SV%',      value: p.hdSv?.pct ?? null },
    { axis: 'MD SV%',      value: p.mdSv?.pct ?? null },
    { axis: 'PK SV%',      value: p.pkSv?.pct ?? null },
  ].map(d => ({ ...d, hasData: d.value != null, value: d.value ?? 0 }))
}
