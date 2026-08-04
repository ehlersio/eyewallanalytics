// utils/nhlPlayerStats.js
// NHL skater/goalie stat definitions + formatters + radar-axis composites,
// extracted from PlayerPopup.jsx (Session 91) so PlayerComparisonPopup.jsx
// can reuse the exact same stat list/percentile mapping/radar logic without
// a circular import (PlayerPopup.jsx renders the comparison entry point, so
// it can't also be the thing PlayerComparisonPopup.jsx imports from -- same
// reasoning that pulled StatTileGrid out of PlayerPopup.jsx in Session 75).

// `perGame`/`perGameKey`/`cumulative`/`derive` (Session 70) mark which
// stats have a real per-game data source, for the Compare tab's trend
// chart -- see SESSION_70_FINDINGS_player_compare_hybrid_viz.md Q3 for the
// full per-metric reasoning. Only flagged where the NHL API's
// /player/{id}/game-log endpoint (getPlayerGameLog, nhlApi.js) actually
// carries the field; hits/blocks/TK/GV/FO%/S% don't (unconfirmed source),
// and gamesPlayed isn't a trend concept at all -- those stay tile-only.
// `cumulative: true` means the chart plots a running season-to-date total
// rather than the raw per-game value -- for rare/binary events (a single
// game's SHG/GWG is almost always 0), a running total is the only
// meaningful line.
export const SKATER_STATS = [
  { key: 'goals',              label: 'Goals',       group: 'Scoring', perGame: true,
    tip: 'Total goals scored. A goal is awarded when the puck fully crosses the opposing goal line.',
    why: 'The most direct measure of a player\'s finishing ability and offensive contribution.' },
  { key: 'assists',            label: 'Assists',     group: 'Scoring', perGame: true,
    tip: 'Points credited for setting up a goal. Up to two assists are awarded per goal.',
    why: 'Reflects a player\'s playmaking and vision. Some elite players accumulate far more assists than goals.' },
  { key: 'points',             label: 'Points',      group: 'Scoring', perGame: true,
    tip: 'Goals + Assists. The primary measure of offensive production.',
    why: 'The standard yardstick for comparing forwards and offensive defencemen across the league.' },
  { key: 'plusMinus',          label: '+/−',         group: 'Scoring', perGame: true,
    tip: '+1 when on ice for a 5v5 or 4v4 goal for; −1 when on ice for one against. PP/SH goals excluded.',
    why: 'A rough proxy for two-way effectiveness, though heavily influenced by linemates and usage.' },
  { key: 'gamesPlayed',        label: 'GP',          group: 'Scoring',
    tip: 'Games played in this sample.',
    why: 'Context for all counting stats — a player with 20 points in 25 games is more productive than 20 in 40.' },
  { key: 'powerPlayGoals',     label: 'PPG',         group: 'Special Teams', perGame: true,
    tip: 'Goals scored while your team has a man advantage (power play).',
    why: 'Power play specialists can have outsized PPG totals. Compare to even-strength goals for full picture.' },
  { key: 'powerPlayPoints',    label: 'PPP',         group: 'Special Teams', perGame: true,
    tip: 'Goals + Assists on the power play.',
    why: 'High PPP players are valuable on the man-advantage unit but may be less impactful at 5v5.' },
  { key: 'shorthandedGoals',   label: 'SHG',         group: 'Special Teams', perGame: true, cumulative: true,
    tip: 'Goals scored while your team is shorthanded (penalty kill).',
    why: 'Rare and opportunistic — indicates speed and instinct.' },
  { key: 'gameWinningGoals',   label: 'GWG',         group: 'Special Teams', perGame: true, cumulative: true,
    tip: 'The goal that proved to be the winning margin. If the final score is 4–2, the 3rd goal for the winner is the GWG.',
    why: 'A measure of clutch scoring, though partially luck-dependent.' },
  { key: 'shots',              label: 'Shots',       group: 'Shot Quality', perGame: true,
    tip: 'Shots on goal — shots that would have entered the net if not for the goalie.',
    why: 'High shot volume indicates an offensive presence even when not scoring.' },
  { key: 'shootingPctg',       label: 'S%',          group: 'Shot Quality',
    tip: 'Goals ÷ Shots on Goal × 100. League average for forwards is roughly 10–12%.',
    calc: 'S% = (Goals / Shots) × 100',
    why: 'Sustained high S% indicates elite finishing; very high or low rates often regress toward average over time.' },
  { key: 'avgToi',             label: 'TOI/G',       group: 'Ice Time', perGame: true, perGameKey: 'toi',
    tip: 'Average time on ice per game (minutes:seconds).',
    why: 'Coaches allocate more ice time to trusted players. Elite forwards average 18–22 min; top D pairs often exceed 24 min.' },
  { key: 'pim',                label: 'PIM',         group: 'Ice Time', perGame: true,
    tip: 'Penalty minutes. 2 min per minor, 4 per double minor, 5 per major.',
    why: 'High PIM means the player spends time in the box — hurting the team — though some physical players balance this with defensive value.' },
  { key: 'faceoffWinningPctg', label: 'FO%',         group: 'Ice Time',
    tip: 'Percentage of faceoffs won. Relevant mainly for centres.',
    calc: 'FO% = (Faceoffs Won / Total Faceoffs) × 100',
    why: 'Winning faceoffs gives your team puck possession. A rate above 50% is above average.' },
  { key: 'hits',               label: 'Hits',        group: 'Defensive',
    tip: 'Body checks delivered. Counted when a player legally separates an opponent from the puck.',
    why: 'Physical play disrupts opponents and can shift momentum, though elite defensive players aren\'t always hitters.' },
  { key: 'blockedShots',       label: 'Blocks',      group: 'Defensive',
    tip: 'Shots blocked by this player — positioned between the shooter and the net.',
    why: 'Shot blocking is a tangible defensive contribution, especially valued in the playoffs where teams tighten defensively.' },
  { key: 'takeaways',          label: 'TK',          group: 'Defensive',
    tip: 'Takeaways — times this player stripped the puck from an opponent.',
    why: 'Takeaways generate possession and transition chances. A high ratio of TK to GV signals a net-positive puck-battle player.' },
  { key: 'giveaways',          label: 'GV',          group: 'Defensive',
    tip: 'Giveaways — times this player lost the puck to an opponent.',
    why: 'Giveaways lead to odd-man rushes and scoring chances against. Lower is better — compare to TK for full picture.' },
]

