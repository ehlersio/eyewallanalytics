/**
 * PlayerPopup.jsx
 * Shared player detail modal used by PlayersView (CAR roster) and
 * LeagueView Leaders tab (any NHL player).
 *
 * Props:
 *   player       {object}  — minimum shape: { id, firstName, lastName, teamAbbrev }
 *                            PlayersView passes the full roster object which also
 *                            includes positionCode, sweaterNumber, headshot, shootsCatches.
 *   inPlayoffs   {boolean} — controls section ordering; pass false from LeagueView
 *   standings    {array}   — for rank calculation; pass [] from LeagueView
 *   onClose      {fn}      — close handler
 *   isLeagueContext {bool} — when true, hides CAR-specific tabs (Heat Map, Scout)
 *                            and the contract panel; keeps Stats + Analytics
 */

import { useState, useRef, useEffect } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getPlayerStats, fetchPlayerRankings, TEAM_CONFIG } from '../utils/nhlApi'
import {
  getPlayerAnalytics,
  getGoalieAnalytics,
  getPlayerShots,
  getGoalieShots,
  getScoutingBlurb,
} from '../utils/supabaseClient'
import { findContract, contractValue, pointsPer60, valueLabel, goalieContractValue, goalieValueLabel, CAP_CEILING } from '../utils/carContracts'
import IceRink from '../components/IceRink'
import InfoTip from '../components/InfoTip'
import '../views/PlayersView.css'

const SEASON       = Number(TEAM_CONFIG.season.slice(0, 4) + TEAM_CONFIG.season.slice(4))
const SEASON_LABEL = `${TEAM_CONFIG.season.slice(0, 4)}–${TEAM_CONFIG.season.slice(6)}`

// ─── Stat definitions ─────────────────────────────────────────

