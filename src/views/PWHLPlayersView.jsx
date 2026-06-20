// views/PWHLPlayersView.jsx
// Mirrors NHL PlayersView — Roster tab (photo grid) + Stats tab (sortable table).
import { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLPlayers, PWHL_TEAM_CONFIG, PWHL_TEAM_ID } from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import PWHLPlayerPopup from '../components/PWHLPlayerPopup';
import './PlayersView.css';

const SEASONS = [
  { id: 8, label: '2025-26' },
  { id: 5, label: '2024-25' },
  { id: 1, label: '2023-24' },
];

// ── Skater columns ────────────────────────────────────────────
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
  { key: 'shot_pct',    label: 'S%',     align: 'right',  sortable: true,                fmt: v => v != null ? `${Number(v).toFixed(1)}%` : '—' },
];

// ── Goalie columns ────────────────────────────────────────────
const GOALIE_COLS = [
  { key: 'player_name',   label: 'Goalie', align: 'left',  sortable: true,  sticky: true, fmt: v => v || '—' },
  { key: 'gp',            label: 'GP',     align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'wins',          label: 'W',      align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'losses',        label: 'L',      align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'ot_losses',     label: 'OTL',    align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'gaa',           label: 'GAA',    align: 'right', sortable: true,  bold: true,   fmt: v => v != null ? Number(v).toFixed(2) : '—' },
  { key: 'sv_pct',        label: 'SV%',    align: 'right', sortable: true,  bold: true,   fmt: v => v != null ? Number(v).toFixed(3).replace('0.', '.') : '—' },
  { key: 'shutouts',      label: 'SO',     align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'saves',         label: 'SV',     align: 'right', sortable: true,                fmt: v => v ?? '—' },
  { key: 'goals_against', label: 'GA',     align: 'right', sortable: true,                fmt: v => v ?? '—' },
];

// ── Main view ─────────────────────────────────────────────────

