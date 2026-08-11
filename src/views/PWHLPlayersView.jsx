// views/PWHLPlayersView.jsx
// Mirrors NHL PlayersView — Roster tab (photo grid) + Stats tab (sortable table).
import { useState, useMemo, useEffect, useRef } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLPlayers, PWHL_TEAM_CONFIG, PWHL_TEAM_ID } from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON, PWHL_REGULAR_SEASONS } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import PWHLPlayerPopup from '../components/PWHLPlayerPopup';

// Tailwind migration (Session 97, Phase 3, sub-PR 1) -- see PlayersView.jsx
// for the full rationale (cascade-layer note on .player-card's hover/active
// state, Cypress marker classes kept: .player-card, .player-card-skeleton,
// .pc-last, .sst-table). This file mirrors that one's class constants since
// there's no shared component between the NHL/PWHL roster views.
// DRILL_EMPTY_CLASSES (Phase 5, ShotMapView.css sub-PR 2) -- see
// PlayersView.jsx's identical comment: "drill-empty" here was a
// coincidental same-name marker with zero real CSS backing it, since this
// file never imported ShotMapView.css. Fixed here too.
const DRILL_EMPTY_CLASSES = 'drill-empty text-[color:var(--text-dim)] text-[13px] py-[24px] px-[16px] text-center'
const HEADER_WRAP_CLASSES = 'mb-[14px]'
const VIEW_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold flex items-center gap-2 mb-[2px]'
const PLAYERS_SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)]'

const TABS_WRAP_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-14px] mb-[14px] px-[14px]'
const TAB_BASE_CLASSES = 'players-tab flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]'
const TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent'
const TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]'
function tabClasses(isActive) {
  return `${TAB_BASE_CLASSES} ${isActive ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`
}

const ROSTER_SECTION_CLASSES = 'mb-5'
const ROSTER_GRID_CLASSES = 'grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(110px,1fr))]'

// padding is real CSS in index.css, not a Tailwind utility -- .card's own
// unlayered padding:14px would beat a layered p-[9px] utility (see index.css)
const CARD_BASE_CLASSES = 'player-card card flex flex-col cursor-pointer overflow-hidden'
const SKELETON_CARD_CLASSES = 'player-card-skeleton card flex flex-col overflow-hidden'
const PC_PHOTO_WRAP_CLASSES = 'relative mb-[7px]'
const PC_PHOTO_CLASSES = 'pc-photo w-full aspect-square object-cover object-top rounded-[var(--radius-sm)] bg-[var(--bg3)] block'
const PC_PHOTO_FALLBACK_CLASSES = 'w-full aspect-square rounded-[var(--radius-sm)] bg-[var(--bg3)] flex items-center justify-center font-[family-name:var(--font-display)] text-[20px] font-bold text-[color:var(--text-dim)]'
const PC_NUM_CLASSES = 'absolute top-1 left-1 bg-[rgba(0,0,0,0.65)] text-[color:var(--red-bright)] font-[family-name:var(--font-display)] text-[11px] font-bold py-px px-[5px] rounded-[3px] leading-[1.4]'
const PC_INFO_CLASSES = 'flex flex-col gap-[2px]'
const PC_FIRST_CLASSES = 'text-[10px] text-[color:var(--text-muted)] leading-none'
const PC_LAST_CLASSES = 'pc-last text-[13px] font-semibold text-[color:var(--text)] leading-[1.2]'
const PC_BADGES_CLASSES = 'flex gap-1 mt-[3px] flex-wrap'
const PC_POS_CLASSES = 'font-[family-name:var(--font-display)] text-[10px] font-bold bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[var(--red-border)] py-px px-[5px] rounded-[3px]'
const PC_SHOOTS_CLASSES = 'text-[10px] text-[color:var(--text-dim)] bg-[var(--bg3)] py-px px-[5px] rounded-[3px]'

