// components/PlayerComparisonPopup.jsx (Session 91)
//
// Player-vs-Player comparison. Same-league only (NHL-NHL or PWHL-PWHL) --
// avoids reconciling NHL's 3-marker (league/conf/div) percentile depth
// against PWHL's 1-marker (league-only) system. Goalie-vs-skater is a hard
// block (non-overlapping stat schemas); PWHL goalie-vs-goalie is also a
// hard block (PWHL has zero percentile data for goalies today -- confirmed
// via investigation, PWHLPlayerPopup.jsx never renders a PercentileBar for
// goalies). F-vs-D pairing is allowed with a soft, non-blocking badge.
//
// Both players self-fetch their own full data from a minimal identity
// shape ({id, name, team, position}) -- same self-fetch-by-id convention
// every other popup in this app follows (see PlayerSearch.jsx). This
// intentionally does NOT reuse whatever the parent PlayerPopup/
// PWHLPlayerPopup already fetched for "its" player -- keeping both sides
// symmetric is simpler than plumbing one player's data in via props and
// fetching only the other.
import { useState } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { getPlayerStats, TEAM_CONFIG } from '../utils/nhlApi'
import { getPlayerAnalytics, getGoalieAnalytics } from '../utils/supabaseClient'
import { fetchPWHLPlayerLanding, fetchPWHLPlayerPercentiles } from '../utils/pwhlApi'
import { ALL_TEAMS } from '../utils/teamConfig'
import { PWHL_CURRENT_SEASON, getPWHLTeamById } from '../utils/pwhlConfig'
import {
  SKATER_STATS as NHL_SKATER_STATS, GOALIE_STATS as NHL_GOALIE_STATS,
  groupStats as nhlGroupStats, STAT_PCT_MAP as NHL_STAT_PCT_MAP,
  computeRadarAxes as nhlSkaterRadarAxes, computeGoalieRadarAxes as nhlGoalieRadarAxes,
  RADAR_AXIS_ABBR as NHL_RADAR_AXIS_ABBR, posLabel as nhlPosLabel,
} from '../utils/nhlPlayerStats'
import {
  SKATER_STATS as PWHL_SKATER_STATS, GOALIE_STATS as PWHL_GOALIE_STATS,
  groupStats as pwhlGroupStats, PWHL_STAT_PCT_MAP,
  computeRadarAxes as pwhlSkaterRadarAxes, RADAR_AXIS_ABBR as PWHL_RADAR_AXIS_ABBR,
  posLabel as pwhlPosLabel,
} from '../utils/pwhlPlayerStats'
import { StatTileGrid } from './StatTileGrid'
import PercentileBar from './PercentileBar'
import TeamLogo from './TeamLogo'
import './PlayerComparisonPopup.css'

// Tailwind migration (Session 97, Phase 3, sub-PR 3) -- this file's own
// popup-shell classNames (player-popup, pp-header, pp-close, pp-body,
// pp-no-stats, pp-radar-note) came from PlayersView.css; that file is
// deleted now that every consumer has migrated. .popup-backdrop stays a
// literal className -- separate, permanently-shared global class in
// index.css, not part of PlayersView.css. Cypress marker classnames kept
// (audited via grep): player-popup, pp-close, pp-body.
const PLAYER_POPUP_CLASSES = 'player-popup bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-t-[var(--radius-lg)] w-full max-w-[420px] max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-[0_-8px_40px_rgba(0,0,0,0.5)] animate-[slide-up_0.2s_cubic-bezier(0.34,1.2,0.64,1)] min-[560px]:rounded-[var(--radius-lg)] min-[560px]:animate-[pop-in_0.2s_cubic-bezier(0.34,1.2,0.64,1)]'
const PP_HEADER_CLASSES = 'pp-header flex items-start gap-[14px] p-4 border-b-[0.5px] border-[var(--border)] [background:linear-gradient(135deg,rgba(204,34,0,0.07)_0%,transparent_55%)] relative'
const PP_CLOSE_CLASSES = 'pp-close absolute top-3 right-3 w-[28px] h-[28px] rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]'
const PP_BODY_CLASSES = 'pp-body pt-2 pb-4'
const PP_NO_STATS_CLASSES = 'text-center p-5 text-[12px] text-[color:var(--text-dim)] italic'
const PP_RADAR_NOTE_CLASSES = 'text-[9px] text-[color:var(--text-dim)] text-center leading-[1.4] px-1 mt-[-6px]'

const NHL_SEASON = Number(TEAM_CONFIG.season.slice(0, 4) + TEAM_CONFIG.season.slice(4))

