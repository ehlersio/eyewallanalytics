/**
 * PlayerPopup.jsx
 * Shared player detail modal used by PlayersView (selected team's roster) and
 * LeagueView Leaders tab (any NHL player).
 *
 * Props:
 *   player       {object}  — minimum shape: { id, firstName, lastName, teamAbbrev }
 *                            PlayersView passes the full roster object which also
 *                            includes positionCode, sweaterNumber, headshot, shootsCatches.
 *   inPlayoffs   {boolean} — controls section ordering; pass false from LeagueView
 *   standings    {array}   — for rank calculation; pass [] from LeagueView
 *   onClose      {fn}      — close handler
 *   isLeagueContext {bool} — when true, hides roster-scoped tabs (Heat Map, Scout)
 *                            and the contract panel (contract panel is further
 *                            gated to TEAM_CONFIG.abbr === 'CAR' — carContracts.js
 *                            only has real data for Carolina); keeps Stats + Analytics
 */

import { useState, useMemo } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { getPlayerStats, getPlayerGameLog, fetchPlayerRankings, TEAM_CONFIG, GAME_TYPE } from '../utils/nhlApi'
import { ALL_TEAMS } from '../utils/teamConfig'
import {
  getPlayerAnalytics,
  getGoalieAnalytics,
  getPlayerShots,
  getGoalieShots,
  getScoutingBlurb,
  getResultsVsProcessNarrative,
} from '../utils/supabaseClient'
import { findContract, contractValue, pointsPer60, valueLabel, goalieContractValue, goalieValueLabel, CAP_CEILING } from '../utils/carContracts'
import { nhlSeasonLabel } from '../utils/seasonComparison'
import IceRink from '../components/IceRink'
import InfoTip from '../components/InfoTip'
import SeasonComparisonPicker from '../components/SeasonComparisonPicker'
import SeasonOverlayChart from './SeasonOverlayChart'
import { TileStatSection, PercentileScopeLegend } from './StatTileGrid'
import PercentileBar from './PercentileBar'
import PlayerComparisonEntry from './PlayerComparisonEntry'
import {
  SKATER_STATS, GOALIE_STATS, groupStats, posLabel,
  STAT_PCT_MAP, computeRadarAxes, RADAR_AXIS_ABBR,
} from '../utils/nhlPlayerStats'
import '../views/PlayersView.css'

const SEASON       = Number(TEAM_CONFIG.season.slice(0, 4) + TEAM_CONFIG.season.slice(4))
const SEASON_LABEL = `${TEAM_CONFIG.season.slice(0, 4)}–${TEAM_CONFIG.season.slice(6)}`

// ─── Stat definitions ─────────────────────────────────────────
// SKATER_STATS/GOALIE_STATS/groupStats/posLabel moved to
// utils/nhlPlayerStats.js (Session 91) so PlayerComparisonPopup.jsx can
// reuse them without a circular import back into this file.

// ─── Per-game trend chart helpers (Session 70) ─────────────────

function toiToSeconds(toi) {
  if (typeof toi !== 'string' || !toi.includes(':')) return null
  const [m, s] = toi.split(':').map(Number)
  if (Number.isNaN(m) || Number.isNaN(s)) return null
  return m * 60 + s
}

// Reads one stat's value off a single game-log row. Most `perGame` stats
// are a direct field read (def.perGameKey || def.key); the small set of
// goalie stats that aren't direct API fields (saves, W/L, GAA) go through
// `def.derive` instead -- see the GOALIE_STATS comment above for why each
// one needs its own formula rather than a field read.
function perGameRawValue(def, game) {
  if (!game) return null
  if (def.derive === 'saves') {
    const sa = game.shotsAgainst, ga = game.goalsAgainst
    return (sa == null || ga == null) ? null : sa - ga
  }
  if (def.derive === 'win')  return game.decision === 'W' ? 1 : 0
  if (def.derive === 'loss') return game.decision === 'L' ? 1 : 0
  if (def.derive === 'gaa') {
    const secs = toiToSeconds(game.toi)
    return (!secs || game.goalsAgainst == null) ? null : (game.goalsAgainst / secs) * 3600
  }
  const raw = game[def.perGameKey || def.key]
  return raw == null ? null : Number(raw)
}

