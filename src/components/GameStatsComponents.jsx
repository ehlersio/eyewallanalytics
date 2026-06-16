import React from 'react';
import { computeGSAx } from '../utils/advancedStats';
import InfoTip from '../components/InfoTip';

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
    <div className="period-table">
      <div className="period-row header">
        <span />
        {periods.map(p => <span key={p.label}>{p.label}</span>)}
        <span>T</span>
      </div>
      <div className="period-row car-row">
        <span style={{ color: 'var(--team-primary)', fontWeight: 600 }}>{carAbbr}</span>
        {periods.map(p => <span key={p.label}>{p.carG}</span>)}
        <span className="period-total">{carTotal}</span>
      </div>
      <div className="period-row">
        <span style={{ color: 'var(--text-muted)' }}>{oppAbbr}</span>
        {periods.map(p => <span key={p.label}>{p.oppG}</span>)}
        <span className="period-total">{oppTotal}</span>
      </div>
    </div>
  );
}

// ── Skater table (shared between CAR and OPP) ───────────────

function SkaterTable({ players, goalies }) {
  function fmtSvPct(v) {
    if (v == null) return '—';
    return v <= 1 ? v.toFixed(3) : (v / 100).toFixed(3);
  }

  return (
    <>
      <div className="gp-skater-table">
        <div className="gp-skater-header">
          <span className="col-name">Player</span>
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
          return (
            <div key={i} className={"gp-skater-row" + ((p.points ?? 0) > 0 ? " has-points" : "")}>
              <span className="col-name">
                <span className="gp-player-name">{p.name?.default || ("#" + p.sweaterNumber)}</span>
                <span className="gp-player-num">{"#" + p.sweaterNumber}</span>
              </span>
              <span>{p.goals ?? 0}</span>
              <span>{p.assists ?? 0}</span>
              <span className={(p.points ?? 0) > 0 ? "gp-pts-highlight" : ""}>{p.points ?? 0}</span>
              <span style={{ color: pmColor }}>{pmStr}</span>
              <span>{p.shots ?? 0}</span>
              <span>{p.hits ?? 0}</span>
              <span>{p.blockedShots ?? p.blocks ?? 0}</span>
              <span className="gp-toi">{p.toi ?? "—"}</span>
            </div>
          );
        })}
      </div>

      {goalies.length > 0 && goalies.map((g, i) => (
        <div key={i} className="gp-goalie-row" style={{ marginTop: 8 }}>
          <span className="gp-player-name">{g.name?.default || ("#" + g.sweaterNumber)}</span>
          <div className="gp-goalie-stats">
            <span className="gp-goalie-stat"><span className="gp-goalie-label">SA</span>{g.shotsAgainst ?? "—"}</span>
            <span className="gp-goalie-stat"><span className="gp-goalie-label">SV</span>{g.saves ?? "—"}</span>
            <span className="gp-goalie-stat"><span className="gp-goalie-label">SV%</span>{fmtSvPct(g.savePctg)}</span>
            <span className="gp-goalie-stat"><span className="gp-goalie-label">TOI</span>{g.toi ?? "—"}</span>
            {(() => { const gsax = computeGSAx(g.shotsAgainst, g.saves); return gsax ? (
              <span className="gp-goalie-stat">
                <span className="gp-goalie-label">GSAx</span>
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
    <span className="goal-strength-chip" style={{ color: c.color, background: c.bg }}>
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

  if (!allGoals.length) return <div className="gp-no-data">No scoring data available.</div>;

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
    <div className="goals-two-col">
      {/* Column headers — single row, no border */}
      <div className="goals-header-row">
        <span className="goals-col-header" style={{ color: 'var(--team-primary)' }}>{carAbbr}</span>
        <span />
        <span className="goals-col-header right" style={{ color: oppColor || 'var(--text-muted)' }}>{oppAbbr}</span>
      </div>

      {periods.map(({ label, carGoals, oppGoals }) => {
        const maxRows = Math.max(carGoals.length, oppGoals.length, 1);
        return (
          <div key={label} className="goals-period-group">
            {/* Period divider spanning full width */}
            <div className="goals-period-divider">
              <span className="goals-period-label">{label}</span>
            </div>

            {/* Goal rows side by side */}
            {Array.from({ length: maxRows }).map((_, rowIdx) => {
              const carG = carGoals[rowIdx] || null;
              const oppG = oppGoals[rowIdx] || null;
              return (
                <div key={rowIdx} className="goals-row-pair">
                  {/* CAR goal — left column */}
                  <div className="goal-cell car">
                    {carG && <GoalEntry goal={carG} isCar side="left" />}
                  </div>
                  {/* Centre spacer */}
                  <div className="goal-cell-mid" />
                  {/* OPP goal — right column */}
                  <div className="goal-cell opp">
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
    <div className={`goal-entry ${side}`}>
      <div className="goal-entry-top" style={{ textAlign: align }}>
        <span className="goal-entry-time">{g.timeInPeriod}</span>
        {chip}
      </div>
      <div className="goal-entry-scorer" style={{ color, textAlign: align }}>
        🚨 {scorer}
        {g.goalsToDate != null && (
          <span className="goal-season-num"> ({g.goalsToDate})</span>
        )}
      </div>
      {assistNames.length > 0 ? (
        <div className="goal-entry-assists" style={{ textAlign: align }}>
          {assistNames.join(', ')}
        </div>
      ) : (
        <div className="goal-entry-assists unassisted" style={{ textAlign: align }}>
          Unassisted
        </div>
      )}
    </div>
  );
}


// ── Series card ──────────────────────────────────────────────



export { PeriodTable, SkaterTable, GoalsList };
