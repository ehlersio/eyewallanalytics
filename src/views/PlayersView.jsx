import { useState, useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getRoster, getPlayoffGames, getStandings, TEAM_CONFIG } from '../utils/nhlApi'
import { getTeamSkaterStatsFromDB } from '../utils/supabaseClient'
import { useSport } from '../utils/SportContext'
import { isStandingsStale } from '../utils/standingsUtils'
import TeamLogo from '../components/TeamLogo'
import PlayerPopup from '../components/PlayerPopup'

// ─── Stat definitions with tooltips ──────────────────────────
// Moved to PlayerPopup.jsx (shared with LeagueView leaders modal)

// Tailwind migration (Session 97, Phase 3, sub-PR 1) -- PlayersView.css
// still imported above: PlayerPopup.jsx, PWHLPlayerPopup.jsx,
// PlayerComparisonPopup.jsx, TeamComparisonPopup.jsx, and PWHLLeagueView.jsx
// haven't migrated yet, so the file's remaining rules (.pp-*, .stat-*, etc)
// are still needed. The import here is removed only once every consumer is
// migrated (sub-PR 3).
//
// Class names below are kept as literal marker strings alongside the
// Tailwind utilities wherever Cypress selects on them directly (audited via
// grep across cypress/e2e + cypress/support): .player-card,
// .player-card-skeleton, .pc-last, .sst-table. They carry no CSS of their
// own anymore.
//
// .player-card's hover/active border-color + translateY can't be a Tailwind
// hover: utility here -- .card (index.css) sets its own unlayered `border`
// shorthand, and unlayered CSS always beats a layered Tailwind utility
// regardless of specificity (the same bug class fixed for button/a/svg in
// Session 94, Phase 0). Kept as a small real, unlayered CSS rule in
// index.css instead of trying to out-specificity it.
// DRILL_EMPTY_CLASSES (Phase 5, ShotMapView.css sub-PR 2) -- "drill-empty"
// here was a coincidental same-name marker with ZERO real CSS backing it:
// this file never imported ShotMapView.css (the only place `.drill-empty`
// was ever defined), so this empty-state has been rendering completely
// unstyled (no color/padding/centering) since before this migration
// touched anything. Found while migrating ShotMapView.css's own
// `.drill-empty` and fixed here too, since it's the same class name and
// the intended styling is now documented right here instead of a CSS file
// this component never actually depended on. Marker string kept for
// players.cy.js's `cy.skipIfEither('.drill-empty', ...)` skip-gate.
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

// ─── Main component ───────────────────────────────────────────

export default function PlayersView() {
  // SEASON used to be a module-level const derived from TEAM_CONFIG.season
  // once at import time -- frozen at whatever value existed then, never
  // picking up the Worker's live season resolution landing afterward.
  // useSport().currentSeason is reactive (see SportContext.jsx).
  const { currentSeason } = useSport()
  const SEASON = Number(currentSeason)
  const { data: roster,      loading: rosterLoading } = useFetch(() => getRoster(TEAM_CONFIG.abbr))
  const { data: poGames }   = useFetch(getPlayoffGames)
  const { data: standingsRaw } = useFetch(getStandings)
  // NHL's /standings/now stays pinned to last season's finale for months
  // after our season config flips — see nhlApi.js's _getTeamStats() for the
  // full story. Don't feed last season's team rank context into a player's
  // rankings display as if it were current. Only reject on an EXPLICIT
  // mismatch — an absent seasonId (e.g. a test stub) isn't evidence of
  // staleness, the real NHL API always includes it.
  const standingsAreStale = isStandingsStale(standingsRaw, TEAM_CONFIG.season)
  const standings = standingsAreStale ? [] : (standingsRaw || [])
  const [selected, setSelected] = useState(null)
  const [view, setView]         = useState('roster')
  const [gameType, setGameType] = useState(2)
  const inPlayoffs = (poGames?.length || 0) > 0

  const { data: skaterStats, loading: statsLoading } = useFetch(
    () => getTeamSkaterStatsFromDB(TEAM_CONFIG.abbr, SEASON, gameType),
    [gameType, SEASON]
  )

  return (
    <div className="page">
      <div className={HEADER_WRAP_CLASSES}>
        <h2 className={VIEW_TITLE_CLASSES}>
          <TeamLogo abbr={TEAM_CONFIG.abbr} size={22} />
          Roster
        </h2>
        <p className={PLAYERS_SUB_CLASSES}>Tap a player for detailed stats &amp; rankings</p>
      </div>

      {/* View toggle */}
      <div className={TABS_WRAP_CLASSES}>
        <button className={tabClasses(view === 'roster')} onClick={() => setView('roster')}>Roster</button>
        <button className={tabClasses(view === 'stats')} onClick={() => setView('stats')}>📊 Stats</button>
      </div>

      {view === 'stats' && (
        <>
          <div className={TABS_WRAP_CLASSES} style={{ marginTop: 8, marginBottom: 4 }}>
            <button className={tabClasses(gameType === 2)} onClick={() => setGameType(2)}>Regular Season</button>
            <button className={tabClasses(gameType === 3)} onClick={() => setGameType(3)}>🏆 Playoffs</button>
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
    <div className={ROSTER_SECTION_CLASSES}>
      <div className="sec-label">{title}</div>
      <div className={ROSTER_GRID_CLASSES}>
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
    <div className={CARD_BASE_CLASSES} onClick={onClick}>
      <div className={PC_PHOTO_WRAP_CLASSES}>
        {!imgErr && p.headshot ? (
          <img src={p.headshot} alt={name} className={PC_PHOTO_CLASSES} onError={() => setImgErr(true)} />
        ) : (
          <div className={PC_PHOTO_FALLBACK_CLASSES}>
            {(p.firstName?.default?.[0] || '') + (p.lastName?.default?.[0] || '')}
          </div>
        )}
        <span className={PC_NUM_CLASSES}>#{p.sweaterNumber}</span>
      </div>
      <div className={PC_INFO_CLASSES}>
        <span className={PC_FIRST_CLASSES}>{p.firstName?.default}</span>
        <span className={PC_LAST_CLASSES}>{p.lastName?.default}</span>
        <div className={PC_BADGES_CLASSES}>
          <span className={PC_POS_CLASSES}>{p.positionCode}</span>
          {p.shootsCatches && <span className={PC_SHOOTS_CLASSES}>{p.shootsCatches}</span>}
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
    <div className={ROSTER_GRID_CLASSES} style={{ marginTop: 8 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={SKELETON_CARD_CLASSES}>
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
    <div className={DRILL_EMPTY_CLASSES}>
      {gameType === 3
        ? `No playoff stats yet — data populates once ${TEAM_CONFIG.displayName} advances.`
        : 'No stats available.'}
    </div>
  );

  return (
    <div className={SST_WRAP_CLASSES}>
      <div className={SST_SCROLL_CLASSES}>
        <table className={SST_TABLE_CLASSES}>
          <thead>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  className={thClasses(col, sortKey)}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className={SST_SORT_ICON_CLASSES}>{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.playerId} className={SST_ROW_CLASSES}
                onClick={() => onSelect(p.playerId)}>
                {COLS.map(col => {
                  const val = p[col.key];
                  const pmColor = col.key === 'plusMinus'
                    ? val > 0 ? '#4ade80' : val < 0 ? '#f87171' : 'inherit'
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
      <div className={SST_HINT_CLASSES}>Tap a player row to open their profile · Sort by any column</div>
    </div>
  );
}