// Small season-color ramp -- same math as TeamComparisonPopup's
// seasonRampColor/hexToRgba, duplicated rather than cross-imported (this
// codebase's convention for small UI-adjacent helpers owned by a single
// popup component; see rapm.py's 3-bucket proxy for the same pattern on
// the pipeline side).
function hexToRgba(hex, alpha) {
  const clean = String(hex).replace('#', '')
  if (clean.length !== 6) return hex
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
function seasonRampColor(baseHex, index, total) {
  if (total <= 1) return baseHex
  const MIN_ALPHA = 0.35
  const alpha = 1 - (index / (total - 1)) * (1 - MIN_ALPHA)
  return hexToRgba(baseHex, Number(alpha.toFixed(2)))
}
const CHART_DASH_PATTERNS = [undefined, '6 4', '2 3']

// ─── Player-card header + Stats tab redesign (Session 66, NHL skaters only) ──
// Radar chart + percentile tile grid below are additive UI on top of the
// existing mpData.percentiles shape from getPlayerAnalytics() (supabaseClient.js)
// -- no new data fetching. Goalies and PWHL are explicitly untouched: this
// entire block is only reached when !isGoalie in this (NHL-only) file, and
// PWHLPlayerPopup.jsx is a completely separate component this PR never edits.

// WCAG-AA dark-mode-safe team colors, same lookup pattern LeagueView.jsx
// already uses for its power-rankings sparkline (ALL_TEAMS -> displayColor).
const TEAM_DISPLAY_COLORS = Object.fromEntries(ALL_TEAMS.map(t => [t.abbr, t.displayColor]))

function teamColorFor(abbr) {
  return TEAM_DISPLAY_COLORS[abbr] || TEAM_CONFIG.displayColor || '#4d80f0'
}

// computeRadarAxes/STAT_PCT_MAP moved to utils/nhlPlayerStats.js (Session 91,
// same circular-import reasoning as the stat-def move above).

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

// StatRow/StatSection (vertical row-list accordion) removed Session 73 --
// every section in this file now renders via the tile grid (TileStatSection,
// imported from StatTileGrid.jsx as of Session 75's extraction so
// PWHLPlayerPopup.jsx can share the same mechanism); the row-list layout
// has no remaining call sites in this file. `def.why`/`def.calc` tooltip
// text (dropped when StatRow was removed, since InfoTip only took a single
// `text` at the time) is resurfaced via InfoTip's `sections` prop (Session
// 74) -- see StatTile in StatTileGrid.jsx.

// ─── Skater header radar + quick stats (Session 66) ────────────

// Root cause of the label-cutoff bug (Session 72): .pp-radar-wrap is capped
// to a ~140-160px flex slot inside a popup hard-capped at 420px wide
// (PlayersView.css), leaving only ~15-25px of margin outside the plotted
// circle -- nowhere near enough for two-word labels like "Special Teams" at
// any legible font size. Abbreviating is the only fix that guarantees no
// clipping at every viewport; full names are still available on hover/tap
// via a native SVG <title> (same info the "Not enough playing time yet"
// caption below already spells out in full for whichever axes are missing).
// RADAR_AXIS_ABBR moved to utils/nhlPlayerStats.js (Session 91).

function RadarAxisTick({ x, y, payload, textAnchor }) {
  const full  = payload.value
  const short = RADAR_AXIS_ABBR[full] || full
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--text-dim)" fontSize={8.5}>
      {short}
      <title>{full}</title>
    </text>
  )
}

