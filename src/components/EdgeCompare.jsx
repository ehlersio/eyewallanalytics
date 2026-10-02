// components/EdgeCompare.jsx
// NHL EDGE in the comparison popups.
//   EdgeHeadToHead -- the player comparison's Tracking tab: one row per
//     metric, each player's value and the NHL's percentile side by side,
//     the better percentile highlighted. Same metrics as the player popup's
//     Analytics section (edgeFormat.js EDGE_METRICS skater/goalie).
//   EdgeTeamRows -- the team comparison's per-team-season cards: the Team
//     page's EDGE metrics (EDGE_METRICS.team) with the NHL's rank.
// Both follow the 10-games rule the rest of the app uses for EDGE
// (EDGE_MIN_GP): fewer regular-season games and that side's percentile or
// rank is left out, the value still shown. Speeds follow Settings -> Units.

import { useTranslation } from 'react-i18next'
import { useFetch } from '../hooks/useFetch'
import { useUnits } from '../hooks/useUnits'
import { getPlayerEdge } from '../utils/edgeApi'
import { EDGE_METRICS, formatEdgeMetric } from '../utils/edgeFormat'
import { formatOrdinal } from '../utils/formatters'
import { nhlSeasonLabel } from '../utils/seasonComparison'
import { ALL_TEAMS } from '../utils/teamConfig'
import { EDGE_MIN_GP } from './EdgeTrackingSection'

const TABLE_CLASSES = 'edge-h2h w-full text-[12px] border-collapse'
const HEAD_CLASSES = 'text-[11px] font-bold pb-1.5 align-bottom'
const LABEL_CELL_CLASSES = 'text-center text-[color:var(--text-muted)] px-1 py-[7px] border-b-[0.5px] border-[rgba(255,255,255,0.05)]'
const VALUE_CELL_CLASSES = 'py-[7px] border-b-[0.5px] border-[rgba(255,255,255,0.05)] font-[family-name:var(--font-mono)] whitespace-nowrap'
const PCT_CLASSES = 'block text-[10px] text-[color:var(--text-dim)] font-normal'
const BETTER_CLASSES = 'text-[color:var(--green)] font-bold'
const NOTE_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-2 text-center'

const kindOf = (metrics, name) => metrics.find(([n]) => n === name)?.[1]

// A side's percentile, or null under EDGE_MIN_GP regular-season games
function pctOf(side, name) {
  if (!side?.edge) return null
  if ((side.edge.gamesPlayed ?? 0) < EDGE_MIN_GP) return null
  return side.edge.metrics?.[name]?.pct ?? null
}

/**
 * @param {'skater'|'goalie'} kind
 * @param {{ name, color, edge }} left / right -- edge: the Worker's
 *   /nhl/edge response body (`{ season, gamesPlayed, metrics }`) or null
 */
export function EdgeHeadToHead({ kind, left, right }) {
  const { t } = useTranslation()
  const units = useUnits()
  const metrics = EDGE_METRICS[kind] || []
  const names = metrics.map(([n]) => n).filter(n => left.edge?.metrics?.[n] || right.edge?.metrics?.[n])
  if (!names.length) return null

  const sideLabel = (side) => side.edge
    ? t('playerComparisonPopup.edge.seasonGp', { season: nhlSeasonLabel(side.edge.season), count: side.edge.gamesPlayed ?? 0 })
    : t('playerComparisonPopup.edge.noData')

  const cell = (side, name, better) => {
    const m = side.edge?.metrics?.[name]
    if (!m) return <span className="text-[color:var(--text-dim)]">—</span>
    const f = formatEdgeMetric(kindOf(metrics, name), m, units, t)
    const pct = pctOf(side, name)
    return (
      <>
        <span className={better ? BETTER_CLASSES : undefined}>{f.value}</span>
        {pct != null && <span className={PCT_CLASSES}>{t('playerComparisonPopup.edge.pct', { pct: formatOrdinal(pct) })}</span>}
      </>
    )
  }

  return (
    <div data-testid="edge-h2h">
      <table className={TABLE_CLASSES}>
        <thead>
          <tr>
            <th className={`${HEAD_CLASSES} text-left`} style={{ color: left.color }}>
              {left.name}<span className={PCT_CLASSES}>{sideLabel(left)}</span>
            </th>
            <th className={HEAD_CLASSES} />
            <th className={`${HEAD_CLASSES} text-right`} style={{ color: right.color }}>
              {right.name}<span className={PCT_CLASSES}>{sideLabel(right)}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {names.map((name) => {
            const pa = pctOf(left, name)
            const pb = pctOf(right, name)
            const aBetter = pa != null && pb != null && pa > pb
            const bBetter = pa != null && pb != null && pb > pa
            return (
              <tr key={name} data-metric={name}>
                <td className={`${VALUE_CELL_CLASSES} text-left`}>{cell(left, name, aBetter)}</td>
                <td className={LABEL_CELL_CLASSES}>{t(`playerPopup.edge.metrics.${name}`, { context: units })}</td>
                <td className={`${VALUE_CELL_CLASSES} text-right`}>{cell(right, name, bBetter)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className={NOTE_CLASSES}>{t('playerComparisonPopup.edge.source', { count: EDGE_MIN_GP })}</div>
    </div>
  )
}

/**
 * One team-season's EDGE rows for a team comparison card. Renders nothing
 * when the NHL has no EDGE data for that team and season (before 2021-22,
 * or the fetch failed).
 *
 * @param {string} abbr    NHL team abbreviation
 * @param {number|string} season  8-digit NHL season id
 * @param {(props) => JSX} Row  the card's own row component ({ label, value, note })
 */
export function EdgeTeamRows({ abbr, season, Row, headingClassName }) {
  const { t } = useTranslation()
  const units = useUnits()
  const teamId = ALL_TEAMS.find(tm => tm.abbr === abbr)?.teamId
  const { data } = useFetch(
    () => (teamId && season) ? getPlayerEdge('team', teamId, String(season), 2).catch(() => null) : Promise.resolve(null),
    [teamId, season]
  )
  if (data?.status !== 'ok') return null
  const { metrics, gamesPlayed } = data.data
  const rows = (EDGE_METRICS.team || []).filter(([n]) => metrics?.[n])
  if (!rows.length) return null
  const ranked = (gamesPlayed ?? 0) >= EDGE_MIN_GP

  return (
    <div data-testid="edge-team-rows">
      <div className={headingClassName}>{t('teamView.edge.title')}</div>
      {rows.map(([name, kind]) => {
        const m = metrics[name]
        const f = formatEdgeMetric(kind, m, units, t)
        return (
          <Row
            key={name}
            label={t(`teamView.edge.metrics.${name}`, { context: units })}
            value={f.value}
            note={ranked && m.rank != null ? t('teamView.edge.rank', { rank: formatOrdinal(m.rank) }) : null}
          />
        )
      })}
    </div>
  )
}
