import React from 'react';
import { computeGSAx } from '../utils/advancedStats';
import InfoTip from '../components/InfoTip';

// Styling used to come from ScheduleView.css -- migrated to Tailwind here
// (Phase 6, ScheduleView.css sub-PR 3). NHL-only, single real consumer
// GameStatsPopup.jsx (confirmed via full-tree grep -- PWHL's box score
// system is a self-contained sibling, PWHLGameStatsPopup.css/.pgs-*/.pbs-*).
// The "Goals list" wrapper classes this file used to also carry
// (.goals-list/.goal-row/.goal-meta/.goal-detail/bare .goal-scorer/
// .goal-strength) were confirmed genuinely dead -- zero JSX consumers
// anywhere -- and dropped rather than migrated. .goal-season-num is a bare
// class matched by both that dead block's own rule AND the live
// .goal-entry-scorer-nested one below it in the original CSS; even with the
// dead block's wrappers gone, its rule still cascaded onto this shared
// classname -- final resolved value (font-weight:400 from the dead rule,
// color:var(--text-dim) from the live one, since it came later) is what's
// actually rendered today and is what's carried forward here.
const PERIOD_ROW_BASE = 'period-row grid gap-1 text-[13px] text-center [grid-template-columns:40px_repeat(auto-fill,minmax(28px,1fr))] [&>span:first-child]:text-left';

function PeriodTable({ scoring, _home, carAbbr, oppAbbr }) {
  // scoring is array of periods, each with goals array
  const periods = scoring.map((p, i) => {
    const num = p.period || i + 1;
    const label = num <= 3 ? `P${num}` : num === 4 ? 'OT' : `OT${num - 3}`;
    let carG = 0, oppG = 0;
    (p.goals || []).forEach(g => {
      if (g.teamAbbrev?.default === carAbbr) carG++;
      else oppG++;
    });
    return { label, carG, oppG };
  });

  const carTotal = periods.reduce((s, p) => s + p.carG, 0);
  const oppTotal = periods.reduce((s, p) => s + p.oppG, 0);

  return (
    <div className="period-table flex flex-col gap-1">
      <div className={`${PERIOD_ROW_BASE} header text-[10px] text-[color:var(--text-dim)]`}>
        <span />
        {periods.map(p => <span key={p.label}>{p.label}</span>)}
        <span>T</span>
      </div>
      <div className={`${PERIOD_ROW_BASE} car-row text-[color:var(--text)]`}>
        <span style={{ color: 'var(--team-primary)', fontWeight: 600 }}>{carAbbr}</span>
        {periods.map(p => <span key={p.label}>{p.carG}</span>)}
        <span className="period-total font-bold text-[color:var(--text)]">{carTotal}</span>
      </div>
      <div className={PERIOD_ROW_BASE}>
        <span style={{ color: 'var(--text-muted)' }}>{oppAbbr}</span>
        {periods.map(p => <span key={p.label}>{p.oppG}</span>)}
        <span className="period-total font-bold text-[color:var(--text)]">{oppTotal}</span>
      </div>
    </div>
  );
}

// ── Skater table (shared between CAR and OPP) ───────────────

const SKATER_GRID_COLS = '[grid-template-columns:1fr_28px_28px_34px_34px_34px_34px_34px_44px] max-[400px]:[grid-template-columns:1fr_26px_26px_30px_30px_30px_40px] max-[400px]:[&>span:nth-child(7)]:hidden max-[400px]:[&>span:nth-child(8)]:hidden';
const SKATER_COL_NAME_CLASSES = 'col-name text-left flex items-center gap-1 min-w-0';

