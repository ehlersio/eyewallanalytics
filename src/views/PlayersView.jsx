import { useState, useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getRoster, getPlayoffGames, getStandings, TEAM_CONFIG } from '../utils/nhlApi'
import { getTeamSkaterStatsFromDB } from '../utils/supabaseClient'
import TeamLogo from '../components/TeamLogo'
import PlayerPopup from '../components/PlayerPopup'
import './PlayersView.css'

const SEASON = Number(TEAM_CONFIG.season.slice(0, 4) + TEAM_CONFIG.season.slice(4)) // e.g. 20252026

// ─── Stat definitions with tooltips ──────────────────────────
// Moved to PlayerPopup.jsx (shared with LeagueView leaders modal)

// ─── Main component ───────────────────────────────────────────

export default function PlayersView() {
  const { data: roster,      loading: rosterLoading } = useFetch(() => getRoster(TEAM_CONFIG.abbr))
  const { data: poGames }   = useFetch(getPlayoffGames)
  const { data: standingsRaw } = useFetch(getStandings)
  // NHL's /standings/now stays pinned to last season's finale for months
  // after our season config flips — see nhlApi.js's _getTeamStats() for the
  // full story. Don't feed last season's team rank context into a player's
  // rankings display as if it were current. Only reject on an EXPLICIT
  // mismatch — an absent seasonId (e.g. a test stub) isn't evidence of
  // staleness, the real NHL API always includes it.
  const standingsAreStale = standingsRaw?.[0]?.seasonId != null
    && String(standingsRaw[0].seasonId) !== TEAM_CONFIG.season
  const standings = standingsAreStale ? [] : (standingsRaw || [])
  const [selected, setSelected] = useState(null)
  const [view, setView]         = useState('roster')
  const [gameType, setGameType] = useState(2)
  const inPlayoffs = (poGames?.length || 0) > 0

  const { data: skaterStats, loading: statsLoading } = useFetch(
    () => getTeamSkaterStatsFromDB(TEAM_CONFIG.abbr, SEASON, gameType),
    [gameType]
  )

  return (
    <div className="page">
      <div className="players-header">
        <h2 className="view-title">
          <TeamLogo abbr={TEAM_CONFIG.abbr} size={22} />
          Roster
        </h2>
        <p className="players-sub">Tap a player for detailed stats &amp; rankings</p>
      </div>

      {/* View toggle */}
      <div className="players-tabs">
        <button className={`players-tab ${view === 'roster' ? 'active' : ''}`} onClick={() => setView('roster')}>Roster</button>
        <button className={`players-tab ${view === 'stats'  ? 'active' : ''}`} onClick={() => setView('stats')}>📊 Stats</button>
      </div>

      {view === 'stats' && (
        <>
          <div className="players-tabs" style={{ marginTop: 8, marginBottom: 4 }}>
            <button className={`players-tab ${gameType === 2 ? 'active' : ''}`} onClick={() => setGameType(2)}>Regular Season</button>
            <button className={`players-tab ${gameType === 3 ? 'active' : ''}`} onClick={() => setGameType(3)}>🏆 Playoffs</button>
          </div>
          <SkaterStatsTable skaters={skaterStats || []} loading={statsLoading} gameType={gameType} onSelect={(id) => {
            const p = roster?.all?.find(r => r.id === id);
            if (p) setSelected(p);
          }} />
        </>
      )}

      {view === 'roster' && (
        <>
          {rosterLoading && <RosterSkeleton />}
          {!rosterLoading && roster && (
            <>
              <RosterSection title="Forwards"   players={roster.forwards}   onSelect={setSelected} />
              <RosterSection title="Defensemen" players={roster.defensemen} onSelect={setSelected} />
              <RosterSection title="Goalies"    players={roster.goalies}    onSelect={setSelected} />
            </>
          )}
        </>
      )}

      {selected && (
        <PlayerPopup
          player={selected}
          inPlayoffs={inPlayoffs}
          standings={standings || []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ─── Roster section ───────────────────────────────────────────

function RosterSection({ title, players = [], onSelect }) {
  if (!players.length) return null
  const sorted = [...players].sort((a, b) => (a.sweaterNumber || 0) - (b.sweaterNumber || 0))
  return (
    <div className="roster-section">
      <div className="sec-label">{title}</div>
      <div className="roster-grid">
        {sorted.map(p => <PlayerCard key={p.id} player={p} onClick={() => onSelect(p)} />)}
      </div>
    </div>
  )
}

// ─── Player card (roster tile) ────────────────────────────────

function PlayerCard({ player: p, onClick }) {
  const [imgErr, setImgErr] = useState(false)
  const name = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim()
  return (
    <div className="player-card card" onClick={onClick}>
      <div className="pc-photo-wrap">
        {!imgErr && p.headshot ? (
          <img src={p.headshot} alt={name} className="pc-photo" onError={() => setImgErr(true)} />
        ) : (
          <div className="pc-photo-fallback">
            {(p.firstName?.default?.[0] || '') + (p.lastName?.default?.[0] || '')}
          </div>
        )}
        <span className="pc-num">#{p.sweaterNumber}</span>
      </div>
      <div className="pc-info">
        <span className="pc-first">{p.firstName?.default}</span>
        <span className="pc-last">{p.lastName?.default}</span>
        <div className="pc-badges">
          <span className="pc-pos">{p.positionCode}</span>
          {p.shootsCatches && <span className="pc-shoots">{p.shootsCatches}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Player popup (extracted to PlayerPopup.jsx) ─────────────
// PlayerPopup is now in src/components/PlayerPopup.jsx, shared with LeagueView.
// Pass isLeagueContext={true} when opening from the Leaders tab.

// ─── Roster skeleton ──────────────────────────────────────────

function RosterSkeleton() {
  return (
    <div className="roster-grid" style={{ marginTop: 8 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="player-card-skeleton card">
          <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 10, width: '60%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 10, width: '40%' }} />
        </div>
      ))}
    </div>
  )
}

// ── Skater Stats Table ────────────────────────────────────────
const COLS = [
  { key: 'skaterFullName', label: 'Player',   fmt: v => v,                           sortable: true,  align: 'left',  sticky: true },
  { key: 'positionCode',   label: 'Pos',      fmt: v => v,                           sortable: false, align: 'center' },
  { key: 'gamesPlayed',    label: 'GP',       fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'goals',          label: 'G',        fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'assists',        label: 'A',        fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'primaryAssists', label: 'A1',       fmt: v => v ?? '—',                    sortable: true,  align: 'right' },
  { key: 'secondaryAssists',label:'A2',       fmt: v => v ?? '—',                    sortable: true,  align: 'right' },
  { key: 'points',         label: 'PTS',      fmt: v => v,                           sortable: true,  align: 'right', bold: true },
  { key: 'plusMinus',      label: '+/-',      fmt: v => v > 0 ? `+${v}` : v,        sortable: true,  align: 'right' },
  { key: 'penaltyMinutes', label: 'PIM',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'ppGoals',        label: 'PPG',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'shGoals',        label: 'SHG',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'gameWinningGoals',label:'GWG',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'shots',          label: 'SOG',      fmt: v => v,                           sortable: true,  align: 'right' },
  { key: 'shootingPct',    label: 'S%',       fmt: v => v != null ? `${(v*100).toFixed(1)}%` : '—', sortable: true, align: 'right' },
];

function SkaterStatsTable({ skaters, loading, gameType = 2, onSelect }) {
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    if (!skaters?.length) return [];
    return [...skaters].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [skaters, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  if (loading) return (
    <div style={{ padding: '16px 0' }}>
      {[80,65,72,58,70].map((w,i) => (
        <div key={i} className="skeleton" style={{ height: 32, width: `${w}%`, marginBottom: 6, borderRadius: 6 }} />
      ))}
    </div>
  );

  if (!skaters?.length) return (
    <div className="drill-empty">
      {gameType === 3
        ? `No playoff stats yet — data populates once ${TEAM_CONFIG.displayName} advances.`
        : 'No stats available.'}
    </div>
  );

  return (
    <div className="sst-wrap">
      <div className="sst-scroll">
        <table className="sst-table">
          <thead>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  className={`sst-th ${col.align} ${col.sticky ? 'sticky' : ''} ${sortKey === col.key ? 'sorted' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="sst-sort-icon">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.playerId} className={`sst-row ${i % 2 === 0 ? 'even' : ''}`}
                onClick={() => onSelect(p.playerId)}>
                {COLS.map(col => {
                  const val = p[col.key];
                  const pmColor = col.key === 'plusMinus'
                    ? val > 0 ? '#4ade80' : val < 0 ? '#f87171' : 'inherit'
                    : 'inherit';
                  return (
                    <td key={col.key}
                      className={`sst-td ${col.align} ${col.sticky ? 'sticky' : ''} ${col.bold ? 'bold' : ''}`}
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
      <div className="sst-hint">Tap a player row to open their profile · Sort by any column</div>
    </div>
  );
}