// getGoalieAnalytics/getPlayerAnalytics both return a full-league batch
// keyed by player_id (same object PlayerPopup.jsx's own `mpAll`/`goalieAll`
// already are) -- fetching this once per side and indexing by id is the
// same cost as the existing single-player cards pay, no new Worker route.

function isGoalieCode(pos) {
  return pos === 'G'
}

// Coarse position bucket for the soft F-vs-D mismatch badge. Deliberately
// collapses every forward code (C/LW/RW/F) into one bucket -- the scope
// decision only asked for an F-vs-D flag, not a line-position mismatch
// flag (e.g. C vs LW isn't flagged).
function posGroup(code) {
  if (code === 'D' || code === 'LD' || code === 'RD') return 'D'
  if (code === 'G') return 'G'
  return 'F'
}

function usePlayerComparisonData(sport, player) {
  const isPwhl = sport === 'pwhl'
  const id = player?.id
  const isGoalie = isGoalieCode(player?.position)

  const { data: nhlStats, loading: nhlLoading } = useFetch(
    () => (!isPwhl && id) ? getPlayerStats(id) : Promise.resolve(null),
    [isPwhl, id]
  )
  const { data: nhlSkaterAnalytics } = useFetch(
    () => (!isPwhl && !isGoalie && id) ? getPlayerAnalytics() : Promise.resolve(null),
    [isPwhl, isGoalie, id]
  )
  const { data: nhlGoalieAnalytics } = useFetch(
    () => (!isPwhl && isGoalie && id) ? getGoalieAnalytics() : Promise.resolve(null),
    [isPwhl, isGoalie, id]
  )
  const { data: pwhlLanding, loading: pwhlLoading } = useFetch(
    () => (isPwhl && id) ? fetchPWHLPlayerLanding(id, PWHL_CURRENT_SEASON) : Promise.resolve(null),
    [isPwhl, id]
  )
  const { data: pwhlPct } = useFetch(
    () => (isPwhl && !isGoalie && id) ? fetchPWHLPlayerPercentiles(id, PWHL_CURRENT_SEASON) : Promise.resolve(null),
    [isPwhl, isGoalie, id]
  )

  if (isPwhl) {
    const p = { ...player, ...(pwhlLanding || {}) }
    const name = p.player_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || player?.name || ''
    const team = getPWHLTeamById(p.team_id)
    return {
      loading: pwhlLoading,
      isGoalie,
      name,
      headshot: p.headshot || (id ? `https://assets.leaguestat.com/pwhl/240x240/${id}.jpg` : null),
      teamAbbr: team?.abbr,
      teamColor: team?.displayColor || '#4d80f0',
      position: p.position || player?.position,
      boxStats: p,
      percentiles: pwhlPct?.percentiles || null,
    }
  }

  const stats = nhlStats
  // Whole-season fallback (matches PlayerPopup.jsx's own SkaterHeaderPanel
  // staleNote handling, Session 66): early in a new season (or offseason,
  // e.g. right now -- 2026-27 has been live-resolved as current but has
  // zero games played yet), NHL_SEASON's own row doesn't exist. Falling
  // back to the most recent regular-season row with real games avoids a
  // permanently-blank comparison rather than trying to reproduce
  // PlayerPopup's mpData.statsStale/statsSeason machinery exactly (that's
  // resolved server-side against a different data source and isn't
  // guaranteed to agree with which season the raw NHL feed falls back to).
  const nhlRegSeasons = (stats?.seasonTotals || []).filter(s => s.gameTypeId === 2 && s.leagueAbbrev === 'NHL')
  const seasonReg = nhlRegSeasons.find(s => s.season === NHL_SEASON)
    || [...nhlRegSeasons].sort((a, b) => b.season - a.season)[0]
  const name = stats
    ? `${stats.firstName?.default || ''} ${stats.lastName?.default || ''}`.trim()
    : (player?.name || '')
  const teamAbbr = stats?.teamAbbrev || player?.team
  const analytics = isGoalie ? nhlGoalieAnalytics : nhlSkaterAnalytics
  const mpData = analytics?.[String(id)] || null
  // hits/blockedShots/takeaways/giveaways aren't in the NHL API's own
  // seasonTotals row at all (confirmed live) -- PlayerPopup.jsx sources
  // them from mpData (the Supabase/pipeline realtime-stats batch) and
  // merges them in before rendering tiles (PlayerPopup.jsx's own
  // `enriched` step). Same merge needed here or the Physical tab's
  // Defensive group silently has nothing to render.
  const boxStats = (seasonReg && !isGoalie && mpData)
    ? { ...seasonReg, hits: mpData.hits ?? undefined, blockedShots: mpData.blockedShots ?? undefined, takeaways: mpData.takeaways ?? undefined, giveaways: mpData.giveaways ?? undefined }
    : (seasonReg || null)
  return {
    loading: nhlLoading,
    isGoalie,
    name,
    headshot: stats?.headshot,
    teamAbbr,
    teamColor: ALL_TEAMS.find(t => t.abbr === teamAbbr)?.displayColor || '#4d80f0',
    position: stats?.positionCode || player?.position,
    boxStats,
    percentiles: mpData?.percentiles || null,
  }
}