function PlayerRadarChart({ data, color, staleNote }) {
  const missing = data.filter(d => !d.hasData).map(d => d.axis)
  return (
    <div className="pp-radar-wrap">
      <ResponsiveContainer width="100%" height={150}>
        <RadarChart data={data} outerRadius="62%">
          <PolarGrid stroke="var(--border-2)" />
          <PolarAngleAxis dataKey="axis" tick={RadarAxisTick} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={2} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.35} strokeWidth={2} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
      {missing.length > 0 && (
        <div className="pp-radar-note">Not enough playing time yet: {missing.join(', ')}</div>
      )}
      {/* Whole-season fallback caption (Session 66) — rendered here, inside
          the narrow radar column, rather than as a sibling of .pp-quickstats
          in .pp-header-radar's row (Session 80): once that row shares width
          with the compact identity column instead of spanning the popup's
          full ~400px, a full-sentence-length flex sibling there forces
          .pp-quickstats to zero width instead of wrapping in place. */}
      {staleNote && (
        <div className="pp-radar-note pp-radar-stale">{staleNote}</div>
      )}
    </div>
  )
}

function QuickStatPill({ label, value }) {
  return (
    <div className="pp-quickstat">
      <span className="pp-quickstat-val">{value ?? '—'}</span>
      <span className="pp-quickstat-label">{label}</span>
    </div>
  )
}

// Header panel shown only for NHL skaters (goalies + PWHL keep today's
// header). `boxStats` is the current/highlighted season's raw stat line
// (same object the Stats tab uses) -- reused here for the G/A/P/TOI pills
// rather than re-fetching anything.
// `comparisonEntry` (the "vs Player" button, Session 91) is rendered
// stacked below the quickstats grid rather than as a sibling of this whole
// panel in .pp-header's row -- putting it inline there ate into
// .pp-radar-wrap's already-tight flex share (radar takes "whatever's
// left" after quickstats' protected fixed width, see PlayersView.css) and
// visibly squeezed the radar. Reported live after shipping.
function SkaterHeaderPanel({ percentiles, boxStats, teamColor, statsStale, statsSeason, comparisonEntry }) {
  if (!percentiles) return null
  const radarData = computeRadarAxes(percentiles)
  const fmtToi = (raw) => {
    if (raw == null) return null
    if (typeof raw === 'string' && raw.includes(':')) return raw
    const m = Math.floor(raw / 60), s = String(raw % 60).padStart(2, '0')
    return `${m}:${s}`
  }
  // Whole-season fallback (Session 66) — same "as of last season" signal as
  // the Stats tab's stat-section-stale badge, since this radar is built
  // from the same possibly-stale percentiles object.
  const staleNote = statsStale
    ? `Not enough games yet this season — showing ${nhlSeasonLabel(statsSeason)}`
    : null
  return (
    <div className="pp-header-radar">
      <PlayerRadarChart data={radarData} color={teamColor} staleNote={staleNote} />
      <div className="pp-quickstats-col">
        <div className="pp-quickstats">
          <QuickStatPill label="G"   value={boxStats?.goals} />
          <QuickStatPill label="A"   value={boxStats?.assists} />
          <QuickStatPill label="P"   value={boxStats?.points} />
          <QuickStatPill label="TOI" value={fmtToi(boxStats?.avgToi)} />
        </div>
        {comparisonEntry}
      </div>
    </div>
  )
}

// ─── Heat Map ─────────────────────────────────────────────────

function PlayerHeatMap({ shotData, goalieShotData, _playerName, isGoalie }) {
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
                <span style={{ width:10, height:10, borderRadius:2, background:c, display:'inline-block' }} />{l}
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

// PercentileBar moved to components/PercentileBar.jsx (Session 91).

function PlayerAnalytics({ mpData, goalieData, _playerName, isGoalie, position, narrativeData, isLeagueContext }) {
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
      {!isLeagueContext && (
        <ResultsVsProcess
          onIceGfPct={mpData.onIceGfPct}
          resultsVsProcessDiff={mpData.resultsVsProcessDiff}
          narrativeData={narrativeData}
        />
      )}
      <div className="pa-source">Data: MoneyPuck.com · Updates nightly</div>
    </div>
  )
}

// ─── Results vs. Process ──────────────────────────────────────
// Pairs on-ice results (on_ice_gf_pct) against underlying process (the
// existing EV xGF% percentile) to surface over/underperforming players.
// Both mpData fields are null below eyewall-pipeline's GP≥25 guardrail
// (moneypuck.py::RESULTS_VS_PROCESS_MIN_GP) -- that's the only check made
// here, no GP threshold is re-derived on this side.

