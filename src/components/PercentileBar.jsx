// components/PercentileBar.jsx
// Extracted from PlayerPopup.jsx (Session 91) so PlayerComparisonPopup.jsx
// can render the same goalie/WAR percentile rows (GSAX, EV Offence, etc)
// without a circular import. Uses PlayersView.css's .pa-* classes, same as
// before -- purely a file move, no visual change.
import InfoTip from './InfoTip'

export default function PercentileBar({ label, pct, note, na }) {
  if (na || pct == null) {
    const naNote = note || `${label} data unavailable — player may not have enough ice time in this situation to generate a reliable percentile.`
    return (
      <div className="pa-row">
        <span className="pa-label">
          {label}
          {naNote && <InfoTip text={naNote} position="above" />}
        </span>
        <span className="pa-na">N/A</span>
      </div>
    )
  }
  const color = pct >= 67 ? '#4ade80' : pct >= 34 ? '#fbbf24' : '#f87171'
  const tier  = pct >= 90 ? 'Elite' : pct >= 75 ? 'Great' : pct >= 50 ? 'Above avg'
              : pct >= 25 ? 'Below avg' : 'Poor'
  return (
    <div className="pa-row">
      <span className="pa-label">
        {label}
        {note && <InfoTip text={note} position="above" />}
      </span>
      <div className="pa-bar-wrap">
        <div className="pa-bar-track">
          <div className="pa-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="pa-pct" style={{ color }}>{pct}th</span>
        <span className="pa-tier" style={{ color }}>{tier}</span>
      </div>
    </div>
  )
}