export default function PWHLPlayersView() {
  const team   = PWHL_TEAM_CONFIG;
  const teamId = PWHL_TEAM_ID;
  const abbr   = team?.abbr || '—';
  const color  = team?.displayColor || 'var(--text-dim)';

  const [season,   setSeason]   = useState(PWHL_CURRENT_SEASON);
  const [view,     setView]     = useState('roster');
  const [gameType, setGameType] = useState('regular');
  const [selected, setSelected] = useState(null);

  const { data, loading } = useFetch(
    () => teamId ? fetchPWHLPlayers(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  const roster  = useMemo(() => data?.roster  || [], [data]);
  const skaters = useMemo(() => data?.skaters || [], [data]);
  const goalies = useMemo(() => data?.goalies || [], [data]);

  const seasonLabel = SEASONS.find(s => s.id === season)?.label || String(season);

  // For popup: merge stat row with roster bio (roster has headshot/birth_date etc)
  const rosterMap = useMemo(() => {
    const m = {};
    for (const p of roster) m[p.player_id] = p;
    return m;
  }, [roster]);

  function openPopup(row) {
    const bio = rosterMap[row.player_id] || {};
    setSelected({ ...bio, ...row });
  }

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
          Roster
        </h2>
        <p className="players-sub">Tap a player for stats</p>
      </div>

      {/* Roster / Stats toggle */}
      <div className="players-tabs">
        <button className={`players-tab${view === 'roster' ? ' active' : ''}`} onClick={() => setView('roster')}>
          Roster
        </button>
        <button className={`players-tab${view === 'stats' ? ' active' : ''}`} onClick={() => setView('stats')}>
          📊 Stats
        </button>
      </div>

      {/* ── Roster tab ── */}
      {view === 'roster' && (
        <>
          {loading && <RosterSkeleton />}
          {!loading && !data && (
            <div className="card" style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>
              Failed to load roster.
            </div>
          )}
          {!loading && data && roster.length === 0 && (
            <div className="card" style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>
              No roster data — try busting the cache.
            </div>
          )}
          {!loading && data && roster.length > 0 && (
            <>
              <RosterSection
                title="Forwards"
                players={roster.filter(p => ['C','LW','RW','F'].includes(p.position))}
                onSelect={p => setSelected({ ...p, ...(skaters.find(s => s.player_id === p.player_id) || {}) })}
              />
              <RosterSection
                title="Defencemen"
                players={roster.filter(p => ['D','LD','RD'].includes(p.position))}
                onSelect={p => setSelected({ ...p, ...(skaters.find(s => s.player_id === p.player_id) || {}) })}
              />
              <RosterSection
                title="Goalies"
                players={roster.filter(p => p.position === 'G')}
                onSelect={p => setSelected({ ...p, ...(goalies.find(g => g.player_id === p.player_id) || {}) })}
              />
            </>
          )}
        </>
      )}

      {/* ── Stats tab ── */}
      {view === 'stats' && (
        <>
          {/* Season picker */}
          <div className="players-tabs" style={{ marginTop: 0, marginBottom: 0 }}>
            {SEASONS.map(s => (
              <button key={s.id} className={`players-tab${season === s.id ? ' active' : ''}`}
                onClick={() => setSeason(s.id)}>{s.label}</button>
            ))}
          </div>
          {/* Skaters / Goalies sub-tabs */}
          <div className="players-tabs" style={{ marginTop: 4, marginBottom: 4 }}>
            <button className={`players-tab${gameType === 'regular' ? ' active' : ''}`}
              onClick={() => setGameType('regular')}>Skaters</button>
            <button className={`players-tab${gameType === 'goalies' ? ' active' : ''}`}
              onClick={() => setGameType('goalies')}>Goalies</button>
          </div>

          {gameType === 'regular' && (
            <SortableTable
              rows={skaters} cols={SKATER_COLS} defaultSort="points"
              loading={loading} emptyMsg={`No skater stats for ${seasonLabel}.`}
              onRowClick={openPopup}
            />
          )}
          {gameType === 'goalies' && (
            <SortableTable
              rows={goalies} cols={GOALIE_COLS} defaultSort="wins"
              loading={loading} emptyMsg={`No goalie stats for ${seasonLabel}.`}
              onRowClick={openPopup}
            />
          )}
        </>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '8px 0' }}>
        Source: HockeyTech / PWHL
      </div>

      {selected && (
        <PWHLPlayerPopup
          player={selected}
          seasonLabel={seasonLabel}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ── Roster section ────────────────────────────────────────────

function RosterSection({ title, players, onSelect }) {
  if (!players.length) return null;
  const sorted = [...players].sort((a,b) => (a.jersey_number||99) - (b.jersey_number||99));
  return (
    <div className="roster-section">
      <div className="sec-label">{title}</div>
      <div className="roster-grid">
        {sorted.map(p => <PlayerCard key={p.player_id} player={p} onClick={() => onSelect(p)} />)}
      </div>
    </div>
  );
}

// ── Player card ───────────────────────────────────────────────

function PlayerCard({ player: p, onClick }) {
  const [imgErr, setImgErr] = useState(false);
  const name     = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  const headshot = p.headshot || `https://assets.leaguestat.com/pwhl/240x240/${p.player_id}.jpg`;
  const initials = (p.first_name?.[0] || '') + (p.last_name?.[0] || '');

  return (
    <div className="player-card card" onClick={onClick}>
      <div className="pc-photo-wrap">
        {!imgErr ? (
          <img src={headshot} alt={name} className="pc-photo" onError={() => setImgErr(true)} />
        ) : (
          <div className="pc-photo-fallback">{initials}</div>
        )}
        {p.jersey_number && <span className="pc-num">#{p.jersey_number}</span>}
      </div>
      <div className="pc-info">
        <span className="pc-first">{p.first_name}</span>
        <span className="pc-last">{p.last_name}</span>
        <div className="pc-badges">
          {p.position && <span className="pc-pos">{p.position}</span>}
          {p.shoots   && <span className="pc-shoots">{p.shoots}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Roster skeleton ───────────────────────────────────────────

function RosterSkeleton() {
  return (
    <div className="roster-grid" style={{ marginTop: 8 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="player-card card">
          <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 10, width: '60%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 10, width: '40%' }} />
        </div>
      ))}
    </div>
  );
}

// ── Sortable stats table ──────────────────────────────────────

function SortableTable({ rows, cols, defaultSort, loading, emptyMsg, onRowClick }) {
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
      {[80,65,72,58,70].map((w,i) => (
        <div key={i} className="skeleton" style={{ height: 32, width: `${w}%`, borderRadius: 6 }} />
      ))}
    </div>
  );

  if (!rows?.length) return <div className="drill-empty">{emptyMsg}</div>;

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
              <tr key={row.player_id ?? i}
                className={`sst-row${i % 2 === 0 ? ' even' : ''}${onRowClick ? ' clickable' : ''}`}
                onClick={() => onRowClick?.(row)}>
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
      <div className="sst-hint">Tap a row to open player profile · Sort by any column</div>
    </div>
  );
}
