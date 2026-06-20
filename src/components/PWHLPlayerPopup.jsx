// components/PWHLPlayerPopup.jsx
// Player detail popup for PWHL players — mirrors NHL PlayerPopup structure.
// Tabs: Stats only (no Analytics/HeatMap/Scout — data not available for PWHL).
import { useState } from 'react';
import InfoTip from './InfoTip';
import '../views/PlayersView.css';

// ── Stat definitions ─────────────────────────────────────────

const SKATER_STATS = [
  { key: 'goals',      label: 'Goals',  group: 'Scoring',
    tip: 'Total goals scored.',
    why: 'The most direct measure of finishing ability and offensive contribution.' },
  { key: 'assists',    label: 'Assists', group: 'Scoring',
    tip: 'Points credited for setting up a goal.',
    why: 'Reflects playmaking and vision.' },
  { key: 'points',     label: 'Points', group: 'Scoring',
    tip: 'Goals + Assists.',
    why: 'Primary measure of offensive production.' },
  { key: 'plus_minus', label: '+/−',    group: 'Scoring',
    tip: '+1 when on ice for a goal for; −1 for a goal against at even strength.',
    why: 'Rough proxy for two-way effectiveness.' },
  { key: 'gp',         label: 'GP',     group: 'Scoring',
    tip: 'Games played.',
    why: 'Context for all counting stats.' },
  { key: 'pp_goals',   label: 'PPG',    group: 'Special Teams',
    tip: 'Goals scored on the power play.',
    why: 'Indicates value on the man-advantage unit.' },
  { key: 'sh_goals',   label: 'SHG',    group: 'Special Teams',
    tip: 'Goals scored while shorthanded.',
    why: 'Rare and opportunistic — indicates speed and instinct.' },
  { key: 'gw_goals',   label: 'GWG',    group: 'Special Teams',
    tip: 'The goal that proved to be the winning margin.',
    why: 'A measure of clutch scoring.' },
  { key: 'shots',      label: 'Shots',  group: 'Shot Quality',
    tip: 'Shots on goal.',
    why: 'High shot volume indicates offensive presence even when not scoring.' },
  { key: 'shot_pct',   label: 'S%',     group: 'Shot Quality',
    tip: 'Goals ÷ Shots on Goal × 100.',
    why: 'Sustained high S% indicates elite finishing; extreme values often regress.' },
  { key: 'pim',        label: 'PIM',    group: 'Discipline',
    tip: 'Penalty minutes.',
    why: 'High PIM hurts the team; compare to physical impact for full picture.' },
];

const GOALIE_STATS = [
  { key: 'gp',           label: 'GP',  group: 'Record',
    tip: 'Games played.', why: 'Context for all other stats.' },
  { key: 'wins',         label: 'W',   group: 'Record',
    tip: 'Wins.', why: 'Primary measure of team contribution.' },
  { key: 'losses',       label: 'L',   group: 'Record',
    tip: 'Regulation losses.', why: 'Combined with OTL gives the full record picture.' },
  { key: 'ot_losses',    label: 'OTL', group: 'Record',
    tip: 'Overtime/shootout losses (1 point for the team).', why: 'Goalies with many OTL often faced close games.' },
  { key: 'sv_pct',       label: 'SV%', group: 'Performance',
    tip: 'Saves ÷ Shots Against.',
    why: 'The most important goalie stat. Even small differences are significant.' },
  { key: 'gaa',          label: 'GAA', group: 'Performance',
    tip: 'Goals allowed per 60 minutes.',
    why: 'Best read alongside SV% for full context.' },
  { key: 'shutouts',     label: 'SO',  group: 'Performance',
    tip: 'Games where the goalie allowed zero goals.',
    why: 'A prestigious milestone.' },
  { key: 'saves',        label: 'SV',  group: 'Performance',
    tip: 'Total saves made.', why: 'Combined with shots against gives SV%.' },
  { key: 'goals_against',label: 'GA',  group: 'Performance',
    tip: 'Total goals allowed.', why: 'Context for GAA and SV%.' },
];

// ── Helpers ───────────────────────────────────────────────────

function posLabel(code) {
  return { C:'Centre', LW:'Left Wing', RW:'Right Wing', D:'Defence', G:'Goalie', F:'Forward' }[code] || code;
}

