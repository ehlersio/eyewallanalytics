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

// ─── Skater/goalie percentile tile (Stats tab tile grid) ──────────────
// Restyles a single box-score stat as a tile: label, big number, and — for
// the subset of stats with a backing percentile column (via pctMap) — a
// thin percentile bar + ordinal label underneath. Color is a plain
// blue(>=50th)/red(<50th) split rather than team color: this bar's whole
// job is an at-a-glance good/bad read, and team colors (some of which are
// red) would make that ambiguous. Team color is used instead on the radar
// chart in the header, where there's no per-axis good/bad claim being made.
function StatTile({ def, fmt, pctInfo }) {
  const pct = pctInfo?.pct ?? null
  const insufficientSample = !!pctInfo && pct == null
  const color = pct >= 50 ? 'var(--blue-bright)' : '#f87171'
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
      {pctInfo && !insufficientSample && (
        <>
          <div className="stat-tile-bar-track">
            <div className="stat-tile-bar-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
          <div className="stat-tile-pct-label" style={{ color }}>
            {ordinal(pct)} percentile
            {pctInfo.note && <InfoTip text={pctInfo.note} position="above" />}
          </div>
        </>
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
