// views/PWHLScheduleView.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PWHLCalendarView } from '../components/PWHLCalendarView';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLSchedule, fetchPWHLTeamRecord, PWHL_TEAM_CONFIG, PWHL_TEAM_ID } from '../utils/pwhlApi';
import { PWHL_CURRENT_SEASON, PWHL_TEAM_MAP } from '../utils/pwhlConfig';
import TeamLogo from '../components/TeamLogo';
import './ScheduleView.css';
import './ShotMapView.css';

// Season map: regular vs playoff
const SEASONS = [
  { id: 8, label: '2025-26', type: 'regular' },
  { id: 9, label: '2025-26 Playoffs', type: 'playoffs' },
  { id: 5, label: '2024-25', type: 'regular' },
  { id: 6, label: '2024-25 Playoffs', type: 'playoffs' },
  { id: 1, label: '2023-24', type: 'regular' },
  { id: 3, label: '2023-24 Playoffs', type: 'playoffs' },
];

const REGULAR_SEASONS  = SEASONS.filter(s => s.type === 'regular');
const PLAYOFF_SEASONS  = SEASONS.filter(s => s.type === 'playoffs');

const TEAM_CODES = { 1:'BOS',2:'MIN',3:'MTL',4:'NY',5:'OTT',6:'TOR',8:'SEA',9:'VAN' };
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _gameStr(g) {
  // Always return a string or null — never the game object itself
  if (typeof g === 'string') return g;
  return (g?.game_date || g?.date_with_day) ?? null;
}

