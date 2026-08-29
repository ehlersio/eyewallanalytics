// utils/ahlPlayerStats.js
// AHL skater/goalie stat definitions + formatters -- mirrors
// pwhlPlayerStats.js's shape (same {group, items: [{def, fmt}]} output
// StatTileGrid's TileStatSection expects), scoped to fields AHL's feed
// actually has. No percentile map / radar-axis functions here -- AHL has
// no percentile pipeline (see AHL_BUILD_BRIEF.md), unlike PWHL's.
import i18n from '../i18n';

// Drops shot_pct/gw_goals from PWHL's SKATER_STATS -- confirmed absent
// from AHL's HockeyTech feed entirely (see ahl_stats.py's
// fetch_skater_stats(), also AHLPlayersView.jsx's own column list).
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
  { key: 'shots',      label: 'Shots',  group: 'Shot Quality', perGame: true,
    tip: 'Shots on goal.',
    why: 'High shot volume indicates offensive presence even when not scoring.' },
  { key: 'pim',        label: 'PIM',    group: 'Discipline', perGame: true, perGameKey: 'penalty_minutes',
    tip: 'Penalty minutes.',
    why: 'High PIM hurts the team; compare to physical impact for full picture.' },
]

export const GOALIE_STATS = [
  { key: 'gp',            label: 'GP',  group: 'Record',
    tip: 'Games played.', why: 'Context for all other stats.' },
  { key: 'wins',          label: 'W',   group: 'Record',
    tip: 'Wins.', why: 'Primary measure of team contribution.' },
  { key: 'losses',        label: 'L',   group: 'Record',
    tip: 'Regulation losses.', why: 'Combined with OTL/SOL gives the full record.' },
  { key: 'ot_losses',     label: 'OTL', group: 'Record',
    tip: 'Overtime losses (1 point for the team).',
    why: 'Goalies with many OTL often faced close games.' },
  { key: 'sv_pct',        label: 'SV%', group: 'Performance',
    tip: 'Saves ÷ Shots Against.',
    calc: 'SV% = Saves / Shots Against',
    why: 'The most important goalie stat. Even small differences are significant.' },
  { key: 'gaa',           label: 'GAA', group: 'Performance',
    tip: 'Goals allowed per 60 minutes.',
    calc: 'GAA = (Goals Against / Minutes Played) × 60',
    why: 'Best read alongside SV% for full context.' },
  { key: 'shutouts',      label: 'SO',  group: 'Performance',
    tip: 'Games where the goalie allowed zero goals.',
    why: 'A prestigious milestone.' },
  { key: 'saves',         label: 'SV',  group: 'Performance', perGame: true,
    tip: 'Total saves made.', why: 'Combined with shots against gives SV%.' },
  { key: 'goals_against', label: 'GA',  group: 'Performance', perGame: true,
    tip: 'Total goals allowed.', why: 'Context for GAA and SV%.' },
]

export function posLabel(code) {
  return {
    C:  i18n.t('posLabel.pwhl.centre'),
    LW: i18n.t('posLabel.pwhl.leftWing'),
    RW: i18n.t('posLabel.pwhl.rightWing'),
    D:  i18n.t('posLabel.pwhl.defence'),
    LD: i18n.t('posLabel.pwhl.leftDefence'),
    RD: i18n.t('posLabel.pwhl.rightDefence'),
    G:  i18n.t('posLabel.pwhl.goalie'),
    F:  i18n.t('posLabel.pwhl.forward'),
  }[code] || code
}

// Same shape as pwhlPlayerStats.js's groupStats() -- kept as an
// independent copy per this codebase's popup-owned-helper convention
// rather than cross-importing between the PWHL and AHL component trees.
export function groupStats(defs, stats) {
  const groups = {}
  defs.forEach(def => {
    const raw = stats?.[def.key]
    if (raw == null) return
    let fmt
    if (def.key === 'sv_pct') fmt = Number(raw).toFixed(3).replace(/^0\./, '.')
    else if (def.key === 'gaa') fmt = Number(raw).toFixed(2)
    else if (def.key === 'plus_minus') { const n = Number(raw); fmt = n > 0 ? `+${n}` : String(n) }
    else fmt = raw
    if (!groups[def.group]) groups[def.group] = []
    groups[def.group].push({ def, fmt })
  })
  return Object.entries(groups).map(([group, items]) => ({ group, items }))
}