function SkaterTable({ players, goalies }) {
  function fmtSvPct(v) {
    if (v == null) return '—';
    return v <= 1 ? v.toFixed(3) : (v / 100).toFixed(3);
  }

  return (
    <>
      <div className="gp-skater-table w-full">
        <div className={`gp-skater-header grid gap-0.5 items-center text-[11px] text-center text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.06em] pb-[5px] border-b-[0.5px] border-b-[color:var(--border)] mb-0.5 ${SKATER_GRID_COLS}`}>
          <span className={SKATER_COL_NAME_CLASSES}>Player</span>
          <span title="Goals">G</span>
          <span title="Assists">A</span>
          <span title="Points">PTS</span>
          <span title="Plus/Minus">+/−</span>
          <span title="Shots on Goal">SOG</span>
          <span title="Hits">HIT</span>
          <span title="Blocked Shots">BLK</span>
          <span title="Time on Ice">TOI</span>
        </div>
        {players.map((p, i) => {
          const pm = p.plusMinus;
          const pmStr   = pm != null ? (pm >= 0 ? "+" + pm : "" + pm) : "—";
          const pmColor = pm > 0 ? "var(--green)" : pm < 0 ? "var(--red-bright)" : "var(--text-muted)";
          const hasPoints = (p.points ?? 0) > 0;
          return (
            <div key={i} className={`gp-skater-row grid gap-0.5 items-center text-[11px] text-center py-[5px] border-b-[0.5px] border-b-[rgba(255,255,255,0.04)] ${hasPoints ? 'has-points text-[color:var(--text)]' : 'text-[color:var(--text-muted)]'} ${SKATER_GRID_COLS}`}>
              <span className={SKATER_COL_NAME_CLASSES}>
                <span className="gp-player-name text-[12px] whitespace-nowrap overflow-hidden text-ellipsis">{p.name?.default || ("#" + p.sweaterNumber)}</span>
                <span className="gp-player-num text-[9px] text-[color:var(--text-dim)] shrink-0">{"#" + p.sweaterNumber}</span>
              </span>
              <span>{p.goals ?? 0}</span>
              <span>{p.assists ?? 0}</span>
              <span className={hasPoints ? "gp-pts-highlight text-[color:var(--green)] font-semibold" : ""}>{p.points ?? 0}</span>
              <span style={{ color: pmColor }}>{pmStr}</span>
              <span>{p.shots ?? 0}</span>
              <span>{p.hits ?? 0}</span>
              <span>{p.blockedShots ?? p.blocks ?? 0}</span>
              <span className="gp-toi font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--text-muted)]">{p.toi ?? "—"}</span>
            </div>
          );
        })}
      </div>

      {goalies.length > 0 && goalies.map((g, i) => (
        <div key={i} className="gp-goalie-row flex items-center justify-between py-2 border-b-[0.5px] border-b-[color:var(--border)]" style={{ marginTop: 8 }}>
          <span className="gp-player-name text-[color:var(--text)] text-[12px]">{g.name?.default || ("#" + g.sweaterNumber)}</span>
          <div className="gp-goalie-stats flex gap-3">
            <span className="gp-goalie-stat flex flex-col items-center gap-[1px] text-[13px] font-medium"><span className="gp-goalie-label text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]">SA</span>{g.shotsAgainst ?? "—"}</span>
            <span className="gp-goalie-stat flex flex-col items-center gap-[1px] text-[13px] font-medium"><span className="gp-goalie-label text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]">SV</span>{g.saves ?? "—"}</span>
            <span className="gp-goalie-stat flex flex-col items-center gap-[1px] text-[13px] font-medium"><span className="gp-goalie-label text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]">SV%</span>{fmtSvPct(g.savePctg)}</span>
            <span className="gp-goalie-stat flex flex-col items-center gap-[1px] text-[13px] font-medium"><span className="gp-goalie-label text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]">TOI</span>{g.toi ?? "—"}</span>
            {(() => { const gsax = computeGSAx(g.shotsAgainst, g.saves); return gsax ? (
              <span className="gp-goalie-stat flex flex-col items-center gap-[1px] text-[13px] font-medium">
                <span className="gp-goalie-label text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]">GSAx</span>
                <span style={{color:gsax.color}}>{gsax.label} <InfoTip text={gsax.note} position="above" /></span>
              </span>
            ) : null; })()}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Goals list ───────────────────────────────────────────────

// Strength codes from NHL API — 'EV'/'ev' = even strength (don't show chip)
// Show a chip only for PP, SH, EN goals
function strengthChip(strength) {
  if (!strength) return null;
  const s = strength.toUpperCase();
  if (s === 'EV' || s === '5V5') return null; // even strength — no chip
  const config = {
    PP:  { label: 'PP',  color: '#ffaa22', bg: 'rgba(255,170,34,0.15)' },
    SH:  { label: 'SH',  color: '#4477ee', bg: 'rgba(68,119,238,0.15)' },
    EN:  { label: 'EN',  color: '#8899aa', bg: 'rgba(136,153,170,0.15)' },
  };
  // Handle numeric situation codes: 1451=PP, 1541=SH, etc.
  // The API also returns string like 'pp', 'sh', 'en'
  const key = Object.keys(config).find(k => s.includes(k)) || null;
  if (!key) return null;
  const c = config[key];
  return (
    <span className="goal-strength-chip text-[9px] font-bold py-[2px] px-[5px] rounded-[3px] tracking-[0.04em]" style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  );
}

function GoalsList({ scoring, carAbbr, oppAbbr, oppColor }) {
  // Flatten all goals, annotating each with period label and team side
  const allGoals = scoring.flatMap((p, pi) => {
    const num = p.period || pi + 1;
    const periodLabel = num <= 3 ? `P${num}` : num === 4 ? 'OT' : `OT${num - 3}`;
    return (p.goals || []).map(g => ({ ...g, periodLabel, periodNum: num }));
  });

  if (!allGoals.length) return <div className="gp-no-data text-[12px] text-[color:var(--text-dim)] text-center py-4 italic">No scoring data available.</div>;

  // Group goals by period for the side-by-side layout
  const byPeriod = {};
  allGoals.forEach(g => {
    const key = g.periodLabel;
    if (!byPeriod[key]) byPeriod[key] = { label: key, carGoals: [], oppGoals: [] };
    const teamAbbr = g.teamAbbrev?.default || g.teamAbbrev || '';
    if (teamAbbr === carAbbr) byPeriod[key].carGoals.push(g);
    else                       byPeriod[key].oppGoals.push(g);
  });

  const periods = Object.values(byPeriod);

  return (
    <div className="goals-two-col flex flex-col gap-0">
      {/* Column headers — single row, no border. .goals-col-header was
          defined twice in the original CSS (an 11px version with its own
          unused .center modifier, and a 14px version) -- only the 14px
          version actually applies (later in source, wins on font-size);
          the earlier block's padding is the only piece of it that still
          carries over, since the later block never set its own. */}
      <div className="goals-header-row grid gap-1 mb-1.5 [grid-template-columns:1fr_12px_1fr]">
        <span className="goals-col-header font-[family-name:var(--font-display)] text-[14px] font-bold pb-1.5 tracking-[0.06em]" style={{ color: 'var(--team-primary)' }}>{carAbbr}</span>
        <span />
        <span className="goals-col-header right font-[family-name:var(--font-display)] text-[14px] font-bold pb-1.5 tracking-[0.06em] text-right" style={{ color: oppColor || 'var(--text-muted)' }}>{oppAbbr}</span>
      </div>

      {periods.map(({ label, carGoals, oppGoals }) => {
        const maxRows = Math.max(carGoals.length, oppGoals.length, 1);
        return (
          <div key={label} className="goals-period-group">
            {/* Period divider spanning full width */}
            <div className="goals-period-divider flex items-center gap-2 my-2 mb-1 [&::before]:content-[''] [&::before]:flex-1 [&::before]:h-[0.5px] [&::before]:bg-[var(--border)] [&::after]:content-[''] [&::after]:flex-1 [&::after]:h-[0.5px] [&::after]:bg-[var(--border)]">
              <span className="goals-period-label text-[10px] font-[family-name:var(--font-display)] font-bold text-[color:var(--text-dim)] tracking-[0.08em] uppercase shrink-0">{label}</span>
            </div>

            {/* Goal rows side by side */}
            {Array.from({ length: maxRows }).map((_, rowIdx) => {
              const carG = carGoals[rowIdx] || null;
              const oppG = oppGoals[rowIdx] || null;
              return (
                <div key={rowIdx} className="goals-row-pair grid gap-1 mb-2 items-start [grid-template-columns:1fr_12px_1fr]">
                  {/* CAR goal — left column */}
                  <div className="goal-cell car min-w-0">
                    {carG && <GoalEntry goal={carG} isCar side="left" />}
                  </div>
                  {/* Centre spacer */}
                  <div className="goal-cell-mid" />
                  {/* OPP goal — right column */}
                  <div className="goal-cell opp min-w-0">
                    {oppG && <GoalEntry goal={oppG} isCar={false} side="right" />}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function GoalEntry({ goal: g, isCar, side }) {
  const scorer = g.name?.default ||
    [g.firstName?.default, g.lastName?.default].filter(Boolean).join(' ') ||
    'Unknown';

  let assistNames = [];
  if (Array.isArray(g.assists) && g.assists.length) {
    assistNames = g.assists.map(a =>
      a.name?.default ||
      [a.firstName?.default, a.lastName?.default].filter(Boolean).join(' ') ||
      `#${a.playerId}`
    ).filter(Boolean);
  } else {
    assistNames = [
      g.assist1Name?.default, g.assist2Name?.default,
      g.assist1?.name?.default, g.assist2?.name?.default,
    ].filter(Boolean);
  }

  const chip  = strengthChip(g.strength || g.situationCode);
  const color = isCar ? 'var(--team-primary)' : 'var(--blue-bright)';
  const align = side === 'right' ? 'right' : 'left';

  return (
    <div className={`goal-entry ${side} flex flex-col gap-0.5`}>
      <div className={`goal-entry-top flex items-center gap-[5px] flex-wrap ${side === 'right' ? 'justify-end' : ''}`} style={{ textAlign: align }}>
        <span className="goal-entry-time text-[10px] text-[color:var(--text-dim)] font-[family-name:var(--font-mono)]">{g.timeInPeriod}</span>
        {chip}
      </div>
      <div className="goal-entry-scorer text-[12px] font-semibold leading-[1.3]" style={{ color, textAlign: align }}>
        🚨 {scorer}
        {g.goalsToDate != null && (
          <span className="goal-season-num text-[11px] font-normal text-[color:var(--text-dim)]"> ({g.goalsToDate})</span>
        )}
      </div>
      {assistNames.length > 0 ? (
        <div className="goal-entry-assists text-[10px] text-[color:var(--text-muted)] leading-[1.3]" style={{ textAlign: align }}>
          {assistNames.join(', ')}
        </div>
      ) : (
        <div className="goal-entry-assists unassisted text-[10px] leading-[1.3] italic text-[color:var(--text-dim)]" style={{ textAlign: align }}>
          Unassisted
        </div>
      )}
    </div>
  );
}


// ── Series card ──────────────────────────────────────────────



export { PeriodTable, SkaterTable, GoalsList };
