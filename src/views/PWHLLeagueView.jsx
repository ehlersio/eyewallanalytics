// views/PWHLLeagueView.jsx
// Mirrors NHL LeagueView — tabbed: Standings / Leaders
import { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLStandings, fetchPWHLPlayers, PWHL_TEAM_CONFIG, PWHL_TEAM_ID } from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON, PWHL_TEAM_MAP, PWHL_TEAMS } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import './ShotMapView.css';
import './PlayersView.css';

const SEASONS = [
  { id: 8, label: '2025-26' },
  { id: 5, label: '2024-25' },
  { id: 1, label: '2023-24' },
];

const TABS = ['Standings', 'Leaders'];

const STAND_COLS = [
  { key: 'team_code',     label: 'Team', align: 'left',   sticky: true,  sortable: false },
  { key: 'gp',            label: 'GP',   align: 'right',  sortable: true  },
  { key: 'wins',          label: 'W',    align: 'right',  sortable: true  },
  { key: 'losses',        label: 'L',    align: 'right',  sortable: true  },
  { key: 'ot_losses',     label: 'OTL',  align: 'right',  sortable: true  },
  { key: 'points',        label: 'PTS',  align: 'right',  sortable: true,  bold: true },
  { key: 'goals_for',     label: 'GF',   align: 'right',  sortable: true  },
  { key: 'goals_against', label: 'GA',   align: 'right',  sortable: true  },
  { key: '_diff',         label: 'DIFF', align: 'right',  sortable: true  },
  { key: 'home_wins',     label: 'HW',   align: 'right',  sortable: true  },
  { key: 'away_wins',     label: 'AW',   align: 'right',  sortable: true  },
];