function ResultsVsProcess({ onIceGfPct, resultsVsProcessDiff, narrativeData }) {
  if (resultsVsProcessDiff == null) {
    return (
      <div className="rvp-wrap">
        <div className="pa-section-label">Results vs. Process</div>
        <div className="scout-empty">
          <div className="scout-empty-icon">⏳</div>
          <div>Not enough games yet for a reliable read.</div>
          <div className="scout-empty-sub">Needs a minimum sample of games played this season.</div>
        </div>
      </div>
    )
  }

  const outperforming = resultsVsProcessDiff > 0
  const diffColor = outperforming ? '#4ade80' : '#f87171'
  const directionLabel = outperforming ? 'Outperforming process' : 'Underperforming process'

  return (
    <div className="rvp-wrap">
      <div className="pa-section-label">Results vs. Process</div>
      <div className="pa-context">
        <div className="pa-ctx-item">
          <span className="pa-ctx-val">{onIceGfPct}%</span>
          <span className="pa-ctx-label">On-Ice GF% <InfoTip text="On-ice goals-for percentage at 5-on-5 -- the share of goals scored (not just shot attempts/quality) while this player is on the ice. The 'results' side of this pairing." position="above" /></span>
        </div>
        <div className="pa-ctx-item">
          <span className="pa-ctx-val" style={{ color: diffColor }}>{resultsVsProcessDiff > 0 ? '+' : ''}{resultsVsProcessDiff}%</span>
          <span className="pa-ctx-label">Gap vs. Process <InfoTip text="On-Ice GF% minus EV xGF% (the process/shot-quality side, shown above in the percentile rankings). A large positive or negative gap suggests results are running hotter or colder than the underlying process -- often a sign of unsustainable luck rather than true talent." position="above" /></span>
        </div>
      </div>
      <div style={{ color: diffColor, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{directionLabel}</div>
      {narrativeData === undefined ? (
        <div className="scout-loading">
          {[92, 85, 70].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 11, width: `${w}%`, marginBottom: 10, borderRadius: 4 }} />
          ))}
        </div>
      ) : narrativeData?.blurb ? (
        <div className="scout-blurb">{narrativeData.blurb}</div>
      ) : (
        <div className="scout-empty-sub">Narrative generates nightly — check back after the next pipeline run.</div>
      )}
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
        <span className="scout-season">{SEASON_LABEL}</span>
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
  const [compareSeasons, setCompareSeasons] = useState([])

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

  // Results-vs-process narrative — skater-only (no on-ice GF/GA split for
  // goalies), same CAR-roster-context gating as the Scout tab/ScoutingBlurb.
  const { data: rvpNarrative } = useFetch(
    () => (!isLeagueContext && !isGoalie) ? getResultsVsProcessNarrative(p.id, SEASON) : Promise.resolve(undefined),
    [p.id, isGoalie, isLeagueContext]
  )

  const seasonPO  = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 3)
  let   seasonReg = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 2)
  const careerPO  = stats?.careerTotals?.playoffs
  const careerReg = stats?.careerTotals?.regularSeason

  // Whole-season fallback (Session 66) — mirrors mpData.statsStale/
  // statsSeason, but this is a SEPARATE data source (the NHL API's own
  // seasonTotals, already fully fetched for the Career accordions below --
  // no new network call needed) with its own independent "does the live
  // season have a real row yet" answer. The redesigned tile grid is only
  // ever attached to whichever section has highlight: true, so without
  // this, a player with no live-season box score (true right now for
  // every NHL player) never gets the new layout at all, even once
  // /player-analytics has real fallback percentiles to show.
  let boxStatsStale = false
  let boxStatsSeason = null
  if (!seasonReg) {
    const priorReg = (stats?.seasonTotals || [])
      .filter(s => s.season < SEASON && s.gameTypeId === 2)
      .sort((a, b) => b.season - a.season)[0]
    if (priorReg) {
      seasonReg = priorReg
      boxStatsStale = true
      boxStatsSeason = String(priorReg.season)
    }
  }
  const regSeasonLabel = boxStatsStale ? nhlSeasonLabel(boxStatsSeason) : SEASON_LABEL

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
        { label: `${regSeasonLabel} Regular season`,   stats: seasonReg, highlight: true },
        { label: `${SEASON_LABEL} Playoffs`,           stats: seasonPO,  highlight: false },
        { label: 'Career Regular season',              stats: careerReg, highlight: false },
        { label: 'Career Playoffs',                    stats: careerPO,  highlight: false },
      ]

  const statDefs = isGoalie ? GOALIE_STATS : SKATER_STATS

  // ── Stats tab sections (Session 73) ─────────────────────────────
  // Every section renders as a tile grid now, not just the highlighted one
  // (Session 72 found every StatSection instance in this file was hiding a
  // comparison, not doing legitimate density-organizing work -- see
  // SESSION_72_FINDINGS). The highlighted section still renders full-width
  // on its own; the rest render together in a wrapping row so Career
  // Regular/Playoffs (and the current season's sibling game-type) are all
  // visible at once instead of one click-to-expand at a time.
  const statsTabSections = loading ? [] : sections
    .map(({ label, stats: s, highlight }) => {
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
      return {
        highlight,
        node: (
          <TileStatSection
            key={label} label={label} groups={groups} highlight={highlight}
            percentiles={!isGoalie && highlight ? mpData?.percentiles : undefined}
            statsStale={boxStatsStale} statsSeason={boxStatsSeason}
            pctMap={STAT_PCT_MAP}
          />
        ),
      }
    })
    .filter(Boolean)
  const currentStatSections = statsTabSections.filter(r => r.highlight).map(r => r.node)
  const otherStatSections   = statsTabSections.filter(r => !r.highlight).map(r => r.node)

  // ── Compare tab per-game trend chart (Session 70) ──────────────
  // Chart-ready metrics only (statDefs entries flagged `perGame` above);
  // everything else still shows in the per-season tile grid below.
  const chartableStatDefs = statDefs.filter(d => d.perGame)
  const [chartMetricKey, setChartMetricKey] = useState(null)
  const activeChartDef = chartableStatDefs.find(d => d.key === chartMetricKey) || chartableStatDefs[0] || null

  const { data: gameLogsBySeason, loading: gameLogLoading } = useFetch(
    () => (compareSeasons.length
      ? Promise.all(compareSeasons.map(season => getPlayerGameLog(p.id, season, GAME_TYPE.REGULAR)))
      : Promise.resolve([])),
    [p.id, compareSeasons.join(',')]
  )

  const compareSeasonsSortedDesc = useMemo(
    () => [...compareSeasons].sort((a, b) => b - a),
    [compareSeasons]
  )

  const chartSeries = useMemo(() => {
    if (!activeChartDef || !gameLogsBySeason) return []
    const logBySeason = new Map(compareSeasons.map((s, i) => [s, gameLogsBySeason[i]?.gameLog || []]))
    const baseColor = teamColorFor(p.teamAbbrev)
    return compareSeasonsSortedDesc.map((season, idx) => {
      // NHL's game-log endpoint returns newest-first; reverse so gameNumber
      // 1 is the season's first game, matching SeasonOverlayChart's x-axis.
      const games = (logBySeason.get(season) || []).slice().reverse()
      let running = 0
      const dataPoints = games.map((g, i) => {
        const raw = perGameRawValue(activeChartDef, g)
        if (activeChartDef.cumulative) {
          if (raw != null) running += raw
          return { gameNumber: i + 1, value: running }
        }
        return { gameNumber: i + 1, value: raw }
      })
      return {
        seasonLabel: nhlSeasonLabel(season),
        color: seasonRampColor(baseColor, idx, compareSeasonsSortedDesc.length),
        dashPattern: CHART_DASH_PATTERNS[idx % CHART_DASH_PATTERNS.length],
        dataPoints,
      }
    })
  }, [activeChartDef, gameLogsBySeason, compareSeasons, compareSeasonsSortedDesc, p.teamAbbrev])

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
  // carContracts.js only has real data for CAR — for any other selected team,
  // findContract()'s last-name fallback can false-positive against CAR's roster
  // (e.g. a shared surname), so gate on the selected team too, not just
  // roster-vs-league context. Matches TeamView.jsx's Cap-tab guard.
  const contract = (!isLeagueContext && TEAM_CONFIG.abbr === 'CAR')
    ? findContract(p.id, p.lastName?.default) : null

  // Derive positionCode from stats if not on the player object (league context)
  const positionCode = p.positionCode || stats?.position || null

  // ── Header + Stats tab redesign inputs (NHL skaters only, Session 66) ──
  // isGoalie already computed above; PWHL never reaches this component.
  const teamAbbr  = p.teamAbbrev || TEAM_CONFIG.abbr
  const teamColor = teamColorFor(teamAbbr)
  const currentSection   = sections.find(sec => sec.highlight)
  const currentBoxStats  = currentSection?.stats || null

  // ── Header reflow (Session 80) — two-column top row (compact identity |
  // radar + 2x2 totals) plus a full-width 6-column bio row underneath.
  // Scoped to exactly the case SkaterHeaderPanel already renders for
  // (!isGoalie && percentiles present) -- goalies and the pre-percentiles
  // loading flash keep the original single-block header rather than
  // splitting into a two-column layout with nothing to put on the right.
  const showHeaderReflow = !isGoalie && !!mpData?.percentiles
  const bioFields = [
    { label: 'Height',    value: bio.heightInInches ? fmtHeight(bio.heightInInches) : null },
    { label: 'Weight',    value: bio.weightInPounds ? `${bio.weightInPounds} lbs` : null },
    { label: 'Shoots',    value: p.shootsCatches ? (p.shootsCatches === 'L' ? 'Left' : 'Right') : null },
    { label: 'Age',       value: bio.birthDate ? calcAge(bio.birthDate) : null },
    { label: 'Birthdate', value: bio.birthDate ? fmtBirth(bio.birthDate) : null },
    { label: 'Hometown',  value: bio.birthCity?.default
        ? `${bio.birthCity.default}${bio.birthCountry ? `, ${bio.birthCountry}` : ''}`
        : null },
  ]

  // Built once, placed either inline in .pp-header (goalies/loading, no
  // radar to compress) or stacked under SkaterHeaderPanel's quickstats
  // grid (skaters with a reflowed header) -- see showHeaderReflow below.
  const comparisonEntry = (
    <PlayerComparisonEntry
      sport="nhl"
      player={{
        id: p.id,
        name: `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(),
        // Deliberately p.teamAbbrev directly, not the `teamAbbr` var above
        // -- that one falls back to TEAM_CONFIG.abbr (this app's
        // currently-selected team, default CAR) when missing, which is
        // fine for its actual use (a radar-color fallback) but reads as a
        // real, wrong team label if reused here. Confirmed live:
        // /players-search-index can return team:null for a player
        // (Shesterkin, this session), which would otherwise silently show
        // "CAR" for a Rangers goalie.
        team: p.teamAbbrev || null,
        position: positionCode,
      }}
    />
  )

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="player-popup" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={`pp-header ${showHeaderReflow ? 'pp-header-reflow' : ''}`}>
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
              {!showHeaderReflow && bio.heightInInches && <span className="pp-chip">{fmtHeight(bio.heightInInches)}</span>}
              {!showHeaderReflow && bio.weightInPounds && <span className="pp-chip">{bio.weightInPounds} lbs</span>}
              {!showHeaderReflow && p.shootsCatches && (
                <span className="pp-chip">{isGoalie ? 'Catches' : 'Shoots'} {p.shootsCatches === 'L' ? 'Left' : 'Right'}</span>
              )}
            </div>
            {!showHeaderReflow && bio.birthDate && (
              <div className="pp-birth">
                {fmtBirth(bio.birthDate)} · Age {calcAge(bio.birthDate)}
                {bio.birthCity?.default && ` · ${bio.birthCity.default}`}
                {bio.birthCountry && `, ${bio.birthCountry}`}
              </div>
            )}
          </div>
          {showHeaderReflow && (
            <SkaterHeaderPanel
              percentiles={mpData.percentiles}
              boxStats={currentBoxStats}
              teamColor={teamColor}
              statsStale={mpData.statsStale}
              statsSeason={mpData.statsSeason}
              comparisonEntry={comparisonEntry}
            />
          )}
          {!showHeaderReflow && comparisonEntry}
          <button className="pp-close" onClick={onClose} aria-label="Close player details">✕</button>
        </div>

        {/* ── Bio row — full width, 6 evenly-spaced columns (Session 80) ── */}
        {showHeaderReflow && (
          <div className="pp-bio-row">
            {bioFields.map(f => (
              <div className="pp-bio-field" key={f.label}>
                <div className="pp-bio-label">{f.label}</div>
                <div className="pp-bio-value">{f.value ?? '—'}</div>
              </div>
            ))}
          </div>
        )}

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
          <button className={`pp-tab ${ppTab === 'compare' ? 'active' : ''}`} onClick={() => setPpTab('compare')}>🆚 Compare</button>
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
            {!loading && !isGoalie && mpData?.percentiles && <PercentileScopeLegend />}
            {!loading && currentStatSections}
            {!loading && otherStatSections.length > 0 && (
              <div className="stat-section-peers">{otherStatSections}</div>
            )}
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
          <PlayerAnalytics mpData={mpData} goalieData={goalieData} playerName={name} isGoalie={isGoalie} position={positionCode} narrativeData={rvpNarrative} isLeagueContext={isLeagueContext} />
        )}

        {/* ── Scout tab — CAR context only ── */}
        {ppTab === 'scout' && !isLeagueContext && (
          <ScoutingBlurb data={scoutData} playerName={name} />
        )}

        {/* ── Compare tab — season-over-season (Session 64) ──
            Reuses seasonTotals already fetched for the Stats tab above — no
            second network call. Deliberately does NOT enrich with
            mpData/goalieData (WAR/RAPM/QS%) the way the Stats tab's current
            season does: those Supabase lookups are current-season-only, so
            attaching them to a non-current selected season would silently
            mislabel one season's numbers as another's. Box-score fields
            from the NHL API's own seasonTotals only. */}
        {ppTab === 'compare' && (
          <div className="pp-body">
            <SeasonComparisonPicker
              league="nhl"
              selected={compareSeasons}
              onChange={setCompareSeasons}
              maxSelected={4}
            />
            {compareSeasons.length === 0 && (
              <div className="pp-no-stats">Select two or more seasons above to compare.</div>
            )}
            {chartableStatDefs.length > 0 && compareSeasons.length > 0 && (
              <div className="stat-section xg-overlay-section">
                <div className="stat-section-header">
                  <span className="stat-section-label">Per-game trend</span>
                  <select
                    className="pp-metric-select"
                    value={activeChartDef?.key || ''}
                    onChange={e => setChartMetricKey(e.target.value)}
                    aria-label="Trend metric"
                  >
                    {chartableStatDefs.map(d => (
                      <option key={d.key} value={d.key}>{d.label}{d.cumulative ? ' (season total)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="stat-section-body">
                  {gameLogLoading
                    ? <div className="pp-no-stats">Loading chart…</div>
                    : (
                      <SeasonOverlayChart
                        series={chartSeries}
                        metricLabel={activeChartDef.label}
                        valueFormatter={v => (activeChartDef.key === 'savePctg' ? v.toFixed(3) : Math.round(v * 10) / 10)}
                      />
                    )}
                </div>
              </div>
            )}
            {compareSeasons.length > 0 && (
              <div className="stat-section-peers">
                {compareSeasonsSortedDesc.map(season => {
                  const seasonStats = stats?.seasonTotals?.find(s => s.season === season && s.gameTypeId === 2)
                  if (!seasonStats) {
                    return (
                      <div key={season} className="pp-no-stats">
                        No regular-season data for {nhlSeasonLabel(season)}.
                      </div>
                    )
                  }
                  const groups = groupStats(statDefs, seasonStats, isGoalie)
                  if (!groups.length) return null
                  return <TileStatSection key={season} label={nhlSeasonLabel(season)} groups={groups} />
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
