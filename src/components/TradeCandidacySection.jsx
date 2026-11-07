// The NHL player popup's Candidate signals section: the signals that came
// before past deadline trades which this player has, and a tier, from the
// Worker's /trade-candidacy (eyewall-pipeline trade_candidacy.py). Phase 4
// of the trade fit scope. Never a percentage for the player: the backtest
// behind the tiers didn't calibrate well enough for one, so the method note
// quotes each tier's backtest rate as a group fact. Renders nothing unless
// the player is tiered with at least one signal, which only happens from
// Jan 1 to the trade deadline (no dead options). Under the clause, the
// player's EyeWall AI paragraph (ai_trade_candidacy.py, written from these
// signals, the clause and his best trade fits only), when there is one.

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useFetch } from '../hooks/useFetch'
import { getTradeCandidacy } from '../utils/nhlApi'
import { formatDate } from '../utils/formatters'
import InfoTip from './InfoTip'
import { clauseKey } from '../utils/tradeFit'
import { TIER_BACKTEST_RATES, hasCandidacy, signalKey } from '../utils/tradeCandidacy'

export const TIER_COLORS = { several: 'var(--amber)', some: 'var(--text-muted)' }

const SECTION_CLASSES = 'trade-candidacy py-3 px-4 border-b-[0.5px] border-[var(--border)]'
const HEAD_CLASSES = 'sec-label flex items-center gap-1.5 mb-1'
const NOTE_CLASSES = 'text-[11px] text-[color:var(--text-muted)]'
const TIER_ROW_CLASSES = 'flex items-center gap-2 flex-wrap'
const TIER_CLASSES = 'trade-candidacy-tier inline-flex items-center text-[11px] font-semibold py-[2px] px-2 rounded-xl border-[0.5px]'
const SIGNALS_CLASSES = 'trade-candidacy-signals list-disc pl-5 m-0 mt-2 flex flex-col gap-[2px]'
const SIGNAL_CLASSES = 'trade-candidacy-signal text-[12px] text-[color:var(--text)] leading-snug'
const AI_CLASSES = 'trade-candidacy-ai mt-3 bg-[var(--bg2)] rounded-[10px] py-[10px] px-3 border-[0.5px] border-[var(--border)]'
const AI_LABEL_CLASSES = 'trade-candidacy-ai-label text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--red-bright)] mb-1'
const AI_TEXT_CLASSES = 'trade-candidacy-ai-text text-[13px] leading-[1.55] text-[color:var(--text)]'
const AI_NOTE_CLASSES = 'trade-candidacy-ai-note text-[10px] text-[color:var(--text-dim)] mt-[6px]'

export function fmtDay(iso) {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d) ? iso : formatDate(d, { month: 'short', day: 'numeric' })
}

const pct = x => `${Math.round(x * 100)}%`

export function TradeCandidacyBody({ data }) {
  const { t } = useTranslation()
  if (!hasCandidacy(data)) return null
  const { player } = data
  const color = TIER_COLORS[player.tier]
  const clause = clauseKey(player.clause, player.clauseStatus)
  const conference = c => t(`playerPopup.candidacy.conferences.${c}`, { defaultValue: c })
  const ai = typeof data.ai?.text === 'string' && data.ai.text.trim() ? data.ai : null
  return (
    <div className={SECTION_CLASSES} data-tier={player.tier}>
      <div className={HEAD_CLASSES}>
        {t('playerPopup.candidacy.title')}
        <InfoTip
          label={t('playerPopup.candidacy.methodLabel')}
          text={t('playerPopup.candidacy.methodTip', { several: pct(TIER_BACKTEST_RATES.several), some: pct(TIER_BACKTEST_RATES.some) })}
        />
      </div>
      <div className={TIER_ROW_CLASSES}>
        <span className={TIER_CLASSES} style={{ color, borderColor: color }}>{t(`playerPopup.candidacy.tiers.${player.tier}`)}</span>
        <span className={`${NOTE_CLASSES} trade-candidacy-asof`}>
          {t('playerPopup.candidacy.asOf', { date: fmtDay(data.asOf) || '—', deadline: fmtDay(data.deadline) || '—' })}
        </span>
      </div>
      <ul className={SIGNALS_CLASSES}>
        {player.signals.map((s, i) => {
          const k = signalKey(s)
          if (!k) return null
          const params = s.code === 'outside_playoffs' ? { ...k.params, conference: conference(k.params.conference) } : k.params
          return (
            <li key={i} className={SIGNAL_CLASSES} data-code={s.code}>
              {t(k.key, params)}{k.note && <span className="text-[color:var(--text-dim)]"> · {t(k.note.key, k.note.params)}</span>}
            </li>
          )
        })}
      </ul>
      <div className={`${NOTE_CLASSES} trade-candidacy-clause mt-2`}>{t(clause.key, clause.params)}</div>
      {ai && (
        <div className={AI_CLASSES}>
          <div className={AI_LABEL_CLASSES}>⚡ {t('playerPopup.candidacy.aiLabel')}</div>
          <div className={AI_TEXT_CLASSES}>{ai.text}</div>
          <div className={AI_NOTE_CLASSES}>
            {t('playerPopup.candidacy.aiNote')}
            {fmtDay(ai.generatedAt?.slice(0, 10)) && ` · ${fmtDay(ai.generatedAt.slice(0, 10))}`}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TradeCandidacySection({ playerId }) {
  const { i18n } = useTranslation()
  const { data } = useFetch(() => getTradeCandidacy(playerId, i18n.language), [playerId, i18n.language])
  return <TradeCandidacyBody data={data} />
}
