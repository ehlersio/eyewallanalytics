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
    <tr className={`lv-row${isPrimary ? ' lv-row--you' : ''}`}>
      <td className="lv-td lv-td--rank">{rank}</td>
      <td
        className="lv-td lv-td--team"
        style={clinchColor ? { borderLeft: `2.5px solid ${clinchColor}` } : undefined}
      >
        <span className="lv-team-cell">
          <span className="lv-team-abbrev">{abbrev}</span>
          {isPrimary && <span className="lv-you-badge">YOU</span>}
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
          <div key={p.playerId ?? i} className={`lv-leaders-row${isPrimary ? ' lv-leaders-row--you' : ''}`}>
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

// ─── Bracket Panel (Phase 2 stub) ────────────────────────────────────────────

function BracketPanel({ data }) {
  const series = data?.series ?? data?.rounds?.flatMap((r) => r.series) ?? [];

  if (!series.length) {
    return (
      <div className="lv-empty">
        <p className="lv-empty-msg">Playoff bracket will appear here once the postseason begins.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="lv-phase-note">{series.length} series loaded — bracket UI coming in Phase 2.</p>
      {series.map((s, i) => {
        const top     = s.topSeedTeam    ?? s.matchupTeams?.[0]?.team;
        const bottom  = s.bottomSeedTeam ?? s.matchupTeams?.[1]?.team;
        const topW    = s.topSeedWins    ?? s.matchupTeams?.[0]?.wins ?? 0;
        const botW    = s.bottomSeedWins ?? s.matchupTeams?.[1]?.wins ?? 0;
        const topAbbr = top?.abbrev    ?? '?';
        const botAbbr = bottom?.abbrev ?? '?';
        return (
          <div key={i} className="lv-bracket-row">
            <span className={`lv-bracket-team${topAbbr === PRIMARY ? ' lv-bracket-team--you' : ''}`}>{topAbbr}</span>
            <span className="lv-bracket-wins">{topW}–{botW}</span>
            <span className={`lv-bracket-team${botAbbr === PRIMARY ? ' lv-bracket-team--you' : ''}`}>{botAbbr}</span>
          </div>
        );
      })}
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
