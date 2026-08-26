// components/PercentileBar.jsx
// Extracted from PlayerPopup.jsx (Session 91) so PlayerComparisonPopup.jsx
// can render the same goalie/WAR percentile rows (GSAX, EV Offence, etc)
// without a circular import.
//
// Tailwind migration (Session 97, Phase 3, sub-PR 2). No Cypress selectors
// on any of these classes (audited via grep). PlayersView.css's rules for
// this file's classes are deleted in this same sub-PR -- unlike PlayerPopup.jsx,
// nothing in TeamComparisonPopup.jsx/PlayerComparisonPopup.jsx's own markup
// used the .pa-* classes directly (only via this shared component, which
// PlayerComparisonPopup.jsx already renders and gets the new styling for
// automatically).
import { useTranslation } from 'react-i18next'
import InfoTip from './InfoTip'
import { formatOrdinal } from '../utils/formatters'

const ROW_CLASSES = 'flex items-center gap-2'
const LABEL_CLASSES = 'text-[11px] text-[color:var(--text-muted)] w-[90px] shrink-0'
const NA_CLASSES = 'text-[11px] text-[color:var(--text-dim)] italic'
const BAR_WRAP_CLASSES = 'flex-1 flex items-center gap-[6px]'
const BAR_TRACK_CLASSES = 'flex-1 h-[6px] bg-[var(--bg3)] rounded-[3px] overflow-hidden'
const BAR_FILL_CLASSES = 'h-full rounded-[3px] [transition:width_0.3s]'
const PCT_CLASSES = 'text-[11px] font-bold font-[family-name:var(--font-mono)] w-[32px] text-right shrink-0'
const TIER_CLASSES = 'text-[10px] w-[72px] shrink-0'

export default function PercentileBar({ label, pct, note, na }) {
  const { t } = useTranslation()
  if (na || pct == null) {
    const naNote = note || t('percentileBar.naFallback', { label })
    return (
      <div className={ROW_CLASSES}>
        <span className={LABEL_CLASSES}>
          {label}
          {naNote && <InfoTip text={naNote} position="above" />}
        </span>
        <span className={NA_CLASSES}>{t('percentileBar.na')}</span>
      </div>
    )
  }
  const color = pct >= 67 ? '#4ade80' : pct >= 34 ? '#fbbf24' : '#f87171'
  const tier  = pct >= 90 ? t('percentileBar.tierElite') : pct >= 75 ? t('percentileBar.tierGreat') : pct >= 50 ? t('percentileBar.tierAboveAvg')
              : pct >= 25 ? t('percentileBar.tierBelowAvg') : t('percentileBar.tierPoor')
  return (
    <div className={ROW_CLASSES}>
      <span className={LABEL_CLASSES}>
        {label}
        {note && <InfoTip text={note} position="above" />}
      </span>
      <div className={BAR_WRAP_CLASSES}>
        <div className={BAR_TRACK_CLASSES}>
          <div className={BAR_FILL_CLASSES} style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className={PCT_CLASSES} style={{ color }}>{formatOrdinal(pct)}</span>
        <span className={TIER_CLASSES} style={{ color }}>{tier}</span>
      </div>
    </div>
  )
}
