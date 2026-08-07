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

// Tailwind migration (Session 97, Phase 3, sub-PR 2 + sub-PR 3). Now that
// TeamComparisonPopup.jsx (sub-PR 3) is also migrated, .stat-section/
// .stat-section-header/.stat-section-label/.stat-section-body are fully
// Tailwind here too -- the highlight-section -> label-color coupling that
// used to require real CSS is now a plain ternary, since this component
// controls both the section and its label in the same render (no more
// cross-component ancestor-selector dependency).
//
// .stat-section, .stat-section-header, .stat-section-body, .stat-tile-grid
// are kept as literal markers even though their base rules are gone: a
// small set of `.stat-section-peers .stat-section*`/`.stat-tile-grid`
// nested overrides still live in index.css as real CSS (shared with
// TeamComparisonPopup.jsx's own TeamCompareSeasonCard, which independently
// renders the same class names) -- see the comment there for why.
//
// Cypress marker classnames kept (audited via grep, including the
// comma-separated-selector gap found in sub-PR 2): .stat-tile,
// .stat-tile-label, .stat-tile-value (pwhl-players.cy.js,
// player-comparison.cy.js), .stat-section (pwhl-team.cy.js, team.cy.js).

const LEGEND_CLASSES = 'flex flex-wrap gap-3 text-[11px] text-[color:var(--text-muted)] px-4 mb-2'
const LEGEND_ITEM_CLASSES = 'flex items-center gap-1'
const LEGEND_DOT_CLASSES = 'w-[7px] h-[7px] rounded-full inline-block shrink-0'

const TILE_GRID_CLASSES = 'stat-tile-grid grid grid-cols-3 gap-2 mb-1 max-[400px]:gap-[6px]'
const TILE_CLASSES = 'stat-tile bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-[var(--radius-sm)] p-[9px_10px] flex flex-col gap-1 max-[400px]:p-[7px_8px]'
const TILE_TOP_CLASSES = 'flex items-baseline justify-between gap-[6px]'
const TILE_LABEL_WRAP_CLASSES = 'flex items-center gap-1 min-w-0'
const TILE_LABEL_CLASSES = 'stat-tile-label text-[11px] text-[color:var(--text-muted)] font-semibold whitespace-nowrap overflow-hidden text-ellipsis'
const TILE_VALUE_CLASSES = 'stat-tile-value font-[family-name:var(--font-display)] text-[15px] font-bold text-[color:var(--text)] leading-none whitespace-nowrap max-[400px]:text-[14px]'
const TILE_NA_CLASSES = 'text-[10px] text-[color:var(--text-dim)] italic mt-[2px]'

const SCALE_WRAP_CLASSES = 'flex items-center gap-1 mt-[14px] pb-3'
const SCALE_TRACK_CLASSES = 'relative flex-1 h-[3px] bg-[var(--bg3)] rounded-[2px]'
const MARKER_BASE_CLASSES = 'absolute top-1/2 w-[6px] h-[6px] rounded-full -translate-x-1/2 -translate-y-1/2'
const MARKER_VAL_ABOVE_CLASSES = 'absolute left-1/2 text-[9px] font-bold whitespace-nowrap bottom-2'
const MARKER_VAL_BELOW_CLASSES = 'absolute left-1/2 text-[9px] font-bold whitespace-nowrap top-2'

const STAT_GROUP_CLASSES = 'mb-[10px]'
const STAT_GROUP_LABEL_CLASSES = 'text-[9px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-dim)] font-[family-name:var(--font-display)] py-1 border-b-[0.5px] border-[var(--border)] mb-[2px]'

