// components/StatTileGrid.jsx
// Shared tile-grid stat display, extracted from PlayerPopup.jsx (Session
// 75) so PWHLPlayerPopup.jsx can use the same tile-grid + sectioned-InfoTip
// mechanism NHL got in Session 73 (#52) instead of duplicating it. League-
// specific knowledge (which stats have a percentile column, NHL's stale-
// season fallback label) stays in each popup's own file and gets passed in
// as props -- this module only knows about the generic {def, fmt} shape.
import { useState } from 'react'
import InfoTip from './InfoTip'
import { nhlSeasonLabel } from '../utils/seasonComparison'

function ordinalSuffix(n) {
  const v = Math.round(n)
  const mod100 = v % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  switch (v % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}
function ordinal(n) {
  const v = Math.round(n)
  return `${v}${ordinalSuffix(v)}`
}

// ─── Percentile scope legend (PLAYER_CARD_PERCENTILE_DISPLAY_BRIEF) ────
// Division/Conference are NHL-only (PR #56) -- PWHL has no conf/div
// structure at all, so PWHLPlayerPopup.jsx never renders this legend, it
// only ever has the League scope to show and a single marker needs no key.
export const PCT_SCOPES = [
  { key: 'div',    label: 'Division',   color: 'var(--amber)' },
  { key: 'conf',   label: 'Conference', color: 'var(--purple)' },
  { key: 'league', label: 'League',     color: 'var(--blue-bright)' },
]

export function PercentileScopeLegend() {
  return (
    <div className="stat-tile-legend">
      {PCT_SCOPES.map(s => (
        <span key={s.key} className="stat-tile-legend-item">
          <span className="stat-tile-legend-dot" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

// ─── Skater/goalie percentile tile (Stats tab tile grid) ──────────────
// Restyles a single box-score stat as a tile: label, big number, and — for
// the subset of stats with a backing percentile column (via pctMap) — a
// bare 0-100 scale with a small tick marker per scope. Markers are colored
// by scope (PCT_SCOPES above), not by good/bad -- position on the scale
// already carries that meaning, and a fixed per-scope color is what lets
// the shared legend mean the same thing on every card. PWHL (and any NHL
// category without conf/div, e.g. pre-#56 rows) renders a single League
// marker; NHL's 16 tile-facing categories render all 3 once PR #56's
// conf/div columns are populated. `pctInfo.conf`/`.div` being undefined --
// not present at all -- is what selects the 1-marker path, so this
// degrades automatically rather than needing a separate PWHL code path.
function StatTile({ def, fmt, pctInfo }) {
  const hasLeague = pctInfo && pctInfo.pct != null
  const hasScopes = pctInfo && (pctInfo.conf != null || pctInfo.div != null)
  const insufficientSample = !!pctInfo && !hasLeague && !hasScopes

  // Above/below placement is assigned by sorted *value*, not fixed scope
  // order -- two scopes frequently land on the same or a near-identical
  // percentile (division and league agreeing is common, not an edge case),
  // and a fixed div/conf/league alternation would put both of those on the
  // same side, stacking their labels exactly on top of each other. Sorting
  // by value first means any two markers close enough to collide are
  // adjacent in the sort and land on opposite sides -- *unless* all 3
  // values cluster within one small span, in which case 2 rows can't avoid
  // giving one row 2 members (pigeonhole: 3 markers, 2 rows). That's the
  // common case, not rare -- division/conference/league percentiles for
  // one player are correlated, so real data frequently has 2 or all 3
  // matching exactly (confirmed live: e.g. Blocks/TK/GV tiles below all
  // land 3-for-3 identical for some players). The second pass below nudges
  // same-row labels apart horizontally when their values are too close,
  // so a same-row pair never fully overlaps regardless of clustering.
  const COLLISION_PCT = 10
  const markers = pctInfo
    ? (() => {
        const raw = PCT_SCOPES
          .map(scope => ({ ...scope, value: scope.key === 'league' ? pctInfo.pct : pctInfo[scope.key] }))
          .filter(m => m.value != null)
        if (raw.length < 2) return raw
        const bySorted = [...raw].sort((a, b) => a.value - b.value)
        const aboveKeys = new Set(bySorted.filter((_, i) => i % 2 === 0).map(m => m.key))
        const withSide = raw.map(m => ({ ...m, above: aboveKeys.has(m.key) }))
        for (const above of [true, false]) {
          const group = withSide.filter(m => m.above === above).sort((a, b) => a.value - b.value)
          if (group.length === 2 && Math.abs(group[0].value - group[1].value) < COLLISION_PCT) {
            group[0].offsetPx = -11
            group[1].offsetPx = 11
          }
        }
        return withSide
      })()
    : []

  return (
    <div className="stat-tile">
      <div className="stat-tile-top">
        <span className="stat-tile-label">{def.label}</span>
        <InfoTip
          sections={[
            { text: def.tip },
            def.calc && { label: 'Calculation', text: def.calc },
            def.why  && { label: 'Why it matters', text: def.why },
          ].filter(Boolean)}
          position="above"
        />
      </div>
      <div className="stat-tile-value">{fmt ?? '—'}</div>
      {markers.length > 0 && (
        <div className="stat-tile-scale-wrap">
          <div className="stat-tile-scale-track">
            {markers.map(m => (
              <div
                key={m.key}
                className={`stat-tile-marker ${m.above ? 'marker-above' : 'marker-below'}`}
                style={{ left: `${m.value}%`, background: m.color }}
              >
                <span
                  className="stat-tile-marker-val"
                  style={{ color: m.color, transform: `translateX(calc(-50% + ${m.offsetPx || 0}px))` }}
                >
                  {ordinal(m.value)}
                </span>
              </div>
            ))}
          </div>
          {pctInfo.note && <InfoTip text={pctInfo.note} position="above" />}
        </div>
      )}
      {insufficientSample && (
        <div className="stat-tile-na">Not enough playing time yet</div>
      )}
    </div>
  )
}

// `showPercentiles` gates whether pctMap is even consulted -- not just
// whether `percentiles` is present. Percentile data is current-season-only
// for both leagues (PWHL's pwhl_percentiles.py/poller route were already
// computed and served -- Session 80 wired PWHLPlayerPopup.jsx to actually
// fetch them, this comment previously and incorrectly claimed PWHL had no
// percentile system at all), so for Career/other-season/Compare-tab
// sections there is no percentile concept at all, not merely a missing
// value. Falling through to `{ pct: null }` in that case would make
// StatTile render "Not enough playing time yet" on a career totals tile,
// which is actively wrong, not just blank.
export function StatTileGrid({ groups, percentiles, showPercentiles = true, pctMap = {} }) {
  return (
    <>
      {groups.map(({ group, items }) => (
        <div key={group} className="stat-group">
          <div className="stat-group-label">{group}</div>
          <div className="stat-tile-grid">
            {items.map(({ def, fmt }) => {
              const pctKey = showPercentiles ? pctMap[def.key] : null
              const pctInfo = pctKey ? (percentiles?.[pctKey] ?? { pct: null }) : null
              return <StatTile key={def.key} def={def} fmt={fmt} pctInfo={pctInfo} />
            })}
          </div>
        </div>
      ))}
    </>
  )
}

// Collapsible section wrapper rendering the tile grid -- used for every
// section (Session 73), not just the current/highlighted one. Percentiles
// are only ever passed for the current-season skater section, either
// league (Session 80 added PWHL's); every other call site (Career, the
// current season's sibling game-type, Compare-tab seasons, and all goalie
// sections) omits `percentiles` entirely, which turns off pctMap lookups
// in StatTileGrid rather than showing a misleading "insufficient sample" bar.
// Defaults open for every section -- the whole point of the tile-grid pass
// is that Career/other sections shouldn't hide behind a click. Toggle is
// kept so a section can still be manually collapsed to save space.
// `statsStale`/`statsSeason` (NHL's whole-season fallback badge, Session
// 66) only ever render when `highlight` is true -- PWHL and non-highlight
// NHL sections never pass these, so `nhlSeasonLabel` is never called for
// PWHL despite the shared import.
export function TileStatSection({ label, groups, highlight, percentiles, showPercentiles, statsStale, statsSeason, pctMap }) {
  const [open, setOpen] = useState(true)
  return (
    <div className={`stat-section ${highlight ? 'highlight-section' : ''}`}>
      <button className="stat-section-header" onClick={() => setOpen(o => !o)}>
        <span className="stat-section-label">{label}</span>
        {highlight && (
          statsStale
            ? <span className="stat-section-current stat-section-stale" title={`Not enough games yet this season — showing ${nhlSeasonLabel(statsSeason)}`}>
                As of {nhlSeasonLabel(statsSeason)}
              </span>
            : <span className="stat-section-current">Current</span>
        )}
        <span className="stat-section-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="stat-section-body">
          <StatTileGrid
            groups={groups}
            percentiles={percentiles}
            showPercentiles={showPercentiles ?? !!percentiles}
            pctMap={pctMap}
          />
        </div>
      )}
    </div>
  )
}
