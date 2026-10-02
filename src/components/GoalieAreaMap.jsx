// components/GoalieAreaMap.jsx
// A goalie's save % in each of the NHL's 17 shot areas, on
// react-hockey-rink's ShotAreaMap. Rows come from utils/goalieAreas.js:
//   mode 'nhl'  -- the NHL's own numbers (NHL EDGE), colored by each
//                  area's save-% percentile among NHL goalies
//   mode 'pwhl' -- our shots, colored against the PWHL's save % in that area
// An area with fewer than MIN_AREA_SHOTS shots is left uncolored and
// unlabelled. Tap an area for its numbers. Shared by the NHL popup's Heat
// Map and Analytics tabs and the PWHL popup's Heat Map.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShotAreaMap, toSvg } from 'react-hockey-rink'
import {
  AREA_KEYS, MIN_AREA_SHOTS, PCT_COLORS, formatSv, leagueDiffColor, pctColor, toAttackingRight,
} from '../utils/goalieAreas'
import { formatOrdinal } from '../utils/formatters'

const LEGEND_CLASSES = 'flex gap-3 flex-wrap mb-1.5 text-[11px] text-[color:var(--text-muted)]'
const SWATCH_CLASSES = 'inline-block w-2.5 h-2.5 rounded-[2px]'
const DETAIL_CLASSES = 'text-[12px] text-[color:var(--text)] mt-1.5 min-h-[18px] text-center'
const NOTE_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-1 text-center'

export default function GoalieAreaMap({ rows, mode = 'nhl', className = '' }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(null)
  if (!rows) return null

  const areaName = (name) => t(`playerPopup.heatMap.goalie.areas.${AREA_KEYS[name] || 'unknown'}`, { defaultValue: name })
  const fillOf = (r) => (mode === 'nhl' ? pctColor(r.pct) : leagueDiffColor(r.diff))

  const areas = {}
  for (const [name, r] of Object.entries(rows)) {
    if (!r.enough) continue
    areas[name] = { fill: fillOf(r) || undefined, label: formatSv(r.svPct), title: `${areaName(name)}: ${formatSv(r.svPct)}` }
  }

  const detail = (() => {
    if (!selected) return t('playerPopup.heatMap.goalie.areaHint', { count: MIN_AREA_SHOTS })
    const r = rows[selected]
    const area = areaName(selected)
    if (!r || !r.shots) return t('playerPopup.heatMap.goalie.areaDetailNone', { area })
    if (!r.enough) return t('playerPopup.heatMap.goalie.areaDetailFew', { area, count: r.shots })
    if (mode === 'nhl') {
      return r.pct != null
        ? t('playerPopup.heatMap.goalie.areaDetailNhl', { area, count: r.shots, sv: formatSv(r.svPct), pct: formatOrdinal(r.pct) })
        : t('playerPopup.heatMap.goalie.areaDetailPlain', { area, count: r.shots, sv: formatSv(r.svPct) })
    }
    return t('playerPopup.heatMap.goalie.areaDetailPwhl', { area, count: r.shots, sv: formatSv(r.svPct), league: formatSv(r.leagueSvPct) })
  })()

  const legend = mode === 'nhl' ? 'areaLegendNhl' : 'areaLegendPwhl'

  return (
    <div className={`goalie-area-map ${className}`.trim()} data-testid="goalie-area-map">
      <div className={LEGEND_CLASSES}>
        {['high', 'mid', 'low'].map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className={SWATCH_CLASSES} style={{ background: PCT_COLORS[k] }} />
            {t(`playerPopup.heatMap.goalie.${legend}.${k}`)}
          </span>
        ))}
      </div>
      <ShotAreaMap
        areas={areas}
        selected={selected}
        onSelect={(name) => setSelected((cur) => (cur === name ? null : name))}
        ariaLabel={t('playerPopup.heatMap.goalie.areaMapLabel')}
      />
      <div className={DETAIL_CLASSES} aria-live="polite">{detail}</div>
      <div className={NOTE_CLASSES}>
        {t(mode === 'nhl' ? 'playerPopup.heatMap.goalie.areaSourceNhl' : 'playerPopup.heatMap.goalie.areaSourcePwhl')}
      </div>
    </div>
  )
}

// A goalie's shots as dots on the same rink: green a save, red a goal.
// `shots` are { x, y, t: 'g' | 's' } in play-by-play feet; a goalie switches
// ends each period, so shots at the left net are turned to face the right
// one (the old hand-drawn view dropped them -- about half his shots).
export function GoalieDotMap({ shots, caption, ariaLabel }) {
  return (
    <>
      <ShotAreaMap areas={{}} outlines={false} ariaLabel={ariaLabel}>
        <g pointerEvents="none">
          {shots.map((s, i) => {
            const [x, y] = toAttackingRight(s.x, s.y)
            const { px, py } = toSvg(x, y)
            const goal = s.t === 'g'
            return (
              <circle key={i} cx={px} cy={py} r={goal ? 4.5 : 3.5}
                fill={goal ? '#E24B4A' : '#1D9E75'} opacity={goal ? 0.85 : 0.45} />
            )
          })}
        </g>
      </ShotAreaMap>
      {caption && <div className={NOTE_CLASSES}>{caption}</div>}
    </>
  )
}