const SECTION_BADGE_BASE_CLASSES = 'text-[9px] py-[2px] px-[7px] rounded-[10px] border-[0.5px]'
const SECTION_BADGE_CURRENT_CLASSES = 'font-bold bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[var(--red-border)] uppercase tracking-[0.06em]'
const SECTION_BADGE_STALE_CLASSES = 'font-semibold italic bg-[var(--bg3)] text-[color:var(--text-dim)] border-[var(--border-2)] normal-case tracking-normal'
const SECTION_ARROW_CLASSES = 'text-[10px] text-[color:var(--text-dim)]'

const SECTION_CLASSES = 'stat-section border-b-[0.5px] border-[var(--border)]'
const SECTION_HIGHLIGHT_BG_CLASSES = 'highlight-section bg-[rgba(204,34,0,0.02)]'
const SECTION_HEADER_CLASSES = 'stat-section-header w-full flex items-center py-[10px] px-4 gap-2 bg-transparent border-0 cursor-pointer text-left [transition:background_0.12s] hover:bg-[var(--bg2)]'
const SECTION_LABEL_CLASSES = 'flex-1 text-[13px] font-semibold'
const SECTION_LABEL_COLOR_CLASSES = 'text-[color:var(--text)]'
const SECTION_LABEL_HIGHLIGHT_COLOR_CLASSES = 'text-[color:var(--red-bright)]'
const SECTION_BODY_CLASSES = 'stat-section-body py-1 px-4 pb-3'

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
    <div className={LEGEND_CLASSES}>
      {PCT_SCOPES.map(s => (
        <span key={s.key} className={LEGEND_ITEM_CLASSES}>
          <span className={LEGEND_DOT_CLASSES} style={{ background: s.color }} />
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
    <div className={TILE_CLASSES}>
      <div className={TILE_TOP_CLASSES}>
        <span className={TILE_LABEL_WRAP_CLASSES}>
          <span className={TILE_LABEL_CLASSES}>{def.label}</span>
          <InfoTip
            sections={[
              { text: def.tip },
              def.calc && { label: 'Calculation', text: def.calc },
              def.why  && { label: 'Why it matters', text: def.why },
            ].filter(Boolean)}
            position="above"
          />
        </span>
        <span className={TILE_VALUE_CLASSES}>{fmt ?? '—'}</span>
      </div>
      {markers.length > 0 && (
        <div className={SCALE_WRAP_CLASSES}>
          <div className={SCALE_TRACK_CLASSES}>
            {markers.map(m => (
              <div
                key={m.key}
                className={MARKER_BASE_CLASSES}
                style={{ left: `${m.value}%`, background: m.color }}
              >
                <span
                  className={m.above ? MARKER_VAL_ABOVE_CLASSES : MARKER_VAL_BELOW_CLASSES}
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
        <div className={TILE_NA_CLASSES}>Not enough playing time yet</div>
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
        <div key={group} className={STAT_GROUP_CLASSES}>
          <div className={STAT_GROUP_LABEL_CLASSES}>{group}</div>
          <div className={TILE_GRID_CLASSES}>
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
    <div className={`${SECTION_CLASSES} ${highlight ? SECTION_HIGHLIGHT_BG_CLASSES : ''}`}>
      <button className={SECTION_HEADER_CLASSES} onClick={() => setOpen(o => !o)}>
        <span className={`${SECTION_LABEL_CLASSES} ${highlight ? SECTION_LABEL_HIGHLIGHT_COLOR_CLASSES : SECTION_LABEL_COLOR_CLASSES}`}>{label}</span>
        {highlight && (
          statsStale
            ? <span className={`${SECTION_BADGE_BASE_CLASSES} ${SECTION_BADGE_STALE_CLASSES}`} title={`Not enough games yet this season — showing ${nhlSeasonLabel(statsSeason)}`}>
                As of {nhlSeasonLabel(statsSeason)}
              </span>
            : <span className={`${SECTION_BADGE_BASE_CLASSES} ${SECTION_BADGE_CURRENT_CLASSES}`}>Current</span>
        )}
        <span className={SECTION_ARROW_CLASSES}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={SECTION_BODY_CLASSES}>
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