const SST_WRAP_CLASSES = 'mb-[12px]'
const SST_SCROLL_CLASSES = 'overflow-x-auto [-webkit-overflow-scrolling:touch] rounded-[10px] border-[0.5px] border-[var(--border)]'
const SST_TABLE_CLASSES = 'sst-table border-collapse w-full min-w-[680px] text-[12px]'
const SST_TH_BASE_CLASSES = 'py-2 px-[6px] text-[11px] font-bold border-b-[0.5px] border-[var(--border)] whitespace-nowrap relative select-none'
const SST_TD_BASE_CLASSES = 'py-2 px-[6px] border-b-[0.5px] border-[rgba(255,255,255,0.04)] whitespace-nowrap'
const STICKY_CLASSES = 'sticky left-0 z-[2] bg-[var(--bg2)] border-r-[0.5px] border-[var(--border)]'
const SST_SORT_ICON_CLASSES = 'text-[10px]'
const SST_ROW_CLASSES = 'sst-row cursor-pointer [transition:background_0.1s] hover:bg-[var(--bg3)]'
const SST_HINT_CLASSES = 'text-[10px] text-[color:var(--text-dim)] text-center mt-[6px]'

function alignClasses(align) {
  if (align === 'left') return 'text-left pl-[10px]'
  if (align === 'right') return 'text-right pr-2'
  return 'text-center'
}
function thClasses(col, sortKey) {
  const color = sortKey === col.key ? 'text-[color:var(--text)]' : 'text-[color:var(--text-dim)]'
  return `${SST_TH_BASE_CLASSES} ${alignClasses(col.align)} ${color} ${col.sticky ? STICKY_CLASSES : ''}`
}
function tdClasses(col, isEvenRow) {
  const colorFont = col.sticky
    ? `text-[color:var(--text)] font-[family-name:inherit] font-semibold ${STICKY_CLASSES}`
    : col.bold
      ? 'text-[color:var(--text)] font-bold font-[family-name:var(--font-mono)]'
      : 'text-[color:var(--text-muted)] font-[family-name:var(--font-mono)]'
  const evenBg = isEvenRow && !col.sticky ? 'bg-[rgba(255,255,255,0.015)]' : ''
  return `${SST_TD_BASE_CLASSES} ${alignClasses(col.align)} ${colorFont} ${evenBg}`
}

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

  // useState's initial value only runs once, at first mount. If this
  // component happens to mount before pwhlConfig.js's async live-season
  // fetch resolves, `season` permanently locks onto the fallback value
  // (PWHL_CURRENT_SEASON at that instant) even after the real value comes
  // in — the fallback constant itself updates live, but this component's
  // own snapshot of it doesn't. Catching up via the event pwhlConfig.js
  // already dispatches on resolution, but only if the user hasn't
  // manually picked a season themselves — don't clobber their choice.
  const userPickedSeason = useRef(false);
  useEffect(() => {
    function handleSeasonUpdate(e) {
      if (!userPickedSeason.current) setSeason(e.detail);
    }
    window.addEventListener('eyewall:pwhl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:pwhl-season-updated', handleSeasonUpdate);
  }, []);

  function handleSeasonPick(id) {
    userPickedSeason.current = true;
    setSeason(id);
  }

  const { data, loading } = useFetch(
    () => teamId ? fetchPWHLPlayers(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  const roster  = useMemo(() => data?.roster  || [], [data]);
  const skaters = useMemo(() => data?.skaters || [], [data]);
  const goalies = useMemo(() => data?.goalies || [], [data]);

  const seasonLabel = PWHL_REGULAR_SEASONS.find(s => s.id === season)?.label || String(season);

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
      <div className={HEADER_WRAP_CLASSES}>
        <h2 className={VIEW_TITLE_CLASSES}>
          <TeamLogo abbr={abbr} sport="pwhl" size={22} color={color} />
          Roster
        </h2>
        <p className={PLAYERS_SUB_CLASSES}>Tap a player for stats</p>
      </div>

      {/* Roster / Stats toggle */}
      <div className={TABS_WRAP_CLASSES}>
        <button className={tabClasses(view === 'roster')} onClick={() => setView('roster')}>
          Roster
        </button>
        <button className={tabClasses(view === 'stats')} onClick={() => setView('stats')}>
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
                onSelect={setSelected}
              />
              <RosterSection
                title="Defencemen"
                players={roster.filter(p => ['D','LD','RD'].includes(p.position))}
                onSelect={setSelected}
              />
              <RosterSection
                title="Goalies"
                players={roster.filter(p => p.position === 'G')}
                onSelect={setSelected}
              />
            </>
          )}
        </>
      )}

      {/* ── Stats tab ── */}
      {view === 'stats' && (
        <>
          {/* Season picker */}
          <div className={TABS_WRAP_CLASSES} style={{ marginTop: 0, marginBottom: 0 }}>
            {PWHL_REGULAR_SEASONS.map(s => (
              <button key={s.id} className={tabClasses(season === s.id)}
                onClick={() => handleSeasonPick(s.id)}>{s.label}</button>
            ))}
          </div>
          {/* Skaters / Goalies sub-tabs */}
          <div className={TABS_WRAP_CLASSES} style={{ marginTop: 4, marginBottom: 4 }}>
            <button className={tabClasses(gameType === 'regular')}
              onClick={() => setGameType('regular')}>Skaters</button>
            <button className={tabClasses(gameType === 'goalies')}
              onClick={() => setGameType('goalies')}>Goalies</button>
          </div>

          {gameType === 'regular' && (
            <SortableTable
              rows={skaters} cols={SKATER_COLS} defaultSort="points"
              loading={loading} emptyMsg={`No skater stats for ${seasonLabel}.`}
              onRowClick={setSelected}
            />
          )}
          {gameType === 'goalies' && (
            <SortableTable
              rows={goalies} cols={GOALIE_COLS} defaultSort="wins"
              loading={loading} emptyMsg={`No goalie stats for ${seasonLabel}.`}
              onRowClick={setSelected}
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
          season={season}
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
    <div className={ROSTER_SECTION_CLASSES}>
      <div className="sec-label">{title}</div>
      <div className={ROSTER_GRID_CLASSES}>
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
    <div className={CARD_BASE_CLASSES} onClick={onClick}>
      <div className={PC_PHOTO_WRAP_CLASSES}>
        {!imgErr ? (
          <img src={headshot} alt={name} className={PC_PHOTO_CLASSES} onError={() => setImgErr(true)} />
        ) : (
          <div className={PC_PHOTO_FALLBACK_CLASSES}>{initials}</div>
        )}
        {p.jersey_number && <span className={PC_NUM_CLASSES}>#{p.jersey_number}</span>}
      </div>
      <div className={PC_INFO_CLASSES}>
        <span className={PC_FIRST_CLASSES}>{p.first_name}</span>
        <span className={PC_LAST_CLASSES}>{p.last_name}</span>
        <div className={PC_BADGES_CLASSES}>
          {p.position && <span className={PC_POS_CLASSES}>{p.position}</span>}
          {p.shoots   && <span className={PC_SHOOTS_CLASSES}>{p.shoots}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Roster skeleton ───────────────────────────────────────────

function RosterSkeleton() {
  return (
    <div className={ROSTER_GRID_CLASSES} style={{ marginTop: 8 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={SKELETON_CARD_CLASSES}>
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

  if (!rows?.length) return <div className={DRILL_EMPTY_CLASSES}>{emptyMsg}</div>;

  return (
    <div className={SST_WRAP_CLASSES}>
      <div className={SST_SCROLL_CLASSES}>
        <table className={SST_TABLE_CLASSES}>
          <thead>
            <tr>
              {cols.map(col => (
                <th key={col.key}
                  className={thClasses(col, sortKey)}
                  style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                  onClick={() => handleSort(col.key)}>
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className={SST_SORT_ICON_CLASSES}>{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.player_id ?? i}
                className={`${SST_ROW_CLASSES}${onRowClick ? ' clickable' : ''}`}
                onClick={() => onRowClick?.(row)}>
                {cols.map(col => {
                  const val = row[col.key];
                  const pmColor = col.key === 'plus_minus'
                    ? (val > 0 ? '#4ade80' : val < 0 ? '#f87171' : 'inherit')
                    : 'inherit';
                  return (
                    <td key={col.key}
                      className={tdClasses(col, i % 2 === 0)}
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
      <div className={SST_HINT_CLASSES}>Tap a row to open player profile · Sort by any column</div>
    </div>
  );
}