// ── Radar (two-series overlay, Recharts -- same library/pattern as the
// single-player radar in PlayerPopup.jsx, Session 66/80. Deliberately not
// a hand-rolled SVG: Recharts is already a dependency and already renders
// a production radar chart elsewhere in this app.) ─────────────────────
function mergeRadarSeries(axesA, axesB) {
  return axesA.map((d, i) => ({ axis: d.axis, a: d.value, b: axesB[i]?.value ?? 0 }))
}

function RadarTick(abbrMap) {
  return function Tick({ x, y, payload, textAnchor }) {
    const full = payload.value
    const short = abbrMap[full] || full
    return (
      <text x={x} y={y} textAnchor={textAnchor} fill="var(--text-dim)" fontSize={9}>
        {short}
        <title>{full}</title>
      </text>
    )
  }
}

function ComparisonRadar({ axesA, axesB, colorA, colorB, abbrMap }) {
  const data = mergeRadarSeries(axesA, axesB)
  const missingA = axesA.filter(d => !d.hasData).map(d => d.axis)
  const missingB = axesB.filter(d => !d.hasData).map(d => d.axis)
  return (
    <div className="pcp-radar">
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data} outerRadius="68%">
          <PolarGrid stroke="var(--border-2)" />
          <PolarAngleAxis dataKey="axis" tick={RadarTick(abbrMap)} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={2} />
          <Radar dataKey="a" stroke={colorA} fill={colorA} fillOpacity={0.28} strokeWidth={2} isAnimationActive={false} />
          <Radar dataKey="b" stroke={colorB} fill={colorB} fillOpacity={0.28} strokeWidth={2} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
      {(missingA.length > 0 || missingB.length > 0) && (
        <div className={PP_RADAR_NOTE_CLASSES}>
          Not enough playing time yet: {[...new Set([...missingA, ...missingB])].join(', ')}
        </div>
      )}
    </div>
  )
}

// ── Identity ─────────────────────────────────────────────────────────
function PlayerIdentity({ data, sport }) {
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      {data.headshot
        ? <img src={data.headshot} alt="" className="w-11 h-11 rounded-full object-cover shrink-0 bg-[var(--bg2)]" />
        : <TeamLogo abbr={data.teamAbbr} sport={sport} size={44} color={data.teamColor} />}
      <div className="min-w-0">
        <div className="text-[15px] font-semibold leading-tight truncate">{data.name || '—'}</div>
        <div className="text-xs text-[color:var(--text-dim)] truncate">{data.teamAbbr || ''}</div>
      </div>
    </div>
  )
}

function BlockMessage({ text }) {
  return (
    <div className="mx-1 my-6 rounded-lg border border-[var(--border-2)] bg-[var(--bg2)] px-4 py-6 text-center text-sm text-[color:var(--text-dim)]">
      {text}
    </div>
  )
}

// ── Tab config ───────────────────────────────────────────────────────
// "Possession"/"Advanced" tabs are percentile-only (WAR/RAPM composites for
// skaters, GSAX-family for goalies) -- not sourced from SKATER_STATS/
// GOALIE_STATS at all, so they're handled as a special-cased tab rather
// than a groups-filter bucket like the other three.
const NHL_SKATER_TAB_GROUPS = {
  scoring:       ['Scoring', 'Shot Quality'],
  specialTeams:  ['Special Teams'],
  physical:      ['Defensive', 'Ice Time'],
}
const PWHL_SKATER_TAB_GROUPS = {
  scoring:       ['Scoring', 'Shot Quality'],
  specialTeams:  ['Special Teams'],
  physical:      ['Discipline'],
}
const GOALIE_TAB_GROUPS = {
  record:        ['Record'],
  performance:   ['Performance'],
}