// `otLosses`/`qualityStartPct` are deliberately NOT flagged `perGame` --
// otLosses because the game-log's `decision` field was only observed as
// `"W"`/`"L"` in the live sample checked (Session 70), not confirmed for
// the OT/SO-loss case; qualityStartPct because it's a threshold classifier
// (SV% ≥ .917, or ≥ .885 facing ≤20 shots) needing its own per-game
// classification logic, not just a field read -- narrower scope than the
// rest of this pass, left as a tile pending a follow-up.
export const GOALIE_STATS = [
  { key: 'gamesPlayed',   label: 'GP',   group: 'Record',
    tip: 'Games played.', why: 'Context for all other goalie stats.' },
  { key: 'wins',          label: 'W',    group: 'Record', perGame: true, cumulative: true, derive: 'win',
    tip: 'Wins — the starter in a winning game receives the win.',
    why: 'The primary measure of a goalie\'s team contribution, though win totals depend on the team in front of them.' },
  { key: 'losses',        label: 'L',    group: 'Record', perGame: true, cumulative: true, derive: 'loss',
    tip: 'Regulation losses.', why: 'Combined with OTL gives the full record picture.' },
  { key: 'otLosses',      label: 'OTL',  group: 'Record',
    tip: 'Overtime/shootout losses. The team earns 1 point; the goalie still receives a loss.',
    why: 'Goalies with many OTL often faced close games — neither good nor bad on its own.' },
  { key: 'savePctg',      label: 'SV%',  group: 'Performance', perGame: true,
    tip: 'Saves ÷ Shots Against. League average is roughly .910; elite is above .920.',
    calc: 'SV% = Saves / Shots Against',
    why: 'The most important single goalie stat. Even small differences are significant — .920 vs .900 = 2 extra goals allowed per 100 shots.' },
  { key: 'goalsAgainstAvg', label: 'GAA', group: 'Performance', perGame: true, derive: 'gaa',
    tip: 'Goals allowed per 60 minutes of play.',
    calc: 'GAA = (Goals Against / Minutes Played) × 60',
    why: 'Context-dependent — a goalie on a weak team will face more shots. Best read alongside SV%.' },
  { key: 'qualityStartPct', label: 'QS%', group: 'Performance',
    tip: 'Percentage of starts where the goalie posted a quality start — SV% ≥ .917, or ≥ .885 when facing 20 or fewer shots.',
    calc: 'QS% = Quality Starts / Games Started',
    why: 'Measures consistency. A "quality start" means the goalie gave his team a reasonable chance to win based on historical win rates at those SV% thresholds. League average is roughly 55%. Elite starters exceed 65%.' },
  { key: 'shotsAgainst',   label: 'SA',  group: 'Performance', perGame: true,
    tip: 'Shots on goal faced. Indicates workload.', why: 'High SA means the team gives up many chances; context for SV%.' },
  { key: 'saves',          label: 'SV',  group: 'Performance', perGame: true, derive: 'saves',
    tip: 'Total saves made.', why: 'Combined with SA gives the SV%.' },
  { key: 'shutouts',       label: 'SO',  group: 'Performance', perGame: true, cumulative: true,
    tip: 'Games where the goalie allowed zero goals (must play the full game).',
    why: 'A prestigious milestone. Elite goalies typically post 5–7 per full season.' },
  { key: 'gamesStarted',   label: 'GS',  group: 'Record', perGame: true, cumulative: true,
    tip: 'Games where the goalie started in net.',
    why: 'Distinguishes full-time starters from backups; relevant for season-long workload.' },
]

