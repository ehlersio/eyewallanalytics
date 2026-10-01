// components/EdgeTrackingSection.jsx
// NHL EDGE tracking stats on the player Analytics tab: a few headline
// values, then a percentile bar per metric, every percentile and league
// average the NHL's own (eyewall-poller's /nhl/edge route). Speeds and
// distances read in the user's units (Settings → Units).
//
// Renders nothing while loading, when the NHL has no EDGE data for this
// player/season/game type, and when the fetch failed (getPlayerEdge has
// already retried by then; opening the player again asks again) -- the
// section is extra, so it never holds the tab up or shows an error.

import { useTranslation } from 'react-i18next'
import { useFetch } from '../hooks/useFetch'
import { useUnits } from '../hooks/useUnits'
import { getPlayerEdge } from '../utils/edgeApi'
import { EDGE_HEADLINES, EDGE_METRICS, formatEdgeMetric, presentEdgeMetrics } from '../utils/edgeFormat'
import { nhlSeasonLabel } from '../utils/seasonComparison'
import PercentileBar from './PercentileBar'

const WRAP_CLASSES = 'edge-tracking mt-[18px]'
const SECTION_LABEL_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] mb-2'
const CONTEXT_CLASSES = 'flex gap-2 flex-wrap mb-[14px] justify-center'
const CTX_ITEM_CLASSES = 'flex flex-col items-center bg-[var(--bg2)] rounded-lg py-[6px] px-[10px] text-[10px] text-[color:var(--text-dim)] gap-[2px] flex-[1_1_calc(33.333%-8px)] min-w-[60px] max-w-[120px]'
const CTX_VAL_CLASSES = 'text-[14px] font-bold font-[family-name:var(--font-mono)] text-[color:var(--text)] whitespace-nowrap'
const CTX_LABEL_CLASSES = 'whitespace-nowrap'
const BARS_CLASSES = 'flex flex-col gap-[6px]'
const SOURCE_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-[14px] text-center'

// Fewer regular-season games than this and the bars read N/A: the NHL
// publishes percentiles from a player's first game, which early in a season
// rank one night against everyone. Same 10 GP as the MoneyPuck percentile
// pool above it on the tab (eyewall-pipeline moneypuck.py MIN_GP). The
// headline values, which are just facts, still show.
export const EDGE_MIN_GP = 10

const kindOf = (kind, name) => EDGE_METRICS[kind].find(([n]) => n === name)?.[1]

// className: extra wrapper classes, e.g. padding when it sits outside the
// tab's padded wrapper (under an empty state).
export default function EdgeTrackingSection({ kind, playerId, season, gameType, className = '' }) {
  const { t } = useTranslation()
  const units = useUnits()
  const { data } = useFetch(
    () => getPlayerEdge(kind, playerId, season ? String(season) : null, gameType),
    [kind, playerId, season, gameType]
  )
  if (data?.status !== 'ok') return null
  const { metrics, gamesPlayed } = data.data
  const rows = presentEdgeMetrics(kind, metrics)
  if (rows.length === 0) return null

  const label = (name) => t(`playerPopup.edge.metrics.${name}`, { context: units })
  const headlines = EDGE_HEADLINES[kind].filter(name => metrics[name])
  const tooFewGames = gameType === 2 && (gamesPlayed ?? 0) < EDGE_MIN_GP

  return (
    <div className={`${WRAP_CLASSES} ${className}`} data-testid="edge-tracking">
      <div className={SECTION_LABEL_CLASSES}>
        {t('playerPopup.edge.sectionLabel', { season: nhlSeasonLabel(season), count: gamesPlayed ?? 0 })}
      </div>
      {headlines.length > 0 && (
        <div className={CONTEXT_CLASSES}>
          {headlines.map(name => (
            <div key={name} className={CTX_ITEM_CLASSES}>
              <span className={CTX_VAL_CLASSES}>{formatEdgeMetric(kindOf(kind, name), metrics[name], units, t).value}</span>
              <span className={CTX_LABEL_CLASSES}>{label(name)}</span>
            </div>
          ))}
        </div>
      )}
      <div className={BARS_CLASSES}>
        {rows.map(([name, metricKind]) => {
          const f = formatEdgeMetric(metricKind, metrics[name], units, t)
          if (tooFewGames) {
            const note = t('playerPopup.edge.tooFewGames', { value: f.value, count: EDGE_MIN_GP })
            return <PercentileBar key={name} label={label(name)} na note={note} />
          }
          const note = f.avg != null
            ? t('playerPopup.edge.note', { value: f.value, avg: f.avg })
            : f.value
          return <PercentileBar key={name} label={label(name)} pct={metrics[name].pct} note={note} />
        })}
      </div>
      <div className={SOURCE_CLASSES}>{t('playerPopup.edge.source')}</div>
    </div>
  )
}