const SKATER_TABS = [
  { key: 'scoring',      label: 'Scoring' },
  { key: 'possession',   label: 'Possession' },
  { key: 'physical',     label: 'Physical' },
  { key: 'specialTeams', label: 'Special Teams' },
]
const GOALIE_TABS = [
  { key: 'record',       label: 'Record' },
  { key: 'performance',  label: 'Performance' },
  { key: 'advanced',     label: 'Advanced' },
]

function filterGroups(groups, names) {
  return groups.filter(g => names.includes(g.group))
}

// NHL skaters' "Possession" tab: EV Offence/EV Defence/Competition/
// Teammates -- the 4 WAR/RAPM percentile categories that feed
// computeRadarAxes but have no StatTile counterpart (STAT_PCT_MAP
// deliberately excludes them, see nhlPlayerStats.js). PWHL has no
// possession-flavored percentile data at all (WAR/RAPM blocked until
// shift-level PBP data exists, expected October) -- shows a placeholder.
function PossessionColumn({ sport, percentiles }) {
  if (sport === 'pwhl') {
    return (
      <div className="text-xs text-[color:var(--text-dim)] px-1 py-3">
        Not available for PWHL yet — possession metrics (WAR/RAPM) need shift-level
        play-by-play data PWHL doesn't have until the league's tracking catches up
        (expected October).
      </div>
    )
  }
  const p = percentiles || {}
  return (
    <div className="pcp-pct-col">
      <PercentileBar label="EV Offence"  pct={p.evOff?.pct}     note={p.evOff?.note} />
      <PercentileBar label="EV Defence"  pct={p.evDef?.pct}     note={p.evDef?.note} />
      <PercentileBar label="Competition" pct={p.comp?.pct}      note={p.comp?.note} />
      <PercentileBar label="Teammates"   pct={p.teammates?.pct} note={p.teammates?.note} />
    </div>
  )
}

function AdvancedGoalieColumn({ percentiles }) {
  const p = percentiles || {}
  return (
    <div className="pcp-pct-col">
      <PercentileBar label="GSAX"            pct={p.gsax?.pct}   note={p.gsax?.note} />
      <PercentileBar label="GSAX/60"         pct={p.gsax60?.pct} note={p.gsax60?.note} />
      <PercentileBar label="5-on-5 SV%"      pct={p.evSv?.pct}   note={p.evSv?.note} />
      <PercentileBar label="High Danger SV%" pct={p.hdSv?.pct}   note={p.hdSv?.note} />
      <PercentileBar label="Med Danger SV%"  pct={p.mdSv?.pct}   note={p.mdSv?.note} />
      <PercentileBar label="PK SV%"          pct={p.pkSv?.pct}   note={p.pkSv?.note} />
    </div>
  )
}

