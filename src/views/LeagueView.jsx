// LeagueView.jsx
// Place in src/views/ alongside LeagueView.css

import React, { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import {
  getStandings,
  getScoringLeaders,
  getGoalLeaders,
  getGoalieLeaders,
  getPlayoffBracket,
  TEAM_CONFIG,
} from '../utils/nhlApi';
import { ALL_TEAMS } from '../utils/teamConfig';
import './LeagueView.css';

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
          <span className="lv-team-abbrev">{abbrev}</span>
          {isPrimary && <span className="lv-you-badge" style={{ color: PRIMARY_COLOR, background: `${PRIMARY_COLOR}26` }}>YOU</span>}
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
      <td className="lv-td">{entry.streakCode ?? '—'}</td>
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
            onClick={() => setFilter(f.id)}
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

function LeadersCard({ title, statLabel, rows, formatStat }) {
  return (
    <div className="lv-leaders-card">
      <div className="lv-leaders-card__header">
        <span>{title}</span>
        <span className="lv-leaders-card__stat-label">{statLabel}</span>
      </div>
      {rows.map((p, i) => {
        const abbrev    = p.teamAbbrev ?? '—';
        const name      = p.firstName?.default
          ? `${p.firstName.default} ${p.lastName.default}`
          : p.name ?? '—';
        const isPrimary = abbrev === PRIMARY;
        const stat      = p.value ?? 0;

        return (
          <div key={p.playerId ?? i} className={`lv-leaders-row${isPrimary ? ' lv-leaders-row--you' : ''}`} style={isPrimary ? { '--row-accent': PRIMARY_COLOR } : undefined}>
            <span className="lv-leaders-rank">{i + 1}</span>
            <span className="lv-leaders-name">{name}</span>
            <span className="lv-leaders-team">{abbrev}</span>
            <span className="lv-leaders-stat">{formatStat ? formatStat(stat) : stat}</span>
          </div>
        );
      })}
    </div>
  );
}

function LeadersPanel({ scoring, goals, gaa, svp }) {
  return (
    <div className="lv-leaders-grid">
      <LeadersCard title="Points"            statLabel="PTS" rows={scoring ?? []} />
      <LeadersCard title="Goals"             statLabel="G"   rows={goals   ?? []} />
      <LeadersCard
        title="Goals against avg."
        statLabel="GAA"
        rows={gaa ?? []}
        formatStat={(v) => Number(v).toFixed(2)}
      />
      <LeadersCard
        title="Save percentage"
        statLabel="SV%"
        rows={svp ?? []}
        formatStat={(v) => Number(v).toFixed(3).replace('0.', '.')}
      />
    </div>
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
    console.log('[BracketPanel] bracketData shape:', JSON.stringify(raw, null, 2));
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

function TeamAbbr({ abbrev, isWinner, isEliminated }) {
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

function SeriesCard({ series }) {
  if (!series) return <div className="bkt-card bkt-card--empty" />;

  const { top, bottom, topWins, bottomWins } = series;
  const isPrimary  = top === PRIMARY || bottom === PRIMARY;
  const isComplete = topWins === 4 || bottomWins === 4;
  const dash       = '\u2013';

  let label = null;
  if (topWins + bottomWins > 0) {
    if      (topWins    === 4)          label = `${top} wins 4${dash}${bottomWins}`;
    else if (bottomWins === 4)          label = `${bottom} wins 4${dash}${topWins}`;
    else if (topWins    === bottomWins) label = `Tied ${topWins}${dash}${bottomWins}`;
    else if (topWins    >  bottomWins)  label = `${top} leads ${topWins}${dash}${bottomWins}`;
    else                                label = `${bottom} leads ${bottomWins}${dash}${topWins}`;
  }

  return (
    <div
      className={['bkt-card', isPrimary ? 'bkt-card--primary' : ''].filter(Boolean).join(' ')}
      style={isPrimary ? { borderColor: PRIMARY_COLOR } : undefined}
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

function RoundCol({ round, label }) {
  return (
    <div className="bkt-round-col">
      <div className="bkt-round-label">{label ?? ROUND_LABELS[round.round] ?? `Round ${round.round}`}</div>
      <div className="bkt-round-series">
        {round.series.map((s, i) => (
          <div key={i} className="bkt-series-slot">
            <SeriesCard series={s} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cup Final center ──

function CupFinalCol({ series }) {
  if (!series) return null;
  const { top, bottom, topWins, bottomWins } = series;
  const winner      = topWins === 4 ? top : bottomWins === 4 ? bottom : null;
  const isComplete  = topWins === 4 || bottomWins === 4;

  return (
    <div className="bkt-final-col">
      <div className="bkt-round-label">Stanley Cup Final</div>
      <div className="bkt-final-center">
        <div className="bkt-card bkt-card--final">
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

// ── Main BracketPanel ──

function BracketPanel({ data }) {
  const bracket = useMemo(() => {
    // Live API data takes priority. If it returns nothing (offseason 404,
    // post-Final cleanup, or any other gap), fall back to the last completed
    // bracket — always better than a blank screen.
    return parseBracketData(data) ?? OFFSEASON_BRACKET;
  }, [data]);

  if (!bracket) {
    return (
      <div className="lv-empty">
        <p className="lv-empty-msg">Playoff bracket will appear here once the postseason begins.</p>
      </div>
    );
  }

  const { east, west, final } = bracket;

  return (
    <div className="bkt-root">
      <div className="bkt-bracket">

        {/* East rounds — left side, connectors flow right */}
        {east.map((round, ri) => (
          <React.Fragment key={`e${ri}`}>
            <RoundCol round={round} />
            {ri < east.length - 1 && (
              <Connector count={round.series.length} direction="right" />
            )}
          </React.Fragment>
        ))}

        {/* Connector: Conf Finals → Cup Final (straight horizontal) */}
        <Connector count={1} direction="right" straight />

        {/* Cup Final */}
        <CupFinalCol series={final} />

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
              <RoundCol round={round} />
            </React.Fragment>
          );
        })}

      </div>
    </div>
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

// ─── LeagueView ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'standings', label: 'Standings' },
  { id: 'bracket',   label: 'Playoff bracket' },
  { id: 'leaders',   label: 'Leaders' },
];

export default function LeagueView() {
  const [activeTab, setActiveTab] = useState('standings');

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
            onClick={() => setActiveTab(tab.id)}
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
      </div>
    </div>
  );
}
