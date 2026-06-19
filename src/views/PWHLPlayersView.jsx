// views/PWHLPlayersView.jsx
// Mirrors NHL PlayersView.jsx — Stats tab with sortable skater/goalie tables.
// No roster grid (PWHL doesn't have headshots via HockeyTech).
import { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLPlayers, PWHL_TEAM_CONFIG, PWHL_TEAM_ID } from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import './PlayersView.css';
import './ShotMapView.css';

const SEASONS = [
  { id: 8, label: '2025-26' },
  { id: 5, label: '2024-25' },
  { id: 1, label: '2023-24' },
];

// ── Skater columns — field names verified against /pwhl/players response ──────
const SKATER_COLS = [
  { key: 'player_name', label: 'Player', align: 'left',   sortable: true,  sticky: true, fmt: v => v || '—' },
  { key: 'position',    label: 'Pos',    align: 'center', sortable: false,               fmt: v => v || '—' },
  { key: 'gp',          label: 'GP',     align: 'right',  sortable: true,                fmt: v => v ?? '—' },
  { key: 'goals',       label: 'G',      align: 'right',  sortable: true,                fmt: v => v ?? '—' },
  { key: 'assists',     label: 'A',      align: 'right',  sortable: true,                fmt: v => v ?? '—' },
  { key: 'points',      label: 'PTS',    align: 'right',  sortable: true,  bold: true,   fmt: v => v ?? '—' },
  { key: 'plus_minus',  label: '+/-',    align: 'right',  sortable: true,                fmt: v => v != null ? (v > 0 ? `+${v}` : String(v)) : '—' },
  { key: 'pim',         label: 'PIM',    align: 'right',  sortable: true,                fmt: v => v ?? '—' },
  { key: 'pp_goals',    label: 'PPG',    align: 'right',  sortable: true,                fmt: v => v ?? '—' },
  { key: 'sh_goals',    label: 'SHG',    align: 'right',  sortable: true,                fmt: v => v ?? '—' },
  { key: 'gw_goals',    label: 'GWG',    align: 'right',  sortable: true,                fmt: v => v ?? '—' },
  { key: 'shots',       label: 'SOG',    align: 'right',  sortable: true,                fmt: v => v ?? '—' },
  { key: 'shot_pct',    label: 'S%',     align: 'right',  sortable: true,                fmt: v => v != null ? `${v.toFixed(1)}%` : '—' },
];

// ── Goalie columns — shots_against is 0 in DB; use saves+goals_against as total ─
const GOALIE_COLS = [
  { key: 'player_name',   label: 'Goalie', align: 'left',  sortable: true,  sticky: true, fmt: v => v || '—' },
  { key: 'gp',            label: 'GP',     align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'wins',          label: 'W',      align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'losses',        label: 'L',      align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'ot_losses',     label: 'OTL',    align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'gaa',           label: 'GAA',    align: 'right', sortable: true,  bold: true,   fmt: v => v != null ? v.toFixed(2) : '—' },
  { key: 'sv_pct',        label: 'SV%',    align: 'right', sortable: true,  bold: true,   fmt: v => v != null ? v.toFixed(3).replace('0.', '.') : '—' },
  { key: 'shutouts',      label: 'SO',     align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: '_sa',           label: 'SA',     align: 'right', sortable: true,                fmt: v => v ?? '—' }, // computed
  { key: 'saves',         label: 'SV',     align: 'right', sortable: true,                fmt: v => v ?? '—' },
];

export default function PWHLPlayersView() {
  const team   = PWHL_TEAM_CONFIG;
  const teamId = PWHL_TEAM_ID;
  const abbr   = team?.abbr || '—';
  const color  = team?.displayColor || 'var(--text-dim)';

  const [season, setSeason] = useState(PWHL_CURRENT_SEASON);
  const [tab,    setTab]    = useState('skaters');

  const { data, loading } = useFetch(
    () => teamId ? fetchPWHLPlayers(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  const skaters = useMemo(() => data?.skaters || [], [data]);
  // Compute shots_against from saves + goals_against since DB field is 0
  const goalies = useMemo(() =>
    (data?.goalies || []).map(g => ({
      ...g,
      _sa: (g.saves ?? 0) + (g.goals_against ?? 0),
    })),
    [data]
  );

  const seasonLabel = SEASONS.find(s => s.id === season)?.label || String(season);

  if (!abbr || !teamId) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>No PWHL team selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="players-header">
        <h2 className="view-title">
          <TeamLogo abbr={abbr} sport="pwhl" size={22} color={color} />
          Players
        </h2>
        <p className="players-sub">{seasonLabel} statistics · Tap column header to sort</p>
      </div>

      {/* Season picker */}
      <div className="players-tabs">
        {SEASONS.map(s => (
          <button key={s.id} className={`players-tab${season === s.id ? ' active' : ''}`}
            onClick={() => setSeason(s.id)}>{s.label}</button>
        ))}
      </div>

      {/* Skaters / Goalies */}
      <div className="players-tabs" style={{ marginTop: 0, marginBottom: 4 }}>
        <button className={`players-tab${tab === 'skaters' ? ' active' : ''}`} onClick={() => setTab('skaters')}>
          📊 Skaters
        </button>
        <button className={`players-tab${tab === 'goalies' ? ' active' : ''}`} onClick={() => setTab('goalies')}>
          🥅 Goalies
        </button>
      </div>

      {tab === 'skaters' && (
        <SortableTable rows={skaters} cols={SKATER_COLS} defaultSort="points"
          loading={loading} emptyMsg={`No skater stats for ${seasonLabel}.`} />
      )}
      {tab === 'goalies' && (
        <SortableTable rows={goalies} cols={GOALIE_COLS} defaultSort="wins"
          loading={loading} emptyMsg={`No goalie stats for ${seasonLabel}.`} />
      )}

      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '8px 0' }}>
        Source: HockeyTech / PWHL
      </div>
    </div>
  );
}

function SortableTable({ rows, cols, defaultSort, loading, emptyMsg }) {
  const [sortKey, setSortKey] = useState(defaultSort);
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [rows, sortKey, sortDir]);

  function handleSort(key) {
    if (!cols.find(c => c.key === key)?.sortable) return;
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  if (loading) return (
    <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[80, 65, 72, 58, 70].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 32, width: `${w}%`, borderRadius: 6 }} />
      ))}
    </div>
  );

  if (!rows?.length) return (
    <div className="drill-empty">{emptyMsg}</div>
  );

  return (
    <div className="sst-wrap">
      <div className="sst-scroll">
        <table className="sst-table">
          <thead>
            <tr>
              {cols.map(col => (
                <th key={col.key}
                  className={`sst-th ${col.align}${col.sticky ? ' sticky' : ''}${sortKey === col.key ? ' sorted' : ''}`}
                  style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                  onClick={() => handleSort(col.key)}>
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="sst-sort-icon">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.id ?? i} className={`sst-row${i % 2 === 0 ? ' even' : ''}`}>
                {cols.map(col => {
                  const val = row[col.key];
                  const pmColor = col.key === 'plus_minus'
                    ? (val > 0 ? '#4ade80' : val < 0 ? '#f87171' : 'inherit')
                    : 'inherit';
                  return (
                    <td key={col.key}
                      className={`sst-td ${col.align}${col.sticky ? ' sticky' : ''}${col.bold ? ' bold' : ''}`}
                      style={{ color: pmColor }}>
                      {col.fmt(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sst-hint">Sort by any column</div>
    </div>
  );
}