export default function PlayerComparisonPopup({ sport, playerA, playerB, onClose }) {
  const isPwhl = sport === 'pwhl'
  const a = usePlayerComparisonData(sport, playerA)
  const b = usePlayerComparisonData(sport, playerB)

  const positionsKnown = a.position && b.position
  const goalieMismatch = positionsKnown && a.isGoalie !== b.isGoalie
  const pwhlGoalieBlocked = isPwhl && a.isGoalie && b.isGoalie
  const blocked = goalieMismatch || pwhlGoalieBlocked

  const bothGoalie = !goalieMismatch && a.isGoalie && b.isGoalie
  const positionMismatch = !blocked && !bothGoalie && positionsKnown && posGroup(a.position) !== posGroup(b.position)

  const tabs = bothGoalie ? GOALIE_TABS : SKATER_TABS
  const [tab, setTab] = useState(tabs[0].key)
  const activeTab = tabs.find(t => t.key === tab) ? tab : tabs[0].key

  const defs      = bothGoalie
    ? (isPwhl ? PWHL_GOALIE_STATS : NHL_GOALIE_STATS)
    : (isPwhl ? PWHL_SKATER_STATS : NHL_SKATER_STATS)
  const groupFn   = isPwhl ? pwhlGroupStats : nhlGroupStats
  const pctMap    = isPwhl ? PWHL_STAT_PCT_MAP : NHL_STAT_PCT_MAP
  const tabGroups = bothGoalie
    ? GOALIE_TAB_GROUPS
    : (isPwhl ? PWHL_SKATER_TAB_GROUPS : NHL_SKATER_TAB_GROUPS)
  const posLabelFn = isPwhl ? pwhlPosLabel : nhlPosLabel

  const groupsA = groupFn(defs, a.boxStats, a.isGoalie)
  const groupsB = groupFn(defs, b.boxStats, b.isGoalie)
  // Goalies don't have tile-facing percentiles today in either league
  // (NHL goalies keep the separate PercentileBar "Advanced" tab instead;
  // PWHL goalies are hard-blocked before reaching this point) -- only pass
  // pctMap for skaters.
  const showPct = !bothGoalie

  const radarAxesA = bothGoalie
    ? nhlGoalieRadarAxes(a.percentiles)
    : (isPwhl ? pwhlSkaterRadarAxes(a.percentiles) : nhlSkaterRadarAxes(a.percentiles))
  const radarAxesB = bothGoalie
    ? nhlGoalieRadarAxes(b.percentiles)
    : (isPwhl ? pwhlSkaterRadarAxes(b.percentiles) : nhlSkaterRadarAxes(b.percentiles))
  const abbrMap = bothGoalie ? NHL_RADAR_AXIS_ABBR : (isPwhl ? PWHL_RADAR_AXIS_ABBR : NHL_RADAR_AXIS_ABBR)

  return (
    <div className="popup-backdrop pcp-backdrop" onClick={onClose}>
      <div className={`${PLAYER_POPUP_CLASSES} pcp-root`} onClick={e => e.stopPropagation()}>
        <div className={PP_HEADER_CLASSES}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <PlayerIdentity data={a} sport={sport} />
            <span className="text-xs font-semibold text-[color:var(--text-dim)] shrink-0 px-1">vs</span>
            <PlayerIdentity data={b} sport={sport} />
          </div>
          <button className={PP_CLOSE_CLASSES} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={PP_BODY_CLASSES}>
          {(a.loading || b.loading) && (
            <div className={PP_NO_STATS_CLASSES}>Loading…</div>
          )}

          {!a.loading && !b.loading && goalieMismatch && (
            <BlockMessage text="Goalies and skaters use different stat sets and can't be compared directly. Pick two skaters or two goalies." />
          )}

          {!a.loading && !b.loading && !goalieMismatch && pwhlGoalieBlocked && (
            <BlockMessage text="PWHL goalie comparison isn't available yet — percentile tracking for PWHL goalies hasn't been built. Check back in a future update." />
          )}

          {!a.loading && !b.loading && !blocked && (
            <>
              {positionMismatch && (
                <div className="pcp-mismatch-badge">
                  Position mismatch: {posLabelFn(a.position)} vs {posLabelFn(b.position)} — stats below are still shown, but usage differs by position.
                </div>
              )}

              <ComparisonRadar axesA={radarAxesA} axesB={radarAxesB} colorA={a.teamColor} colorB={b.teamColor} abbrMap={abbrMap} />

              <div className="pcp-tabbar" role="tablist">
                {tabs.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === t.key}
                    className={`pcp-tab ${activeTab === t.key ? 'pcp-tab-active' : ''}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Stacked, not side-by-side: StatTileGrid renders 3 tiles per
                  row (Session 80 redesign) and needs the popup's full width
                  to stay legible -- a 2-column split squeezes that grid to
                  half-width, which cramps and overlaps percentile-marker
                  labels at this app's normal (mobile-first) popup widths.
                  Confirmed visually before landing on this over a side-by-
                  side layout. */}
              <div className="flex flex-col gap-4 mt-2">
                <div className="pcp-player-block">
                  <div className="pcp-player-block-label" style={{ color: a.teamColor }}>{a.name}</div>
                  {activeTab === 'possession' && <PossessionColumn sport={sport} percentiles={a.percentiles} />}
                  {activeTab === 'advanced' && bothGoalie && <AdvancedGoalieColumn percentiles={a.percentiles} />}
                  {activeTab !== 'possession' && activeTab !== 'advanced' && (
                    <StatTileGrid
                      groups={filterGroups(groupsA, tabGroups[activeTab] || [])}
                      percentiles={showPct ? a.percentiles : null}
                      showPercentiles={showPct}
                      pctMap={pctMap}
                    />
                  )}
                </div>
                <div className="pcp-player-block">
                  <div className="pcp-player-block-label" style={{ color: b.teamColor }}>{b.name}</div>
                  {activeTab === 'possession' && <PossessionColumn sport={sport} percentiles={b.percentiles} />}
                  {activeTab === 'advanced' && bothGoalie && <AdvancedGoalieColumn percentiles={b.percentiles} />}
                  {activeTab !== 'possession' && activeTab !== 'advanced' && (
                    <StatTileGrid
                      groups={filterGroups(groupsB, tabGroups[activeTab] || [])}
                      percentiles={showPct ? b.percentiles : null}
                      showPercentiles={showPct}
                      pctMap={pctMap}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
