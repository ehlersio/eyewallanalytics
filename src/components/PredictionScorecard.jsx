import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getScorecard } from '../utils/nhlApi'
import { formatDate } from '../utils/formatters'
import { SKELETON_CLASSES } from '../utils/skeletonClasses'
import { useFeatureViewed } from '../utils/analytics'

// The public prediction scorecard (League page -> Scorecard tab), from the
// Worker's /scorecard route (eyewall-pipeline's nightly
// prediction_scorecard.py). For each model -- game winners (Elo, logged the
// morning of each game), starting goalies, playoff odds -- the live record
// (only predictions published before the fact, from 2026-27; "pending" until
// something's been graded) and a backtest (the model replayed on past
// seasons, always labeled as one), each against a simple baseline, with
// calibration and the latest graded picks. Plain probabilities, no betting
// framing.
const MODELS = ['game_winner', 'starting_goalie', 'playoff_odds']
const RECENT_SHOWN = 5

const pct1 = x => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
const pct0 = x => (x == null ? '—' : `${Math.round(x * 100)}%`)
const brier = x => (x == null ? '—' : x.toFixed(3))

const LABEL_CLASSES = 'text-[9px] uppercase tracking-[0.06em] text-[color:var(--text-dim)]'
const SECTION_CLASSES = 'mt-3 pt-2 border-t-[0.5px] border-t-[color:var(--border)]'

// The edge is in the probabilities, not the yes/no picks -- said plainly
// when accuracy barely beats the baseline but Brier clearly does (playoff
// odds' backtest: 71.6% vs 71.4%, Brier 0.162 vs 0.224).
function edgeIsInBrier(row) {
  const b = row?.baseline
  if (!b || row.accuracy == null || b.accuracy == null || row.brier == null || b.brier == null) return false
  return row.accuracy - b.accuracy < 0.01 && b.brier - row.brier > 0.01
}

function Metrics({ row }) {
  const { t } = useTranslation()
  const b = row.baseline
  return (
    <>
      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <div className={LABEL_CLASSES}>{t('scorecard.accuracy')}</div>
          <div className="scorecard-accuracy font-[family-name:var(--font-mono)] text-[20px] font-bold leading-none text-[color:var(--text)]">{pct1(row.accuracy)}</div>
        </div>
        <div>
          <div className={LABEL_CLASSES}>{t('scorecard.brier')}</div>
          <div className="scorecard-brier font-[family-name:var(--font-mono)] text-[16px] font-bold leading-none text-[color:var(--text)]">{brier(row.brier)}</div>
        </div>
        <div className="text-[11px] text-[color:var(--text-dim)]">{t('scorecard.graded', { count: row.n, n: row.n.toLocaleString() })}</div>
      </div>
      {b && (
        <div className="scorecard-baseline text-[11px] text-[color:var(--text-muted)] mt-1.5">
          {t('scorecard.baselineLine', {
            name: t(`scorecard.baselines.${b.name}`, { defaultValue: b.name }),
            accuracy: pct1(b.accuracy),
            brier: brier(b.brier),
          })}
        </div>
      )}
      {edgeIsInBrier(row) && (
        <div className="scorecard-edge text-[11px] text-[color:var(--amber)] mt-1">{t('scorecard.edgeInBrier')}</div>
      )}
    </>
  )
}

// Buckets with fewer predictions than this are hidden: a handful of games
// at the extremes read as "said 29% -> happened 0%", which is noise, not
// calibration (the first real render showed exactly that for game winners).
const MIN_BUCKET_N = 25

function Calibration({ buckets }) {
  const { t } = useTranslation()
  const shown = (buckets || []).filter(c => c.n >= MIN_BUCKET_N)
  if (!shown.length) return null
  return (
    <div className="scorecard-calibration mt-2">
      <div className={LABEL_CLASSES}>{t('scorecard.calibrationTitle')}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
        {shown.map(c => (
          <span key={c.bucket} className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--text-muted)]" title={t('scorecard.calibrationTitleN', { n: c.n.toLocaleString() })}>
            {t('scorecard.calibrationRow', { predicted: pct0(c.predicted), actual: pct0(c.actual) })}
          </span>
        ))}
      </div>
    </div>
  )
}

