/**
 * CapHitChip.jsx
 * A player's current cap hit and one-way / two-way status as a small chip
 * (call-up watch) or an inline note (trade trees), from utils/
 * capAnnotations.js's capFacts(). Renders nothing without facts, so a
 * player the dataset doesn't know gets no claim at all.
 *
 * Props:
 *   facts   {object|null} — capFacts(index, playerId)
 *   variant {'chip'|'inline'}
 *   now     {boolean}     — say "now …" (a trade tree: the deal he is on today,
 *                            not the one he was traded on)
 */
import { useTranslation } from 'react-i18next'
import { fmtCapHit } from '../utils/capTable'

const CHIP_CLASSES = 'cap-hit-chip text-[9px] py-px px-1.5 rounded-[3px] bg-[var(--bg3)] text-[color:var(--text-muted)] whitespace-nowrap'
const INLINE_CLASSES = 'cap-hit-inline text-[11px] text-[color:var(--text-dim)] whitespace-nowrap'

export default function CapHitChip({ facts, variant = 'chip', now = false }) {
  const { t } = useTranslation()
  if (!facts) return null
  const parts = []
  if (facts.isELC) parts.push(t('capChip.elc'))
  if (facts.twoWay === true) parts.push(t('capChip.twoWay'))
  else if (facts.twoWay === false) parts.push(t('capChip.oneWay'))
  const money = fmtCapHit(facts.capHit)
  if (money) parts.push(now ? t('capChip.now', { capHit: money }) : money)
  if (!parts.length) return null
  const text = parts.join(' · ') + (facts.reported ? ' ≈' : '')
  const title = [
    money ? t('capChip.titleCapHit', { capHit: money }) : null,
    facts.expiresAfter ? t('capChip.thru', { season: facts.expiresAfter }) : null,
    facts.twoWay === true ? t('capChip.twoWayTip') : facts.twoWay === false ? t('capChip.oneWayTip') : null,
    facts.reported ? t('teamView.cap.reportedLegend') : null,
  ].filter(Boolean).join(' · ')
  return (
    <span className={variant === 'inline' ? INLINE_CLASSES : CHIP_CLASSES} title={title} data-two-way={facts.twoWay == null ? undefined : String(facts.twoWay)}>
      {variant === 'inline' ? ` · ${text}` : text}
    </span>
  )
}
