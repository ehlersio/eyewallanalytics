import './StatBar.css';

// Shows a horizontal comparison bar between two values (e.g. CAR 61% vs OPP 39%)
// pct: 0-100 representing the "left" team's share
// labels: { left, right, leftVal, rightVal }
export function StatBar({ label, leftPct, leftVal, rightVal, leftColor = 'red' }) {
  const rightPct = 100 - leftPct;

  return (
    <div className="stat-bar-row">
      <div className="stat-bar-label">{label}</div>
      <div className="stat-bar-track">
        <div
          className={`stat-bar-fill fill-${leftColor}`}
          style={{ width: `${leftPct}%` }}
        />
        <div
          className="stat-bar-fill fill-blue"
          style={{ width: `${rightPct}%` }}
        />
      </div>
      <div className="stat-bar-vals">
        <span className={`val-${leftColor}`}>{leftVal}</span>
        <span className="val-opp">{rightVal}</span>
      </div>
    </div>
  );
}

// Single metric card — big number with label and optional sub-label
export function MetCard({ label, value, sub, color, onClick }) {
  return (
    <div className={`met-card${onClick ? ' met-card-clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="met-label">{label}</div>
      <div className={`met-value ${color || ''}`}>{value ?? '—'}</div>
      {sub && <div className="met-sub">{sub}</div>}
    </div>
  );
}

// Loading skeleton version of MetCard
export function MetCardSkeleton() {
  return (
    <div className="met-card">
      <div className="skeleton" style={{ height: 10, width: '60%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 22, width: '40%' }} />
    </div>
  );
}