function fmtBirth(str) {
  if (!str) return null;
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function calcAge(str) {
  if (!str) return null;
  const today = new Date(), dob = new Date(str);
  let age = today.getFullYear() - dob.getFullYear();
  if (today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
  return age;
}

// ── Sub-components ────────────────────────────────────────────

function StatRow({ def, value }) {
  let fmt = value;
  if (def.key === 'shot_pct' && value != null) fmt = `${Number(value).toFixed(1)}%`;
  else if (def.key === 'sv_pct' && value != null) fmt = Number(value).toFixed(3).replace('0.', '.');
  else if (def.key === 'gaa'    && value != null) fmt = Number(value).toFixed(2);
  else if (def.key === 'plus_minus' && value != null) fmt = value > 0 ? `+${value}` : String(value);
  if (fmt == null) return null;

  return (
    <div className="stat-row">
      <div className="stat-row-left">
        <span className="stat-row-label">{def.label}</span>
        <InfoTip text={`${def.tip}${def.why ? ` — ${def.why}` : ''}`} position="above" />
      </div>
      <span className="stat-row-value">{fmt}</span>
    </div>
  );
}

function StatGroup({ group, defs, stats }) {
  const rows = defs.filter(d => d.group === group && stats?.[d.key] != null);
  if (!rows.length) return null;
  return (
    <div className="stat-group">
      <div className="stat-group-label">{group}</div>
      {rows.map(def => (
        <StatRow key={def.key} def={def} value={stats[def.key]} />
      ))}
    </div>
  );
}

function StatsSection({ label, stats, defs, highlight }) {
  const [open, setOpen] = useState(highlight);
  if (!stats) return null;
  const groups = [...new Set(defs.map(d => d.group))];
  const hasAny = defs.some(d => stats[d.key] != null);
  if (!hasAny) return null;

  return (
    <div className={`stat-section${highlight ? ' highlight-section' : ''}`}>
      <button className="stat-section-header" onClick={() => setOpen(o => !o)}>
        <span className="stat-section-label">{label}</span>
        {highlight && <span className="stat-section-current">Current</span>}
        <span className="stat-section-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="stat-section-body">
          {groups.map(g => (
            <StatGroup key={g} group={g} defs={defs} stats={stats} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main popup ────────────────────────────────────────────────

export default function PWHLPlayerPopup({ player: p, seasonLabel, onClose }) {
  const [imgErr, setImgErr] = useState(false);
  const isGoalie  = p.position === 'G';
  const defs      = isGoalie ? GOALIE_STATS : SKATER_STATS;
  const name      = p.player_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
  const firstName = p.first_name || name.split(' ')[0] || '';
  const lastName  = p.last_name  || name.split(' ').slice(1).join(' ') || '';
  const headshot  = p.headshot || `https://assets.leaguestat.com/pwhl/240x240/${p.player_id}.jpg`;
  const initials  = (firstName[0] || '') + (lastName[0] || '');

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="player-popup" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pp-header">
          <div className="pp-photo-wrap">
            {!imgErr ? (
              <img src={headshot} alt={name} className="pp-photo"
                onError={() => setImgErr(true)} />
            ) : (
              <div className="pp-photo-fallback">{initials}</div>
            )}
          </div>
          <div className="pp-identity">
            {p.jersey_number && <div className="pp-num">#{p.jersey_number}</div>}
            <div className="pp-name">
              <span className="pp-first">{firstName}</span>
              <span className="pp-last">{lastName}</span>
            </div>
            <div className="pp-chips">
              {p.position && <span className="pp-pos-chip">{posLabel(p.position)}</span>}
              {p.shoots    && <span className="pp-chip">Shoots {p.shoots === 'L' ? 'Left' : p.shoots === 'R' ? 'Right' : p.shoots}</span>}
            </div>
            {p.birth_date && (
              <div className="pp-birth">
                {fmtBirth(p.birth_date)} · Age {calcAge(p.birth_date)}
                {p.birth_city ? ` · ${p.birth_city}` : ''}
              </div>
            )}
          </div>
          <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Stats ── */}
        <div className="pp-body">
          <StatsSection
            label={`${seasonLabel} Regular Season`}
            stats={p}
            defs={defs}
            highlight
          />
          {!defs.some(d => p[d.key] != null) && (
            <div className="pp-no-stats">No stats available for this player yet.</div>
          )}
        </div>

      </div>
    </div>
  );
}