const SKATER_STATS = [
  { key: 'goals',              label: 'Goals',       group: 'Scoring',
    tip: 'Total goals scored. A goal is awarded when the puck fully crosses the opposing goal line.',
    why: 'The most direct measure of a player\'s finishing ability and offensive contribution.' },
  { key: 'assists',            label: 'Assists',     group: 'Scoring',
    tip: 'Points credited for setting up a goal. Up to two assists are awarded per goal.',
    why: 'Reflects a player\'s playmaking and vision. Some elite players accumulate far more assists than goals.' },
  { key: 'points',             label: 'Points',      group: 'Scoring',
    tip: 'Goals + Assists. The primary measure of offensive production.',
    why: 'The standard yardstick for comparing forwards and offensive defencemen across the league.' },
  { key: 'plusMinus',          label: '+/−',         group: 'Scoring',
    tip: '+1 when on ice for a 5v5 or 4v4 goal for; −1 when on ice for one against. PP/SH goals excluded.',
    why: 'A rough proxy for two-way effectiveness, though heavily influenced by linemates and usage.' },
  { key: 'gamesPlayed',        label: 'GP',          group: 'Scoring',
    tip: 'Games played in this sample.',
    why: 'Context for all counting stats — a player with 20 points in 25 games is more productive than 20 in 40.' },
  { key: 'powerPlayGoals',     label: 'PPG',         group: 'Special Teams',
    tip: 'Goals scored while your team has a man advantage (power play).',
    why: 'Power play specialists can have outsized PPG totals. Compare to even-strength goals for full picture.' },
  { key: 'powerPlayPoints',    label: 'PPP',         group: 'Special Teams',
    tip: 'Goals + Assists on the power play.',
    why: 'High PPP players are valuable on the man-advantage unit but may be less impactful at 5v5.' },
  { key: 'shorthandedGoals',   label: 'SHG',         group: 'Special Teams',
    tip: 'Goals scored while your team is shorthanded (penalty kill).',
    why: 'Rare and opportunistic — indicates speed and instinct.' },
  { key: 'gameWinningGoals',   label: 'GWG',         group: 'Special Teams',
    tip: 'The goal that proved to be the winning margin. If the final score is 4–2, the 3rd goal for the winner is the GWG.',
    why: 'A measure of clutch scoring, though partially luck-dependent.' },
  { key: 'shots',              label: 'Shots',       group: 'Shot Quality',
    tip: 'Shots on goal — shots that would have entered the net if not for the goalie.',
    why: 'High shot volume indicates an offensive presence even when not scoring.' },
  { key: 'shootingPctg',       label: 'S%',          group: 'Shot Quality',
    tip: 'Goals ÷ Shots on Goal × 100. League average for forwards is roughly 10–12%.',
    calc: 'S% = (Goals / Shots) × 100',
    why: 'Sustained high S% indicates elite finishing; very high or low rates often regress toward average over time.' },
  { key: 'avgToi',             label: 'TOI/G',       group: 'Ice Time',
    tip: 'Average time on ice per game (minutes:seconds).',
    why: 'Coaches allocate more ice time to trusted players. Elite forwards average 18–22 min; top D pairs often exceed 24 min.' },
  { key: 'pim',                label: 'PIM',         group: 'Ice Time',
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

const GOALIE_STATS = [
  { key: 'gamesPlayed',   label: 'GP',   group: 'Record',
    tip: 'Games played.', why: 'Context for all other goalie stats.' },
  { key: 'wins',          label: 'W',    group: 'Record',
    tip: 'Wins — the starter in a winning game receives the win.',
    why: 'The primary measure of a goalie\'s team contribution, though win totals depend on the team in front of them.' },
  { key: 'losses',        label: 'L',    group: 'Record',
    tip: 'Regulation losses.', why: 'Combined with OTL gives the full record picture.' },
  { key: 'otLosses',      label: 'OTL',  group: 'Record',
    tip: 'Overtime/shootout losses. The team earns 1 point; the goalie still receives a loss.',
    why: 'Goalies with many OTL often faced close games — neither good nor bad on its own.' },
  { key: 'savePctg',      label: 'SV%',  group: 'Performance',
    tip: 'Saves ÷ Shots Against. League average is roughly .910; elite is above .920.',
    calc: 'SV% = Saves / Shots Against',
    why: 'The most important single goalie stat. Even small differences are significant — .920 vs .900 = 2 extra goals allowed per 100 shots.' },
  { key: 'goalsAgainstAvg', label: 'GAA', group: 'Performance',
    tip: 'Goals allowed per 60 minutes of play.',
    calc: 'GAA = (Goals Against / Minutes Played) × 60',
    why: 'Context-dependent — a goalie on a weak team will face more shots. Best read alongside SV%.' },
  { key: 'qualityStartPct', label: 'QS%', group: 'Performance',
    tip: 'Percentage of starts where the goalie posted a quality start — SV% ≥ .917, or ≥ .885 when facing 20 or fewer shots.',
    calc: 'QS% = Quality Starts / Games Started',
    why: 'Measures consistency. A "quality start" means the goalie gave his team a reasonable chance to win based on historical win rates at those SV% thresholds. League average is roughly 55%. Elite starters exceed 65%.' },
  { key: 'shotsAgainst',   label: 'SA',  group: 'Performance',
    tip: 'Shots on goal faced. Indicates workload.', why: 'High SA means the team gives up many chances; context for SV%.' },
  { key: 'saves',          label: 'SV',  group: 'Performance',
    tip: 'Total saves made.', why: 'Combined with SA gives the SV%.' },
  { key: 'shutouts',       label: 'SO',  group: 'Performance',
    tip: 'Games where the goalie allowed zero goals (must play the full game).',
    why: 'A prestigious milestone. Elite goalies typically post 5–7 per full season.' },
  { key: 'gamesStarted',   label: 'GS',  group: 'Record',
    tip: 'Games where the goalie started in net.',
    why: 'Distinguishes full-time starters from backups; relevant for season-long workload.' },
]

// ─── Helpers ──────────────────────────────────────────────────

function groupStats(defs, stats, isGoalie) {
  const groups = {}
  defs.forEach(def => {
    let raw = stats?.[def.key]
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

function posLabel(code) {
  return { C:'Centre', LW:'Left Wing', RW:'Right Wing', D:'Defence', G:'Goalie' }[code] || code
}

// ─── Sub-components ───────────────────────────────────────────

function RankBadge({ label, rank }) {
  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'
  const color  = rank <= 3 ? 'var(--green)' : rank <= 10 ? 'var(--amber)' : 'var(--text-muted)'
  return (
    <div className="rank-badge">
      <span className="rank-num" style={{ color }}>{rank}<sup>{suffix}</sup></span>
      <span className="rank-scope">{label}</span>
    </div>
  )
}

function StatRow({ def, value }) {
  const [tipOpen, setTipOpen] = useState(false)
  const tipRef  = useRef(null)

  useEffect(() => {
    if (!tipOpen) return
    function close(e) { if (!tipRef.current?.contains(e.target)) setTipOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [tipOpen])

  return (
    <div className="stat-row">
      <div className="stat-row-left">
        <span className="stat-row-label">{def.label}</span>
        <div className="stat-tip-wrap" ref={tipRef}>
          <button className="stat-tip-btn" onClick={() => setTipOpen(o => !o)}
            aria-label={`Info about ${def.label}`}>ⓘ</button>
          {tipOpen && (
            <div className="stat-tip-popup">
              <div className="tip-title">{def.label}</div>
              <p className="tip-body">{def.tip}</p>
              {def.calc && <div className="tip-calc">{def.calc}</div>}
              {def.why && <p className="tip-why"><strong>Why it matters:</strong> {def.why}</p>}
            </div>
          )}
        </div>
      </div>
      <span className="stat-row-value">{value ?? '—'}</span>
    </div>
  )
}

function StatSection({ label, groups, highlight, isGoalie }) {
  const [open, setOpen] = useState(highlight)
  return (
    <div className={`stat-section ${highlight ? 'highlight-section' : ''}`}>
      <button className="stat-section-header" onClick={() => setOpen(o => !o)}>
        <span className="stat-section-label">{label}</span>
        {highlight && <span className="stat-section-current">Current</span>}
        <span className="stat-section-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="stat-section-body">
          {groups.map(({ group, items }) => (
            <div key={group} className="stat-group">
              <div className="stat-group-label">{group}</div>
              {items.map(({ def, value, fmt }) => (
                <StatRow key={def.key} def={def} value={fmt} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Heat Map ─────────────────────────────────────────────────

function PlayerHeatMap({ shotData, goalieShotData, playerName, isGoalie }) {
  const [filter, setFilter] = useState('all')
  const [mapMode, setMapMode] = useState('dots')

  if (isGoalie) {
    if (!goalieShotData) {
      return (
        <div className="pp-heatmap-empty">
          <div className="pp-heatmap-icon">🥅</div>
          <div>No shot data yet.</div>
          <div className="pp-heatmap-sub">Data builds up as games complete.</div>
        </div>
      )
    }

    const shots  = goalieShotData.shots || []
    const goals  = shots.filter(s => s.t === 'g').length
    const saves  = shots.filter(s => s.t === 's').length
    const total  = goals + saves
    const svPct  = total > 0 ? (saves / total).toFixed(3) : '—'

    const ZONES = [
      { id: 'slot_hi',   label: 'High slot',    test: s => Math.abs(s.y) <= 22 && s.x >= 55 && s.x < 75 },
      { id: 'slot_lo',   label: 'Low slot',     test: s => Math.abs(s.y) <= 22 && s.x >= 75 },
      { id: 'left_hi',   label: 'Left circle',  test: s => s.y < -10 && s.x >= 55 && s.x < 80 },
      { id: 'right_hi',  label: 'Right circle', test: s => s.y > 10  && s.x >= 55 && s.x < 80 },
      { id: 'left_lo',   label: 'Left wing',    test: s => s.y < -22 && s.x >= 55 },
      { id: 'right_lo',  label: 'Right wing',   test: s => s.y > 22  && s.x >= 55 },
      { id: 'perimeter', label: 'Perimeter',    test: s => s.x < 55 },
    ]

    const zoneStats = ZONES.map(z => {
      const zShots = shots.filter(s => z.test(s))
      const zGoals = zShots.filter(s => s.t === 'g').length
      const zSaves = zShots.filter(s => s.t === 's').length
      const zTotal = zGoals + zSaves
      const zSvPct = zTotal >= 5 ? (zSaves / zTotal) : null
      return { ...z, goals: zGoals, saves: zSaves, total: zTotal, svPct: zSvPct }
    })

    function svColor(pct) {
      if (pct == null) return 'transparent'
      if (pct >= 0.960) return '#1D9E75'
      if (pct >= 0.930) return '#5DCAA5'
      if (pct >= 0.900) return '#FAC775'
      if (pct >= 0.860) return '#EF9F27'
      return '#E24B4A'
    }

    const ZONE_RECTS = {
      slot_hi:   { x: 105, y: 45,  w: 90, h: 48 },
      slot_lo:   { x: 105, y: 93,  w: 90, h: 45 },
      left_hi:   { x: 35,  y: 40,  w: 70, h: 53 },
      right_hi:  { x: 195, y: 40,  w: 70, h: 53 },
      left_lo:   { x: 25,  y: 93,  w: 80, h: 45 },
      right_lo:  { x: 195, y: 93,  w: 80, h: 45 },
      perimeter: { x: 25,  y: 138, w: 250,h: 40 },
    }

    const dotFiltered = filter === 'goals' ? shots.filter(s => s.t === 'g')
      : filter === 'saves' ? shots.filter(s => s.t === 's')
      : shots.filter(s => s.t === 'g' || s.t === 's')

    function toSvg(nx, ny) {
      const svgX = 150 + (ny / 42.5) * 125
      const svgY = 30  + ((89 - nx) / 34) * 148
      return { sx: Math.round(svgX), sy: Math.round(svgY) }
    }

    return (
      <div className="pp-heatmap">
        <div className="pp-heatmap-summary">
          <div className="pp-heatmap-stat"><span className="pp-heatmap-num goal-col">{goals}</span><span>Goals</span></div>
          <div className="pp-heatmap-stat"><span className="pp-heatmap-num sog-col">{saves}</span><span>Saves</span></div>
          <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{total}</span><span>Shots faced</span></div>
          <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{svPct}</span><span>SV%</span></div>
        </div>
        <div className="pp-heatmap-filters" style={{ marginBottom: 6 }}>
          <button className={`pp-heatmap-chip ${mapMode === 'dots' ? 'active' : ''}`} onClick={() => setMapMode('dots')}>Dot map</button>
          <button className={`pp-heatmap-chip ${mapMode === 'zones' ? 'active' : ''}`} onClick={() => setMapMode('zones')}>Zone SV%</button>
        </div>
        {mapMode === 'dots' && (
          <div className="pp-heatmap-filters">
            {[
              { key: 'all',   label: `All (${total})` },
              { key: 'goals', label: `Goals (${goals})` },
              { key: 'saves', label: `Saves (${saves})` },
            ].map(f => (
              <button key={f.key} className={`pp-heatmap-chip ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        )}
        {mapMode === 'zones' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6, fontSize: 11 }}>
            {[['#1D9E75','.960+'],['#5DCAA5','.930+'],['#FAC775','.900+'],['#EF9F27','.860+'],['#E24B4A','<.860']].map(([c,l]) => (
              <span key={l} style={{ display:'flex', alignItems:'center', gap:4, color:'var(--text-muted)' }}>
                <span style={{ width:10, height:10, borderRadius:2, background:c, display:'inline-block' }}></span>{l}
              </span>
            ))}
            <span style={{ color:'var(--text-dim)', marginLeft:'auto' }}>min 5 shots</span>
          </div>
        )}
        <div className="pp-heatmap-rink">
          <svg viewBox="0 0 300 230" width="100%" xmlns="http://www.w3.org/2000/svg" style={{ display:'block' }}>
            <rect x="20" y="10" width="260" height="205" rx="12" fill="#d6eaf5" stroke="#9ab8cc" strokeWidth="1" />
            <rect x="133" y="10" width="34" height="14" rx="2" fill="rgba(204,34,0,0.08)" stroke="#cc2200" strokeWidth="1.5" />
            <line x1="35" y1="24" x2="265" y2="24" stroke="#E24B4A" strokeWidth="1.5" opacity="0.7" />
            <path d="M 128 24 A 22 18 0 0 0 172 24" fill="#378ADD" fillOpacity="0.2" stroke="#378ADD" strokeWidth="1" />
            <line x1="20" y1="178" x2="280" y2="178" stroke="#378ADD" strokeWidth="1.5" opacity="0.5" />
            <circle cx="90" cy="88" r="3.5" fill="#E24B4A" opacity="0.5" />
            <circle cx="210" cy="88" r="3.5" fill="#E24B4A" opacity="0.5" />
            <circle cx="90" cy="88" r="30" fill="none" stroke="#E24B4A" strokeWidth="0.7" opacity="0.25" />
            <circle cx="210" cy="88" r="30" fill="none" stroke="#E24B4A" strokeWidth="0.7" opacity="0.25" />
            {mapMode === 'zones' ? (
              <>
                {zoneStats.map(z => {
                  const r = ZONE_RECTS[z.id]
                  const col = svColor(z.svPct)
                  return (
                    <g key={z.id}>
                      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="3"
                        fill={col} opacity={z.svPct != null ? 0.55 : 0.08}
                        stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                      {z.svPct != null && (
                        <>
                          <text x={r.x + r.w/2} y={r.y + r.h/2 - 4} textAnchor="middle"
                            fontSize="12" fontWeight="700" fill="#111"
                            style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.9))' }}>
                            .{Math.round(z.svPct * 1000)}
                          </text>
                          <text x={r.x + r.w/2} y={r.y + r.h/2 + 11} textAnchor="middle"
                            fontSize="9" fontWeight="600" fill="#333"
                            style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.9))' }}>
                            {z.total} shots
                          </text>
                        </>
                      )}
                      {z.svPct == null && z.total > 0 && (
                        <text x={r.x + r.w/2} y={r.y + r.h/2 + 4} textAnchor="middle"
                          fontSize="9" fontWeight="600" fill="#333"
                          style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.9))' }}>
                          {z.total} shots
                        </text>
                      )}
                    </g>
                  )
                })}
              </>
            ) : (
              <>
                {dotFiltered.map((s, i) => {
                  const { sx, sy } = toSvg(s.x, s.y || 0)
                  if (sy < 10 || sy > 225 || sx < 10 || sx > 290) return null
                  return (
                    <circle key={i} cx={sx} cy={sy} r={s.t === 'g' ? 4.5 : 3.5}
                      fill={s.t === 'g' ? '#E24B4A' : '#1D9E75'}
                      opacity={s.t === 'g' ? 0.85 : 0.45} />
                  )
                })}
              </>
            )}
            <text x="150" y="224" textAnchor="middle" fontSize="9" fill="var(--text-dim)">
              Shooter perspective · green = save · red = goal
            </text>
          </svg>
        </div>
      </div>
    )
  }

  // Skater heat map
  if (!shotData) {
    return (
      <div className="pp-heatmap-empty">
        <div className="pp-heatmap-icon">🎯</div>
        <div>No season shot data yet.</div>
        <div className="pp-heatmap-sub">Data builds up as games complete.</div>
      </div>
    )
  }

  const shots = shotData.shots || []
  const typeMap = { g: 'goal', s: 'shot-on-goal', m: 'missed-shot', b: 'blocked-shot' }
  const allEvents = shots.map((s, i) => ({
    id: i, x: s.x, y: s.y,
    type: typeMap[s.t] || 'shot-on-goal',
    period: s.p, shotType: s.st,
    isCanes: true, shooterId: 'player',
  }))

  const filtered = filter === 'all'   ? allEvents
    : filter === 'goals'  ? allEvents.filter(e => e.type === 'goal')
    : filter === 'sog'    ? allEvents.filter(e => e.type === 'shot-on-goal')
    : filter === 'missed' ? allEvents.filter(e => e.type === 'missed-shot')
    : allEvents

  const goals   = allEvents.filter(e => e.type === 'goal').length
  const sog     = allEvents.filter(e => e.type === 'shot-on-goal').length
  const missed  = allEvents.filter(e => e.type === 'missed-shot').length
  const blocked = allEvents.filter(e => e.type === 'blocked-shot').length
  const total   = allEvents.length
  const sh      = (goals + sog) > 0 ? ((goals / (goals + sog)) * 100).toFixed(1) : '—'

  return (
    <div className="pp-heatmap">
      <div className="pp-heatmap-summary">
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num goal-col">{goals}</span><span>Goals</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num sog-col">{sog}</span><span>SOG</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{missed}</span><span>Missed</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{total}</span><span>Total</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{sh}%</span><span>SH%</span></div>
        {shotData.games && <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{shotData.games}</span><span>Games</span></div>}
      </div>
      <div className="pp-heatmap-filters">
        {[
          { key: 'all',    label: `All (${total})` },
          { key: 'goals',  label: `Goals (${goals})` },
          { key: 'sog',    label: `SOG (${sog})` },
          { key: 'missed', label: `Missed (${missed})` },
        ].map(f => (
          <button key={f.key} className={`pp-heatmap-chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      <div className="pp-heatmap-rink">
        <IceRink events={filtered} roster={{}} hidePlayerFilter />
      </div>
    </div>
  )
}

// ─── Analytics ────────────────────────────────────────────────

function PercentileBar({ label, pct, note, na }) {
  if (na || pct == null) {
    const naNote = note || `${label} data unavailable — player may not have enough ice time in this situation to generate a reliable percentile.`
    return (
      <div className="pa-row">
        <span className="pa-label">
          {label}
          {naNote && <InfoTip text={naNote} position="above" />}
        </span>
        <span className="pa-na">N/A</span>
      </div>
    )
  }
  const color = pct >= 67 ? '#4ade80' : pct >= 34 ? '#fbbf24' : '#f87171'
  const tier  = pct >= 90 ? 'Elite' : pct >= 75 ? 'Great' : pct >= 50 ? 'Above avg'
              : pct >= 25 ? 'Below avg' : 'Poor'
  return (
    <div className="pa-row">
      <span className="pa-label">
        {label}
        {note && <InfoTip text={note} position="above" />}
      </span>
      <div className="pa-bar-wrap">
        <div className="pa-bar-track">
          <div className="pa-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="pa-pct" style={{ color }}>{pct}th</span>
        <span className="pa-tier" style={{ color }}>{tier}</span>
      </div>
    </div>
  )
}

function PlayerAnalytics({ mpData, goalieData, playerName, isGoalie, position }) {
  if (isGoalie) {
    if (!goalieData) {
      return (
        <div className="pp-heatmap-empty">
          <div className="pp-heatmap-icon">🥅</div>
          <div>Analytics data not yet available.</div>
          <div className="pp-heatmap-sub">Updates daily from MoneyPuck.</div>
        </div>
      )
    }
    const { gsax, gsax60, gp, evSvPct, hdSvPct, mdSvPct, pkSvPct, percentiles: p } = goalieData
    const gsaxColor = gsax >= 5 ? '#4ade80' : gsax >= 0 ? '#fbbf24' : '#f87171'
    const gsaxLabel = gsax >= 10 ? 'Elite' : gsax >= 5 ? 'Above average' : gsax >= 0 ? 'Average' : 'Below average'
    return (
      <div className="pa-wrap">
        <div className="pa-war-card">
          <div className="pa-war-main">
            <span className="pa-war-num" style={{ color: gsaxColor }}>{gsax > 0 ? '+' : ''}{gsax}</span>
            <span className="pa-war-label">GSAX</span>
          </div>
          <div className="pa-war-meta">
            <span style={{ color: gsaxColor }}>{gsaxLabel}</span>
            <span className="pa-war-sub">{gp} GP · {gsax60 != null ? `${gsax60 > 0 ? '+' : ''}${gsax60} per 60` : ''}</span>
            <span className="pa-war-sub" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
              Goals saved above expected — flurry-adjusted xGoals model
            </span>
          </div>
        </div>
        <div className="pa-context pa-context-centered">
          {evSvPct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{evSvPct}%</span><span className="pa-ctx-label">5on5 SV% <InfoTip text="Save percentage at even strength (5-on-5 only). Removes special teams situations which can skew overall SV%. The most stable indicator of true goaltending ability." position="above" /></span></div>}
          {hdSvPct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{hdSvPct}%</span><span className="pa-ctx-label">HD SV% <InfoTip text="Save percentage on high-danger shots — taken within ~15 feet of the net. The hardest shots to stop; the best quality-adjusted goalie metric." position="above" /></span></div>}
          {mdSvPct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{mdSvPct}%</span><span className="pa-ctx-label">MD SV% <InfoTip text="Save percentage on medium-danger shots (15–30 feet from net). Complements HD SV% for a fuller picture of save quality across shot locations." position="above" /></span></div>}
          {pkSvPct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{pkSvPct}%</span><span className="pa-ctx-label">PK SV% <InfoTip text="Save percentage while shorthanded. Penalty kill goaltending requires different positioning — some goalies are significantly better or worse in this situation than at even strength." position="above" /></span></div>}
        </div>
        <div className="pa-section-label">Percentile rankings vs all NHL goalies</div>
        <div className="pa-bars">
          <PercentileBar label="GSAX"            pct={p.gsax?.pct}   note={p.gsax?.note} />
          <PercentileBar label="GSAX/60"         pct={p.gsax60?.pct} note={p.gsax60?.note} />
          <PercentileBar label="5-on-5 SV%"      pct={p.evSv?.pct}   note={p.evSv?.note} />
          <PercentileBar label="High Danger SV%" pct={p.hdSv?.pct}   note={p.hdSv?.note} />
          <PercentileBar label="Med Danger SV%"  pct={p.mdSv?.pct}   note={p.mdSv?.note} />
          <PercentileBar label="PK SV%"          pct={p.pkSv?.pct}   note={p.pkSv?.note} />
        </div>
        <div className="pa-source">Data: MoneyPuck.com · Updates nightly</div>
      </div>
    )
  }

  if (!mpData) {
    return (
      <div className="pp-heatmap-empty">
        <div className="pp-heatmap-icon">🧮</div>
        <div>Analytics data not yet available.</div>
        <div className="pp-heatmap-sub">Updates daily from MoneyPuck.</div>
      </div>
    )
  }

  const { war, percentiles, gp, xGF_pct, xGF60, xGA60, hdca60, goals60, a1_60, ppToi, pkToi, gameScore } = mpData
  const pos      = ['C','L','R','F'].includes(position) ? 'F' : 'D'
  const posLbl   = pos === 'F' ? 'forwards' : 'defensemen'
  const p        = percentiles || {}
  const fmtToi   = (mins) => { if (mins == null) return null; const m = Math.floor(mins); const s = Math.round((mins - m) * 60); return `${m}:${String(s).padStart(2, '0')}` }
  const warColor = war >= 2 ? '#4ade80' : war >= 0.5 ? '#fbbf24' : '#f87171'
  const warLabel = war >= 4 ? 'MVP candidate' : war >= 2 ? 'Top player'
    : war >= 0.5 ? 'Solid contributor' : war >= -0.5 ? 'Replacement level' : 'Below replacement'

  return (
    <div className="pa-wrap">
      <div className="pa-war-card">
        <div className="pa-war-main">
          <span className="pa-war-num" style={{ color: warColor }}>{war > 0 ? '+' : ''}{war}</span>
          <span className="pa-war-label">
            WAR
            <InfoTip text="Wins Above Replacement (beta). EV component uses 5v5 RAPM — ridge regression across 3 seasons of league-wide shift and shot data, controlling for teammates and opponents. PP/PK and finishing components are xGoals-based from MoneyPuck. RAPM is 5v5 only; special teams remain approximate. Zone-start adjustment in development — defensive defensemen may be slightly undervalued in current model. Validated periodically vs Evolving Hockey public RAPM." position="above" />
          </span>
        </div>
        <div className="pa-war-meta">
          <span style={{ color: warColor }}>{warLabel}</span>
          <span className="pa-war-sub">{gp} GP · Game Score {gameScore}</span>
          <span className="pa-war-sub" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
            5v5 RAPM (beta) + PP/PK/finishing components
          </span>
        </div>
      </div>
      <div className="pa-context">
        {xGF_pct != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{xGF_pct}%</span><span className="pa-ctx-label">EV xGF% <InfoTip text="On-ice expected goals for % at 5-on-5. The share of total shot quality generated while this player is on the ice — above 50% means the team outshoots opponents in quality with him on the ice. Team metric, not individual." position="above" /></span></div>}
        {xGF60  != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{xGF60}</span><span className="pa-ctx-label">xGF/60 <InfoTip text="Individual expected goals generated per 60 minutes — the shot quality this player personally produces, based on shot location and type. Measures how dangerous their own shots are, independent of linemates." position="above" /></span></div>}
        {xGA60  != null && <div className="pa-ctx-item"><span className="pa-ctx-val" style={{ color: xGA60 < 2.0 ? 'var(--green)' : xGA60 > 2.8 ? 'var(--red-bright)' : 'inherit' }}>{xGA60}</span><span className="pa-ctx-label">xGA/60 <InfoTip text="On-ice expected goals against per 60 minutes at 5-on-5. Measures how many quality chances opponents generate while this player is on the ice — lower is better. Team metric reflecting the full line's defensive performance." position="above" /></span></div>}
        {hdca60 != null && <div className="pa-ctx-item"><span className="pa-ctx-val" style={{ color: hdca60 < 7 ? 'var(--green)' : hdca60 > 10 ? 'var(--red-bright)' : 'inherit' }}>{hdca60}</span><span className="pa-ctx-label">HDCA/60 <InfoTip text="High-danger chances against per 60 minutes at 5-on-5. Shots from the slot and crease — the most likely to result in goals. Lower is better." position="above" /></span></div>}
        {goals60!= null && <div className="pa-ctx-item"><span className="pa-ctx-val">{goals60}</span><span className="pa-ctx-label">G/60 <InfoTip text="Goals scored per 60 minutes of ice time. Rate-adjusts for playing time so a player with 15 min/game and one with 22 min/game can be compared fairly." position="above" /></span></div>}
        {a1_60  != null && <div className="pa-ctx-item"><span className="pa-ctx-val">{a1_60}</span><span className="pa-ctx-label">A1/60 <InfoTip text="Primary (first) assists per 60 minutes. First assists directly set up the goal scorer and are more meaningful than secondary assists, which can be coincidental." position="above" /></span></div>}
        {ppToi != null && ppToi > 0 && <div className="pa-ctx-item"><span className="pa-ctx-val">{fmtToi(ppToi)}</span><span className="pa-ctx-label">PP TOI <InfoTip text="Power play ice time this season. Presence here means the player has enough PP time for a reliable PP metric — see the Power Play percentile bar below." position="above" /></span></div>}
        {pkToi != null && pkToi > 0 && <div className="pa-ctx-item"><span className="pa-ctx-val">{fmtToi(pkToi)}</span><span className="pa-ctx-label">PK TOI <InfoTip text="Penalty kill ice time this season. Presence here means the player has enough PK time for a reliable PK metric — see the Penalty Kill percentile bar below." position="above" /></span></div>}
      </div>
      <div className="pa-section-label">Percentile rankings vs all NHL {posLbl}</div>
      <div className="pa-bars">
        <PercentileBar label="EV Offence"    pct={p.evOff?.pct}     note={p.evOff?.note} />
        <PercentileBar label="EV Defence"    pct={p.evDef?.pct}     note={p.evDef?.note} />
        <PercentileBar label="Power Play"    pct={p.pp?.pct}        note={p.pp?.note}    na={p.pp?.pct == null} />
        <PercentileBar label="Penalty Kill"  pct={p.pk?.pct}        note={p.pk?.note}    na={p.pk?.pct == null} />
        <PercentileBar label="Finishing"     pct={p.finishing?.pct} note={p.finishing?.note} />
        <PercentileBar label="Goals"         pct={p.goals?.pct}     note={p.goals?.note} />
        <PercentileBar label="1st Assists"   pct={p.a1?.pct}        note={p.a1?.note} />
        <PercentileBar label="Penalties"     pct={p.penalties?.pct} note={p.penalties?.note} />
        <PercentileBar label="Competition"   pct={p.comp?.pct}      note={p.comp?.note} />
        <PercentileBar label="Teammates"     pct={p.teammates?.pct} note={p.teammates?.note} />
      </div>
      <div className="pa-source">Data: MoneyPuck.com · Updates nightly</div>
    </div>
  )
}

// ─── Scouting Blurb ───────────────────────────────────────────

function ScoutingBlurb({ data, playerName }) {
  if (data === undefined) {
    return (
      <div className="scout-wrap">
        <div className="scout-loading">
          {[95, 88, 72, 90, 65].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 11, width: `${w}%`, marginBottom: 10, borderRadius: 4 }} />
          ))}
        </div>
      </div>
    )
  }
  if (!data?.blurb) {
    return (
      <div className="scout-wrap">
        <div className="scout-empty">
          <div className="scout-empty-icon">📋</div>
          <div>No scouting report yet for {playerName}.</div>
          <div className="scout-empty-sub">Reports generate nightly — check back after the next pipeline run.</div>
        </div>
      </div>
    )
  }
  function fmtDate(iso) {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return (
    <div className="scout-wrap">
      <div className="scout-header">
        <span className="scout-label">Scouting Report</span>
        <span className="scout-season">2025–26</span>
      </div>
      <div className="scout-blurb">{data.blurb}</div>
      <div className="scout-footer">
        AI-generated · Updated nightly
        {data.generatedAt && ` · ${fmtDate(data.generatedAt)}`}
      </div>
    </div>
  )
}

// ─── PlayerPopup ──────────────────────────────────────────────

export default function PlayerPopup({ player: p, inPlayoffs, standings, onClose, isLeagueContext = false }) {
  const { data: stats, loading } = useFetch(() => p.id ? getPlayerStats(p.id) : Promise.resolve(null), [p.id])
  const [imgErr, setImgErr]     = useState(false)

  // In league context only show Stats + Analytics; in roster context show all four
  const defaultTab = 'stats'
  const [ppTab, setPpTab] = useState(defaultTab)

  const { data: scoutData } = useFetch(
    () => !isLeagueContext ? getScoutingBlurb(p.id, SEASON) : Promise.resolve(undefined),
    [p.id, isLeagueContext]
  )

  // headshot: prefer from stats response (always populated), fall back to roster object
  const name     = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim()
  const isGoalie = p.positionCode === 'G'

  // Shot data — only fetch in CAR roster context
  const { data: shotData } = useFetch(
    () => !isLeagueContext ? getPlayerShots(p.id, undefined, TEAM_CONFIG.abbr) : Promise.resolve(null),
    [p.id, isLeagueContext]
  )
  const { data: goalieShotData } = useFetch(
    () => (!isLeagueContext && isGoalie) ? getGoalieShots(p.id) : Promise.resolve(null),
    [p.id, isGoalie, isLeagueContext]
  )

  const { data: mpAll } = useFetch(() => getPlayerAnalytics(), [])
  const mpData = mpAll?.[String(p.id)] || null

  const { data: goalieAll } = useFetch(() => getGoalieAnalytics(), [])
  const goalieData = goalieAll?.[String(p.id)] || null

  const seasonPO  = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 3)
  const seasonReg = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 2)
  const careerPO  = stats?.careerTotals?.playoffs
  const careerReg = stats?.careerTotals?.regularSeason

  // Rankings — skip in league context (requires team/division membership we don't have)
  const { data: rankings } = useFetch(
    () => (!isLeagueContext && stats && standings?.length)
      ? fetchPlayerRankings(p.id, isGoalie, inPlayoffs, p.teamAbbrev || TEAM_CONFIG.abbr, standings)
      : Promise.resolve(null),
    [p.id, !!stats, !!standings?.length, inPlayoffs, isLeagueContext]
  )

  const sections = inPlayoffs
    ? [
        { label: `${SEASON_LABEL} Playoffs`,          stats: seasonPO,  highlight: true },
        { label: 'Career Playoffs',                    stats: careerPO,  highlight: false },
        { label: `${SEASON_LABEL} Regular season`,     stats: seasonReg, highlight: false },
        { label: 'Career Regular season',              stats: careerReg, highlight: false },
      ]
    : [
        { label: `${SEASON_LABEL} Regular season`,     stats: seasonReg, highlight: true },
        { label: `${SEASON_LABEL} Playoffs`,           stats: seasonPO,  highlight: false },
        { label: 'Career Regular season',              stats: careerReg, highlight: false },
        { label: 'Career Playoffs',                    stats: careerPO,  highlight: false },
      ]

  const statDefs = isGoalie ? GOALIE_STATS : SKATER_STATS

  function fmtHeight(inches) {
    if (!inches) return null
    return `${Math.floor(inches / 12)}′${inches % 12}″`
  }
  function fmtBirth(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
  function calcAge(dateStr) {
    if (!dateStr) return null
    const today = new Date(), dob = new Date(dateStr)
    let age = today.getFullYear() - dob.getFullYear()
    if (today.getMonth() < dob.getMonth() ||
        (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--
    return age
  }

  const bio      = stats || p
  // Only look up contract for CAR roster context
  const contract = !isLeagueContext ? findContract(p.id, p.lastName?.default) : null

  // Derive positionCode from stats if not on the player object (league context)
  const positionCode = p.positionCode || stats?.position || null

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="player-popup" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pp-header">
          <div className="pp-photo-wrap">
            {!imgErr && (stats?.headshot || p.headshot) ? (
              <img src={stats?.headshot || p.headshot} alt={name}
                className="pp-photo" onError={() => setImgErr(true)} />
            ) : (
              <div className="pp-photo-fallback">
                {(p.firstName?.default?.[0] || '') + (p.lastName?.default?.[0] || '')}
              </div>
            )}
          </div>
          <div className="pp-identity">
            {p.sweaterNumber && <div className="pp-num">#{p.sweaterNumber}</div>}
            <div className="pp-name">
              <span className="pp-first">{p.firstName?.default}</span>
              <span className="pp-last">{p.lastName?.default}</span>
            </div>
            <div className="pp-chips">
              {positionCode && <span className="pp-pos-chip">{posLabel(positionCode)}</span>}
              {/* In league context show team abbrev as a chip */}
              {isLeagueContext && p.teamAbbrev && (
                <span className="pp-chip">{p.teamAbbrev}</span>
              )}
              {bio.heightInInches && <span className="pp-chip">{fmtHeight(bio.heightInInches)}</span>}
              {bio.weightInPounds && <span className="pp-chip">{bio.weightInPounds} lbs</span>}
              {p.shootsCatches && (
                <span className="pp-chip">{isGoalie ? 'Catches' : 'Shoots'} {p.shootsCatches === 'L' ? 'Left' : 'Right'}</span>
              )}
            </div>
            {bio.birthDate && (
              <div className="pp-birth">
                {fmtBirth(bio.birthDate)} · Age {calcAge(bio.birthDate)}
                {bio.birthCity?.default && ` · ${bio.birthCity.default}`}
                {bio.birthCountry && `, ${bio.birthCountry}`}
              </div>
            )}
          </div>
          <button className="pp-close" onClick={onClose} aria-label="Close player details">✕</button>
        </div>

        {/* ── Rankings banner — CAR context only ── */}
        {!isLeagueContext && rankings && (rankings.division || rankings.conference || rankings.league) && (
          <div className="pp-rankings">
            <span className="pp-rank-label">Ranked by {rankings.statLabel}</span>
            <div className="pp-rank-items">
              {rankings.division   && <RankBadge label="Division"   rank={rankings.division} />}
              {rankings.conference && <RankBadge label="Conference" rank={rankings.conference} />}
              {rankings.league     && <RankBadge label="League"     rank={rankings.league} />}
            </div>
            {rankings.gaa && (rankings.gaa.league || rankings.gaa.division) && (
              <>
                <span className="pp-rank-label" style={{ marginTop: 8 }}>Ranked by GAA</span>
                <div className="pp-rank-items">
                  {rankings.gaa.division   && <RankBadge label="Division"   rank={rankings.gaa.division} />}
                  {rankings.gaa.conference && <RankBadge label="Conference" rank={rankings.gaa.conference} />}
                  {rankings.gaa.league     && <RankBadge label="League"     rank={rankings.gaa.league} />}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Contract & value panel — CAR context only ── */}
        {!isLeagueContext && contract && (
          <div className="pp-contract">
            <div className="pp-contract-row">
              <div className="pp-contract-item">
                <div className="pp-contract-label">Cap Hit</div>
                <div className="pp-contract-val">${(contract.capHit / 1_000_000).toFixed(2)}M</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">AAV / Year</div>
                <div className="pp-contract-val">${(contract.capHit / 1_000_000).toFixed(2)}M</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">Expires After</div>
                <div className="pp-contract-val">{contract.expiresAfter}</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">Status</div>
                <div className="pp-contract-val">{contract.type}{contract.note ? ` · ${contract.note}` : ''}</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">Yrs Left</div>
                <div className="pp-contract-val">{contract.yearsLeft}</div>
              </div>
              <div className="pp-contract-item">
                <div className="pp-contract-label">% of Cap</div>
                <div className="pp-contract-val">{((contract.capHit / CAP_CEILING) * 100).toFixed(1)}%</div>
              </div>
            </div>
            {(() => {
              const regStats = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 2)
              const pts   = regStats?.points ?? 0
              const gp    = regStats?.gamesPlayed ?? 0
              const isELC = contract.note === 'ELC' || contract.capHit < 1_200_000
              const war   = mpData?.war ?? null
              const result = !isGoalie && gp > 0 ? contractValue(pts, gp, contract.capHit, isELC, war) : null
              const score  = result?.score ?? null
              const method = result?.method ?? 'points'
              const vl     = valueLabel(score)
              const p60    = !isGoalie && regStats?.avgToi
                ? pointsPer60(pts, (regStats.avgToi?.includes?.(':')
                    ? regStats.avgToi.split(':').reduce((m,s,i) => i===0 ? +s*60 : m + +s, 0)
                    : Number(regStats.avgToi)) * gp)
                : null
              const valueTooltip = method === 'blended'
                ? `Blended score: 60% points per $1M (projected to 82 GP) + 40% WAR per $1M (scaled). WAR uses 5v5 RAPM (beta) + PP/PK/finishing components — captures two-way value points miss. Defensive specialists and shutdown players score higher here than on a pure points basis. Scale: ≥8.0 Exceptional · ≥5.0 Great · ≥3.0 Good · ≥1.8 Fair · ≥1.0 Below avg · <1.0 Overpaid. ELC contracts excluded.`
                : `Points per $1M of cap hit (projected to 82 games). WAR data unavailable for this player — using points only. Scale: ≥8.0 Exceptional · ≥5.0 Great · ≥3.0 Good · ≥1.8 Fair · ≥1.0 Below avg · <1.0 Overpaid. ELC contracts excluded.`
              return (
                <div className="pp-value-row">
                  {score != null && vl && (
                    <div className="pp-value-badge" style={{ background: vl.color + '22', borderColor: vl.color + '55', color: vl.color }}>
                      <span>{vl.label}</span>
                      <span className="pp-value-score">{score} {method === 'blended' ? 'blended/$M' : 'pts/$M'}</span>
                      <InfoTip label="Contract Value Score" text={valueTooltip} />
                    </div>
                  )}
                  {p60 != null && (
                    <div className="pp-adv-chip">P/60: <strong>{p60}</strong>
                      <InfoTip label="P/60" text="Points per 60 minutes of ice time. Removes ice time differences — a player with 10 pts in 12 min/game produces at a very different rate than 10 pts in 22 min/game. League avg for top-6 forwards: ~2.0–3.5." />
                    </div>
                  )}
                  {isELC && !isGoalie && (
                    <div className="pp-adv-chip" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      ELC — value score N/A
                      <InfoTip label="ELC Contract" text="Entry Level Contracts have a league-mandated cap hit ($775K–$925K) that doesn't reflect market value, so the blended value comparison isn't meaningful." />
                    </div>
                  )}
                  {isGoalie && (() => {
                    const gsax   = goalieData?.gsax ?? null
                    const gGp    = goalieData?.gp ?? 0
                    const isELC  = contract.note === 'ELC' || contract.capHit < 1_200_000
                    const gScore = goalieContractValue(gsax, gGp, contract.capHit, isELC)
                    const gVl    = goalieValueLabel(gScore)
                    if (!gScore || !gVl) return isELC ? (
                      <div className="pp-adv-chip" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        ELC — value score N/A
                        <InfoTip label="ELC Contract" text="ELC cap hits are league-mandated and don't reflect market value." />
                      </div>
                    ) : null
                    return (
                      <div className="pp-value-badge" style={{ background: gVl.color + '22', borderColor: gVl.color + '55', color: gVl.color }}>
                        <span>{gVl.label}</span>
                        <span className="pp-value-score">GSAX {gScore > 0 ? '+' : ''}{gScore}/$M</span>
                        <InfoTip label="Goalie Value Score" text="Goals saved above expected (GSAX) per $1M of cap hit. GSAX accounts for shot quality and volume — a positive number means the goalie saved more goals than an average goalie would have on the same shots. Dividing by cap hit shows how much of that value you're getting per dollar. Scale: ≥4.0 Exceptional · ≥2.0 Great · ≥0.0 Fair · ≥-2.0 Below avg · <-2.0 Overpaid. ELC goalies excluded." />
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── Tab toggle ── */}
        <div className="pp-tabs">
          <button className={`pp-tab ${ppTab === 'stats' ? 'active' : ''}`} onClick={() => setPpTab('stats')}>📊 Stats</button>
          <button className={`pp-tab ${ppTab === 'analytics' ? 'active' : ''}`} onClick={() => setPpTab('analytics')}>🧮 Analytics</button>
          {!isLeagueContext && (
            <button className={`pp-tab ${ppTab === 'heatmap' ? 'active' : ''}`} onClick={() => setPpTab('heatmap')}>🎯 Heat Map</button>
          )}
          {!isLeagueContext && (
            <button className={`pp-tab ${ppTab === 'scout' ? 'active' : ''}`} onClick={() => setPpTab('scout')}>🔍 Scout</button>
          )}
        </div>

        {/* ── Stats tab ── */}
        {ppTab === 'stats' && (
          <div className="pp-body">
            {loading && (
              <div className="pp-loading">
                {[80,60,70,50].map((w,i) => (
                  <div key={i} className="skeleton" style={{ height: 11, width: `${w}%`, marginBottom: 10 }} />
                ))}
              </div>
            )}
            {!loading && sections.map(({ label, stats: s, highlight }) => {
              if (!s) return null
              let enriched = (isGoalie && goalieData?.qsPct != null)
                ? { ...s, qualityStartPct: goalieData.qsPct }
                : s
              if (!isGoalie && mpData) {
                if (s?.gameTypeId === 2) {
                  enriched = { ...enriched, hits: mpData.hits ?? undefined, blockedShots: mpData.blockedShots ?? undefined, takeaways: mpData.takeaways ?? undefined, giveaways: mpData.giveaways ?? undefined }
                } else if (s?.gameTypeId === 3 && mpData.poDef) {
                  enriched = { ...enriched, hits: mpData.poDef.hits ?? undefined, blockedShots: mpData.poDef.blockedShots ?? undefined, takeaways: mpData.poDef.takeaways ?? undefined, giveaways: mpData.poDef.giveaways ?? undefined }
                }
              }
              const groups = groupStats(statDefs, enriched, isGoalie)
              if (!groups.length) return null
              return <StatSection key={label} label={label} groups={groups} highlight={highlight} isGoalie={isGoalie} />
            })}
            {!loading && !sections.some(s => s.stats) && (
              <div className="pp-no-stats">No stats available for this player yet.</div>
            )}
          </div>
        )}

        {/* ── Heat map tab — CAR context only ── */}
        {ppTab === 'heatmap' && !isLeagueContext && (
          <PlayerHeatMap shotData={shotData} goalieShotData={goalieShotData} playerName={name} isGoalie={isGoalie} />
        )}

        {/* ── Analytics tab ── */}
        {ppTab === 'analytics' && (
          <PlayerAnalytics mpData={mpData} goalieData={goalieData} playerName={name} isGoalie={isGoalie} position={positionCode} />
        )}

        {/* ── Scout tab — CAR context only ── */}
        {ppTab === 'scout' && !isLeagueContext && (
          <ScoutingBlurb data={scoutData} playerName={name} />
        )}
      </div>
    </div>
  )
}
