// Tailwind migration (Session 95, Phase 1) -- previously StatBar.css.
const ROW_CLASSES   = 'mb-2.5';
const LABEL_CLASSES  = 'text-[11px] text-[color:var(--text-muted)] mb-1';
const TRACK_CLASSES  = 'h-[5px] rounded-[3px] bg-[rgba(255,255,255,0.07)] flex overflow-hidden mb-[3px]';
const FILL_CLASSES   = 'h-full [transition:width_0.4s_ease]';
const FILL_COLOR = { red: 'bg-[var(--red)]', green: 'bg-[var(--green)]', blue: 'bg-[var(--blue-bright)]' };
const VALS_CLASSES   = 'flex justify-between text-[10px] font-[family-name:var(--font-mono)]';
const VAL_COLOR = { red: 'text-[color:var(--red-bright)]', green: 'text-[color:var(--green)]' };
const VAL_OPP_CLASSES = 'text-[color:var(--text-muted)]';

const MET_CARD_CLASSES = 'bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-[var(--radius-sm)] py-2.5 px-3 text-center flex flex-col items-center relative';
// Keeps the literal "met-card-clickable" class name alongside the Tailwind
// utilities -- pwhl-shot-map.cy.js selects on it directly. Carries no CSS
// of its own anymore; Tailwind owns the visuals, this is a pure test hook.
const MET_CARD_CLICKABLE_CLASSES = "met-card-clickable cursor-pointer [transition:background_0.15s,transform_0.1s] hover:bg-[var(--bg3)] hover:-translate-y-px active:translate-y-0 after:content-['›'] after:absolute after:bottom-1 after:right-1.5 after:text-[11px] after:text-[color:var(--text-dim)] after:opacity-60";
const MET_LABEL_CLASSES = 'text-[9px] uppercase tracking-[0.1em] text-[color:var(--text-dim)] mb-1 font-[family-name:var(--font-display)] font-semibold';
const MET_VALUE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold text-[color:var(--text)] leading-none';
const MET_VALUE_COLOR = {
  green: 'text-[color:var(--green)]',
  red: 'text-[color:var(--red-bright)]',
  amber: 'text-[color:var(--amber)]',
  muted: 'text-[color:var(--text-muted)]',
};
const MET_SUB_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-[3px]';

// Shows a horizontal comparison bar between two values (e.g. CAR 61% vs OPP 39%)
// pct: 0-100 representing the "left" team's share
// labels: { left, right, leftVal, rightVal }
export function StatBar({ label, leftPct, leftVal, rightVal, leftColor = 'red' }) {
  const rightPct = 100 - leftPct;

  return (
    <div className={ROW_CLASSES}>
      <div className={LABEL_CLASSES}>{label}</div>
      <div className={TRACK_CLASSES}>
        <div
          className={`${FILL_CLASSES} ${FILL_COLOR[leftColor] || ''}`}
          style={{ width: `${leftPct}%` }}
        />
        <div
          className={`${FILL_CLASSES} ${FILL_COLOR.blue}`}
          style={{ width: `${rightPct}%` }}
        />
      </div>
      <div className={VALS_CLASSES}>
        <span className={VAL_COLOR[leftColor] || ''}>{leftVal}</span>
        <span className={VAL_OPP_CLASSES}>{rightVal}</span>
      </div>
    </div>
  );
}

// Single metric card — big number with label and optional sub-label
export function MetCard({ label, value, sub, color, onClick }) {
  return (
    <div
      className={`${MET_CARD_CLASSES} ${onClick ? MET_CARD_CLICKABLE_CLASSES : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className={MET_LABEL_CLASSES}>{label}</div>
      <div className={`${MET_VALUE_CLASSES} ${MET_VALUE_COLOR[color] || ''}`}>{value ?? '—'}</div>
      {sub && <div className={MET_SUB_CLASSES}>{sub}</div>}
    </div>
  );
}

// Loading skeleton version of MetCard
export function MetCardSkeleton() {
  return (
    <div className={MET_CARD_CLASSES}>
      <div className="skeleton" style={{ height: 10, width: '60%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 22, width: '40%' }} />
    </div>
  );
}
