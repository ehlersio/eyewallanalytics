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
import InfoTip from './InfoTip'

const ROW_CLASSES = 'flex items-center gap-2'
const LABEL_CLASSES = 'text-[11px] text-[color:var(--text-muted)] w-[90px] shrink-0'
const NA_CLASSES = 'text-[11px] text-[color:var(--text-dim)] italic'
const BAR_WRAP_CLASSES = 'flex-1 flex items-center gap-[6px]'
const BAR_TRACK_CLASSES = 'flex-1 h-[6px] bg-[var(--bg3)] rounded-[3px] overflow-hidden'
const BAR_FILL_CLASSES = 'h-full rounded-[3px] [transition:width_0.3s]'
const PCT_CLASSES = 'text-[11px] font-bold font-[family-name:var(--font-mono)] w-[32px] text-right shrink-0'
const TIER_CLASSES = 'text-[10px] w-[72px] shrink-0'

export default function PercentileBar({ label, pct, note, na }) {
  if (na || pct == null) {
    const naNote = note || `${label} data unavailable — player may not have enough ice time in this situation to generate a reliable percentile.`
    return (
      <div className={ROW_CLASSES}>
        <span className={LABEL_CLASSES}>
          {label}
          {naNote && <InfoTip text={naNote} position="above" />}
        </span>
        <span className={NA_CLASSES}>N/A</span>
      </div>
    )
  }
  const color = pct >= 67 ? '#4ade80' : pct >= 34 ? '#fbbf24' : '#f87171'
  const tier  = pct >= 90 ? 'Elite' : pct >= 75 ? 'Great' : pct >= 50 ? 'Above avg'
              : pct >= 25 ? 'Below avg' : 'Poor'
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
        <span className={PCT_CLASSES} style={{ color }}>{pct}th</span>
        <span className={TIER_CLASSES} style={{ color }}>{tier}</span>
      </div>
    </div>
  )
}
