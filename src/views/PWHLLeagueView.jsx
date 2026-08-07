// views/PWHLLeagueView.jsx
// Mirrors NHL LeagueView — Standings · Bracket · Leaders · Power Rankings
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFetch } from '../hooks/useFetch';
import {
  fetchPWHLStandings, fetchPWHLLeaguePlayers,
  PWHL_TEAM_CONFIG, PWHL_TEAM_ID,
} from '../utils/pwhlApi';
import {
  PWHL_CURRENT_SEASON, PWHL_TEAM_MAP, getPWHLTeamById,
  PWHL_REGULAR_SEASONS as SEASONS,
  PWHL_PLAYOFF_SEASON_MAP as PLAYOFF_SEASON,
} from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import PWHLPlayerPopup from '../components/PWHLPlayerPopup';
import './LeagueView.css';

// Tailwind migration (Session 97, Phase 3, sub-PR 1) -- only the small
// PlayersView.css-owned pieces this file actually uses (.players-tabs/.tab,
// .pp-close, .sst-hint, .sst-sort-icon); LeagueView.css's own .lv-* classes
// are untouched. .pp-close is kept as a literal marker -- league.cy.js,
// milestones.cy.js, player-search.cy.js, and pwhl-league.cy.js select on it
// directly.
const TABS_WRAP_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-14px] mb-[14px] px-[14px]'
const TAB_BASE_CLASSES = 'players-tab flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]'
const TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent'
const TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]'
function tabClasses(isActive) {
  return `${TAB_BASE_CLASSES} ${isActive ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`
}
const PP_CLOSE_CLASSES = 'pp-close absolute top-3 right-3 w-[28px] h-[28px] rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]'
const SST_SORT_ICON_CLASSES = 'text-[10px]'
const SST_HINT_CLASSES = 'text-[10px] text-[color:var(--text-dim)] text-center mt-[6px]'

function teamAbbr(teamId) {
  return getPWHLTeamById(teamId)?.abbr;
}

function teamColor(abbr) {
  return PWHL_TEAM_MAP[abbr]?.displayColor || 'var(--text-dim)';
}

// Hoisted to module scope (not defined inside BracketPanel) so React keeps a
// stable component identity across re-renders. Defining these inside
// BracketPanel's function body created a brand-new function reference every
// render, which React treats as a type change — forcing a full unmount/remount
// of every card instead of reconciling the existing DOM nodes. That's what was
// causing "series cards are clickable and show modal" to flake in Cypress
// (card detaches from the DOM mid-click) and could cause the same
// flicker/remount for real users on any re-render (e.g. closing the modal).
function WinDots({ wins, color }) {
  return (
    <span className="bkt-dots">
      {Array.from({length:3}).map((_,i) => (
        <span key={i} className="bkt-dot"
          style={i < wins && color ? {background:color, borderColor:color} : undefined} />
      ))}
    </span>
  );
}

function BktSeriesCard({ series, onClick, myTeamId, myColor }) {
  if (!series) return <div className="bkt-card bkt-card--empty" />;
  const abbrA   = teamAbbr(series.teamA) || '?';
  const abbrB   = teamAbbr(series.teamB) || '?';
  const colorA  = teamColor(abbrA);
  const colorB  = teamColor(abbrB);
  const doneA   = series.winsA >= 3;
  const doneB   = series.winsB >= 3;
  const hasGames = series.games.length > 0;
  const isPrimary = series.teamA === myTeamId || series.teamB === myTeamId;
  const label = doneA ? `${abbrA} wins 3–${series.winsB}`
    : doneB ? `${abbrB} wins 3–${series.winsA}`
    : series.winsA > series.winsB ? `${abbrA} leads ${series.winsA}–${series.winsB}`
    : series.winsB > series.winsA ? `${abbrB} leads ${series.winsB}–${series.winsA}`
    : `Tied ${series.winsA}–${series.winsB}`;

  return (
    <div className={`bkt-card${isPrimary ? ' bkt-card--primary' : ''}${hasGames ? ' bkt-card--clickable' : ''}`}
      style={isPrimary ? { borderColor: myColor } : undefined}
      onClick={hasGames && onClick ? onClick : undefined}
      role={hasGames ? 'button' : undefined}
      tabIndex={hasGames ? 0 : undefined}
      onKeyDown={hasGames && onClick ? (e => e.key==='Enter' && onClick()) : undefined}>
      <div className="bkt-team-row">
        <span className={`bkt-abbr${doneB && !doneA ? '' : ''}`} style={{ color: colorA }}>{abbrA}</span>
        <WinDots wins={series.winsA} color={colorA} />
      </div>
      <div className="bkt-team-row">
        <span className="bkt-abbr" style={{ color: colorB }}>{abbrB}</span>
        <WinDots wins={series.winsB} color={colorB} />
      </div>
      {series.games.length > 0 && <div className="bkt-series-label">{label}</div>}
    </div>
  );
}

const TABS = [
  { id: 'standings', label: 'Standings'       },
  { id: 'bracket',   label: 'Playoff Bracket' },
  { id: 'leaders',   label: 'Leaders'         },
  { id: 'rankings',  label: 'Power Rankings'  },
  { id: 'draft',     label: 'Draft'           },
];

