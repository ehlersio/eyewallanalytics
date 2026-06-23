// LeagueView.jsx
// Place in src/views/ alongside LeagueView.css

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { capture } from '../utils/analytics';
import { useFetch } from '../hooks/useFetch';
import {
  getStandings,
  getScoringLeaders,
  getGoalLeaders,
  getGoalieLeaders,
  getPlayoffBracket,
  getPlayoffSeries,
  getPlayoffSeriesGames,
  TEAM_CONFIG,
} from '../utils/nhlApi';
import { getTeamSeasonData, getPowerRankingsNarrative, getPowerRankingsHistory } from '../utils/supabaseClient';
import { ALL_TEAMS } from '../utils/teamConfig';
import TeamLogo from '../components/TeamLogo';
import PlayerPopup from '../components/PlayerPopup';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from '../components/ShareButtons';
import './LeagueView.css';
import '../components/ShareButtons.css';
import '../components/PredictionCanvas.css';
import DraftTab from '../components/DraftTab';

const PRIMARY = TEAM_CONFIG.abbr;
const SEASON  = TEAM_CONFIG.season;

const CLINCH_COLOR = {
  z:   '#1D9E75',
  y:   '#1D9E75',
  x:   '#1D9E75',
  wc1: '#5B8FD4',
  wc2: '#5B8FD4',
};

// ─── L10 dots ────────────────────────────────────────────────────────────────

function L10Dots({ wins, losses, otl }) {
  const results = [
    ...Array(wins).fill('w'),
    ...Array(otl).fill('o'),
    ...Array(losses).fill('l'),
  ].slice(0, 10);

  return (
    <span className="l10-dots" aria-label={`Last 10: ${wins}-${losses}-${otl}`}>
      {results.map((r, i) => (
        <span key={i} className={`l10-dot l10-dot--${r}`} />
      ))}
    </span>
  );
}

// ─── Standings table ──────────────────────────────────────────────────────────

const COL_HEADERS = ['#', 'Team', 'GP', 'W', 'L', 'OTL', 'PTS', 'L10', 'STRK'];

function StandingsRow({ entry, rank }) {
  const abbrev    = entry.teamAbbrev?.default ?? entry.teamAbbrev;
  const isPrimary = abbrev === PRIMARY;
  const clinchColor = CLINCH_COLOR[entry.clinchIndicator] ?? null;

  return (
    <tr
      className={`lv-row${isPrimary ? ' lv-row--you' : ''}`}
      style={isPrimary ? { '--row-accent': PRIMARY_COLOR } : undefined}
    >
      <td className="lv-td lv-td--rank">{rank}</td>
      <td
        className="lv-td lv-td--team"
        style={clinchColor ? { borderLeft: `2.5px solid ${clinchColor}` } : undefined}
      >
        <span className="lv-team-cell">
          <span className="lv-team-abbrev" style={{ color: TEAM_COLORS[abbrev] ?? 'var(--text)' }}>{abbrev}</span>
          {entry.clinchIndicator && (
            <span className="lv-clinch-badge">{entry.clinchIndicator.toUpperCase()}</span>
          )}
        </span>
      </td>
      <td className="lv-td">{entry.gamesPlayed}</td>
      <td className="lv-td">{entry.wins}</td>
      <td className="lv-td">{entry.losses}</td>
      <td className="lv-td">{entry.otLosses}</td>
      <td className="lv-td lv-td--pts">{entry.points}</td>
      <td className="lv-td">
        <L10Dots wins={entry.l10Wins ?? 0} losses={entry.l10Losses ?? 0} otl={entry.l10OtLosses ?? 0} />
      </td>
      <td className="lv-td">
        {(() => {
          if (!entry.streakCode || !entry.streakCount) return '—';
          const code = entry.streakCode === 'W' ? 'W' : 'L';
          const color = code === 'W' ? 'var(--green)' : 'var(--red-bright)';
          return <span style={{ color, fontWeight: 600 }}>{code}{entry.streakCount}</span>;
        })()}
      </td>
    </tr>
  );
}

