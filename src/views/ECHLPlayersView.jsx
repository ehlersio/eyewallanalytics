// views/ECHLPlayersView.jsx
// Mirrors AHLPlayersView -- Roster tab (photo grid) + Stats tab
// (sortable table). Same real, deliberate scope cut as AHL's: skater
// columns drop shot_pct/gw_goals -- confirmed absent from ECHL's
// HockeyTech feed entirely (see echl_stats.py's fetch_skater_stats()).
//
// No ECHLPlayerPopup this pass -- roster cards and stat rows are NOT
// clickable, unlike AHLPlayersView (whose player-popup click-through was
// added in a later parity pass, not its own foundation build). Deferred
// to a later follow-up, matching AHL's own two-pass history.
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import { fetchECHLPlayers, ECHL_TEAM_CONFIG, ECHL_TEAM_ID } from '../utils/echlApi';
import { ECHL_CURRENT_SEASON, ECHL_SEASONS } from '../utils/echlConfig';
import TeamLogo from '../components/TeamLogo';
import { PAGE_CLASSES } from '../utils/pageClasses';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

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

const CARD_BASE_CLASSES = 'player-card card flex flex-col overflow-hidden'
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
const SST_TABLE_CLASSES = 'sst-table border-collapse w-full min-w-[560px] text-[12px]'
const SST_TH_BASE_CLASSES = 'py-2 px-[6px] text-[11px] font-bold border-b-[0.5px] border-[var(--border)] whitespace-nowrap relative select-none'
const SST_TD_BASE_CLASSES = 'sst-td py-2 px-[6px] border-b-[0.5px] border-[rgba(255,255,255,0.04)] whitespace-nowrap'
const STICKY_CLASSES = 'sticky left-0 z-[2] bg-[var(--bg2)] border-r-[0.5px] border-[var(--border)]'
const SST_SORT_ICON_CLASSES = 'text-[10px]'
const SST_ROW_CLASSES = 'sst-row [transition:background_0.1s] hover:bg-[var(--bg3)]'
const SST_HINT_CLASSES = 'text-[10px] text-[color:var(--text-dim)] text-center mt-[6px]'
const DRILL_EMPTY_CLASSES = 'text-[color:var(--text-dim)] text-[13px] py-[24px] px-[16px] text-center'

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
  const evenBg = isEvenRow && !col.sticky ? 'sst-td-even bg-[rgba(255,255,255,0.015)]' : ''
  return `${SST_TD_BASE_CLASSES} ${alignClasses(col.align)} ${colorFont} ${evenBg}`
}

// No shot_pct/gw_goals -- confirmed absent from ECHL's feed, same as AHL.
const ECHL_SKATER_COLS = [
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
  { key: 'shots',       label: 'SOG',    align: 'right',  sortable: true,                fmt: v => v ?? '—' },
];