export default function PWHLLeagueView() {
  const [tab,     setTab]     = useState('Standings');
  const [season,  setSeason]  = useState(PWHL_CURRENT_SEASON);
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState('desc');

  const { data: standings, loading: standLoading } = useFetch(
    () => fetchPWHLStandings(season), [season]
  );

  // Leaders: fetch all 8 active teams' player stats in parallel
  const activeTeams = PWHL_TEAMS.filter(t => t.teamId && !t.comingSoon);
  const [leadersReady, setLeadersReady] = useState(false);
  const [allSkaters,   setAllSkaters]   = useState([]);
  const [leadersLoading, setLeadersLoading] = useState(false);

  // Lazy-load leaders only when tab is selected
  async function loadLeaders() {
    if (leadersReady || leadersLoading) return;
    setLeadersLoading(true);
    try {
      const results = await Promise.all(
        activeTeams.map(t =>
          fetch(`${import.meta.env.VITE_WORKER_URL}/pwhl/players?teamId=${t.teamId}&season=${season}`)
            .then(r => r.ok ? r.json() : { skaters: [], goalies: [] })
            .catch(() => ({ skaters: [], goalies: [] }))
        )
      );
      const combined = results.flatMap(r => r.skaters || []);
      setAllSkaters(combined);
      setLeadersReady(true);
    } finally {
      setLeadersLoading(false);
    }
  }

  function handleTab(t) {
    setTab(t);
    if (t === 'Leaders') loadLeaders();
  }

  // Reset leaders when season changes
  const handleSeasonChange = (id) => {
    setSeason(id);
    setLeadersReady(false);
    setAllSkaters([]);
  };

  const enriched = useMemo(() => {
    if (!standings?.length) return [];
    return standings.map(r => ({ ...r, _diff: (r.goals_for??0)-(r.goals_against??0) }));
  }, [standings]);

  const sorted = useMemo(() => {
    return [...enriched].sort((a,b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [enriched, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const seasonLabel = SEASONS.find(s => s.id === season)?.label || String(season);
  const myTeamId    = PWHL_TEAM_ID;

  return (
    <div className="page">
      <div className="players-header">
        <h2 className="view-title">🏒 PWHL League</h2>
        <p className="players-sub">{seasonLabel}</p>
      </div>

      {/* Season picker */}
      <div className="players-tabs">
        {SEASONS.map(s => (
          <button key={s.id} className={`players-tab${season === s.id ? ' active' : ''}`}
            onClick={() => handleSeasonChange(s.id)}>{s.label}</button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="players-tabs" style={{ marginTop: 0, marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t} className={`players-tab${tab === t ? ' active' : ''}`}
            onClick={() => handleTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── Standings tab ── */}
      {tab === 'Standings' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {standLoading && <StandingsSkeleton />}
          {!standLoading && !standings?.length && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
              No standings for {seasonLabel}.
            </div>
          )}
          {!standLoading && sorted.length > 0 && (
            <>
              <div className="sst-scroll">
                <table className="sst-table" style={{ minWidth: 480 }}>
                  <thead>
                    <tr>
                      {STAND_COLS.map(col => (
                        <th key={col.key}
                          className={`sst-th ${col.align}${col.sticky ? ' sticky' : ''}${sortKey === col.key ? ' sorted' : ''}`}
                          style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                          onClick={col.sortable ? () => handleSort(col.key) : undefined}>
                          {col.label}
                          {col.sortable && sortKey === col.key && (
                            <span className="sst-sort-icon">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => {
                      const team      = PWHL_TEAM_MAP[row.team_code];
                      const teamColor = team?.displayColor || 'var(--text-dim)';
                      const isMyTeam  = row.team_id === myTeamId;
                      return (
                        <tr key={row.team_id ?? i}
                          className={`sst-row${i % 2 === 0 ? ' even' : ''}${isMyTeam ? ' sst-row-highlight' : ''}`}
                          style={isMyTeam ? { background: 'rgba(255,255,255,0.04)' } : {}}>
                          {STAND_COLS.map(col => {
                            if (col.key === 'team_code') return (
                              <td key="team_code" className="sst-td left sticky" style={{ color: teamColor }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <TeamLogo abbr={row.team_code} sport="pwhl" size={20} color={teamColor} />
                                  <span style={{ fontWeight: 700 }}>{row.team_code}</span>
                                  {team && <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>{team.shortName}</span>}
                                </div>
                              </td>
                            );
                            const val = row[col.key];
                            const diffColor = col.key === '_diff'
                              ? val > 0 ? 'var(--green)' : val < 0 ? 'var(--red-bright)' : 'inherit'
                              : 'inherit';
                            return (
                              <td key={col.key}
                                className={`sst-td ${col.align}${col.bold ? ' bold' : ''}`}
                                style={{ color: diffColor }}>
                                {col.key === '_diff'
                                  ? (val != null ? (val > 0 ? `+${val}` : val) : '—')
                                  : (val ?? '—')}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="sst-hint" style={{ padding: '6px 0 8px' }}>
                Sort by any column · Source: HockeyTech / PWHL
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Leaders tab ── */}
      {tab === 'Leaders' && (
        <LeadersTab
          allSkaters={allSkaters}
          loading={leadersLoading}
          ready={leadersReady}
          season={seasonLabel}
        />
      )}
    </div>
  );
}

// ── Leaders tab ────────────────────────────────────────────────────────────────
function LeadersTab({ allSkaters, loading, ready, season }) {
  const [cat, setCat] = useState('points'); // 'points' | 'goals' | 'assists'

  const top10 = useMemo(() => {
    if (!allSkaters.length) return [];
    return [...allSkaters]
      .filter(p => p.player_name)
      .sort((a,b) => (b[cat]??0) - (a[cat]??0))
      .slice(0, 10);
  }, [allSkaters, cat]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      {Array.from({length: 8}).map((_,i) => (
        <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
      ))}
    </div>
  );

  return (
    <>
      <div className="players-tabs" style={{ marginBottom: 12, marginTop: 0 }}>
        {[['points','Points'],['goals','Goals'],['assists','Assists']].map(([k,l]) => (
          <button key={k} className={`players-tab${cat === k ? ' active' : ''}`}
            onClick={() => setCat(k)}>{l}</button>
        ))}
      </div>

      {!ready && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}>
          Select Leaders tab to load data.
        </div>
      )}

      {ready && top10.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}>
          No leader data for {season}.
        </div>
      )}

      {ready && top10.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {top10.map((p, i) => {
            const team  = PWHL_TEAM_MAP[p.team_code] || PWHL_TEAMS.find(t => t.teamId === p.team_id);
            const color = team?.displayColor || 'var(--text-dim)';
            return (
              <div key={p.id ?? i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                borderBottom: i < top10.length-1 ? '0.5px solid var(--border)' : 'none',
              }}>
                {/* Rank */}
                <div style={{
                  width: 24, flexShrink: 0, textAlign: 'center',
                  fontFamily: 'var(--font-display)', fontSize: 13,
                  fontWeight: 700, color: i === 0 ? 'var(--amber)' : 'var(--text-dim)',
                }}>{i + 1}</div>

                {/* Team logo */}
                {team && <TeamLogo abbr={team.abbr} sport="pwhl" size={22} color={color} />}

                {/* Name + team */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.player_name}</div>
                  {team && <div style={{ fontSize: 10, color, lineHeight: 1.2 }}>{team.abbr}</div>}
                </div>

                {/* Stat */}
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color,
                  minWidth: 32, textAlign: 'right',
                }}>
                  {p[cat] ?? '—'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', width: 36 }}>
                  {cat === 'points' ? 'PTS' : cat === 'goals' ? 'G' : 'A'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function StandingsSkeleton() {
  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 8 }).map((_,i) => (
        <div key={i} className="skeleton" style={{ height: 32, borderRadius: 6 }} />
      ))}
    </div>
  );
}