export function groupStats(defs, stats, _isGoalie) {
  const groups = {}
  defs.forEach(def => {
    const raw = stats?.[def.key]
    if (raw == null) return
    let fmt
    if (def.key === 'shootingPctg' || def.key === 'faceoffWinningPctg') {
      const n = parseFloat(raw)
      fmt = isNaN(n) ? '—' : (n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`)
    } else if (def.key === 'savePctg') {
      const n = parseFloat(raw)
      fmt = isNaN(n) ? '—' : (n <= 1 ? n.toFixed(3) : (n / 100).toFixed(3))
    } else if (def.key === 'goalsAgainstAvg' || def.key === 'gaa') {
      fmt = parseFloat(raw).toFixed(2)
    } else if (def.key === 'qualityStartPct') {
      const n = parseFloat(raw)
      fmt = isNaN(n) ? '—' : `${(n * 100).toFixed(1)}%`
    } else if (def.key === 'plusMinus') {
      const n = parseInt(raw)
      fmt = isNaN(n) ? '—' : (n >= 0 ? `+${n}` : `${n}`)
    } else if (def.key === 'avgToi' || def.key === 'toi') {
      if (typeof raw === 'string' && raw.includes(':')) fmt = raw
      else { const m = Math.floor(raw/60); const s = String(raw%60).padStart(2,'0'); fmt = `${m}:${s}` }
    } else {
      fmt = raw
    }
    if (!groups[def.group]) groups[def.group] = []
    groups[def.group].push({ def, value: raw, fmt })
  })
  return Object.entries(groups).map(([group, items]) => ({ group, items }))
}

export function posLabel(code) {
  return { C:'Centre', LW:'Left Wing', RW:'Right Wing', D:'Defence', G:'Goalie' }[code] || code
}

// Box-score stat keys (from SKATER_STATS above) that have a percentile
// counterpart in mpData.percentiles. PR #56 (eyewall-pipeline) added the 11
// entries below (GP, +/-, SHG, GWG, Shots, TOI/G, FO%, Hits, Blocks, TK,
// GV) -- previously these had no backing percentile column at all. The 5
// radar-only categories (ev_off, ev_def, pk, competition, teammates) are
// deliberately left out here -- they feed computeRadarAxes, not a tile.
export const STAT_PCT_MAP = {
  goals:              'goals',
  assists:            'a1',        // percentile is 1st-assists/60, not all-assist rate -- noted in the tile's info tip
  powerPlayPoints:    'pp',
  pim:                'penalties',
  shootingPctg:       'finishing',
  gamesPlayed:        'gamesPlayed',
  plusMinus:          'plusMinus',
  shorthandedGoals:   'shGoals',
  gameWinningGoals:   'gwGoals',
  shots:              'shots',
  avgToi:             'toiPerGame',
  faceoffWinningPctg: 'faceoffWinPct',
  hits:               'hits',
  blockedShots:       'blockedShots',
  takeaways:          'takeaways',
  giveaways:          'giveaways',
}

// Radar categories -- 5 composites decided from the 10 pct_* columns.
// Polarity check (done against eyewall-pipeline/moneypuck.py this session):
// ALL 10 pct_* categories are already normalized so higher percentile always
// = better performance before they ever reach the frontend -- ev_def and
// pk are stored as 1/xGA60 (inverted at the source), and penalties60 is
// -PIM/60 (negated at the source). So a flat "pct >= 50 good" read is safe
// for every category here; no per-category flip needed in this display layer.
//
// - Scoring: average of Goals/60 and Finishing percentiles.
// - Playmaking: 1st Assists/60 percentile alone (no secondary-assist data).
// - EV Play-Driving: EV Offence (on-ice xGF%) percentile alone.
// - Defense: EV Defence percentile alone. Deliberately NOT blending in PK
//   here (even though the task allowed it) because PK is already folded
//   into the Special Teams axis below -- reusing it in both places would
//   double-count a single metric and distort the radar's shape.
// - Special Teams: average of PP + PK percentiles when the player has a
//   reliable sample in at least one (min 300s TOI, per moneypuck.py). Many
//   depth players never see PP or PK time and would otherwise show a
//   permanently blank axis, so this composite falls back to the Penalties
//   (discipline) percentile when both PP and PK are null -- still a
//   "special teams / discipline" read, just discipline-only for players
//   who never see specialty-unit ice time.
export function computeRadarAxes(percentiles) {
  const p = percentiles || {}
  const avg = (...vals) => {
    const present = vals.filter(v => v != null)
    return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null
  }
  const scoring    = avg(p.goals?.pct, p.finishing?.pct)
  const playmaking = p.a1?.pct ?? null
  const evDriving  = p.evOff?.pct ?? null
  const defense    = p.evDef?.pct ?? null
  const specialTeams = (p.pp?.pct != null || p.pk?.pct != null)
    ? avg(p.pp?.pct, p.pk?.pct)
    : (p.penalties?.pct ?? null)

  return [
    { axis: 'Scoring',        value: scoring },
    { axis: 'Playmaking',     value: playmaking },
    { axis: 'EV Driving',     value: evDriving },
    { axis: 'Defense',        value: defense },
    { axis: 'Special Teams',  value: specialTeams },
  ].map(d => ({ ...d, hasData: d.value != null, value: d.value ?? 0 }))
}

// Goalie radar axes -- 6 raw percentile categories (no compositing needed,
// unlike skaters' 5-from-10 squeeze), sourced from the same PercentileBar
// list PlayerPopup.jsx's Analytics tab already renders for a single goalie
// (GSAX/GSAX60/5v5/HD/MD/PK SV%). New for Session 91 -- no goalie radar
// existed anywhere in the app before the player-vs-player comparison.
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

export const RADAR_AXIS_ABBR = {
  'Scoring':        'SCR',
  'Playmaking':     'PLM',
  'EV Driving':     'EVD',
  'Defense':        'DEF',
  'Special Teams':  'ST',
  'GSAX':           'GSAX',
  'GSAX/60':        'G60',
  '5v5 SV%':        '5v5',
  'HD SV%':         'HD',
  'MD SV%':         'MD',
  'PK SV%':         'PK',
}