function RecentItem({ model, item }) {
  const { t } = useTranslation()
  let text
  if (model === 'game_winner') {
    const homeFav = item.home_win_prob >= 0.5
    text = t('scorecard.recent.game', {
      away: item.away,
      home: item.home,
      pick: homeFav ? item.home : item.away,
      pct: pct0(homeFav ? item.home_win_prob : 1 - item.home_win_prob),
      winner: item.winner,
    })
  } else if (model === 'starting_goalie') {
    text = t('scorecard.recent.goalie', { team: item.team, pick: item.predicted, pct: pct0(item.prob), actual: item.actual })
  } else {
    return null
  }
  return (
    <div className="scorecard-recent-item flex items-center justify-between gap-2 text-[11px] py-[2px]">
      <span className="text-[color:var(--text-muted)] truncate">{text}</span>
      <span className={item.hit ? 'text-[color:var(--green)]' : 'text-[color:var(--red-bright)]'} aria-label={item.hit ? t('scorecard.hit') : t('scorecard.miss')}>
        {item.hit ? '✓' : '✗'}
      </span>
    </div>
  )
}

function ModelSection({ model, entry }) {
  const { t } = useTranslation()
  const live = entry?.live
  const backtest = entry?.backtest
  const livePending = !live || live.status === 'pending' || !live.n
  const recent = (live?.recent || []).slice(0, RECENT_SHOWN)

  return (
    <div className="card scorecard-model" data-model={model} style={{ marginTop: 10 }}>
      <div className="sec-label" style={{ marginBottom: 2 }}>{t(`scorecard.models.${model}.title`)}</div>
      <div className="text-[11px] text-[color:var(--text-dim)] mb-2">{t(`scorecard.models.${model}.desc`)}</div>

      <div className="scorecard-live">
        <div className={`${LABEL_CLASSES} mb-1`}>{t('scorecard.live', { period: live?.period || '' })}</div>
        {livePending ? (
          <div className="scorecard-pending text-[12px] text-[color:var(--text-dim)]">{t(`scorecard.models.${model}.pending`)}</div>
        ) : (
          <>
            <Metrics row={live} />
            <Calibration buckets={live.calibration} />
            {recent.length > 0 && (
              <div className="mt-2">
                <div className={LABEL_CLASSES}>{t('scorecard.recentTitle')}</div>
                {recent.map(item => <RecentItem key={`${item.game_id}-${item.team || ''}`} model={model} item={item} />)}
              </div>
            )}
          </>
        )}
      </div>

      {backtest && backtest.n > 0 && (
        <div className={`scorecard-backtest ${SECTION_CLASSES}`}>
          <div className={`${LABEL_CLASSES} mb-1`}>{t('scorecard.backtest', { period: backtest.period })}</div>
          <Metrics row={backtest} />
          <Calibration buckets={backtest.calibration} />
          {backtest.note && <div className="text-[10px] text-[color:var(--text-dim)] italic mt-1.5">{backtest.note}</div>}
        </div>
      )}
    </div>
  )
}

export default function PredictionScorecard() {
  const { t } = useTranslation()
  const { data, loading } = useFetch(getScorecard, [])
  const models = data?.models || {}
  const updated = data?.updatedAt ? new Date(data.updatedAt) : null
  const viewRef = useFeatureViewed('scorecard')

  return (
    <div className="prediction-scorecard" ref={viewRef}>
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 4 }}>{t('scorecard.title')}</div>
        <div className="text-[12px] text-[color:var(--text-muted)] leading-[1.45]">{t('scorecard.intro')}</div>
        <div className="text-[11px] text-[color:var(--text-dim)] leading-[1.45] mt-1.5">{t('scorecard.howToRead')}</div>
        <Link to="/methodology" className="scorecard-method-link inline-block text-[12px] text-[color:var(--text)] underline underline-offset-2 mt-2">
          {t('scorecard.methodologyLink')}
        </Link>
      </div>
      {loading ? (
        <div className={SKELETON_CLASSES} style={{ height: 120, width: '100%', marginTop: 10 }} />
      ) : !data || data.unavailable ? (
        <div className="card text-[12px] text-[color:var(--text-dim)]" style={{ marginTop: 10 }}>{t('scorecard.unavailable')}</div>
      ) : !Object.keys(models).length ? (
        <div className="card text-[12px] text-[color:var(--text-dim)]" style={{ marginTop: 10 }}>{t('scorecard.empty')}</div>
      ) : (
        <>
          {MODELS.filter(m => models[m]).map(m => <ModelSection key={m} model={m} entry={models[m]} />)}
          {updated && !Number.isNaN(updated.getTime()) && (
            <div className="text-[10px] text-[color:var(--text-dim)] mt-2">{t('scorecard.updated', { date: formatDate(updated) })}</div>
          )}
        </>
      )}
    </div>
  )
}