function formatDate(g) {
  const str = _gameStr(g);
  if (!str) return '—';
  if (str.includes(',')) {
    // "Fri, Nov 21" → "Nov 21"
    return str.split(',').slice(1).join(',').trim();
  }
  const d = new Date(str + 'T12:00:00Z');
  if (isNaN(d)) return str;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function formatDateLong(g) {
  const str = _gameStr(g);
  if (!str) return '—';
  if (str.includes(',')) {
    return str.split(',').slice(1).join(',').trim();
  }
  const d = new Date(str + 'T12:00:00Z');
  if (isNaN(d)) return str;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function dayOfWeek(g) {
  const str = _gameStr(g);
  if (!str) return '';
  if (str.includes(',')) return str.split(',')[0].trim(); // "Fri"
  const d = new Date(str + 'T12:00:00Z');
  if (isNaN(d)) return '';
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
}

export default function PWHLScheduleView() {
  const team     = PWHL_TEAM_CONFIG;
  const teamId   = PWHL_TEAM_ID;
  const abbr     = team?.abbr || '—';
  const color    = team?.displayColor || 'var(--text-dim)';
  const navigate = useNavigate();

  const [tab,      setTab]      = useState('Regular Season');
  const [season,   setSeason]   = useState(PWHL_CURRENT_SEASON);
  const [poSeason, setPoSeason] = useState(9); // current playoffs season
  const [popup,    setPopup]    = useState(null);
  const [regSort,  setRegSort]  = useState('desc');
  const [viewMode, setViewMode] = useState('list');   // 'list' | 'calendar'
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pageRef = useRef(null);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  // Fetch regular + playoff schedule in parallel
  const { data: regSchedule, loading: regLoading } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, season)   : Promise.resolve(null), [teamId, season]);
  const { data: poSchedule,  loading: poLoading  } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, poSeason) : Promise.resolve(null), [teamId, poSeason]);
  // Fetch authoritative record from standings (has reg_wins/non_reg_wins/ot_losses breakdown)
  const { data: teamRecord } = useFetch(
    () => teamId ? fetchPWHLTeamRecord(teamId, season) : Promise.resolve(null), [teamId, season]);

  const { completed: regCompleted, upcoming: regUpcoming, record: regRecord } = useMemo(() => {
    return splitGames(regSchedule, teamId);
  }, [regSchedule, teamId]);

  const { completed: poCompleted, upcoming: poUpcoming, record: poRecord } = useMemo(() => {
    return splitGames(poSchedule, teamId);
  }, [poSchedule, teamId]);

  const sortedRegCompleted = useMemo(() =>
    [...regCompleted].sort((a,b) => regSort === 'desc' ? b.game_id - a.game_id : a.game_id - b.game_id),
    [regCompleted, regSort]);

  const seasonLabel = REGULAR_SEASONS.find(s => s.id === season)?.label || String(season);
  const poLabel     = PLAYOFF_SEASONS.find(s => s.id === poSeason)?.label || String(poSeason);

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
    <div className="page" ref={pageRef}>
      <div className="sched-header">
        <h2 className="sched-title">
          <TeamLogo abbr={abbr} sport="pwhl" size={22} color={color} />
          {seasonLabel} Schedule
        </h2>
        <div className="sched-record">
          {teamRecord ? (
            <>
              <strong>
                {teamRecord.reg_wins ?? teamRecord.wins ?? regRecord.w}–{teamRecord.non_reg_wins ?? regRecord.otw}–{teamRecord.ot_losses ?? regRecord.otl}–{teamRecord.losses ?? regRecord.l}
              </strong>
              <span className="pts-badge">{teamRecord.points ?? regRecord.pts} pts</span>
              <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:4 }}>W-OTW-OTL-L</span>
            </>
          ) : (
            <>
              <strong>{regRecord.w}–{regRecord.otw}–{regRecord.otl}–{regRecord.l}</strong>
              <span className="pts-badge">{regRecord.pts} pts</span>
              <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:4 }}>W-OTW-OTL-L</span>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="sched-tabs">
        {['Regular Season', 'Playoffs'].map(t => (
          <button key={t} className={`sched-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
            {t === 'Playoffs' && (poRecord.w + poRecord.otw) > 0 && (
              <span className="tab-badge">{poRecord.w + poRecord.otw}–{poRecord.otl + poRecord.l}</span>
            )}
          </button>
        ))}

        {/* List / Calendar toggle — matches NHL icons */}
        <div className="view-mode-toggle" style={{ marginLeft: 'auto' }}>
          <button className={`vm-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode('list')} title="Card view">≡</button>
          <button className={`vm-btn${viewMode === 'calendar' ? ' active' : ''}`}
            onClick={() => setViewMode('calendar')} title="Calendar view">📅</button>
        </div>
      </div>

      {/* ── Regular Season tab ── */}
      {tab === 'Regular Season' && (
        <>
          {/* Season picker */}
          <div className="sched-tabs" style={{ marginBottom: 4, marginTop: 0 }}>
            {REGULAR_SEASONS.map(s => (
              <button key={s.id} className={`sched-tab${season === s.id ? ' active' : ''}`}
                onClick={() => setSeason(s.id)}>{s.label}</button>
            ))}
          </div>

          {/* SortBar — counts + sort toggle, mirrors NHL */}
          {!regLoading && regSchedule?.length > 0 && viewMode === 'list' && (
            <PWHLSortBar
              sortOrder={regSort}
              setSortOrder={setRegSort}
              completedCount={regCompleted.length}
              upcomingCount={regUpcoming.length}
            />
          )}

          {regLoading && <LoadingCards count={5} />}

          {!regLoading && !regSchedule?.length && (
            <div className="card empty-state">
              <div className="empty-icon">📅</div>
              <div className="empty-title">No games found</div>
              <div className="empty-sub">No regular season data for {seasonLabel}.</div>
            </div>
          )}

          {!regLoading && regSchedule?.length > 0 && viewMode === 'list' && (
            <>
              {regUpcoming.map(g => (
                <UpcomingCard key={g.game_id} game={g} teamId={teamId} abbr={abbr} color={color} />
              ))}
              {sortedRegCompleted.map(g => (
                <CompletedCard key={g.game_id} game={g} teamId={teamId} abbr={abbr} color={color}
                  onClick={() => setPopup(g)} />
              ))}
            </>
          )}

          {!regLoading && regSchedule?.length > 0 && viewMode === 'calendar' && (
            <PWHLCalendarView
              games={regSchedule}
              calMonth={calMonth}
              setCalMonth={setCalMonth}
              onGamePopup={setPopup}
              teamId={teamId}
            />
          )}
        </>
      )}

      {/* ── Playoffs tab ── */}
      {tab === 'Playoffs' && (
        <>
          {/* Playoff season picker */}
          <div className="sched-tabs" style={{ marginBottom: 4, marginTop: 0 }}>
            {PLAYOFF_SEASONS.map(s => (
              <button key={s.id} className={`sched-tab${poSeason === s.id ? ' active' : ''}`}
                onClick={() => setPoSeason(s.id)}>{s.label}</button>
            ))}
          </div>

          {poLoading && <LoadingCards count={4} />}

          {!poLoading && !poSchedule?.length && (
            <div className="card empty-state">
              <div className="empty-icon">🏆</div>
              <div className="empty-title">No playoff games</div>
              <div className="empty-sub">{abbr} did not participate in the {poLabel}.</div>
            </div>
          )}

          {!poLoading && poSchedule?.length > 0 && (
            <PWHLPlayoffsTab
              games={poSchedule}
              teamId={teamId}
              abbr={abbr}
              color={color}
              onGamePopup={setPopup}
            />
          )}
        </>
      )}

      {/* Game detail popup */}
      {popup && (
        <PWHLGamePopup
          game={popup} teamId={teamId} abbr={abbr} color={color}
          onClose={() => setPopup(null)}
          onViewShotMap={() => {
            setPopup(null);
            navigate('/pwhl/shots', { state: { selectedGameId: popup.game_id } });
          }}
        />
      )}

      {showScrollTop && (
        <button className="scroll-top-btn" onClick={scrollToTop} aria-label="Back to top">
          ↑ Top
        </button>
      )}
    </div>
  );
}

// ── Shared helper ─────────────────────────────────────────────
function splitGames(schedule, teamId) {
  if (!schedule?.length) return { completed: [], upcoming: [], record: { w:0, otw:0, otl:0, l:0, pts:0 } };
  const completed = schedule.filter(g => g.game_state === 'Final');
  const upcoming  = schedule.filter(g => g.game_state !== 'Final');
  // PWHL uses 3-2-1-0 points system:
  //   Regulation win  = 3 pts
  //   OT/SO win       = 2 pts
  //   OT/SO loss      = 1 pt
  //   Regulation loss = 0 pts
  let w=0, otw=0, otl=0, l=0;
  for (const g of completed) {
    const isHome  = g.home_team_id === teamId;
    const my      = isHome ? g.home_score : g.away_score;
    const op      = isHome ? g.away_score : g.home_score;
    const isExtra = g.ot || g.shootout;
    if (my > op)  { isExtra ? otw++ : w++;  }
    else          { isExtra ? otl++ : l++;   }
  }
  const pts = w*3 + otw*2 + otl*1;
  return { completed, upcoming, record: { w, otw, otl, l, pts } };
}

// ── PWHL Playoffs Tab ────────────────────────────────────────
// Mirrors NHL PlayoffsTab: collapsible rounds, series card, game list.
// PWHL-specific: 2 rounds (Semifinal + Final), best-of-5 (first to 3 wins).
function PWHLPlayoffsTab({ games, teamId, abbr, color, onGamePopup }) {
  const [collapsed, setCollapsed] = React.useState({});
  const toggle = round => setCollapsed(p => ({ ...p, [round]: !p[round] }));

  // Build series by identifying unique team pairs
  // Each game has home_team_id / away_team_id — pair them as a canonical key
  const seriesMap = {};
  games.forEach(g => {
    const ids = [g.home_team_id, g.away_team_id].sort((a,b) => a - b);
    const key = ids.join('-');
    if (!seriesMap[key]) {
      seriesMap[key] = {
        key,
        teamA: ids[0], teamB: ids[1],
        games: [],
        winsA: 0, winsB: 0,
      };
    }
    seriesMap[key].games.push(g);
    if (g.game_state === 'Final') {
      const homeWon = g.home_score > g.away_score;
      const aIsHome = g.home_team_id === ids[0];
      if (homeWon === aIsHome) seriesMap[key].winsA++;
      else seriesMap[key].winsB++;
    }
  });

  // Sort series by earliest game date — later series = deeper round
  const allSeries = Object.values(seriesMap).sort((a,b) =>
    Math.min(...a.games.map(g=>g.game_id)) - Math.min(...b.games.map(g=>g.game_id))
  );

  // Since schedule only contains selected team's games, we see at most 2 series:
  // - If team was eliminated in semis: 1 series (Semi only)
  // - If team reached the Final: 2 series (Semi + Final, in chronological order)
  // Distinguish by overlap: if 2 series and the second starts after the first ends = Final.
  // Simpler: the LATER-starting series (higher min game_id) is always the Final.
  let semifinalSeries, finalSeries;
  if (allSeries.length <= 1) {
    // Only one series — could be Semi or Final; use game count/timing to guess
    // If season has a known final and this series starts late, treat as Final
    const firstGameId = allSeries[0] ? Math.min(...allSeries[0].games.map(g=>g.game_id)) : 0;
    // Heuristic: if we only have 1 series and the team won it decisively, may have been the Final
    // Default: treat single series as Semi unless we can confirm otherwise
    semifinalSeries = allSeries;
    finalSeries     = [];
  } else {
    // 2 series: first chronologically = Semi, second = Final
    semifinalSeries = [allSeries[0]];
    finalSeries     = [allSeries[1]];
  }

  const ROUNDS = [
    { label: 'Walter Cup Final', series: finalSeries,    round: 2 },
    { label: 'Semifinals',              series: semifinalSeries, round: 1 },
  ];

  const maxRound = finalSeries.length > 0 ? 2 : 1;

  return (
    <div>
      {ROUNDS.map(({ label, series, round }) => {
        if (!series.length) return null;
        const isCurrentRound = round === maxRound;
        const isCollapsed    = collapsed[round] ?? (round < maxRound);

        return (
          <div key={round} className="round-section">
            {/* Collapsible round header */}
            <button
              className={`round-section-header ${isCurrentRound ? 'current' : 'older'}`}
              onClick={() => toggle(round)}
              aria-expanded={!isCollapsed}
            >
              <div className="round-section-left">
                <span className="round-collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                <div className="round-header-info">
                  <span className="round-section-label">{label}</span>
                </div>
                {isCurrentRound && series.some(s => s.winsA < 3 && s.winsB < 3 && s.games.some(g => g.game_state === 'Final')) && (
                  <span className="round-live-pill">In progress</span>
                )}
              </div>
              <div className="round-section-right">
                {/* Show our team's record across series in this round */}
                {(() => {
                  const ourSeries = series.find(s => s.teamA === teamId || s.teamB === teamId);
                  if (!ourSeries) return null;
                  const ourWins = ourSeries.teamA === teamId ? ourSeries.winsA : ourSeries.winsB;
                  const oppWins = ourSeries.teamA === teamId ? ourSeries.winsB : ourSeries.winsA;
                  const adv = ourWins >= 3;
                  const elim = oppWins >= 3;
                  return (
                    <>
                      <span className="round-section-record">{ourWins}–{oppWins}</span>
                      {adv  && <span className="round-result-badge adv">✅</span>}
                      {elim && <span className="round-result-badge elim">❌</span>}
                    </>
                  );
                })()}
              </div>
            </button>

            {/* Expanded: series card + games */}
            {!isCollapsed && (
              <>
                {series.map(s => {
                  const isOurSeries = s.teamA === teamId || s.teamB === teamId;
                  const ourWins  = s.teamA === teamId ? s.winsA : s.winsB;
                  const oppWins  = s.teamA === teamId ? s.winsB : s.winsA;
                  const oppId    = s.teamA === teamId ? s.teamB : s.teamA;
                  const oppAbbr  = TEAM_CODES[oppId] || String(oppId);
                  const oppTeam  = PWHL_TEAM_MAP[oppAbbr];
                  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';

                  return (
                    <div key={s.key}>
                      {/* Series card — mirrors NHL SeriesCard with 3-win threshold */}
                      <PWHLSeriesCard
                        series={s}
                        teamId={teamId}
                        abbr={abbr}
                        color={color}
                        oppAbbr={oppAbbr}
                        oppColor={oppColor}
                        ourWins={ourWins}
                        oppWins={oppWins}
                        isFinal={round === 2}
                      />

                      {/* Game list */}
                      {[...s.games]
                        .sort((a,b) => a.game_id - b.game_id)
                        .map((g, gi) => {
                          const isHome   = g.home_team_id === teamId;
                          const my       = isHome ? g.home_score : g.away_score;
                          const op       = isHome ? g.away_score : g.home_score;
                          const gOppId   = isHome ? g.away_team_id : g.home_team_id;
                          const gOppAbbr = TEAM_CODES[gOppId] || String(gOppId);
                          const gOppTeam = PWHL_TEAM_MAP[gOppAbbr];
                          const gOppColor = gOppTeam?.displayColor || 'var(--text-dim)';
                          const won      = my > op;
                          const isExtra  = g.ot || g.shootout;
                          const suffix   = g.shootout ? '/SO' : g.ot ? '/OT' : '';
                          const done     = g.game_state === 'Final';

                          return (
                            <div key={g.game_id}
                              className={`result-card card${done ? ' clickable' : ''}`}
                              onClick={done ? () => onGamePopup(g) : undefined}
                            >
                              <div className="result-top">
                                <span className="result-date">
                                  Game {gi + 1} · {dayOfWeek(g)} {formatDate(g)}
                                </span>
                                {done && (
                                  <span className={`result-outcome ${won ? 'win' : 'loss'}`}>
                                    {won ? 'W' : (isExtra ? 'OT' : 'L')}{suffix}
                                  </span>
                                )}
                                {!done && <span className="context-pill regular" style={{fontSize:9}}>Upcoming</span>}
                                {done && <span className="result-tap-hint">Tap for stats →</span>}
                              </div>
                              <div className="result-score">
                                <TeamLogo abbr={abbr} sport="pwhl" size={20} color={color} />
                                <span className="result-abbr" style={{ color }}>{abbr}</span>
                                {done && <span className="result-num" style={{ color }}>{my}</span>}
                                <span className="result-sep">{done ? '–' : 'vs'}</span>
                                {done && <span className="result-num muted">{op}</span>}
                                <span className="result-abbr muted">{gOppAbbr}</span>
                                <TeamLogo abbr={gOppAbbr} sport="pwhl" size={20} color={gOppColor} />
                                <span className="result-venue">{isHome ? 'Home' : 'Away'}</span>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PWHL Series Card — best-of-5 (3 wins to advance) ─────────
function PWHLSeriesCard({ series, teamId, abbr, color, oppAbbr, oppColor, ourWins, oppWins, isFinal }) {
  const adv      = ourWins >= 3;
  const elim     = oppWins >= 3;
  const isActive = !adv && !elim && series.games.some(g => g.game_state === 'Final');
  const total    = series.games.length;

  return (
    <div className={`series-card card ${isActive ? 'series-active' : ''}`}>
      <div className="series-top">
        <div className="series-top-left">
          <span className="series-status">
            {isActive ? '🔴 In progress' : adv ? (isFinal ? '🏆 Walter Cup Champions' : '✅ Advanced') : elim ? '❌ Eliminated' : '🗓 Upcoming'}
          </span>
        </div>
        <span className="series-games-played">{total} game{total !== 1 ? 's' : ''} played</span>
        {ourWins === 3 && oppWins === 0 && <span className="series-sweep">🧹 Sweep!</span>}
        {oppWins === 3 && ourWins === 0 && <span className="series-swept">🧹 Swept</span>}
      </div>
      <div className="series-body">
        {/* Our team */}
        <div className="series-side">
          <div className="series-row">
            <TeamLogo abbr={abbr} sport="pwhl" size={30} color={color} />
            <span className="series-abbr" style={{ color }}>{abbr}</span>
            <span className="series-wins">{ourWins}</span>
          </div>
          <div className="series-pips">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={`pip ${i < ourWins ? 'pip-opp' : 'pip-empty'}`}
                style={{ '--opp-color': color }} />
            ))}
          </div>
        </div>
        <div className="series-centre">
          <span className="series-divider">–</span>
        </div>
        {/* Opponent */}
        <div className="series-side right">
          <div className="series-row right">
            <span className="series-wins">{oppWins}</span>
            <span className="series-abbr" style={{ color: oppColor }}>{oppAbbr}</span>
            <TeamLogo abbr={oppAbbr} sport="pwhl" size={30} color={oppColor} />
          </div>
          <div className="series-pips">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={`pip ${i < oppWins ? 'pip-opp' : 'pip-empty'}`}
                style={{ '--opp-color': oppColor }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SortBar — exact match of NHL GameCard SortBar ────────────
function PWHLSortBar({ sortOrder, setSortOrder, completedCount, upcomingCount }) {
  return (
    <div className="sort-bar">
      <span className="sort-bar-count">
        {completedCount} played{upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ''}
      </span>
      <div className="sort-bar-controls">
        <span className="sort-bar-label">Sort:</span>
        <button
          className={`sort-btn ${sortOrder === 'desc' ? 'active' : ''}`}
          onClick={() => setSortOrder('desc')}
          title="Newest first"
        >
          Newest first
        </button>
        <button
          className={`sort-btn ${sortOrder === 'asc' ? 'active' : ''}`}
          onClick={() => setSortOrder('asc')}
          title="Oldest first"
        >
          Oldest first
        </button>
      </div>
    </div>
  );
}

// ── Completed game card ───────────────────────────────────────
function CompletedCard({ game: g, teamId, abbr, color, onClick, isPlayoff }) {
  const isHome   = g.home_team_id === teamId;
  const my       = isHome ? g.home_score : g.away_score;
  const op       = isHome ? g.away_score : g.home_score;
  const oppId    = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr  = TEAM_CODES[oppId] || String(oppId);
  const oppTeam  = PWHL_TEAM_MAP[oppAbbr];
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';
  const won      = my > op;
  const isExtra  = g.ot || g.shootout;
  const suffix   = g.shootout ? '/SO' : g.ot ? '/OT' : '';
  // PWHL outcome labels: W (reg win), W/OT, L/OT, L (reg loss)
  const outcomeLabel = won ? 'W' : (isExtra ? 'OT' : 'L');

  return (
    <div className="result-card card clickable" onClick={onClick}>
      <div className="result-top">
        <span className="result-date">{dayOfWeek(g)} {formatDate(g)}</span>
        <span className={`result-outcome ${won ? 'win' : 'loss'}`}>
          {outcomeLabel}{suffix}
        </span>
        {isPlayoff && <span className="context-pill playoff" style={{ fontSize: 9 }}>Playoff</span>}
        <span className="result-tap-hint">Tap for stats →</span>
      </div>
      <div className="result-score">
        <TeamLogo abbr={abbr} sport="pwhl" size={20} color={color} />
        <span className="result-abbr" style={{ color }}>{abbr}</span>
        <span className="result-num" style={{ color }}>{my ?? '—'}</span>
        <span className="result-sep">–</span>
        <span className="result-num muted">{op ?? '—'}</span>
        <span className="result-abbr muted">{oppAbbr}</span>
        <TeamLogo abbr={oppAbbr} sport="pwhl" size={20} color={oppColor} />
        <span className="result-venue">{isHome ? 'Home' : 'Away'}</span>
      </div>
    </div>
  );
}

// ── Upcoming game card ────────────────────────────────────────
function UpcomingCard({ game: g, teamId, abbr, color, isPlayoff }) {
  const isHome   = g.home_team_id === teamId;
  const oppId    = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr  = TEAM_CODES[oppId] || String(oppId);
  const oppTeam  = PWHL_TEAM_MAP[oppAbbr];
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';

  return (
    <div className="card" style={{ marginBottom: 8, padding: '12px 14px' }}>
      <div className="result-top" style={{ marginBottom: 6 }}>
        <span className="result-date">{dayOfWeek(g)} {formatDate(g)}</span>
        <span className={`context-pill ${isPlayoff ? 'playoff' : 'regular'}`} style={{ fontSize: 10 }}>
          {isPlayoff ? '🏆 Playoff' : 'Upcoming'}
        </span>
        <span className="result-venue">{isHome ? 'Home' : 'Away'}</span>
      </div>
      <div className="result-score">
        <TeamLogo abbr={abbr} sport="pwhl" size={20} color={color} />
        <span className="result-abbr" style={{ color }}>{abbr}</span>
        <span className="result-sep" style={{ fontSize: 14, color: 'var(--text-dim)' }}>vs</span>
        <span className="result-abbr muted">{oppAbbr}</span>
        <TeamLogo abbr={oppAbbr} sport="pwhl" size={20} color={oppColor} />
      </div>
    </div>
  );
}

// ── Game detail popup ─────────────────────────────────────────
function PWHLGamePopup({ game: g, teamId, abbr, color, onClose, onViewShotMap }) {
  const isHome   = g.home_team_id === teamId;
  const my       = isHome ? g.home_score : g.away_score;
  const op       = isHome ? g.away_score : g.home_score;
  const oppId    = isHome ? g.away_team_id : g.home_team_id;
  const oppAbbr  = TEAM_CODES[oppId] || String(oppId);
  const oppTeam  = PWHL_TEAM_MAP[oppAbbr];
  const oppColor = oppTeam?.displayColor || 'var(--text-dim)';
  const won      = my > op;
  const suffix   = g.shootout ? ' (SO)' : g.ot ? ' (OT)' : '';

  return (
    <div className="shot-popup-backdrop" onClick={onClose}>
      <div className="shot-popup" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`popup-header ${won ? 'popup-goal popup-car' : 'popup-opp'}`}>
          <div className="popup-type-row">
            <span className="popup-type-icon">{won ? '✅' : '❌'}</span>
            <span className="popup-type-label">{won ? 'Win' : 'Loss'}{suffix}</span>
            <span className="popup-team-badge">{formatDate(g)}</span>
          </div>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>

        <div className="popup-body">
          {/* Score */}
          <div className="popup-section">
            <div className="popup-section-label">Final Score</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:24, padding:'14px 0' }}>
              <div style={{ textAlign:'center' }}>
                <TeamLogo abbr={abbr} sport="pwhl" size={36} color={color} />
                <div style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:700, color, marginTop:6 }}>{my}</div>
                <div style={{ fontSize:11, color, marginTop:2 }}>{abbr}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:4 }}>Final{suffix}</div>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>
                  {isHome ? 'Home' : 'Away'} · {formatDateLong(g.game_date)}
                </div>
              </div>
              <div style={{ textAlign:'center' }}>
                <TeamLogo abbr={oppAbbr} sport="pwhl" size={36} color={oppColor} />
                <div style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:700, color:oppColor, marginTop:6 }}>{op}</div>
                <div style={{ fontSize:11, color:oppColor, marginTop:2 }}>{oppAbbr}</div>
              </div>
            </div>
          </div>

          {/* Game info rows */}
          <div className="popup-section">
            <div className="popup-section-label">Game Info</div>
            <div className="popup-row">
              <span className="popup-field">Date</span>
              <span className="popup-value">{dayOfWeek(g)} · {formatDateLong(g)}</span>
            </div>
            <div className="popup-row">
              <span className="popup-field">Venue</span>
              <span className="popup-value">
                {g.venue_name || (isHome ? 'Home arena' : 'Away')}
                {g.venue_city ? ` · ${g.venue_city}` : ''}
              </span>
            </div>
            <div className="popup-row">
              <span className="popup-field">Location</span>
              <span className="popup-value">{isHome ? 'Home' : 'Away'}</span>
            </div>
            <div className="popup-row">
              <span className="popup-field">Outcome</span>
              <span className="popup-value" style={{ color: won ? 'var(--green)' : 'var(--red-bright)', fontWeight:700 }}>
                {won ? 'Win' : 'Loss'}{suffix}
              </span>
            </div>
          </div>

          {/* Shot map CTA */}
          <div style={{ padding:'12px 16px' }}>
            <button
              onClick={onViewShotMap}
              style={{
                width:'100%', padding:'10px 0',
                background: color, color:'#fff',
                border:'none', borderRadius:8,
                fontWeight:700, fontSize:14,
                cursor:'pointer', letterSpacing:'0.02em',
              }}
            >
              View Shot Map & Stats →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingCards({ count }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="card" style={{ marginBottom: 8, padding: 14 }}>
      <div className="skeleton" style={{ height: 10, width: '40%', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 10, width: '30%' }} />
    </div>
  ));
}