function StandingsTable({ rows, caption }) {
  return (
    <table className="lv-table" aria-label={caption}>
      <thead>
        <tr>
          {COL_HEADERS.map((h) => (
            <th key={h} className={`lv-th${h === 'Team' ? ' lv-th--team' : ''}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((entry, i) => (
          <StandingsRow key={entry.teamAbbrev?.default ?? i} entry={entry} rank={i + 1} />
        ))}
      </tbody>
    </table>
  );
}

import { groupByDivision, groupByConference, buildWildCard } from '../utils/leagueUtils';

// ─── Standings Panel ──────────────────────────────────────────────────────────

function StandingsPanel({ entries }) {
  const [filter, setFilter] = useState('division');

  const byDivision   = useMemo(() => groupByDivision(entries),  [entries]);
  const byConference = useMemo(() => groupByConference(entries), [entries]);
  const byLeague     = useMemo(() => [...entries].sort((a, b) => a.leagueSequence - b.leagueSequence), [entries]);
  const wildCard     = useMemo(() => buildWildCard(entries),     [entries]);

  const FILTERS = [
    { id: 'division',   label: 'By division' },
    { id: 'conference', label: 'By conference' },
    { id: 'league',     label: 'League' },
    { id: 'wildcard',   label: 'Wild card' },
  ];

  return (
    <div>
      <div className="lv-filter-row" role="group" aria-label="Standings view">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`lv-filter-btn${filter === f.id ? ' lv-filter-btn--active' : ''}`}
            onClick={() => { setFilter(f.id); capture('league_standings_filter', { filter: f.id }); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="lv-legend">
        <span className="lv-legend-item">
          <span className="lv-legend-bar lv-legend-bar--playoff" /> Clinched / in playoff position
        </span>
        <span className="lv-legend-item">
          <span className="lv-legend-bar lv-legend-bar--wc" /> Wild card position
        </span>
      </div>

      {filter === 'division' && ['Eastern', 'Western'].map((confName) => {
        const divs = Object.entries(byDivision).filter(([, v]) => v.conf === confName);
        return (
          <section key={confName} className="lv-conf-section">
            <h3 className="lv-conf-label">{confName} Conference</h3>
            <div className="lv-div-grid">
              {divs.map(([divName, { rows }]) => (
                <div key={divName} className="lv-div-card">
                  <div className="lv-div-card__header">{divName}</div>
                  <StandingsTable rows={rows} caption={`${divName} Division standings`} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {filter === 'conference' && Object.entries(byConference).map(([confName, rows]) => (
        <section key={confName} className="lv-conf-section">
          <h3 className="lv-conf-label">{confName} Conference</h3>
          <div className="lv-div-card lv-div-card--wide">
            <StandingsTable rows={rows} caption={`${confName} Conference standings`} />
          </div>
        </section>
      ))}

      {filter === 'league' && (
        <div className="lv-div-card lv-div-card--wide">
          <StandingsTable rows={byLeague} caption="League standings" />
        </div>
      )}

      {filter === 'wildcard' && Object.entries(wildCard).map(([confName, { divLeaders, wcPool }]) => (
        <section key={confName} className="lv-conf-section">
          <h3 className="lv-conf-label">{confName} Conference</h3>
          <div className="lv-div-grid">
            {Object.entries(divLeaders).map(([divName, rows]) => (
              <div key={divName} className="lv-div-card">
                <div className="lv-div-card__header">{divName} — Division leaders</div>
                <StandingsTable rows={rows} caption={`${divName} division leaders`} />
              </div>
            ))}
          </div>
          <div className="lv-div-card lv-div-card--wide lv-div-card--wc">
            <div className="lv-div-card__header">Wild card race</div>
            <StandingsTable rows={wcPool} caption={`${confName} wild card`} />
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Leaders Panel ────────────────────────────────────────────────────────────

function LeadersCard({ title, statLabel, rows, formatStat, onPlayerClick }) {
  return (
    <div className="lv-leaders-card">
      <div className="lv-leaders-card__header">
        <span>{title}</span>
        <span className="lv-leaders-card__stat-label">{statLabel}</span>
      </div>
      {rows.map((p, i) => {
        const abbrev    = p.teamAbbrev ?? '—';
        const firstName = p.firstName?.default ?? p.name?.split(' ')[0] ?? '—';
        const lastName  = p.lastName?.default  ?? p.name?.split(' ').slice(1).join(' ') ?? '';
        const name      = `${firstName} ${lastName}`.trim();
        const isPrimary = abbrev === PRIMARY;
        const stat      = p.value ?? 0;
        const teamColor = TEAM_COLORS[abbrev] ?? 'var(--text-dim)';
        const pid       = p.playerId ?? p.id ?? null;

        const playerObj = pid ? {
          id:         pid,
          firstName:  { default: firstName },
          lastName:   { default: lastName },
          teamAbbrev: abbrev,
        } : null;

        return (
          <div
            key={pid ?? i}
            className={`lv-leaders-row${pid ? ' lv-leaders-row--clickable' : ''}${isPrimary ? ' lv-leaders-row--you' : ''}`}
            style={isPrimary ? { '--row-accent': PRIMARY_COLOR } : undefined}
            onClick={playerObj ? () => onPlayerClick?.(playerObj) : undefined}
            role={playerObj ? 'button' : undefined}
            tabIndex={playerObj ? 0 : undefined}
            onKeyDown={playerObj ? (e => e.key === 'Enter' && onPlayerClick?.(playerObj)) : undefined}
          >
            <span className="lv-leaders-rank">{i + 1}</span>
            <span className="lv-leaders-name">{name}</span>
            <span className="lv-leaders-team" style={{ color: teamColor }}>{abbrev}</span>
            <span className="lv-leaders-stat">{formatStat ? formatStat(stat) : stat}</span>
          </div>
        );
      })}
    </div>
  );
}

function LeadersPanel({ scoring, goals, gaa, svp }) {
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);

  return (
    <>
      <div className="lv-leaders-grid">
        <LeadersCard title="Points"           statLabel="PTS" rows={scoring ?? []} onPlayerClick={setSelectedPlayer} />
        <LeadersCard title="Goals"            statLabel="G"   rows={goals   ?? []} onPlayerClick={setSelectedPlayer} />
        <LeadersCard
          title="Goals against avg."
          statLabel="GAA"
          rows={gaa ?? []}
          formatStat={(v) => Number(v).toFixed(2)}
          onPlayerClick={setSelectedPlayer}
        />
        <LeadersCard
          title="Save percentage"
          statLabel="SV%"
          rows={svp ?? []}
          formatStat={(v) => Number(v).toFixed(3).replace('0.', '.')}
          onPlayerClick={setSelectedPlayer}
        />
      </div>

      {selectedPlayer && (
        <PlayerPopup
          player={selectedPlayer}
          inPlayoffs={false}
          standings={[]}
          onClose={() => setSelectedPlayer(null)}
          isLeagueContext={true}
        />
      )}
    </>
  );
}

// ─── Bracket Panel (Phase 2) ──────────────────────────────────────────────────

// WCAG AA-compliant team display colors, sourced from teamConfig.js (displayColor).
// These are pre-verified to meet ≥4.5:1 contrast on --bg2 (#101827).
const TEAM_COLORS = Object.fromEntries(ALL_TEAMS.map(t => [t.abbr, t.displayColor]));

// Primary team display color for YOU-row highlights and bracket card accent.
const PRIMARY_COLOR = TEAM_CONFIG.displayColor;

// Last completed playoff bracket — shown during offseason when the API returns no data.
// Update this once per year alongside MP_SEASON (next bump: October 2026 → 20262027 season).
const OFFSEASON_BRACKET = {
  east: [
    { round: 1, series: [
      { top: 'CAR', bottom: 'OTT', topWins: 4, bottomWins: 0 },
      { top: 'PHI', bottom: 'PIT', topWins: 4, bottomWins: 2 },
      { top: 'MTL', bottom: 'TBL', topWins: 4, bottomWins: 3 },
      { top: 'BUF', bottom: 'BOS', topWins: 4, bottomWins: 2 },
    ]},
    { round: 2, series: [
      { top: 'CAR', bottom: 'PHI', topWins: 4, bottomWins: 0 },
      { top: 'MTL', bottom: 'BUF', topWins: 4, bottomWins: 3 },
    ]},
    { round: 3, series: [
      { top: 'CAR', bottom: 'MTL', topWins: 4, bottomWins: 1 },
    ]},
  ],
  west: [
    { round: 1, series: [
      { top: 'VGK', bottom: 'UTA', topWins: 4, bottomWins: 2 },
      { top: 'ANA', bottom: 'EDM', topWins: 4, bottomWins: 2 },
      { top: 'MIN', bottom: 'DAL', topWins: 4, bottomWins: 2 },
      { top: 'COL', bottom: 'LAK', topWins: 4, bottomWins: 0 },
    ]},
    { round: 2, series: [
      { top: 'VGK', bottom: 'ANA', topWins: 4, bottomWins: 2 },
      { top: 'COL', bottom: 'MIN', topWins: 4, bottomWins: 1 },
    ]},
    { round: 3, series: [
      { top: 'VGK', bottom: 'COL', topWins: 4, bottomWins: 0 },
    ]},
  ],
  final: { top: 'CAR', bottom: 'VGK', topWins: 4, bottomWins: 2 },
};


/**
 * Normalise one raw series from either known NHL API shape into
 *   { top, bottom, topWins, bottomWins }
 *
 * Shape A: { topSeedTeam, bottomSeedTeam, topSeedWins, bottomSeedWins }
 * Shape B: { matchupTeams: [{ team: { abbrev }, wins }, ...] }
 */
function normaliseSeries(raw) {
  if (!raw) return null;
  if (Array.isArray(raw.matchupTeams)) {
    const [a, b] = raw.matchupTeams;
    return {
      top:        a?.team?.abbrev ?? a?.team ?? '—',
      bottom:     b?.team?.abbrev ?? b?.team ?? '—',
      topWins:    a?.wins ?? 0,
      bottomWins: b?.wins ?? 0,
    };
  }
  return {
    top:        raw.topSeedTeam?.abbrev    ?? raw.topSeedTeam?.default    ?? raw.topSeedTeam    ?? '—',
    bottom:     raw.bottomSeedTeam?.abbrev ?? raw.bottomSeedTeam?.default ?? raw.bottomSeedTeam ?? '—',
    topWins:    raw.topSeedWins    ?? 0,
    bottomWins: raw.bottomSeedWins ?? 0,
  };
}

/**
 * Parse NHL API bracketData into { east, west, final }.
 * Logs raw shape in dev so you can verify field names on first load.
 * Returns null if shape is unrecognised or data is absent (offseason empty state).
 */
function parseBracketData(raw) {
  if (!raw) return null;
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[BracketPanel] bracketData shape:', JSON.stringify(raw, null, 2));
  }
  try {
    if (!Array.isArray(raw.rounds)) return null;
    const east = [];
    const west = [];
    let final  = null;

    raw.rounds.forEach((round) => {
      const r = round.roundNumber ?? round.round;
      if (r === 4) {
        final = normaliseSeries(round.series?.[0]);
        return;
      }
      const eastSeries = [];
      const westSeries = [];
      (round.series ?? []).forEach((s) => {
        const norm = normaliseSeries(s);
        const conf = (s.conference?.abbrev ?? s.conferenceAbbrev ?? '').toUpperCase();
        // Assign by conference abbrev; fall back to East if unknown
        if (conf.startsWith('W')) westSeries.push(norm);
        else eastSeries.push(norm);
      });
      if (eastSeries.length) east.push({ round: r, series: eastSeries });
      if (westSeries.length) west.push({ round: r, series: westSeries });
    });

    if (east.length || west.length || final) return { east, west, final };
    return null;
  } catch {
    return null;
  }
}

// ── Dot row ──

function WinDots({ wins, color }) {
  return (
    <span className="bkt-dots" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className="bkt-dot"
          style={i < wins && color ? { background: color, borderColor: color } : undefined}
        />
      ))}
    </span>
  );
}

// ── Series card ──

function TeamAbbr({ abbrev, _isWinner, isEliminated }) {
  const color = TEAM_COLORS[abbrev];
  return (
    <span
      className={['bkt-abbr', isEliminated ? 'bkt-abbr--dim' : ''].filter(Boolean).join(' ')}
      style={!isEliminated && color ? { color } : undefined}
    >
      {abbrev}
    </span>
  );
}

function SeriesCard({ series, onSeriesClick }) {
  if (!series) return <div className="bkt-card bkt-card--empty" />;

  const { top, bottom, topWins, bottomWins } = series;
  const isPrimary  = top === PRIMARY || bottom === PRIMARY;
  const isComplete = topWins === 4 || bottomWins === 4;
  const hasGames   = topWins + bottomWins > 0;
  const dash       = '\u2013';

  let label = null;
  if (hasGames) {
    if      (topWins    === 4)          label = `${top} wins 4${dash}${bottomWins}`;
    else if (bottomWins === 4)          label = `${bottom} wins 4${dash}${topWins}`;
    else if (topWins    === bottomWins) label = `Tied ${topWins}${dash}${bottomWins}`;
    else if (topWins    >  bottomWins)  label = `${top} leads ${topWins}${dash}${bottomWins}`;
    else                                label = `${bottom} leads ${bottomWins}${dash}${topWins}`;
  }

  return (
    <div
      className={['bkt-card', isPrimary ? 'bkt-card--primary' : '', hasGames ? 'bkt-card--clickable' : ''].filter(Boolean).join(' ')}
      style={isPrimary ? { borderColor: PRIMARY_COLOR } : undefined}
      onClick={hasGames && onSeriesClick ? () => onSeriesClick(series) : undefined}
      role={hasGames && onSeriesClick ? 'button' : undefined}
      tabIndex={hasGames && onSeriesClick ? 0 : undefined}
      onKeyDown={hasGames && onSeriesClick ? (e => e.key === 'Enter' && onSeriesClick(series)) : undefined}
    >
      <div className="bkt-team-row">
        <TeamAbbr abbrev={top} isEliminated={isComplete && topWins !== 4} />
        <WinDots wins={topWins} color={TEAM_COLORS[top]} />
      </div>
      <div className="bkt-team-row">
        <TeamAbbr abbrev={bottom} isEliminated={isComplete && bottomWins !== 4} />
        <WinDots wins={bottomWins} color={TEAM_COLORS[bottom]} />
      </div>
      {label && <div className="bkt-series-label">{label}</div>}
    </div>
  );
}

// ── Connector SVG (scales with flex height via preserveAspectRatio="none") ──

function Connector({ count, direction, straight }) {
  // straight=true: single horizontal line (used for Conf Finals ↔ Cup Final)
  // otherwise: bracket pairs — each slot is a notional 100-unit height
  const xIn  = direction === 'left' ? 20 : 0;
  const xOut = direction === 'left' ? 0  : 20;
  const xMid = 10;
  const stroke = 'var(--bkt-line)';
  const sw = '1';

  if (straight) {
    return (
      <svg
        className="bkt-connector"
        viewBox="0 0 20 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line x1={xIn} y1={50} x2={xOut} y2={50} stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }

  const pairs = Math.ceil(count / 2);
  const totalH = count * 100;

  return (
    <svg
      className="bkt-connector"
      viewBox={`0 0 20 ${totalH}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {Array.from({ length: pairs }).map((_, i) => {
        const topY = i * 2 * 100 + 50;
        const botY = (i * 2 + 1) * 100 + 50;
        const midY = (topY + botY) / 2;
        return (
          <g key={i}>
            <line x1={xIn}  y1={topY} x2={xMid} y2={topY} stroke={stroke} strokeWidth={sw} />
            <line x1={xIn}  y1={botY} x2={xMid} y2={botY} stroke={stroke} strokeWidth={sw} />
            <line x1={xMid} y1={topY} x2={xMid} y2={botY} stroke={stroke} strokeWidth={sw} />
            <line x1={xMid} y1={midY} x2={xOut} y2={midY} stroke={stroke} strokeWidth={sw} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Round column ──

const ROUND_LABELS = { 1: 'First round', 2: 'Second round', 3: 'Conf. finals' };

function RoundCol({ round, label, onSeriesClick }) {
  return (
    <div className="bkt-round-col">
      <div className="bkt-round-label">{label ?? ROUND_LABELS[round.round] ?? `Round ${round.round}`}</div>
      <div className="bkt-round-series">
        {round.series.map((s, i) => (
          <div key={i} className="bkt-series-slot">
            <SeriesCard series={s} onSeriesClick={onSeriesClick} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cup Final center ──

function CupFinalCol({ series, onSeriesClick }) {
  if (!series) return null;
  const { top, bottom, topWins, bottomWins } = series;
  const winner      = topWins === 4 ? top : bottomWins === 4 ? bottom : null;
  const isComplete  = topWins === 4 || bottomWins === 4;
  const hasGames    = topWins + bottomWins > 0;

  return (
    <div className="bkt-final-col">
      <div className="bkt-round-label">Stanley Cup Final</div>
      <div className="bkt-final-center">
        <div
          className={['bkt-card bkt-card--final', hasGames ? 'bkt-card--clickable' : ''].join(' ')}
          onClick={hasGames && onSeriesClick ? () => onSeriesClick(series) : undefined}
          role={hasGames && onSeriesClick ? 'button' : undefined}
          tabIndex={hasGames && onSeriesClick ? 0 : undefined}
          onKeyDown={hasGames && onSeriesClick ? (e => e.key === 'Enter' && onSeriesClick(series)) : undefined}
        >
          <div className="bkt-team-row">
            <TeamAbbr abbrev={top} isEliminated={isComplete && topWins !== 4} />
            <WinDots wins={topWins} color={TEAM_COLORS[top]} />
          </div>
          <div className="bkt-team-row">
            <TeamAbbr abbrev={bottom} isEliminated={isComplete && bottomWins !== 4} />
            <WinDots wins={bottomWins} color={TEAM_COLORS[bottom]} />
          </div>
          {winner && (
            <div className="bkt-winner-line" style={{ color: TEAM_COLORS[winner] ?? 'var(--text)' }}>
              {winner} champion 🏆
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Series Modal ──

function SeriesModal({ series, carouselRounds, season, onClose }) {
  const { top, bottom, topWins, bottomWins } = series;
  const dash = '\u2013';

  // Find matching series in carousel to get seriesLetter + roundNumber
  const carouselSeries = React.useMemo(() => {
    if (!carouselRounds?.length) return null;
    for (const round of carouselRounds) {
      for (const s of (round.series || [])) {
        const a = s.topSeed?.abbrev;
        const b = s.bottomSeed?.abbrev;
        if ((a === top && b === bottom) || (a === bottom && b === top) ||
            (a === top && b === bottom) || (b === top && a === bottom)) {
          return { ...s, roundNumber: round.roundNumber };
        }
      }
    }
    return null;
  }, [carouselRounds, top, bottom]);

  const seriesLetter = carouselSeries?.seriesLetter ?? null;
  const roundNumber  = carouselSeries?.roundNumber  ?? null;

  const { data: games, loading: gamesLoading } = useFetch(
    () => seriesLetter && roundNumber
      ? getPlayoffSeriesGames(season, seriesLetter, roundNumber)
      : Promise.resolve([]),
    [seriesLetter, roundNumber, season]
  );

  const topColor    = TEAM_COLORS[top]    ?? 'var(--text)';
  const bottomColor = TEAM_COLORS[bottom] ?? 'var(--text)';
  const winner      = topWins === 4 ? top : bottomWins === 4 ? bottom : null;

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function periodLabel(periodType) {
    if (periodType === 'OT')  return 'OT';
    if (periodType === 'SO')  return 'SO';
    return '';
  }

  return (
    <div className="popup-backdrop popup-backdrop--centered" onClick={onClose}>
      <div className="series-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="series-modal__header">
          <div className="series-modal__teams">
            <span className="series-modal__abbrev" style={{ color: topColor }}>{top}</span>
            <div className="series-modal__dots-wrap">
              <WinDots wins={topWins} color={topColor} />
              <span className="series-modal__dash">{dash}</span>
              <WinDots wins={bottomWins} color={bottomColor} />
            </div>
            <span className="series-modal__abbrev" style={{ color: bottomColor }}>{bottom}</span>
          </div>
          {winner && (
            <div className="series-modal__result" style={{ color: TEAM_COLORS[winner] }}>
              {winner} wins 4{dash}{winner === top ? bottomWins : topWins} 🏆
            </div>
          )}
          {!winner && topWins + bottomWins > 0 && (
            <div className="series-modal__result">
              {topWins > bottomWins ? `${top} leads` : topWins < bottomWins ? `${bottom} leads` : 'Tied'} {Math.max(topWins, bottomWins)}{dash}{Math.min(topWins, bottomWins)}
            </div>
          )}
          <button className="pp-close" onClick={onClose} aria-label="Close series">✕</button>
        </div>

        {/* Round label */}
        {carouselSeries && (
          <div className="series-modal__round-label">
            {carouselSeries.seriesLabel ?? `Series ${seriesLetter}`}
          </div>
        )}

        {/* Game-by-game */}
        <div className="series-modal__games">
          {gamesLoading && (
            <div className="series-modal__loading">
              {[70, 85, 70, 85].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 32, width: `${w}%`, marginBottom: 6, borderRadius: 6 }} />
              ))}
            </div>
          )}

          {!gamesLoading && games?.length === 0 && (
            <div className="series-modal__empty">Game data unavailable for this series.</div>
          )}

          {!gamesLoading && games?.map((g, i) => {
            const awayWon = g.awayScore > g.homeScore;
            const homeWon = g.homeScore > g.awayScore;
            const extra   = periodLabel(g.periodType);
            const awayColor = TEAM_COLORS[g.awayAbbrev] ?? 'var(--text)';
            const homeColor = TEAM_COLORS[g.homeAbbrev] ?? 'var(--text)';
            return (
              <div key={g.gameId} className="series-modal__game-row">
                <span className="series-modal__game-num">G{i + 1}</span>
                <span className="series-modal__game-date">{fmtDate(g.gameDate)}</span>
                <span className="series-modal__team-score">
                  <span className="series-modal__team-abbrev" style={{ color: awayColor, fontWeight: awayWon ? 700 : 400 }}>{g.awayAbbrev}</span>
                  <span className={`series-modal__score ${awayWon ? 'series-modal__score--win' : ''}`}>{g.awayScore}</span>
                </span>
                <span className="series-modal__separator">–</span>
                <span className="series-modal__team-score series-modal__team-score--home">
                  <span className={`series-modal__score ${homeWon ? 'series-modal__score--win' : ''}`}>{g.homeScore}</span>
                  <span className="series-modal__team-abbrev" style={{ color: homeColor, fontWeight: homeWon ? 700 : 400 }}>{g.homeAbbrev}</span>
                </span>
                {extra && <span className="series-modal__extra">{extra}</span>}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ── Main BracketPanel ──

function BracketPanel({ data }) {
  const [selectedSeries, setSelectedSeries] = useState(null);

  const bracket = useMemo(() => {
    return parseBracketData(data) ?? OFFSEASON_BRACKET;
  }, [data]);

  // Fetch carousel for seriesLetter lookup — only when bracket tab is active
  const { data: carouselRounds } = useFetch(
    () => getPlayoffSeries(SEASON),
    [SEASON]
  );

  if (!bracket) {
    return (
      <div className="lv-empty">
        <p className="lv-empty-msg">Playoff bracket will appear here once the postseason begins.</p>
      </div>
    );
  }

  const { east, west, final } = bracket;

  return (
    <>
      <div className="bkt-root">
        <div className="bkt-bracket">

          {/* East rounds — left side, connectors flow right */}
          {east.map((round, ri) => (
            <React.Fragment key={`e${ri}`}>
              <RoundCol round={round} onSeriesClick={setSelectedSeries} />
              {ri < east.length - 1 && (
                <Connector count={round.series.length} direction="right" />
              )}
            </React.Fragment>
          ))}

          {/* Connector: Conf Finals → Cup Final (straight horizontal) */}
          <Connector count={1} direction="right" straight />

          {/* Cup Final */}
          <CupFinalCol series={final} onSeriesClick={setSelectedSeries} />

          {/* Connector: Cup Final → Conf Finals (straight horizontal) */}
          <Connector count={1} direction="left" straight />

          {/* West rounds — right side, reversed so deepest round is innermost */}
          {[...west].reverse().map((round, ri) => {
            const originalIndex = west.length - 1 - ri;
            return (
              <React.Fragment key={`w${originalIndex}`}>
                {ri > 0 && (
                  <Connector count={round.series.length} direction="left" />
                )}
                <RoundCol round={round} onSeriesClick={setSelectedSeries} />
              </React.Fragment>
            );
          })}

        </div>
      </div>

      {selectedSeries && (
        <SeriesModal
          series={selectedSeries}
          carouselRounds={carouselRounds}
          season={SEASON}
          onClose={() => setSelectedSeries(null)}
        />
      )}
    </>
  );
}

// ─── Loading / Error ──────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <div className="lv-skeleton-wrap" aria-busy="true" aria-label="Loading">
      {[85, 90, 85, 95, 85, 90, 85, 90].map((w, i) => (
        <div key={i} className="lv-skeleton-row" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="lv-error">
      <span>⚠</span>
      <p>{message ?? 'Something went wrong. Try refreshing.'}</p>
    </div>
  );
}

// ─── Power Rankings ───────────────────────────────────────────────────────────

/**
 * Rank all 32 teams using five weighted, normalised components plus a
 * roster talent prior (WAR) that tapers off as the season progresses.
 *
 * Components (full season, alpha = 1.0):
 *   Points %       25%  — season-long win rate
 *   L10 points %   25%  — recent form (drives weekly movement)
 *   Goal diff/GP   20%  — scoring margin strength
 *   5v5 xGF%       20%  — true possession quality (MoneyPuck, nightly)
 *   Special teams  10%  — avg of PP% and PK%
 *
 * Roster WAR blending (early season):
 *   alpha = min(maxGP / 20, 1.0) — reaches 1.0 by game 20
 *   rosterWeight = 0.15 * (1 - alpha) — tapers from 15% → 0%
 *   Other weights scale proportionally to fill the remaining 85%→100%.
 */
function computePowerRankings(standings, xgData) {
  if (!standings?.length) return [];

  const maxGP = Math.max(...standings.map(t => t.gamesPlayed || 0));
  const alpha = Math.min(maxGP / 20, 1.0);
  const wWar  = 0.15 * (1 - alpha);
  const scale = 1 - wWar;

  const W = {
    pts: 0.25 * scale,
    l10: 0.25 * scale,
    gd:  0.20 * scale,
    xgf: 0.20 * scale,
    sp:  0.10 * scale,
    war: wWar,
  };

  const teams = standings.map(t => {
    const abbr = t.teamAbbrev?.default ?? t.teamAbbrev;
    const gp   = t.gamesPlayed || 1;

    const l10w  = t.l10Wins     ?? 0;
    const l10l  = t.l10Losses   ?? 0;
    const l10ot = t.l10OtLosses ?? 0;
    const l10gp = (l10w + l10l + l10ot) || 10;

    const rawPp = t.powerPlayPct   ?? t.ppPct ?? 0;
    const rawPk = t.penaltyKillPct ?? t.pkPct ?? 0;
    const ppPct = rawPp > 1 ? rawPp / 100 : rawPp;
    const pkPct = rawPk > 1 ? rawPk / 100 : rawPk;

    return {
      abbr,
      gp,
      wins:      t.wins     ?? 0,
      losses:    t.losses   ?? 0,
      otLosses:  t.otLosses ?? 0,
      ptsPct:    (t.points ?? 0) / (gp * 2),
      l10PtsPct: ((l10w * 2) + l10ot) / (l10gp * 2),
      gdPG:      ((t.goalFor ?? t.goalsFor ?? 0) - (t.goalAgainst ?? t.goalsAgainst ?? 0)) / gp,
      xgfPct:    xgData?.[abbr]?.xgfPct    ?? null,
      rosterWar: xgData?.[abbr]?.rosterWar ?? null,
      spPct:     (ppPct + pkPct) / 2,
      ppPct,
      pkPct,
      l10: `${l10w}-${l10l}-${l10ot}`,
    };
  });

  function normalise(key) {
    const vals  = teams.map(t => t[key]).filter(v => v != null);
    if (!vals.length) return () => 0.5;
    const min   = Math.min(...vals);
    const range = Math.max(...vals) - min || 1;
    return (v) => v == null ? 0.5 : (v - min) / range;
  }

  const normPts = normalise('ptsPct');
  const normL10 = normalise('l10PtsPct');
  const normGD  = normalise('gdPG');
  const normXGF = normalise('xgfPct');
  const normSP  = normalise('spPct');
  const normWar = normalise('rosterWar');

  // Per-component league rank for display (1 = best)
  function leagueRank(key) {
    const sorted = [...teams].sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
    const map = {};
    sorted.forEach((t, i) => { map[t.abbr] = i + 1; });
    return map;
  }
  const rankPts = leagueRank('ptsPct');
  const rankL10 = leagueRank('l10PtsPct');
  const rankGD  = leagueRank('gdPG');
  const rankXGF = leagueRank('xgfPct');
  const rankSP  = leagueRank('spPct');

  return teams
    .map(t => ({
      ...t,
      score:
        normPts(t.ptsPct)    * W.pts +
        normL10(t.l10PtsPct) * W.l10 +
        normGD(t.gdPG)       * W.gd  +
        normXGF(t.xgfPct)    * W.xgf +
        normSP(t.spPct)      * W.sp  +
        normWar(t.rosterWar) * W.war,
      leagueRanks: {
        pts: rankPts[t.abbr],
        l10: rankL10[t.abbr],
        gd:  rankGD[t.abbr],
        xgf: rankXGF[t.abbr],
        sp:  rankSP[t.abbr],
      },
    }))
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

// ─── Movement arrow ───────────────────────────────────────────────────────────

function MovementArrow({ current, prior }) {
  if (prior == null) return null;
  const diff = prior - current; // positive = moved up
  if (diff === 0) return <span className="pr-mvmt pr-mvmt--flat">—</span>;
  if (diff > 0)   return <span className="pr-mvmt pr-mvmt--up">▲{diff}</span>;
  return              <span className="pr-mvmt pr-mvmt--down">▼{Math.abs(diff)}</span>;
}

// ─── Rank Sparkline ───────────────────────────────────────────────────────────

function RankSparkline({ history, primaryColor }) {
  if (!history?.length) {
    return (
      <div className="pr-sparkline-empty">
        <span>Rank trend data accumulates nightly</span>
      </div>
    );
  }

  const W = 240;
  const H = 80;
  const PAD = 16; // extra padding so labels don't clip

  // With a single point, show a horizontal line at that rank
  const single = history.length === 1;
  const ranks = history.map(r => r.rank);
  const minR = Math.min(...ranks);
  const maxR = Math.max(...ranks);
  const range = maxR - minR || 1;

  const x = (i) => single ? W / 2 : PAD + (i / (history.length - 1)) * (W - PAD * 2);
  const y = (r) => single ? H / 2 : PAD + ((r - minR) / range) * (H - PAD * 2);

  const latest   = history[history.length - 1];
  const earliest = history[0];
  const diff     = single ? 0 : earliest.rank - latest.rank;

  const trendColor = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red-bright)' : 'var(--text-dim)';
  const trendLabel = single ? null
    : diff === 0 ? '—'
    : diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`;

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const points     = history.map((r, i) => `${x(i)},${y(r.rank)}`).join(' ');
  const areaPoints = single ? '' : [
    `${x(0)},${H}`,
    ...history.map((r, i) => `${x(i)},${y(r.rank)}`),
    `${x(history.length - 1)},${H}`,
  ].join(' ');

  return (
    <div className="pr-sparkline" style={{ minWidth: 140 }}>
      <div className="pr-sparkline-header">
        <span className="pr-sparkline-label">Rank trend</span>
        {trendLabel && (
          <span className="pr-sparkline-trend" style={{ color: trendColor }}>
            {trendLabel}
            <span className="pr-sparkline-period"> ({history.length}d)</span>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="pr-sparkline-svg">
        {!single && (
          <polygon points={areaPoints} fill={primaryColor} opacity="0.08" />
        )}
        {!single && (
          <polyline
            points={points}
            fill="none"
            stroke={primaryColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Current rank dot */}
        <circle cx={x(history.length - 1)} cy={y(latest.rank)} r="4" fill={primaryColor} />
        {/* Rank label */}
        <text
          x={x(history.length - 1)}
          y={y(latest.rank) - 5}
          fontSize="11"
          fill={primaryColor}
          textAnchor="middle"
          fontWeight="700"
        >
          #{latest.rank}
        </text>
        {/* First point label (only when multiple points) */}
        {!single && (
          <>
            <circle cx={x(0)} cy={y(earliest.rank)} r="3" fill={primaryColor} opacity="0.5" />
            <text
              x={x(0)}
              y={y(earliest.rank) - 5}
              fontSize="10"
              fill="var(--text-dim)"
              textAnchor="middle"
            >
              #{earliest.rank}
            </text>
          </>
        )}
      </svg>
      <div className="pr-sparkline-dates">
        <span>{fmtDate(earliest.generated_date)}</span>
        {!single && <span>{fmtDate(latest.generated_date)}</span>}
      </div>
    </div>
  );
}

// ─── Rankings Panel ───────────────────────────────────────────────────────────

function RankingsPanel({ standings, xgData, xgLoading, narrative, history }) {
  const [showHow,    setShowHow]    = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const ranked  = computePowerRankings(standings, xgData);
  const loading = !standings?.length || xgLoading;

  // Find this team's rank + prior for movement
  const myData    = ranked.find(t => t.abbr === PRIMARY);
  const priorRank = narrative?.prior_rank ?? null;

  const xCaption = [
    `${PRIMARY} Power Rankings — #${myData?.rank ?? '?'} in the NHL`,
    narrative?.narrative || '',
    `#${PRIMARY} #EyeWallAnalytics`,
  ].filter(Boolean).join('\n');

  const { saving, sharing, handleSave, handleShareX, handleNativeShare, canNativeShare } =
    useShareCard({
      canvasRef:  { current: null }, // power rankings uses getElementById
      filename: `EyeWall-PowerRankings-${PRIMARY}.png`,
      xCaption,
      mountCanvas: async () => {
        if (!canvasMounted) {
          setCanvasMounted(true);
          await new Promise(r => setTimeout(r, 120));
        }
        // Override canvasRef.current after mount
      },
      getNode: () => document.getElementById('pr-export-canvas'),
    });

  const handleSaveWithCapture = async () => {
    await handleSave();
    capture('power_rankings_card_exported', { team: PRIMARY, rank: myData?.rank });
  };

  if (loading) {
    return (
      <div className="lv-skeleton-wrap" aria-busy="true">
        {[85, 90, 85, 95, 85, 90, 85, 90, 85, 95].map((w, i) => (
          <div key={i} className="lv-skeleton-row" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Narrative + sparkline card — shows when either exists */}
      {(narrative?.narrative || history?.length) ? (
        <div className="lv-div-card lv-div-card--wide pr-narrative-card" style={{ marginTop: 4 }}>
          <div className="pr-narrative-card-top">
            {narrative?.narrative && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pr-narrative-label">⚡ EyeWall AI — {PRIMARY} Rankings Report</div>
                <p className="pr-narrative-text">{narrative.narrative}</p>
                {narrative.generated_date && (
                  <span className="pr-narrative-date">
                    Updated {new Date(narrative.generated_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            )}
            <RankSparkline history={history} primaryColor={PRIMARY_COLOR} />
          </div>
        </div>
      ) : null}

      {/* Rankings table */}
      <div className="lv-div-card lv-div-card--wide">
        <div className="pr-table-header-row">
          <span className="pr-col-rank">#</span>
          <span className="pr-col-mvmt" />
          <span className="pr-col-team">Team</span>
          <span className="pr-col-stat">Pts%</span>
          <span className="pr-col-stat">L10</span>
          <span className="pr-col-stat">xGF%</span>
          <span className="pr-col-stat">GD/GP</span>
        </div>

        {ranked.map(t => {
          const isPrimary = t.abbr === PRIMARY;
          // Show movement arrow only for the primary team (we only have their prior rank)
          const showArrow = isPrimary && priorRank != null;
          return (
            <div
              key={t.abbr}
              className={`pr-row${isPrimary ? ' pr-row--you' : ''}`}
              style={isPrimary ? {
                '--row-accent': PRIMARY_COLOR,
                borderLeft: `3px solid ${PRIMARY_COLOR}`,
                background: `color-mix(in srgb, ${PRIMARY_COLOR} 8%, var(--surface))`,
              } : {}}
            >
              <span className="pr-col-rank">
                <span className={`pr-rank-num${t.rank <= 8 ? ' pr-rank--top' : t.rank >= 25 ? ' pr-rank--bot' : ''}`}>
                  {t.rank}
                </span>
              </span>
              <span className="pr-col-mvmt">
                {showArrow && <MovementArrow current={t.rank} prior={priorRank} />}
              </span>
              <span className="pr-col-team">
                <TeamLogo abbr={t.abbr} size={16} />
                <span className="pr-abbr" style={{ color: TEAM_COLORS[t.abbr] ?? 'var(--text)' }}>
                  {t.abbr}
                </span>
              </span>
              <span className="pr-col-stat">{(t.ptsPct * 100).toFixed(1)}%</span>
              <span className="pr-col-stat">{t.l10}</span>
              <span className="pr-col-stat">
                {t.xgfPct != null ? `${(t.xgfPct * 100).toFixed(1)}%` : '—'}
              </span>
              <span className={`pr-col-stat${t.gdPG > 0 ? ' pr-gd--pos' : t.gdPG < 0 ? ' pr-gd--neg' : ''}`}>
                {t.gdPG > 0 ? '+' : ''}{t.gdPG.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Export / share */}
      <ShareButtons
        onSave={handleSaveWithCapture}
        onShareX={handleShareX}
        onNativeShare={handleNativeShare}
        canNativeShare={canNativeShare}
        saving={saving}
        sharing={sharing || !myData}
      />

      {/* How is this calculated? */}
      <div className="lv-div-card lv-div-card--wide">
        <button className="pr-how-toggle" onClick={() => setShowHow(v => !v)} aria-expanded={showHow}>
          <span>How is this calculated?</span>
          <span className="pr-how-chevron">{showHow ? '▲' : '▼'}</span>
        </button>

        {showHow && (
          <div className="pr-how-body">
            <p className="pr-how-text">
              Rankings are computed from five components plus a roster talent prior
              that tapers off as the season progresses. Each component is normalised
              relative to the rest of the league (best team = 1.0, worst = 0.0) before
              weighting, so rankings reflect where a team stands <em>right now</em>.
            </p>

            {[
              {
                label: 'Points %', weight: '25%',
                desc: 'Points earned divided by maximum possible (games played × 2). The primary measure of season-long success.',
                source: 'NHL standings',
              },
              {
                label: 'L10 Points %', weight: '25%',
                desc: 'Same formula applied to the last 10 games only. This is what moves rankings week to week — a hot team climbs, a cold team falls regardless of earlier results.',
                source: 'NHL standings',
              },
              {
                label: 'Goal Differential / GP', weight: '20%',
                desc: 'Goals scored minus goals allowed per game. Teams that win convincingly rank higher than teams that constantly squeak by one goal.',
                source: 'NHL standings',
              },
              {
                label: '5v5 xGF%', weight: '20%',
                desc: 'Expected goals for % at even strength — the share of shot quality a team generates versus allows at 5-on-5. Filters out goaltending and shooting luck that inflate or deflate raw goal totals.',
                source: 'MoneyPuck (updated nightly)',
              },
              {
                label: 'Special Teams', weight: '10%',
                desc: 'Average of power play % and penalty kill %. Weighted lower than even-strength play because special teams frequency and opponent quality vary.',
                source: 'NHL standings',
              },
              {
                label: 'Roster WAR', weight: '0–15%',
                desc: 'Sum of the top-18 skaters\' Wins Above Replacement plus the starter\'s Goals Saved Above Expected. Weighted at 15% at game 0, tapering to 0% by game 20. Ensures pre-season and early-season rankings reflect roster quality rather than a handful of fluky results.',
                source: 'MoneyPuck / EyeWall RAPM model (updated nightly)',
              },
            ].map(c => (
              <div key={c.label} className="pr-how-item">
                <div className="pr-how-item-header">
                  <span className="pr-how-item-label">{c.label}</span>
                  <span className="pr-how-weight">{c.weight}</span>
                </div>
                <p className="pr-how-text">{c.desc}</p>
                <span className="pr-how-source">Source: {c.source}</span>
              </div>
            ))}

            <p className="pr-how-text" style={{ marginTop: 4 }}>
              xGF% and Roster WAR show <em>—</em> until the first nightly pipeline
              run populates them. All other components still produce a valid rank.
            </p>
          </div>
        )}
      </div>

      {/* Off-screen export canvas */}
      {canvasMounted && myData && (
        <PowerRankingsCanvas
          ranked={ranked}
          myTeam={myData}
          priorRank={priorRank}
          narrative={narrative?.narrative ?? null}
          primaryColor={PRIMARY_COLOR}
        />
      )}
    </div>
  );
}

// ─── Power Rankings Export Canvas (1080×1080, off-screen) ────────────────────

function PowerRankingsCanvas({ ranked, myTeam, priorRank, narrative, primaryColor }) {
  const logoUrl = abbr => `/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`;
  const diff = priorRank != null ? priorRank - myTeam.rank : null;
  const mvmtLabel = diff == null ? null : diff === 0 ? '—' : diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`;
  const mvmtColor = diff == null || diff === 0 ? 'rgba(255,255,255,0.5)' : diff > 0 ? '#4ade80' : '#f87171';

  // Top 15 + team's neighbourhood if outside top 15
  const inTop15 = myTeam.rank <= 15;
  const displayRows = ranked.filter(t =>
    t.rank <= 15 || (!inTop15 && Math.abs(t.rank - myTeam.rank) <= 2)
  );

  return (
    <div
      id="pr-export-canvas"
      className="pred-canvas"
      style={{ '--team-canvas': primaryColor, background: '#1a1a2e' }}
    >
      {/* Header */}
      <div className="pred-canvas-header">
        <img src="/eyewall-logo.svg" alt="EyeWall" className="pred-canvas-logo"
          onError={e => { e.target.style.display = 'none'; }} />
        <span className="pred-canvas-badge">Power Rankings</span>
      </div>

      {/* Hero — team logo, rank, movement, component bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '0 52px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <img src={logoUrl(myTeam.abbr)} alt={myTeam.abbr}
          style={{ width: 80, height: 80, objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; }} />

        <div style={{ minWidth: 160 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            {myTeam.abbr} · {myTeam.wins}–{myTeam.losses}–{myTeam.otLosses}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 72, fontWeight: 900, color: 'var(--team-canvas)', lineHeight: 1 }}>
              #{myTeam.rank}
            </span>
            {mvmtLabel && (
              <span style={{ fontSize: 26, fontWeight: 700, color: mvmtColor }}>{mvmtLabel}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>of 32 teams</div>
        </div>

        {/* Component bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { label: 'Pts%',  val: myTeam.ptsPct * 100,                              fmt: v => `${v.toFixed(1)}%`, rank: myTeam.leagueRanks?.pts },
            { label: 'L10',   val: myTeam.l10PtsPct * 100,                           fmt: () => myTeam.l10,        rank: myTeam.leagueRanks?.l10 },
            { label: 'xGF%',  val: myTeam.xgfPct != null ? myTeam.xgfPct * 100 : null, fmt: v => `${v.toFixed(1)}%`, rank: myTeam.leagueRanks?.xgf },
            { label: 'GD/GP', val: myTeam.gdPG,                                      fmt: v => (v > 0 ? '+' : '') + v.toFixed(2), rank: myTeam.leagueRanks?.gd },
            { label: 'SP%',   val: myTeam.spPct * 100,                               fmt: v => `${v.toFixed(1)}%`, rank: myTeam.leagueRanks?.sp },
          ].map(({ label, val, fmt, rank }) => {
            const barPct   = rank != null ? ((32 - rank) / 31) * 100 : 50;
            const barColor = rank != null && rank <= 10 ? '#4ade80' : rank != null && rank >= 23 ? '#f87171' : '#5b8fd4';
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 40, fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                </div>
                <span style={{ width: 46, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {val != null ? fmt(val) : '—'}
                </span>
                <span style={{ width: 26, fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'right' }}>
                  {rank != null ? `#${rank}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI narrative */}
      {narrative && (
        <div className="pred-canvas-ai">
          <div className="pred-canvas-ai-label">⚡ EyeWall AI</div>
          <div className="pred-canvas-ai-text">{narrative}</div>
        </div>
      )}

      {/* League snapshot */}
      <div style={{ flex: 1, padding: '10px 52px 0', overflow: 'hidden' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
          League snapshot
        </div>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 8px 52px 1fr 54px 60px 54px 54px', gap: 6, padding: '0 8px 4px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', marginBottom: 3 }}>
          {['#', '', 'Team', 'Record', 'Pts%', 'L10', 'xGF%', 'GD/GP'].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', textAlign: h === 'Record' ? 'left' : h === '#' || h === '' ? 'center' : 'right' }}>{h}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {displayRows.map(t => {
            const isMe     = t.abbr === myTeam.abbr;
            const teamColor = TEAM_COLORS[t.abbr] ?? 'rgba(255,255,255,0.5)';
            return (
              <div key={t.abbr} style={{
                display: 'grid',
                gridTemplateColumns: '28px 8px 52px 1fr 54px 60px 54px 54px',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 5,
                background: isMe ? `${primaryColor}18` : 'transparent',
                borderLeft: isMe ? `3px solid ${primaryColor}` : '3px solid transparent',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: isMe ? 'var(--team-canvas)' : 'rgba(255,255,255,0.45)', textAlign: 'center' }}>{t.rank}</span>
                <span />
                <span style={{ fontSize: 12, fontWeight: 700, color: teamColor }}>{t.abbr}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{t.wins}–{t.losses}–{t.otLosses}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.70)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(t.ptsPct * 100).toFixed(1)}%</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>{t.l10}</span>
                <span style={{ fontSize: 11, color: t.xgfPct != null ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.35)', textAlign: 'right' }}>
                  {t.xgfPct != null ? `${(t.xgfPct * 100).toFixed(1)}%` : '—'}
                </span>
                <span style={{ fontSize: 11, color: t.gdPG > 0 ? '#4ade80' : t.gdPG < 0 ? '#f87171' : 'rgba(255,255,255,0.4)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {t.gdPG > 0 ? '+' : ''}{t.gdPG.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pred-canvas-footer">
        <span>eyewallanalytics.com</span>
        <span>{TEAM_CONFIG.hashtags?.[0] || `#${myTeam.abbr}`}</span>
      </div>
    </div>
  );
}



// ─── Scroll-to-top button ─────────────────────────────────────────────────────
// Appears after the user scrolls down 200px within the league-content area.
// Used by Power Rankings and Draft tabs which can be long.

function ScrollTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scroller = document.getElementById('main-content');
    if (!scroller) return;
    function onScroll() { setVisible(scroller.scrollTop > 200); }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      className="lv-scroll-top"
      onClick={() => document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
    >
      ↑ Top
    </button>
  );
}

// ─── LeagueView ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'standings', label: 'Standings' },
  { id: 'bracket',   label: 'Playoff bracket' },
  { id: 'leaders',   label: 'Leaders' },
  { id: 'rankings',  label: 'Power rankings' },
  { id: 'draft',     label: 'Draft' }
];

export default function LeagueView() {
  const [activeTab, setActiveTab] = useState('standings');

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    capture('league_tab_viewed', { tab: tabId });
  }, []);

  const { data: standings, loading: standingsLoading, error: standingsError }
    = useFetch(getStandings, []);

  const { data: scoring, loading: scoringLoading, error: scoringError }
    = useFetch(() => getScoringLeaders(SEASON, 10, '2'), [SEASON]);

  const { data: goals,   loading: goalsLoading }
    = useFetch(() => getGoalLeaders(SEASON, 10, '2'), [SEASON]);

  const { data: gaa,     loading: gaaLoading }
    = useFetch(() => getGoalieLeaders('goalsAgainstAverage', SEASON, 10, '2'), [SEASON]);

  const { data: svp,     loading: svpLoading }
    = useFetch(() => getGoalieLeaders('savePctg', SEASON, 10, '2'), [SEASON]);

  const { data: bracket, loading: bracketLoading }
    = useFetch(getPlayoffBracket, []);

  const { data: xgData, loading: xgLoading } = useFetch(
    () => activeTab === 'rankings' ? getTeamSeasonData() : Promise.resolve(null),
    [activeTab]
  )
  const { data: prNarrative } = useFetch(
    () => activeTab === 'rankings' ? getPowerRankingsNarrative(TEAM_CONFIG.abbr) : Promise.resolve(null),
    [activeTab]
  )
  const { data: prHistory } = useFetch(
    () => activeTab === 'rankings' ? getPowerRankingsHistory(TEAM_CONFIG.abbr) : Promise.resolve(null),
    [activeTab]
  )

  const leadersLoading   = scoringLoading || goalsLoading || gaaLoading || svpLoading;
  const standingsEntries = Array.isArray(standings) ? standings : [];

  return (
    <div className="league-view">
      <nav className="league-tabs" role="tablist" aria-label="League sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`league-tab${activeTab === tab.id ? ' league-tab--active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="league-content">
        {activeTab === 'standings' && (
          <>
            {standingsLoading && <LoadingRows />}
            {standingsError   && <ErrorState message="Couldn't load standings." />}
            {!standingsLoading && !standingsError && <StandingsPanel entries={standingsEntries} />}
          </>
        )}

        {activeTab === 'bracket' && (
          <>
            {bracketLoading  && <LoadingRows />}
            {!bracketLoading && <BracketPanel data={bracket} />}
          </>
        )}

        {activeTab === 'leaders' && (
          <>
            {leadersLoading && <LoadingRows />}
            {scoringError   && <ErrorState message="Couldn't load leaders." />}
            {!leadersLoading && !scoringError && (
              <LeadersPanel scoring={scoring} goals={goals} gaa={gaa} svp={svp} />
            )}
          </>
        )}

        {activeTab === 'rankings' && (
          <>
            <ScrollTopButton />
            <RankingsPanel
            standings={standingsEntries}
            xgData={xgData}
            xgLoading={xgLoading}
            narrative={prNarrative}
            history={prHistory}
          />
          </>
        )}

        {activeTab === 'draft' && <>
          <ScrollTopButton />
          <DraftTab />
        </>}
      </div>
    </div>
  );
}