export default function PWHLLeagueView() {
  const [activeTab, setActiveTab] = useState('standings');
  const [season,    setSeason]    = useState(PWHL_CURRENT_SEASON);
  const myTeamId = PWHL_TEAM_ID;
  const myAbbr   = PWHL_TEAM_CONFIG?.abbr;
  const myColor  = PWHL_TEAM_CONFIG?.displayColor || 'var(--team-primary)';
  const seasonLabel = SEASONS.find(s => s.id === season)?.label || String(season);
  const poSeasonId  = PLAYOFF_SEASON[season] || 9;

  // useState's initial value only runs once, at first mount -- if this
  // component mounts before pwhlConfig.js's async live-season fetch
  // resolves, `season` would otherwise lock onto the fallback value
  // forever, even though PWHL_CURRENT_SEASON itself goes on to update
  // correctly. Same fix as PWHLPlayersView.jsx: catch up via the event
  // pwhlConfig.js dispatches on resolution, but only if the user hasn't
  // manually picked a season themselves.
  const userPickedSeason = useRef(false);
  useEffect(() => {
    function handleSeasonUpdate(e) {
      if (!userPickedSeason.current) setSeason(e.detail);
    }
    window.addEventListener('eyewall:pwhl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:pwhl-season-updated', handleSeasonUpdate);
  }, []);

  const { data: standings, loading: standLoading } = useFetch(
    () => fetchPWHLStandings(season), [season]
  );
  const { data: leaguePlayers, loading: playersLoading } = useFetch(
    () => activeTab === 'leaders' ? fetchPWHLLeaguePlayers(season) : Promise.resolve(null),
    [activeTab, season]
  );

  function handleSeason(id) {
    userPickedSeason.current = true;
    setSeason(id);
  }

  return (
    <div className="league-view">
      {/* Season picker */}
      <div className={TABS_WRAP_CLASSES} style={{ marginBottom: 8 }}>
        {SEASONS.map(s => (
          <button key={s.id} className={tabClasses(season === s.id)}
            onClick={() => handleSeason(s.id)}>{s.label}</button>
        ))}
      </div>

      {/* Tab bar — mirrors NHL */}
      <nav className="league-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab"
            aria-selected={activeTab === t.id}
            className={`league-tab${activeTab === t.id ? ' league-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="league-content">
        {activeTab === 'standings' && (
          <StandingsPanel
            standings={standings || []}
            loading={standLoading}
            myTeamId={myTeamId}
            myColor={myColor}
          />
        )}
        {activeTab === 'bracket' && (
          <BracketPanel
            poSeasonId={poSeasonId}
            seasonLabel={seasonLabel}
            myTeamId={myTeamId}
            myColor={myColor}
          />
        )}
        {activeTab === 'leaders' && (
          <LeadersPanel
            skaters={leaguePlayers?.skaters || []}
            goalies={leaguePlayers?.goalies || []}
            loading={playersLoading}
            season={season}
            seasonLabel={seasonLabel}
          />
        )}
        {activeTab === 'rankings' && (
          <PowerRankingsPanel
            standings={standings || []}
            loading={standLoading}
            myTeamId={myTeamId}
            myAbbr={myAbbr}
            myColor={myColor}
          />
        )}
        {activeTab === 'draft' && (
          <DraftPanel season={season} />
        )}
      </div>
    </div>
  );
}

// ── L10 dots ──────────────────────────────────────────────────
function L10Dots({ w, otl, l }) {
  const results = [
    ...Array(w).fill('w'),
    ...Array(otl).fill('o'),
    ...Array(l).fill('l'),
  ].slice(0, 10);
  return (
    <span className="l10-dots">
      {results.map((r, i) => (
        <span key={i} className={`l10-dot l10-dot--${r}`} />
      ))}
    </span>
  );
}

// ── Standings ─────────────────────────────────────────────────
function StandingsPanel({ standings, loading, myTeamId, myColor }) {
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState('desc');

  const COLS = [
    { key: '#',            label: '#',    align: 'center', sortable: false, width: 18 },
    { key: 'team',         label: 'Team', align: 'left',   sortable: false, sticky: true },
    { key: 'gp',           label: 'GP',   align: 'right',  sortable: true },
    { key: 'reg_wins',     label: 'W',    align: 'right',  sortable: true },
    { key: 'non_reg_wins', label: 'OTW',  align: 'right',  sortable: true },
    { key: 'ot_losses',    label: 'OTL',  align: 'right',  sortable: true },
    { key: 'losses',       label: 'L',    align: 'right',  sortable: true },
    { key: 'points',       label: 'PTS',  align: 'right',  sortable: true, bold: true },
    { key: '_ptsPct',      label: 'Pt%',  align: 'right',  sortable: true },
    { key: 'goals_for',    label: 'GF',   align: 'right',  sortable: true },
    { key: 'goals_against',label: 'GA',   align: 'right',  sortable: true },
    { key: '_diff',        label: 'DIFF', align: 'right',  sortable: true },
    { key: '_l10',         label: 'L10',  align: 'center', sortable: false },
    { key: '_streak',      label: 'STRK', align: 'center', sortable: false },
  ];

  const enriched = useMemo(() => standings.map((r, i) => ({
    ...r,
    _rank:   i + 1,
    _diff:   (r.goals_for??0) - (r.goals_against??0),
    _ptsPct: r.gp ? ((r.points??0) / (r.gp * 3) * 100).toFixed(1) : '—',
  })), [standings]);

  const sorted = useMemo(() => [...enriched].sort((a,b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    if (typeof av === 'string') return sortDir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  }), [enriched, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  if (loading) return <LoadingRows />;
  if (!sorted.length) return <div className="lv-empty">No standings data.</div>;

  return (
    <div className="lv-div-card lv-div-card--wide">
      <div className="lv-div-card__header">PWHL League Standings · 3-2-1-0 pts system</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="lv-table" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              {COLS.map(col => (
                <th key={col.key}
                  className={`lv-th${col.key === 'team' ? ' lv-th--team' : ''}${sortKey === col.key ? ' sorted' : ''}`}
                  style={{ cursor: col.sortable ? 'pointer' : 'default', textAlign: col.align, width: col.width }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}>
                  {col.label}
                  {col.sortable && sortKey === col.key && <span className={SST_SORT_ICON_CLASSES}>{sortDir==='desc'?' ↓':' ↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const abbr   = teamAbbr(row.team_id) || '—';
              const color  = teamColor(abbr);
              const isMe   = row.team_id === myTeamId;
              const diff   = row._diff;
              return (
                <tr key={row.team_id}
                  className={`lv-row${isMe ? ' lv-row--you' : ''}`}
                  style={isMe ? { '--row-accent': myColor } : undefined}>
                  <td className="lv-td lv-td--rank">{i + 1}</td>
                  <td className="lv-td lv-td--team">
                    <span className="lv-team-cell">
                      <TeamLogo abbr={abbr} sport="pwhl" size={18} color={color} />
                      <span className="lv-team-abbrev" style={{ color }}>{abbr}</span>
                    </span>
                  </td>
                  <td className="lv-td">{row.gp ?? '—'}</td>
                  <td className="lv-td">{row.reg_wins ?? '—'}</td>
                  <td className="lv-td">{row.non_reg_wins ?? '—'}</td>
                  <td className="lv-td">{row.ot_losses ?? '—'}</td>
                  <td className="lv-td">{row.losses ?? '—'}</td>
                  <td className="lv-td lv-td--pts">{row.points ?? '—'}</td>
                  <td className="lv-td">{row._ptsPct !== '—' ? `${row._ptsPct}%` : '—'}</td>
                  <td className="lv-td">{row.goals_for ?? '—'}</td>
                  <td className="lv-td">{row.goals_against ?? '—'}</td>
                  <td className="lv-td" style={{ color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red-bright)' : 'inherit' }}>
                    {diff != null ? (diff > 0 ? `+${diff}` : diff) : '—'}
                  </td>
                  <td className="lv-td" style={{ textAlign: 'center' }}>
                    {row.l10W != null
                      ? <L10Dots w={row.l10W} otl={row.l10OTL || 0} l={row.l10L || 0} />
                      : '—'}
                  </td>
                  <td className="lv-td" style={{ textAlign: 'center' }}>
                    {row.streakType && row.streakCount
                      ? <span style={{ color: row.streakType==='W' ? 'var(--green)' : 'var(--red-bright)', fontWeight: 600 }}>
                          {row.streakType}{row.streakCount}
                        </span>
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={SST_HINT_CLASSES} style={{ padding: '6px 0 8px' }}>
        W–OTW–OTL–L · PTS = W×3 + OTW×2 + OTL×1 · Sort by any column · Source: HockeyTech / PWHL
      </div>
    </div>
  );
}

// ── Bracket ───────────────────────────────────────────────────
// Fetches all 8 teams' playoff schedules and builds the bracket
function BracketPanel({ poSeasonId, seasonLabel, myTeamId, myColor }) {
  const [allPoGames, setAllPoGames]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [selectedSeries, setSelected] = useState(null);
  const WORKER = import.meta.env.VITE_WORKER_URL || '';

  useEffect(() => {
    setLoading(true);
    const teamIds = [1,2,3,4,5,6,8,9];
    Promise.all(
      teamIds.map(tid =>
        fetch(`${WORKER}/pwhl/schedule?teamId=${tid}&season=${poSeasonId}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      )
    ).then(results => {
      // Deduplicate by game_id
      const gameMap = {};
      for (const games of results) {
        for (const g of (games || [])) {
          if (g.game_id) gameMap[g.game_id] = g;
        }
      }
      setAllPoGames(Object.values(gameMap));
      setLoading(false);
    });
  }, [poSeasonId]);

  if (loading) return <LoadingRows />;
  if (!allPoGames?.length) return (
    <div className="lv-empty">No playoff data for {seasonLabel}.</div>
  );

  // Build series from games
  const seriesMap = {};
  for (const g of allPoGames) {
    if (g.game_state !== 'Final') continue;
    const ids  = [g.home_team_id, g.away_team_id].sort((a,b)=>a-b);
    const key  = ids.join('-');
    if (!seriesMap[key]) seriesMap[key] = { key, teamA: ids[0], teamB: ids[1], games: [], winsA: 0, winsB: 0 };
    seriesMap[key].games.push(g);
    const homeWon = g.home_score > g.away_score;
    const aIsHome = g.home_team_id === ids[0];
    if (homeWon === aIsHome) seriesMap[key].winsA++;
    else seriesMap[key].winsB++;
  }

  const allSeries = Object.values(seriesMap)
    .sort((a,b) => Math.min(...a.games.map(g=>g.game_id)) - Math.min(...b.games.map(g=>g.game_id)));
  const semis  = allSeries.slice(0, 2);
  const finals = allSeries.slice(2);

  return (
    <div>
      <div className="bkt-root">
        <div className="bkt-bracket" style={{ minWidth: 380 }}>
          {/* Semifinals */}
          <div className="bkt-round-col">
            <div className="bkt-round-label">Semifinals</div>
            <div className="bkt-round-series">
              {semis.map((s,i) => (
                <div key={i} className="bkt-series-slot">
                  <BktSeriesCard series={s} onClick={() => setSelected(s)} myTeamId={myTeamId} myColor={myColor} />
                </div>
              ))}
              {semis.length === 0 && <div className="bkt-card bkt-card--empty" />}
            </div>
          </div>
          {/* Connector */}
          <svg className="bkt-connector" viewBox="0 0 20 200" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="50"  x2="10" y2="50"  stroke="var(--bkt-line)" strokeWidth="1" />
            <line x1="0" y1="150" x2="10" y2="150" stroke="var(--bkt-line)" strokeWidth="1" />
            <line x1="10" y1="50" x2="10" y2="150" stroke="var(--bkt-line)" strokeWidth="1" />
            <line x1="10" y1="100" x2="20" y2="100" stroke="var(--bkt-line)" strokeWidth="1" />
          </svg>
          {/* Walter Cup Final */}
          <div className="bkt-final-col">
            <div className="bkt-round-label">Walter Cup Final</div>
            <div className="bkt-final-center">
              {finals.length > 0
                ? finals.map((s,i) => <BktSeriesCard key={i} series={s} onClick={() => setSelected(s)} myTeamId={myTeamId} myColor={myColor} />)
                : <div className="bkt-card bkt-card--empty" style={{ minHeight: 80 }}>
                    <div style={{ fontSize:11, color:'var(--text-dim)', textAlign:'center', padding:12 }}>
                      Awaiting semi winners
                    </div>
                  </div>
              }
            </div>
          </div>
        </div>
      </div>
      <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:8 }}>
        Best-of-5 series · First to 3 wins advances
      </div>
      {selectedSeries && (
        <div className="popup-backdrop popup-backdrop--centered" onClick={() => setSelected(null)}>
          <div className="series-modal" onClick={e => e.stopPropagation()}>
            {(() => {
              const s = selectedSeries;
              const abbrA = teamAbbr(s.teamA) || '?';
              const abbrB = teamAbbr(s.teamB) || '?';
              const colorA = teamColor(abbrA);
              const colorB = teamColor(abbrB);
              const doneA = s.winsA >= 3, doneB = s.winsB >= 3;
              const winner = doneA ? abbrA : doneB ? abbrB : null;
              return (
                <>
                  <div className="series-modal__header">
                    <button className={PP_CLOSE_CLASSES} onClick={() => setSelected(null)}>✕</button>
                    <div className="series-modal__teams">
                      <span className="series-modal__abbrev" style={{ color: colorA }}>{abbrA}</span>
                      <div className="series-modal__dots-wrap">
                        <span className="series-modal__dash">{s.winsA}–{s.winsB}</span>
                      </div>
                      <span className="series-modal__abbrev" style={{ color: colorB }}>{abbrB}</span>
                    </div>
                    {winner && <div className="series-modal__result">{winner} wins the series 🏆</div>}
                  </div>
                  <div className="series-modal__games">
                    {[...s.games].sort((a,b)=>a.game_id-b.game_id).map((g, gi) => {
                              const homeAbbr = teamAbbr(g.home_team_id) || '?';
                      const awayAbbr = teamAbbr(g.away_team_id) || '?';
                      const homeColor = teamColor(homeAbbr);
                      const awayColor = teamColor(awayAbbr);
                      const homeWon = g.home_score > g.away_score;
                      const suffix = g.shootout ? '/SO' : g.ot ? '/OT' : '';
                      return (
                        <div key={g.game_id} className="series-modal__game-row">
                          <span className="series-modal__game-num">G{gi+1}</span>
                          <span className="series-modal__game-date">{g.game_date ? new Date(g.game_date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'}</span>
                          <div className="series-modal__team-score series-modal__team-score--home">
                            <span className="series-modal__team-abbrev" style={{ color: homeColor }}>{homeAbbr}</span>
                            <span className={`series-modal__score${homeWon?' series-modal__score--win':''}`}>{g.home_score}</span>
                          </div>
                          <span className="series-modal__separator">–</span>
                          <div className="series-modal__team-score">
                            <span className={`series-modal__score${!homeWon?' series-modal__score--win':''}`}>{g.away_score}</span>
                            <span className="series-modal__team-abbrev" style={{ color: awayColor }}>{awayAbbr}</span>
                          </div>
                          <span className="series-modal__extra">{suffix}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Leaders ───────────────────────────────────────────────────
function LeadersCard({ title, statLabel, rows, formatStat, onPlayerClick }) {
  return (
    <div className="lv-leaders-card">
      <div className="lv-leaders-card__header">
        <span>{title}</span>
        <span className="lv-leaders-card__stat-label">{statLabel}</span>
      </div>
      {rows.map((p, i) => {
        const abbr   = teamAbbr(p.team_id) || '—';
        const color  = teamColor(abbr);
        const name   = p.player_name || '—';
        return (
          <div key={p.player_id ?? i}
            className="lv-leaders-row lv-leaders-row--clickable"
            onClick={() => onPlayerClick?.(p)}
            role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onPlayerClick?.(p)}>
            <span className="lv-leaders-rank">{i + 1}</span>
            <span className="lv-leaders-name">{name}</span>
            <span className="lv-leaders-team" style={{ color }}>{abbr}</span>
            <span className="lv-leaders-stat">
              {formatStat ? formatStat(p) : (p.points ?? '—')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LeadersPanel({ skaters, goalies, loading, season, seasonLabel }) {
  const [selected, setSelected] = useState(null);

  const top10pts  = useMemo(() => [...skaters].filter(p=>p.player_name).sort((a,b)=>(b.points??0)-(a.points??0)).slice(0,10), [skaters]);
  const top10g    = useMemo(() => [...skaters].filter(p=>p.player_name).sort((a,b)=>(b.goals??0)-(a.goals??0)).slice(0,10),  [skaters]);
  const top10gaa  = useMemo(() => [...goalies].filter(g=>g.player_name&&(g.gp??0)>=5).sort((a,b)=>(a.gaa??99)-(b.gaa??99)).slice(0,10), [goalies]);
  const top10svp  = useMemo(() => [...goalies].filter(g=>g.player_name&&(g.gp??0)>=5).sort((a,b)=>(b.sv_pct??0)-(a.sv_pct??0)).slice(0,10), [goalies]);

  if (loading) return <LoadingRows />;
  if (!skaters.length && !goalies.length) return (
    <div className="lv-empty">No player data for {seasonLabel}.</div>
  );

  return (
    <>
      <div className="lv-leaders-grid">
        <LeadersCard title="Points" statLabel="PTS" rows={top10pts}
          formatStat={p => p.points ?? '—'} onPlayerClick={setSelected} />
        <LeadersCard title="Goals" statLabel="G" rows={top10g}
          formatStat={p => p.goals ?? '—'} onPlayerClick={setSelected} />
        <LeadersCard title="Goals Against Avg" statLabel="GAA" rows={top10gaa}
          formatStat={p => p.gaa != null ? Number(p.gaa).toFixed(2) : '—'} onPlayerClick={setSelected} />
        <LeadersCard title="Save Percentage" statLabel="SV%" rows={top10svp}
          formatStat={p => p.sv_pct != null ? Number(p.sv_pct).toFixed(3).replace('0.','.') : '—'} onPlayerClick={setSelected} />
      </div>
      {selected && (
        <PWHLPlayerPopup
          player={selected}
          seasonLabel={seasonLabel}
          season={season}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ── Power Rankings ────────────────────────────────────────────
function PowerRankingsPanel({ standings, loading, myTeamId, myAbbr: _myAbbr, myColor }) {
  const [showHow, setShowHow] = useState(false);

  // Weights — PWHL adapted (no xGF%, uses CF% instead; no roster WAR)
  const W = { pts: 0.35, l10: 0.20, gd: 0.20, cf: 0.15, sp: 0.10 };

  const ranked = useMemo(() => {
    if (!standings.length) return [];
    const teams = standings.map(r => {
      const abbr   = teamAbbr(r.team_id) || '—';
      const gp     = r.gp || 1;
      const ptsPct = r.gp ? (r.points ?? 0) / (r.gp * 3) : 0;
      const l10pts = r.l10W != null ? (r.l10W * 3 + (r.l10OTL||0)) / 30 : ptsPct;
      const gdPG   = ((r.goals_for??0) - (r.goals_against??0)) / gp;
      const cfPct  = r.corsi_for_pct != null ? Number(r.corsi_for_pct) / 100 : 0.5;
      const spScore = r.pp_pct != null && r.pk_pct != null
        ? (Number(r.pp_pct) + Number(r.pk_pct)) / 2 : 0.5;
      return { abbr, team_id: r.team_id, ptsPct, l10PtsPct: l10pts, gdPG, cfPct, spScore,
        wins: r.reg_wins ?? 0, otw: r.non_reg_wins ?? 0, otl: r.ot_losses ?? 0, losses: r.losses ?? 0,
        points: r.points ?? 0, gp, l10W: r.l10W, l10OTL: r.l10OTL, l10L: r.l10L,
        streakType: r.streakType, streakCount: r.streakCount,
        corsi_for_pct: r.corsi_for_pct, pp_pct: r.pp_pct, pk_pct: r.pk_pct,
      };
    });

    function norm(arr, key, best='max') {
      const vals = arr.map(t => t[key]).filter(v => v != null && isFinite(v));
      if (!vals.length) return () => 0.5;
      const mn = Math.min(...vals), mx = Math.max(...vals);
      if (mx === mn) return () => 0.5;
      return (v) => best === 'max' ? (v - mn)/(mx - mn) : (mx - v)/(mx - mn);
    }
    const nPts  = norm(teams, 'ptsPct');
    const nL10  = norm(teams, 'l10PtsPct');
    const nGD   = norm(teams, 'gdPG');
    const nCF   = norm(teams, 'cfPct');
    const nSP   = norm(teams, 'spScore');

    return teams.map(t => ({
      ...t,
      score: nPts(t.ptsPct)*W.pts + nL10(t.l10PtsPct)*W.l10 +
             nGD(t.gdPG)*W.gd + nCF(t.cfPct)*W.cf + nSP(t.spScore)*W.sp,
    })).sort((a,b)=>b.score-a.score).map((t,i)=>({...t, rank:i+1}));
  }, [standings]);

  if (loading) return <LoadingRows />;
  if (!ranked.length) return <div className="lv-empty">No standings data for rankings.</div>;


  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* How it's calculated */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <button className="pr-how-toggle" onClick={() => setShowHow(s=>!s)}>
          <span>How is this calculated?</span>
          <span className="pr-how-chevron">{showHow ? '▲' : '▼'}</span>
        </button>
        {showHow && (
          <div className="pr-how-body">
            <p className="pr-how-text">
              PWHL Power Rankings combine five factors into a composite score. Each metric is
              normalized 0–1 across all 8 teams, then weighted and summed.
            </p>
            {[
              ['Points%',          `${(W.pts*100).toFixed(0)}%`, 'Season points ÷ max possible (GP×3)'],
              ['L10 Points%',      `${(W.l10*100).toFixed(0)}%`, 'Last 10 games performance'],
              ['GD/GP',            `${(W.gd*100).toFixed(0)}%`,  'Goal differential per game'],
              ['CF% (Corsi)',      `${(W.cf*100).toFixed(0)}%`,  'Shot attempt share — proxy for possession'],
              ['Special Teams',   `${(W.sp*100).toFixed(0)}%`,  'Average of PP% and PK%'],
            ].map(([label, weight, source]) => (
              <div key={label} className="pr-how-item">
                <div className="pr-how-item-header">
                  <span className="pr-how-item-label">{label}</span>
                  <span className="pr-how-weight">{weight}</span>
                </div>
                <span className="pr-how-source">{source}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rankings table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'8px 12px 6px', borderBottom:'0.5px solid var(--border)', background:'var(--bg2)' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--text-dim)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
            Power Rankings
          </span>
        </div>
        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 64px 56px 56px 56px', gap:6,
          padding:'6px 12px', borderBottom:'0.5px solid var(--border)' }}>
          {['#','Team','Record','Pts%','GD/GP','CF%'].map(h => (
            <span key={h} style={{ fontSize:9, fontWeight:700, letterSpacing:'0.06em',
              textTransform:'uppercase', color:'var(--text-dim)',
              textAlign: h==='#'||h==='Team' ? 'left' : 'right' }}>{h}</span>
          ))}
        </div>
        {ranked.map(t => {
          const isMe = t.team_id === myTeamId;
          const color = teamColor(t.abbr);
          return (
            <div key={t.team_id} style={{
              display:'grid', gridTemplateColumns:'32px 1fr 64px 56px 56px 56px',
              gap:6, padding:'6px 12px', alignItems:'center',
              borderBottom:'0.5px solid rgba(255,255,255,0.03)',
              background: isMe ? `color-mix(in srgb, ${myColor} 8%, transparent)` : 'transparent',
              borderLeft: isMe ? `3px solid ${myColor}` : '3px solid transparent',
            }}>
              <span style={{ fontSize:12, fontWeight:700,
                color: t.rank<=2 ? 'var(--green)' : t.rank>=7 ? 'var(--red-bright)' : 'var(--text-muted)',
                textAlign:'center' }}>
                {t.rank}
              </span>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <TeamLogo abbr={t.abbr} sport="pwhl" size={18} color={color} />
                <span style={{ fontSize:13, fontWeight:700, color }}>{t.abbr}</span>
              </div>
              <span style={{ fontSize:11, color:'var(--text-muted)', textAlign:'right',
                fontVariantNumeric:'tabular-nums' }}>
                {t.wins}–{t.otw}–{t.otl}–{t.losses}
              </span>
              <span style={{ fontSize:11, color:'var(--text-muted)', textAlign:'right' }}>
                {(t.ptsPct*100).toFixed(1)}%
              </span>
              <span style={{ fontSize:11, textAlign:'right',
                color: t.gdPG>0 ? 'var(--green)' : t.gdPG<0 ? 'var(--red-bright)' : 'var(--text-muted)',
                fontVariantNumeric:'tabular-nums' }}>
                {t.gdPG > 0 ? '+' : ''}{t.gdPG.toFixed(2)}
              </span>
              <span style={{ fontSize:11, color:'var(--text-muted)', textAlign:'right' }}>
                {t.corsi_for_pct != null ? `${Number(t.corsi_for_pct).toFixed(1)}%` : '—'}
              </span>
            </div>
          );
        })}
        <div className={SST_HINT_CLASSES} style={{ padding:'6px 0 8px' }}>
          Composite of Pts%, L10, GD/GP, CF%, Special Teams · Updates with standings
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────
function LoadingRows() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
      {Array.from({length:8}).map((_,i) => (
        <div key={i} className="skeleton" style={{ height:34, borderRadius:6 }} />
      ))}
    </div>
  );
}

// ── Draft ─────────────────────────────────────────────────────
const DRAFT_2026 = [
  // Round 1
  { pick:1,  round:1, team:'Vancouver Goldeneyes',                 teamAbbr:'VAN', player:'Caroline "KK" Harvey', pos:'D', prev:'University of Wisconsin (NCAA)',        nat:'USA' },
  { pick:2,  round:1, team:'Seattle Torrent',                      teamAbbr:'SEA', player:'Abbey Murphy',          pos:'F', prev:'University of Minnesota (NCAA)',         nat:'USA' },
  { pick:3,  round:1, team:'PWHL Las Vegas (via DET)',             teamAbbr:'LAS', player:'Tessa Janecke',         pos:'F', prev:'Penn State University (NCAA)',           nat:'USA' },
  { pick:4,  round:1, team:'PWHL San Jose',                        teamAbbr:'SJS', player:'Laila Edwards',         pos:'D', prev:'University of Wisconsin (NCAA)',         nat:'USA' },
  { pick:5,  round:1, team:'PWHL Las Vegas',                       teamAbbr:'LAS', player:'Lacey Eden',            pos:'F', prev:'University of Wisconsin (NCAA)',         nat:'USA' },
  { pick:6,  round:1, team:'PWHL Hamilton',                        teamAbbr:'HAM', player:'Nelli Laitinen',        pos:'D', prev:'University of Minnesota (NCAA)',         nat:'FIN' },
  { pick:7,  round:1, team:'New York Sirens',                      teamAbbr:'NY',  player:'Emma Peschel',          pos:'D', prev:'Ohio State University (NCAA)',           nat:'USA' },
  { pick:8,  round:1, team:'Toronto Sceptres',                     teamAbbr:'TOR', player:'Kirsten Simms',         pos:'F', prev:'University of Wisconsin (NCAA)',         nat:'USA' },
  { pick:9,  round:1, team:'Minnesota Frost',                      teamAbbr:'MIN', player:'Sara Swiderski',        pos:'D', prev:'Ohio State University (NCAA)',           nat:'CAN' },
  { pick:10, round:1, team:'Boston Fleet',                         teamAbbr:'BOS', player:'Grace Dwyer',           pos:'D', prev:'Cornell University (NCAA)',              nat:'USA' },
  { pick:11, round:1, team:'Ottawa Charge',                        teamAbbr:'OTT', player:'Vivian Jungels',        pos:'D', prev:'University of Wisconsin (NCAA)',         nat:'USA' },
  { pick:12, round:1, team:'Montréal Victoire',                    teamAbbr:'MTL', player:'Petra Nieminen',        pos:'F', prev:'Luleå (SDHL)',                          nat:'FIN' },
  // Round 2
  { pick:13, round:2, team:'PWHL Las Vegas (via VAN)',             teamAbbr:'LAS', player:'Issy Wunder',           pos:'F', prev:'Princeton University (NCAA)',           nat:'CAN' },
  { pick:14, round:2, team:'Seattle Torrent',                      teamAbbr:'SEA', player:'Sydney Morrow',         pos:'D', prev:'University of Minnesota (NCAA)',         nat:'USA' },
  { pick:15, round:2, team:'PWHL Detroit',                         teamAbbr:'DET', player:'Andrea Brändli',        pos:'G', prev:'Frölunda HC (SDHL)',                    nat:'SUI' },
  { pick:16, round:2, team:'PWHL San Jose',                        teamAbbr:'SJS', player:'Sloane Matthews',       pos:'F', prev:'Ohio State University (NCAA)',           nat:'USA' },
  { pick:17, round:2, team:'Vancouver Goldeneyes (via LAS)',       teamAbbr:'VAN', player:'Thea Johansson',        pos:'F', prev:'Univ. of Minnesota Duluth (NCAA)',      nat:'SWE' },
  { pick:18, round:2, team:'PWHL Hamilton',                        teamAbbr:'HAM', player:'Jade Iginla',           pos:'F', prev:'Brown University (NCAA)',                nat:'CAN' },
  { pick:19, round:2, team:'New York Sirens',                      teamAbbr:'NY',  player:'Elisa Holopainen',      pos:'F', prev:'Frölunda HC (SDHL)',                    nat:'FIN' },
  { pick:20, round:2, team:'Toronto Sceptres',                     teamAbbr:'TOR', player:'Jamie Nelson',          pos:'F', prev:'University of Minnesota (NCAA)',         nat:'USA' },
  { pick:21, round:2, team:'Minnesota Frost',                      teamAbbr:'MIN', player:'Viivi Vainikka',        pos:'F', prev:'Brynäs (SDHL)',                         nat:'FIN' },
  { pick:22, round:2, team:'PWHL Detroit (via BOS)',               teamAbbr:'DET', player:'Casey Borgiel',         pos:'D', prev:'Colgate University (NCAA)',              nat:'USA' },
  { pick:23, round:2, team:'Ottawa Charge',                        teamAbbr:'OTT', player:'Jordan Ray',            pos:'F', prev:'Yale University (NCAA)',                 nat:'USA' },
  { pick:24, round:2, team:'Montréal Victoire',                    teamAbbr:'MTL', player:'Avi Adam',              pos:'F', prev:'Cornell University (NCAA)',              nat:'CAN' },
  // Round 3
  { pick:25, round:3, team:'Vancouver Goldeneyes',                 teamAbbr:'VAN', player:'Jules Constantinople',  pos:'D', prev:'Northeastern University (NCAA)',         nat:'USA' },
  { pick:26, round:3, team:'Seattle Torrent',                      teamAbbr:'SEA', player:'Emerson Jarvis',        pos:'F', prev:'Quinnipiac University (NCAA)',           nat:'CAN' },
  { pick:27, round:3, team:'Boston Fleet (via DET)',               teamAbbr:'BOS', player:'Leah Stecker',          pos:'D', prev:'Penn State University (NCAA)',           nat:'USA' },
  { pick:28, round:3, team:'PWHL San Jose',                        teamAbbr:'SJS', player:'Tia Chan',              pos:'G', prev:'University of Connecticut (NCAA)',       nat:'CAN' },
  { pick:29, round:3, team:'PWHL Las Vegas',                       teamAbbr:'LAS', player:'Josefin Bouveng',       pos:'F', prev:'University of Minnesota (NCAA)',         nat:'SWE' },
  // Round 3 cont.
  { pick:30, round:3, team:'PWHL Hamilton',                        teamAbbr:'HAM', player:'Elyssa Biederman',     pos:'F', prev:'Colgate University (NCAA)',              nat:'USA' },
  { pick:31, round:3, team:'New York Sirens',                      teamAbbr:'NY',  player:'Carina DiAntonio',     pos:'F', prev:'Yale University (NCAA)',                 nat:'CAN' },
  { pick:32, round:3, team:'Toronto Sceptres',                     teamAbbr:'TOR', player:'Brooke Disher',        pos:'D', prev:'Ohio State University (NCAA)',           nat:'CAN' },
  { pick:33, round:3, team:'Minnesota Frost',                      teamAbbr:'MIN', player:'Maddy Christian',      pos:'F', prev:'Penn State University (NCAA)',           nat:'USA' },
  { pick:34, round:3, team:'PWHL Detroit (via Boston)',            teamAbbr:'DET', player:"MK O'Brien",          pos:'F', prev:'Univ. of Minnesota Duluth (NCAA)',      nat:'USA' },
  { pick:35, round:3, team:'Ottawa Charge',                        teamAbbr:'OTT', player:'Tereza Pištěková',     pos:'F', prev:'SDE (SDHL)',                            nat:'CZE' },
  { pick:36, round:3, team:'Montréal Victoire',                    teamAbbr:'MTL', player:'Zoe Uens',             pos:'D', prev:'Quinnipiac University (NCAA)',           nat:'CAN' },
  // Round 4
  { pick:37, round:4, team:'Vancouver Goldeneyes',                 teamAbbr:'VAN', player:'Katelyn DeSa',         pos:'G', prev:'Penn State University (NCAA)',           nat:'USA' },
  { pick:38, round:4, team:'Seattle Torrent',                      teamAbbr:'SEA', player:'Grace Elliott',        pos:'F', prev:'Univ. of British Columbia (U Sports)',  nat:'CAN' },
  { pick:39, round:4, team:'PWHL Detroit',                         teamAbbr:'DET', player:'Kyla Josifovic',       pos:'F', prev:'University of Connecticut (NCAA)',       nat:'CAN' },
  { pick:40, round:4, team:'PWHL San Jose',                        teamAbbr:'SJS', player:'Lily Shannon',         pos:'F', prev:'Northeastern University (NCAA)',         nat:'USA' },
  { pick:41, round:4, team:'PWHL Las Vegas',                       teamAbbr:'LAS', player:'Saskia Maurer',        pos:'G', prev:'SC Bern (SWHL)',                        nat:'SUI' },
  { pick:42, round:4, team:'PWHL Hamilton',                        teamAbbr:'HAM', player:'Megan Woodworth',      pos:'F', prev:'University of Connecticut (NCAA)',       nat:'CAN' },
  { pick:43, round:4, team:'New York Sirens',                      teamAbbr:'NY',  player:'Katelyn Roberts',      pos:'F', prev:'Penn State University (NCAA)',           nat:'USA' },
  { pick:44, round:4, team:'Toronto Sceptres',                     teamAbbr:'TOR', player:'Jane Kuehl',           pos:'F', prev:'Princeton University (NCAA)',            nat:'USA' },
  { pick:45, round:4, team:'Minnesota Frost',                      teamAbbr:'MIN', player:'Tova Henderson',       pos:'D', prev:'Univ. of Minnesota Duluth (NCAA)',      nat:'CAN' },
  { pick:46, round:4, team:'Boston Fleet',                         teamAbbr:'BOS', player:'Jaden Bogden',         pos:'F', prev:'Northeastern University (NCAA)',         nat:'CAN' },
  { pick:47, round:4, team:'Ottawa Charge',                        teamAbbr:'OTT', player:'Tory Mariano',         pos:'D', prev:'Northeastern University (NCAA)',         nat:'USA' },
  { pick:48, round:4, team:'Montréal Victoire',                    teamAbbr:'MTL', player:'Hailey MacLeod',       pos:'G', prev:'Ohio State University (NCAA)',           nat:'CAN' },
  // Round 5
  { pick:49, round:5, team:'PWHL Las Vegas (via Vancouver)',       teamAbbr:'LAS', player:'Kendall Butze',        pos:'D', prev:'Penn State University (NCAA)',           nat:'USA' },
  { pick:50, round:5, team:'Seattle Torrent',                      teamAbbr:'SEA', player:'Gracie Gilkyson',      pos:'D', prev:'Yale University (NCAA)',                 nat:'CAN' },
  { pick:51, round:5, team:'PWHL Detroit',                         teamAbbr:'DET', player:'Sena Catterall',       pos:'F', prev:'Clarkson University (NCAA)',             nat:'CAN' },
  { pick:52, round:5, team:'PWHL San Jose',                        teamAbbr:'SJS', player:'McKenna Van Gelder',   pos:'F', prev:'Cornell University (NCAA)',              nat:'CAN' },
  { pick:53, round:5, team:'PWHL Las Vegas',                       teamAbbr:'LAS', player:'Alexis Petford',       pos:'F', prev:'Colgate University (NCAA)',              nat:'CAN' },
  { pick:54, round:5, team:'PWHL Hamilton',                        teamAbbr:'HAM', player:'Emma-Sofie Nordström', pos:'G', prev:'St. Lawrence University (NCAA)',         nat:'DEN' },
  { pick:55, round:5, team:'New York Sirens',                      teamAbbr:'NY',  player:'Grace Wolfe',          pos:'D', prev:'St. Cloud State University (NCAA)',      nat:'USA' },
  { pick:56, round:5, team:'Toronto Sceptres',                     teamAbbr:'TOR', player:"Emerson O'Leary",     pos:'F', prev:'Princeton University (NCAA)',            nat:'USA' },
  { pick:57, round:5, team:'Minnesota Frost',                      teamAbbr:'MIN', player:'Darya Gredzen',        pos:'G', prev:'Biryusa Krasnoyarsk (ZhHL)',             nat:'RUS' },
  { pick:58, round:5, team:'Boston Fleet',                         teamAbbr:'BOS', player:'Jenna Goodwin',        pos:'F', prev:'Frölunda HC (SDHL)',                    nat:'CAN' },
  { pick:59, round:5, team:'Ottawa Charge',                        teamAbbr:'OTT', player:'Neena Brick',          pos:'F', prev:'MoDo (SDHL)',                           nat:'CAN' },
  { pick:60, round:5, team:'Montréal Victoire',                    teamAbbr:'MTL', player:'Erica Rieder',         pos:'D', prev:'Luleå (SDHL)',                          nat:'CAN' },
  // Round 6
  { pick:61, round:6, team:'Vancouver Goldeneyes',                 teamAbbr:'VAN', player:'Ashley Messier',       pos:'D', prev:'Univ. of Minnesota Duluth (NCAA)',      nat:'CAN' },
  { pick:62, round:6, team:'Seattle Torrent',                      teamAbbr:'SEA', player:'Gabriella Durante',    pos:'G', prev:'Real Torino (Italy)',                   nat:'CAN' },
  { pick:63, round:6, team:'PWHL Detroit',                         teamAbbr:'DET', player:'Georgia Schiff',       pos:'F', prev:'Cornell University (NCAA)',              nat:'USA' },
  { pick:64, round:6, team:'PWHL San Jose',                        teamAbbr:'SJS', player:'Reichen Kirchmair',    pos:'F', prev:'Providence College (NCAA)',              nat:'CAN' },
  { pick:65, round:6, team:'PWHL Las Vegas',                       teamAbbr:'LAS', player:'Sydney Healey',        pos:'F', prev:'Boston University (NCAA)',               nat:'CAN' },
  { pick:66, round:6, team:'PWHL Hamilton',                        teamAbbr:'HAM', player:'Mya Vaslet',           pos:'F', prev:'Penn State University (NCAA)',           nat:'CAN' },
  { pick:67, round:6, team:'New York Sirens',                      teamAbbr:'NY',  player:'Naomi Boucher',        pos:'F', prev:'Yale University (NCAA)',                 nat:'CAN' },
  { pick:68, round:6, team:'Toronto Sceptres',                     teamAbbr:'TOR', player:'Alyssa Regalado',      pos:'D', prev:'Cornell University (NCAA)',              nat:'CAN' },
  { pick:69, round:6, team:'Minnesota Frost',                      teamAbbr:'MIN', player:'Lara Beecher',         pos:'F', prev:'Clarkson University (NCAA)',             nat:'USA' },
  { pick:70, round:6, team:'Boston Fleet',                         teamAbbr:'BOS', player:'Maeve Kelly',          pos:'D', prev:'Boston University (NCAA)',               nat:'USA' },
  { pick:71, round:6, team:'Ottawa Charge',                        teamAbbr:'OTT', player:'Taylor Otremba',       pos:'F', prev:'Minnesota State University (NCAA)',      nat:'USA' },
  { pick:72, round:6, team:'Montréal Victoire',                    teamAbbr:'MTL', player:'Emilie Lavoie',        pos:'F', prev:'Concordia University (U Sports)',        nat:'CAN' },
];

const DRAFT_2025 = [
  { pick:1,  round:1, team:'New York Sirens',            teamAbbr:'NY',  player:'Kristýna Kaltounková', pos:'F', prev:'Colgate University (NCAA)',                    nat:'CZE' },
  { pick:2,  round:1, team:'Boston Fleet',               teamAbbr:'BOS', player:'Haley Winn',           pos:'D', prev:'Clarkson University (NCAA)',                   nat:'USA' },
  { pick:3,  round:1, team:'New York Sirens (via TOR)',  teamAbbr:'NY',  player:'Casey O\'Brien',        pos:'F', prev:'University of Wisconsin (NCAA)',               nat:'USA' },
  { pick:4,  round:1, team:'Montréal Victoire',          teamAbbr:'MTL', player:'Nicole Gosling',        pos:'D', prev:'Clarkson University (NCAA)',                   nat:'CAN' },
  { pick:5,  round:1, team:'Ottawa Charge',              teamAbbr:'OTT', player:'Rory Guilday',          pos:'D', prev:'Cornell University (NCAA)',                    nat:'USA' },
  { pick:6,  round:1, team:'Minnesota Frost',            teamAbbr:'MIN', player:'Kendall Cooper',        pos:'D', prev:'Quinnipiac University (NCAA)',                 nat:'CAN' },
  { pick:7,  round:1, team:'PWHL Vancouver',             teamAbbr:'VAN', player:'Michelle Karvinen',     pos:'F', prev:'Frölunda HC (SDHL)',                           nat:'FIN' },
  { pick:8,  round:1, team:'PWHL Seattle',               teamAbbr:'SEA', player:'Jenna Buglioni',        pos:'F', prev:'Ohio State University (NCAA)',                 nat:'CAN' },
  { pick:9,  round:2, team:'New York Sirens',            teamAbbr:'NY',  player:'Anne Cherkowski',       pos:'F', prev:'Clarkson University (NCAA)',                   nat:'CAN' },
  { pick:10, round:2, team:'Boston Fleet',               teamAbbr:'BOS', player:'Ella Huber',            pos:'F', prev:'University of Minnesota (NCAA)',               nat:'USA' },
  { pick:11, round:2, team:'Toronto Sceptres',           teamAbbr:'TOR', player:'Emma Gentry',           pos:'F', prev:'St. Cloud State University (NCAA)',            nat:'USA' },
  { pick:12, round:2, team:'Montréal Victoire',          teamAbbr:'MTL', player:'Natalie Mlynkova',      pos:'F', prev:'University of Minnesota (NCAA)',               nat:'CZE' },
  { pick:13, round:2, team:'Ottawa Charge',              teamAbbr:'OTT', player:'Anna Shokhina',         pos:'F', prev:'Dynamo-Neva St. Petersburg (ZhHL)',            nat:'RUS' },
  { pick:14, round:2, team:'Minnesota Frost',            teamAbbr:'MIN', player:'Abby Hustler',          pos:'F', prev:'St. Lawrence University (NCAA)',               nat:'CAN' },
  { pick:15, round:2, team:'PWHL Seattle',               teamAbbr:'SEA', player:'Hannah Murphy',         pos:'G', prev:'Colgate University (NCAA)',                    nat:'CAN' },
  { pick:16, round:2, team:'Toronto Sceptres (via VAN)', teamAbbr:'TOR', player:'Kiara Zanon',           pos:'F', prev:'Ohio State University (NCAA)',                 nat:'USA' },
  { pick:17, round:3, team:'New York Sirens',            teamAbbr:'NY',  player:'Makenna Webster',       pos:'F', prev:'Ohio State University (NCAA)',                 nat:'USA' },
  { pick:18, round:3, team:'Boston Fleet',               teamAbbr:'BOS', player:'Olivia Mobley',         pos:'F', prev:'Univ. of Minnesota Duluth (NCAA)',             nat:'USA' },
  { pick:19, round:3, team:'PWHL Vancouver (via TOR)',   teamAbbr:'VAN', player:'Nina Jobst-Smith',      pos:'D', prev:'Univ. of Minnesota Duluth (NCAA)',             nat:'GER' },
  { pick:20, round:3, team:'Montréal Victoire',          teamAbbr:'MTL', player:'Skylar Irving',         pos:'F', prev:'Northeastern University (NCAA)',               nat:'USA' },
  { pick:21, round:3, team:'Ottawa Charge',              teamAbbr:'OTT', player:'Sarah Wozniewicz',      pos:'F', prev:'University of Wisconsin (NCAA)',               nat:'CAN' },
  { pick:22, round:3, team:'Minnesota Frost',            teamAbbr:'MIN', player:'Anna Segedi',           pos:'F', prev:'St. Lawrence University (NCAA)',               nat:'USA' },
  { pick:23, round:3, team:'Toronto Sceptres (via VAN)', teamAbbr:'TOR', player:'Clara Van Wieren',      pos:'F', prev:'Univ. of Minnesota Duluth (NCAA)',             nat:'USA' },
  { pick:24, round:3, team:'PWHL Seattle',               teamAbbr:'SEA', player:'Lily Delianedis',       pos:'F', prev:'Cornell University (NCAA)',                    nat:'USA' },
  { pick:25, round:4, team:'New York Sirens',            teamAbbr:'NY',  player:'Dayle Ross',            pos:'D', prev:'St. Cloud State University (NCAA)',            nat:'CAN' },
  { pick:26, round:4, team:'Boston Fleet',               teamAbbr:'BOS', player:'Riley Brengman',        pos:'D', prev:'Ohio State University (NCAA)',                 nat:'USA' },
  { pick:27, round:4, team:'New York Sirens (via TOR)',  teamAbbr:'NY',  player:'Maddi Wheeler',         pos:'F', prev:'Ohio State University (NCAA)',                 nat:'CAN' },
  { pick:28, round:4, team:'New York Sirens (via MTL)',  teamAbbr:'NY',  player:'Callie Shanahan',       pos:'G', prev:'Boston University (NCAA)',                     nat:'USA' },
  { pick:29, round:4, team:'Ottawa Charge',              teamAbbr:'OTT', player:'Peyton Hemp',           pos:'F', prev:'University of Minnesota (NCAA)',               nat:'USA' },
  { pick:30, round:4, team:'Minnesota Frost',            teamAbbr:'MIN', player:'Ava Rinker',            pos:'D', prev:'University of Connecticut (NCAA)',             nat:'USA' },
  { pick:31, round:4, team:'PWHL Seattle',               teamAbbr:'SEA', player:'Jada Habisch',          pos:'F', prev:'University of Connecticut (NCAA)',             nat:'USA' },
  { pick:32, round:4, team:'PWHL Vancouver',             teamAbbr:'VAN', player:'Brianna Brooks',        pos:'F', prev:'Penn State University (NCAA)',                 nat:'CAN' },
  { pick:33, round:5, team:'New York Sirens',            teamAbbr:'NY',  player:'Anna Bargman',          pos:'F', prev:'Yale University (NCAA)',                       nat:'USA' },
  { pick:34, round:5, team:'Boston Fleet',               teamAbbr:'BOS', player:'Abby Newhook',          pos:'F', prev:'Boston College (NCAA)',                        nat:'CAN' },
  { pick:35, round:5, team:'Toronto Sceptres',           teamAbbr:'TOR', player:'Sara Hjalmarsson',      pos:'F', prev:'Linköping HC (SDHL)',                         nat:'SWE' },
  { pick:36, round:5, team:'Montréal Victoire',          teamAbbr:'MTL', player:'Maya Labad',            pos:'F', prev:'Quinnipiac University (NCAA)',                 nat:'CAN' },
  { pick:37, round:5, team:'Ottawa Charge',              teamAbbr:'OTT', player:'Sanni Ahola',           pos:'G', prev:'St. Cloud State University (NCAA)',            nat:'FIN' },
  { pick:38, round:5, team:'Minnesota Frost',            teamAbbr:'MIN', player:'Vanessa Upson',         pos:'F', prev:'Mercyhurst University (NCAA)',                 nat:'CAN' },
  { pick:39, round:5, team:'PWHL Vancouver',             teamAbbr:'VAN', player:'Madison Samoskevich',   pos:'D', prev:'Quinnipiac University (NCAA)',                 nat:'USA' },
  { pick:40, round:5, team:'PWHL Seattle',               teamAbbr:'SEA', player:'Lyndie Lobdell',        pos:'D', prev:'Penn State University (NCAA)',                 nat:'USA' },
  { pick:41, round:6, team:'New York Sirens',            teamAbbr:'NY',  player:'Kaley Doyle',           pos:'G', prev:'Quinnipiac University (NCAA)',                 nat:'USA' },
  { pick:42, round:6, team:'Boston Fleet',               teamAbbr:'BOS', player:'Amanda Thiele',         pos:'G', prev:'Ohio State University (NCAA)',                 nat:'USA' },
  { pick:43, round:6, team:'Toronto Sceptres',           teamAbbr:'TOR', player:'Hanna Baskin',          pos:'D', prev:'Univ. of Minnesota Duluth (NCAA)',             nat:'USA' },
  { pick:44, round:6, team:'Montréal Victoire',          teamAbbr:'MTL', player:'Tamara Giaquinto',      pos:'D', prev:'Boston University (NCAA)',                     nat:'CAN' },
  { pick:45, round:6, team:'Ottawa Charge',              teamAbbr:'OTT', player:'Fanuza Kadirova',       pos:'F', prev:'Dynamo-Neva St. Petersburg (ZhHL)',            nat:'RUS' },
  { pick:46, round:6, team:'Minnesota Frost',            teamAbbr:'MIN', player:'Brooke Becker',         pos:'D', prev:'Providence College (NCAA)',                    nat:'USA' },
  { pick:47, round:6, team:'PWHL Seattle',               teamAbbr:'SEA', player:'Olivia Wallin',         pos:'F', prev:'Univ. of Minnesota Duluth (NCAA)',             nat:'CAN' },
  { pick:48, round:6, team:'PWHL Vancouver',             teamAbbr:'VAN', player:'Chanreet Bassi',        pos:'F', prev:'Univ. of British Columbia (U Sports)',         nat:'CAN' },
];

const PWHL_ABBR_COLOR = {
  BOS:'#00285E',MIN:'#154734',MTL:'#862633',NY:'#003D7C',
  OTT:'#C8102E',TOR:'#00205B',SEA:'#005C8A',VAN:'#C8A951',
  LAS:'#B8960C',DET:'#CF0A2C',SJS:'#006D75',HAM:'#5C2D91',
};

function DraftPanel({ season }) {
  const [draftYear, setDraftYear] = useState(season === 8 ? 2026 : 2025);
  const [filter, setFilter]       = useState('all');
  const [roundFilter, setRound]   = useState(0); // 0 = all rounds

  const picks = draftYear === 2026 ? DRAFT_2026 : DRAFT_2025;

  const filtered = useMemo(() => picks.filter(p => {
    const posOk  = filter === 'all' || p.pos === filter;
    const rndOk  = roundFilter === 0 || p.round === roundFilter;
    return posOk && rndOk;
  }), [picks, filter, roundFilter]);

  const rounds = [...new Set(picks.map(p => p.round))].sort((a,b)=>a-b);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* Draft year picker */}
      <div className={TABS_WRAP_CLASSES} style={{ marginBottom:0 }}>
        {[2026, 2025].map(y => (
          <button key={y} className={tabClasses(draftYear === y)}
            onClick={() => setDraftYear(y)}>{y} Draft</button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div className="lv-filter-row" style={{ margin:0, gap:6 }}>
          {[['all','All'],['F','Forwards'],['D','Defence'],['G','Goalies']].map(([k,l]) => (
            <button key={k} className={`lv-filter-btn${filter===k?' lv-filter-btn--active':''}`}
              onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <div className="lv-filter-row" style={{ margin:0, gap:6 }}>
          <button className={`lv-filter-btn${roundFilter===0?' lv-filter-btn--active':''}`}
            onClick={() => setRound(0)}>All Rounds</button>
          {rounds.map(r => (
            <button key={r} className={`lv-filter-btn${roundFilter===r?' lv-filter-btn--active':''}`}
              onClick={() => setRound(r)}>Rd {r}</button>
          ))}
        </div>
      </div>

      {/* Picks table */}
      <div className="lv-div-card lv-div-card--wide">
        <div className="lv-div-card__header">
          {draftYear} PWHL Draft · {filtered.length} pick{filtered.length!==1?'s':''}
        </div>
        <div style={{ overflowX:'auto' }}>
          <table className="lv-table" style={{ minWidth:340 }}>
            <thead>
              <tr>
                {['Pick','Rd','Team','Player','Pos','Previous Team','Nat'].map(h => (
                  <th key={h} className={`lv-th${h==='Player'||h==='Previous Team'?' lv-th--team':''}`}
                    style={{ textAlign: h==='Pick'||h==='Rd'||h==='Team'||h==='Pos'||h==='Nat' ? 'center' : 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const color = PWHL_ABBR_COLOR[p.teamAbbr] || 'var(--text-dim)';
                return (
                  <tr key={p.pick} className={`lv-row${i%2===0?' even':''}`}>
                    <td className="lv-td" style={{ textAlign:'center', fontWeight:700, color:'var(--text-muted)' }}>{p.pick}</td>
                    <td className="lv-td" style={{ textAlign:'center', color:'var(--text-dim)' }}>{p.round}</td>
                    <td className="lv-td" style={{ textAlign:'center' }}>
                      <span style={{ color, fontWeight:700, fontFamily:'var(--font-display)', fontSize:12 }}>{p.teamAbbr}</span>
                    </td>
                    <td className="lv-td draft-td--player" style={{ fontWeight:600, color:'var(--text)' }}>{p.player}</td>
                    <td className="lv-td" style={{ textAlign:'center' }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:'1px 4px', borderRadius:3,
                        background: p.pos==='F'?'rgba(74,222,128,0.1)':p.pos==='D'?'rgba(96,165,250,0.1)':'rgba(251,191,36,0.1)',
                        color: p.pos==='F'?'var(--green)':p.pos==='D'?'var(--blue-bright)':'var(--amber)' }}>
                        {p.pos}
                      </span>
                    </td>
                    <td className="lv-td draft-td--prev" style={{ fontSize:11, color:'var(--text-dim)' }}>
                      {(() => {
                        const m = p.prev.match(/^(.+?)\s*\(([^)]+)\)$/);
                        const school = m ? m[1] : p.prev;
                        const league = m ? m[2] : null;
                        return (
                          <>
                            <span className="draft-prev-school">{school}</span>
                            {league && (
                              <span className="draft-prev-badge">{league}</span>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="lv-td" style={{ textAlign:'center', fontSize:11, color:'var(--text-dim)' }}>{p.nat}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