const ECHL_GOALIE_COLS = [
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

export default function ECHLPlayersView() {
  const { t } = useTranslation();
  const team   = ECHL_TEAM_CONFIG;
  const teamId = ECHL_TEAM_ID;
  const abbr   = team?.abbr || '—';

  const [season,   setSeason]   = useState(ECHL_CURRENT_SEASON);
  const [view,     setView]     = useState('roster');
  const [statType, setStatType] = useState('skaters');

  // Same live-season-update race/fix as ECHLShotMapView.jsx.
  const userPickedSeason = useRef(false);
  useEffect(() => {
    function handleSeasonUpdate(e) {
      if (!userPickedSeason.current) setSeason(e.detail);
    }
    window.addEventListener('eyewall:echl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:echl-season-updated', handleSeasonUpdate);
  }, []);

  function handleSeasonPick(id) {
    userPickedSeason.current = true;
    setSeason(id);
  }

  const { data, loading } = useFetch(
    () => teamId ? fetchECHLPlayers(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  const roster  = useMemo(() => data?.roster  || [], [data]);
  const skaters = useMemo(() => data?.skaters || [], [data]);
  const goalies = useMemo(() => data?.goalies || [], [data]);

  const seasonLabel = ECHL_SEASONS.find(s => s.id === season)?.label || String(season);

  if (!abbr || !teamId) {
    return (
      <div className={PAGE_CLASSES}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>{t('echlPlayersView.noTeamSelected')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_CLASSES}>
      <div className={HEADER_WRAP_CLASSES}>
        <h2 className={VIEW_TITLE_CLASSES}>
          <TeamLogo abbr={abbr} sport="echl" size={22} />
          {t('players.roster')}
        </h2>
        <p className={PLAYERS_SUB_CLASSES}>{t('echlPlayersView.subtitle')}</p>
      </div>

      <div className={TABS_WRAP_CLASSES}>
        <button className={tabClasses(view === 'roster')} onClick={() => setView('roster')}>
          {t('players.roster')}
        </button>
        <button className={tabClasses(view === 'stats')} onClick={() => setView('stats')}>
          {t('players.statsToggle')}
        </button>
      </div>

      {view === 'roster' && (
        <>
          {loading && <RosterSkeleton />}
          {!loading && !data && (
            <div className="card" style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>
              {t('echlPlayersView.failedToLoadRoster')}
            </div>
          )}
          {!loading && data && roster.length === 0 && (
            <div className="card" style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>
              {t('echlPlayersView.noRosterData')}
            </div>
          )}
          {!loading && data && roster.length > 0 && (
            <>
              <RosterSection title={t('players.forwards')} players={roster.filter(p => ['C','LW','RW','F'].includes(p.position))} />
              <RosterSection title={t('echlPlayersView.defencemen')} players={roster.filter(p => ['D','LD','RD'].includes(p.position))} />
              <RosterSection title={t('players.goalies')} players={roster.filter(p => p.position === 'G')} />
            </>
          )}
        </>
      )}

      {view === 'stats' && (
        <>
          <div className={TABS_WRAP_CLASSES} style={{ marginTop: 0, marginBottom: 0 }}>
            {ECHL_SEASONS.map(s => (
              <button key={s.id} className={tabClasses(season === s.id)} onClick={() => handleSeasonPick(s.id)}>{s.label}</button>
            ))}
          </div>
          <div className={TABS_WRAP_CLASSES} style={{ marginTop: 4, marginBottom: 4 }}>
            <button className={tabClasses(statType === 'skaters')} onClick={() => setStatType('skaters')}>{t('echlPlayersView.skatersToggle')}</button>
            <button className={tabClasses(statType === 'goalies')} onClick={() => setStatType('goalies')}>{t('players.goalies')}</button>
          </div>

          {statType === 'skaters' && (
            <SortableTable rows={skaters} cols={ECHL_SKATER_COLS} defaultSort="points" loading={loading}
              emptyMsg={t('echlPlayersView.emptySkaterStats', { season: seasonLabel })} />
          )}
          {statType === 'goalies' && (
            <SortableTable rows={goalies} cols={ECHL_GOALIE_COLS} defaultSort="wins" loading={loading}
              emptyMsg={t('echlPlayersView.emptyGoalieStats', { season: seasonLabel })} />
          )}
        </>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '8px 0' }}>
        {t('echlPlayersView.footerHintSource')}
      </div>
    </div>
  );
}

function RosterSection({ title, players }) {
  if (!players.length) return null;
  const sorted = [...players].sort((a,b) => (a.jersey_number||99) - (b.jersey_number||99));
  return (
    <div className={ROSTER_SECTION_CLASSES}>
      <div className="sec-label">{title}</div>
      <div className={ROSTER_GRID_CLASSES}>
        {sorted.map(p => <PlayerCard key={p.player_id} player={p} />)}
      </div>
    </div>
  );
}

function PlayerCard({ player: p }) {
  const [imgErr, setImgErr] = useState(false);
  const headshot = p.headshot || `https://assets.leaguestat.com/echl/120x160/${p.player_id}.jpg`;
  const initials = (p.first_name?.[0] || '') + (p.last_name?.[0] || '');

  return (
    <div className={CARD_BASE_CLASSES}>
      <div className={PC_PHOTO_WRAP_CLASSES}>
        {!imgErr ? (
          <img src={headshot} alt={p.last_name} className={PC_PHOTO_CLASSES} onError={() => setImgErr(true)} />
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

function RosterSkeleton() {
  return (
    <div className={ROSTER_GRID_CLASSES} style={{ marginTop: 8 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={SKELETON_CARD_CLASSES}>
          <div className={SKELETON_CLASSES} style={{ width: '100%', aspectRatio: '1', borderRadius: 6, marginBottom: 8 }} />
          <div className={SKELETON_CLASSES} style={{ height: 10, width: '60%', marginBottom: 6 }} />
          <div className={SKELETON_CLASSES} style={{ height: 10, width: '40%' }} />
        </div>
      ))}
    </div>
  );
}

function SortableTable({ rows, cols, defaultSort, loading, emptyMsg }) {
  const { t } = useTranslation();
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
        <div key={i} className={SKELETON_CLASSES} style={{ height: 32, width: `${w}%`, borderRadius: 6 }} />
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
                <th key={col.key} className={thClasses(col, sortKey)} style={{ cursor: col.sortable ? 'pointer' : 'default' }} onClick={() => handleSort(col.key)}>
                  {col.key === 'player_name' ? (cols === ECHL_GOALIE_COLS ? t('echlPlayersView.colGoalie') : t('players.colPlayer')) : col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className={SST_SORT_ICON_CLASSES}>{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.player_id ?? i} className={SST_ROW_CLASSES}>
                {cols.map(col => {
                  const val = row[col.key];
                  const pmColor = col.key === 'plus_minus' ? (val > 0 ? '#4ade80' : val < 0 ? '#f87171' : 'inherit') : 'inherit';
                  return (
                    <td key={col.key} className={tdClasses(col, i % 2 === 0)} style={{ color: pmColor }}>
                      {col.fmt(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={SST_HINT_CLASSES}>{t('echlPlayersView.tableHint')}</div>
    </div>
  );
}
