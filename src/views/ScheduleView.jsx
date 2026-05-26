import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFetch } from '../hooks/useFetch';
import { savePrediction, getPredictionStats, recordOutcome } from '../utils/predictionStore';
import ScoutingTab from '../components/ScoutingTab';
import InfoTip from '../components/InfoTip';
import { computeShotAttempts, computePDO, computePuckLuck, computeGSAx } from '../utils/advancedStats';
import {
  getRegularSeasonGames, getPlayoffGames, getStandings,
  buildCarPlayoffSummary, getCompletedGameStats,
  formatGameDate, formatGameTime,
  getOpponent, isHomeGame, getCarScore, getOppScore,
  TEAM_COLORS,
} from '../utils/nhlApi';
import { StatBar } from '../components/StatBar';
import {
  getNhlOdds, findGameOdds, extractMoneyline, oddsToImplied, fmtOdds,
} from '../utils/nhlApi';
import TeamLogo from '../components/TeamLogo';
import './ScheduleView.css';

const TABS = ['Playoffs', 'Regular Season'];
const CAR_ABBR = 'CAR';

export default function ScheduleView() {
  const [tab, setTab]                   = useState('Playoffs');
  const [selectedGame, setSelectedGame] = useState(null);
  const [popupGame, setPopupGame]       = useState(null);
  const [poSort, setPoSort]             = useState('desc');
  const [regSort, setRegSort]           = useState('desc');
  const [viewMode, setViewMode]          = useState('cards'); // 'cards' | 'calendar'
  const [calMonth, setCalMonth]          = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pageRef = useRef(null);

  // Show scroll-to-top button when user scrolls down
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const { data: playoffGames, loading: poLoading  } = useFetch(getPlayoffGames);
  const { data: regGames,     loading: regLoading } = useFetch(getRegularSeasonGames);
  const { data: standings }                          = useFetch(getStandings);
  const { data: oddsData }                           = useFetch(getNhlOdds);

  const standingMap = {};
  if (standings) standings.forEach(t => {
    // Key by the abbreviation — handle both { default: "CAR" } and plain "CAR"
    const abbr = t.teamAbbrev?.default || t.teamAbbrev;
    if (abbr) {
      standingMap[abbr] = t;
      standingMap[abbr.toLowerCase()] = t; // also store lowercase for safe lookup
    }
  });

  const carStanding    = standingMap[CAR_ABBR];

  // Auto-record prediction outcomes for any completed games
  useEffect(() => {
    const allGames = [...(regGames || []), ...(playoffGames || [])];
    const completed = allGames.filter(g =>
      ['OFF','FINAL','F','FINAL_OVERTIME','FINAL_SHOOTOUT'].includes(g.gameState)
    );
    completed.forEach(g => {
      const isHome    = g.homeTeam?.abbrev === CAR_ABBR;
      const carActual = isHome ? g.homeTeam?.score : g.awayTeam?.score;
      const oppActual = isHome ? g.awayTeam?.score : g.homeTeam?.score;
      if (carActual != null && oppActual != null && g.id) {
        recordOutcome(g.id, carActual, oppActual);
      }
    });
  }, [regGames, playoffGames]);
  const playoffSeries  = buildCarPlayoffSummary(playoffGames || []);
  const poRecord       = playoffSeries.reduce((a, s) => ({
    w: a.w + s.carWins, l: a.l + s.oppWins
  }), { w: 0, l: 0 });

  return (
    <div className="page" ref={pageRef}>
      <div className="sched-header">
        <h2 className="sched-title">2025–26 Schedule</h2>
        {carStanding && (
          <div className="sched-record">
            Regular season: <strong>{carStanding.wins}–{carStanding.losses}–{carStanding.otLosses}</strong>
            <span className="pts-badge">{carStanding.points} pts</span>
            <span className="div-badge">{carStanding.divisionName}</span>
          </div>
        )}
      </div>

      <div className="sched-tabs">
        {TABS.map(t => (
          <button key={t} className={`sched-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
            {t === 'Playoffs' && poRecord.w > 0 && (
              <span className="tab-badge">{poRecord.w}–{poRecord.l}</span>
            )}
          </button>
        ))}

        {/* View mode toggle — sits on the right end of the same tab row */}
        <div className="view-mode-toggle">
          <button className={`vm-btn ${viewMode === 'cards' ? 'active' : ''}`} onClick={() => setViewMode('cards')} title="Card view">≡</button>
          <button className={`vm-btn ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => setViewMode('calendar')} title="Calendar view">📅</button>
        </div>
      </div>

      {/* Calendar view — shows all games for a month across both reg + playoff */}
      {viewMode === 'calendar' && (
        <CalendarView
          games={[...(regGames || []), ...(playoffGames || [])]}
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          onGamePopup={setPopupGame}
        />
      )}

      {viewMode === 'cards' && tab === 'Playoffs' && (
        <PlayoffsTab
          loading={poLoading}
          playoffGames={playoffGames || []}
          playoffSeries={playoffSeries}
          standingMap={standingMap}
          carStanding={carStanding}
          selectedGame={selectedGame}
          setSelectedGame={setSelectedGame}
          onGamePopup={setPopupGame}
          oddsData={oddsData}
        />
      )}

      {viewMode === 'cards' && tab === 'Regular Season' && (
        <RegularSeasonTab
          games={regGames || []}
          loading={regLoading}
          standingMap={standingMap}
          carStanding={carStanding}
          selectedGame={selectedGame}
          setSelectedGame={setSelectedGame}
          onGamePopup={setPopupGame}
          sortOrder={regSort}
          setSortOrder={setRegSort}
        />
      )}

      {popupGame && (
        <GameStatsPopup game={popupGame} onClose={() => setPopupGame(null)} />
      )}

      {showScrollTop && (
        <button className="scroll-top-btn" onClick={scrollToTop} aria-label="Back to top">
          ↑ Top
        </button>
      )}
    </div>
  );
}

// ── Calendar view ────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function CalendarView({ games, calMonth, setCalMonth, onGamePopup }) {
  const { year, month } = calMonth;

  // Build a map: "YYYY-MM-DD" -> game object
  const gameByDate = {};
  games.forEach(g => {
    if (g.gameDate) gameByDate[g.gameDate] = g;
  });

  // Calendar grid: first day of month, pad with nulls
  const firstDay  = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMo  = new Date(year, month + 1, 0).getDate();
  const today     = new Date();
  const todayStr  = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  function prevMonth() {
    setCalMonth(({ year: y, month: m }) =>
      m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 }
    );
  }
  function nextMonth() {
    setCalMonth(({ year: y, month: m }) =>
      m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 }
    );
  }

  // Build cells: nulls for padding, then 1..daysInMo
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="calendar-wrap">
      {/* Month navigation */}
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cal-month-label">{MONTHS[month]} {year}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="cal-grid">
        {DOW.map(d => (
          <div key={d} className="cal-dow">{d}</div>
        ))}

        {/* Day cells */}
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className="cal-cell empty" />;

          const mm      = String(month + 1).padStart(2, '0');
          const dd      = String(day).padStart(2, '0');
          const dateStr = `${year}-${mm}-${dd}`;
          const game    = gameByDate[dateStr];
          const isToday = dateStr === todayStr;

          return (
            <CalCell
              key={dateStr}
              day={day}
              dateStr={dateStr}
              game={game}
              isToday={isToday}
              onGamePopup={onGamePopup}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <span className="cal-leg-item"><span className="cal-leg-dot win" />Win</span>
        <span className="cal-leg-item"><span className="cal-leg-dot otl" />OT Loss</span>
        <span className="cal-leg-item"><span className="cal-leg-dot loss" />Loss</span>
        <span className="cal-leg-item"><span className="cal-leg-dot upcoming" />Upcoming</span>
        <span className="cal-leg-item"><span className="cal-leg-home">●</span>Home</span>
        <span className="cal-leg-item"><span className="cal-leg-home">○</span>Away</span>
      </div>
    </div>
  );
}

function CalCell({ day, dateStr, game, isToday, onGamePopup }) {
  if (!game) {
    return (
      <div className={`cal-cell no-game ${isToday ? 'today' : ''}`}>
        <span className="cal-day-num">{day}</span>
      </div>
    );
  }

  const isCompleted = ['OFF','FINAL','F'].includes(game.gameState);
  const opp         = getOpponent(game);
  const oppAbbr     = opp?.abbrev || '???';
  const oppColor    = TEAM_COLORS[oppAbbr] || 'var(--text-muted)';
  const home        = isHomeGame(game);
  const carScore    = getCarScore(game);
  const oppScore    = getOppScore(game);
  const isPlayoff   = game.gameType === 3;

  // Result classification
  let result = null;
  if (isCompleted && carScore != null && oppScore != null) {
    if (carScore > oppScore)       result = 'win';
    else if (game.gameState === 'OT' ||
             (carScore < oppScore && game.periodDescriptor?.number > 3))
                                   result = 'otl';
    else                           result = 'loss';
  }

  const cellClass = [
    'cal-cell',
    'has-game',
    result || 'upcoming',
    isToday ? 'today' : '',
    isPlayoff ? 'playoff-cell' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cellClass}
      onClick={() => isCompleted ? onGamePopup(game) : null}
      style={{ cursor: isCompleted ? 'pointer' : 'default' }}
    >
      <div className="cal-cell-top">
        <span className="cal-day-num">{day}</span>
        <span className="cal-home-dot" title={home ? 'Home' : 'Away'}>
          {home ? '●' : '○'}
        </span>
      </div>

      <div className="cal-cell-body">
        <TeamLogo abbr={oppAbbr} size={20} color={oppColor} />
        <span className="cal-opp-abbr">{oppAbbr}</span>
      </div>

      {isCompleted && carScore != null ? (
        <div className="cal-score">
          <span className={result === 'win' ? 'cal-score-w' : 'cal-score-l'}>
            {result === 'win' ? 'W' : result === 'otl' ? 'OTL' : 'L'}
          </span>
          <span className="cal-score-nums">{carScore}–{oppScore}</span>
        </div>
      ) : (
        <div className="cal-time">{formatGameTime(game.startTimeUTC)}</div>
      )}

      {isPlayoff && <span className="cal-playoff-badge">PO</span>}
    </div>
  );
}

// ── Playoffs tab ─────────────────────────────────────────────

function PlayoffsTab({ loading, playoffGames, playoffSeries, standingMap, carStanding, selectedGame, setSelectedGame, onGamePopup, oddsData }) {
  if (loading) return <LoadingCards count={3} />;

  if (!playoffGames.length) {
    return (
      <div className="card empty-state">
        <div className="empty-icon">🏒</div>
        <div className="empty-title">Playoff data not yet available</div>
        <div className="empty-sub">Check back once the 2025–26 playoffs begin.</div>
      </div>
    );
  }

  const isCompletedGame = g => ['OFF','FINAL','F'].includes(g.gameState);

  // Group games by round number
  const byRound = {};
  playoffGames.forEach(g => {
    const id = String(g.id);
    const round = (id.length === 10 && id.slice(4,6) === '03')
      ? parseInt(id[7], 10) : 0;
    if (!byRound[round]) byRound[round] = [];
    byRound[round].push(g);
  });

  const roundNums = Object.keys(byRound).map(Number).sort((a,b) => b - a);
  const maxRound  = roundNums[0] || 1;

  const ROUND_LABELS = {
    1: 'First Round', 2: 'Second Round',
    3: 'Conference Finals', 4: 'Stanley Cup Final',
  };

  // Build series map keyed by round
  const seriesByRound = {};
  playoffSeries.forEach(s => { seriesByRound[s.round] = s; });

  // Collapsed: older rounds collapsed by default, current open
  const [collapsed, setCollapsed] = React.useState(() =>
    Object.fromEntries(roundNums.map(r => [r, r < maxRound]))
  );
  const toggleRound = r => setCollapsed(prev => ({ ...prev, [r]: !prev[r] }));

  return (
    <div>
      {roundNums.map(round => {
        const roundGames  = byRound[round];
        const done        = roundGames.filter(isCompletedGame);
        const pending     = roundGames.filter(g => !isCompletedGame(g))
          .sort((a,b) => new Date(a.gameDate) - new Date(b.gameDate));
        const sortedDone  = [...done].sort((a,b) => new Date(b.gameDate) - new Date(a.gameDate));
        const displayGames = [...pending, ...sortedDone];
        const isCollapsed  = collapsed[round];
        const isCurrent    = round === maxRound;
        const series       = seriesByRound[round];
        const winsCAR      = done.filter(g => getCarScore(g) > getOppScore(g)).length;
        const winsOpp      = done.filter(g => getCarScore(g) < getOppScore(g)).length;

        return (
          <div key={round} className="round-section">

            {/* Collapsible header — contains series info */}
            <button
              className={`round-section-header ${isCurrent ? 'current' : 'older'}`}
              onClick={() => toggleRound(round)}
              aria-expanded={!isCollapsed}
            >
              <div className="round-section-left">
                <span className="round-collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                <div className="round-header-info">
                  <span className="round-section-label">
                    {ROUND_LABELS[round] || `Round ${round}`}
                  </span>
                  {series && (
                    <span className="round-series-opp" style={{ color: TEAM_COLORS[series.opponent?.abbrev] || 'var(--text-dim)' }}>
                      vs {series.opponent?.abbrev}
                    </span>
                  )}
                </div>
                {isCurrent && pending.length > 0 && (
                  <span className="round-live-pill">In progress</span>
                )}
              </div>
              <div className="round-section-right">
                <span className="round-section-record">{winsCAR}–{winsOpp}</span>
                {series?.carWins === 4 && series?.oppWins === 0 && (
                  <span className="round-sweep-badge">🧹</span>
                )}
                {series && !series.isActive && (
                  <span className={`round-result-badge ${series.carAdvance ? 'adv' : 'elim'}`}>
                    {series.carAdvance ? '✅' : '❌'}
                  </span>
                )}
              </div>
            </button>

            {/* Expanded content: series card + game list */}
            {!isCollapsed && (
              <>
                {/* Inline series card */}
                {series && (
                  <SeriesCard series={series} compact />
                )}

                {/* Games */}
                {displayGames.map(game => {
                  const completed  = isCompletedGame(game);
                  const isSelected = selectedGame?.id === game.id;
                  const opp        = getOpponent(game);
                  const oppStanding = standingMap[opp?.abbrev] || standingMap[opp?.abbrev?.toLowerCase()];
                  const gameOdds   = !completed ? findGameOdds(oddsData, game) : null;
                  const ml         = gameOdds ? extractMoneyline(gameOdds, isHomeGame(game)) : null;

                  return (
                    <div key={game.id}>
                      <GameCard
                        game={game}
                        isCompleted={completed}
                        isSelected={isSelected}
                        isPlayoff
                        odds={ml}
                        cardFavoured={!completed ? computeWinPct(carStanding, oppStanding, game, playoffSeries) : null}
                        onClick={() => {
                          if (completed) { onGamePopup(game); }
                          else { setSelectedGame(isSelected ? null : game); }
                        }}
                      />
                      {isSelected && !completed && (
                        <MatchupDetail
                          game={game}
                          oppStanding={oppStanding}
                          carStanding={carStanding}
                          odds={ml}
                          playoffSeries={playoffSeries}
                        />
                      )}
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


function RegularSeasonTab({ games, loading, standingMap, carStanding, selectedGame, setSelectedGame, onGamePopup, sortOrder, setSortOrder }) {
  if (loading) return <LoadingCards count={4} />;

  if (!games.length) {
    return (
      <div className="card empty-state">
        <div className="empty-icon">📅</div>
        <div className="empty-title">Regular season complete</div>
        <div className="empty-sub">Final record shown above. Playoffs are underway.</div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completed = games.filter(g => ['OFF','FINAL','F'].includes(g.gameState));
  const upcoming  = games.filter(g =>
    !['OFF','FINAL','F'].includes(g.gameState) &&
    new Date(g.gameDate + 'T12:00:00') >= today
  );

  // Sort completed by selected order (default: newest first)
  const sortedCompleted = [...completed].sort((a, b) =>
    sortOrder === 'desc'
      ? new Date(b.gameDate) - new Date(a.gameDate)
      : new Date(a.gameDate) - new Date(b.gameDate)
  );
  // Upcoming always soonest first
  const sortedUpcoming = [...upcoming].sort((a, b) =>
    new Date(a.gameDate) - new Date(b.gameDate)
  );

  // Completed games first, then upcoming at the bottom
  const allGames = [...sortedCompleted, ...sortedUpcoming];

  return (
    <div>
      <SortBar
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        completedCount={completed.length}
        upcomingCount={upcoming.length}
        label="games"
      />

      {allGames.map(game => {
        const isCompleted = ['OFF','FINAL','F'].includes(game.gameState);
        const opp         = getOpponent(game);
        const carScore    = getCarScore(game);
        const oppScore    = getOppScore(game);
        const won  = carScore != null && oppScore != null && carScore > oppScore;
        const lost = carScore != null && oppScore != null && carScore < oppScore;

        if (isCompleted) {
          return (
            <div
              key={game.id}
              className="result-card card clickable"
              onClick={() => onGamePopup(game)}
            >
              <div className="result-top">
                <span className="result-date">{formatGameDate(game.gameDate)}</span>
                {carScore != null && (
                  <span className={`result-outcome ${won ? 'win' : 'loss'}`}>
                    {won ? 'W' : lost ? 'L' : 'OT'}
                  </span>
                )}
                <span className="result-tap-hint">Tap for stats →</span>
              </div>
              <div className="result-score">
                <TeamLogo abbr="CAR" size={20} />
                <span className="result-abbr red">CAR</span>
                <span className="result-num red">{carScore ?? '—'}</span>
                <span className="result-sep">–</span>
                <span className="result-num muted">{oppScore ?? '—'}</span>
                <span className="result-abbr muted">{opp?.abbrev}</span>
                <TeamLogo abbr={opp?.abbrev} size={20} color={TEAM_COLORS[opp?.abbrev]} />
                <span className="result-venue">{isHomeGame(game) ? 'Home' : 'Away'}</span>
              </div>
            </div>
          );
        }

        // Upcoming game
        const isSelected  = selectedGame?.id === game.id;
        const oppStanding = standingMap[opp?.abbrev] || standingMap[opp?.abbrev?.toLowerCase()];

        const cardFavoured = computeWinPct(carStanding, oppStanding, game, null);

        return (
          <div key={game.id}>
            <GameCard
              game={game}
              isCompleted={false}
              isSelected={isSelected}
              cardFavoured={cardFavoured}
              onClick={() => setSelectedGame(isSelected ? null : game)}
            />
            {isSelected && oppStanding && carStanding && (
              <MatchupDetail game={game} oppStanding={oppStanding} carStanding={carStanding} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Game stats popup ─────────────────────────────────────────

function GameStatsPopup({ game, onClose }) {
  const { data, loading } = useFetch(() => getCompletedGameStats(game.id), [game.id]);
  const [skaterTeam, setSkaterTeam] = useState('car');
  const [summary, setSummary]       = useState(null);

  // Fetch AI-generated summary from Worker KV
  useEffect(() => {
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    if (!workerUrl || !game?.id) return;
    fetch(`${workerUrl}/cache/${encodeURIComponent(`summary:${game.id}`)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.narrative) setSummary(d); })
      .catch(() => {});
  }, [game?.id]);

  const opp      = getOpponent(game);
  const oppAbbr  = opp?.abbrev || 'OPP';
  const oppColor = TEAM_COLORS[oppAbbr] || '#7a8899';
  const carScore = getCarScore(game);
  const oppScore = getOppScore(game);
  const won      = carScore != null && oppScore != null && carScore > oppScore;
  const home     = isHomeGame(game);

  // Pull team stats from right-rail
  const rr         = data?.rightRail;
  const pbpPlays   = data?.pbp?.plays || [];
  const isCarHome  = data?.homeTeamId === 12;
  const advStats   = pbpPlays.length ? computeShotAttempts(pbpPlays) : null;
  const pdoStats   = pbpPlays.length ? computePDO(pbpPlays) : null;
  const luckStats  = pbpPlays.length ? computePuckLuck(pbpPlays) : null;
  const teamStats  = rr?.teamGameStats || [];

  // Pull scoring summary from boxscore
  const bs         = data?.boxscore;
  const scoring    = bs?.summary?.scoring || bs?.linescore?.periods || [];
  const shootout   = bs?.summary?.shootout || [];
  const starsList  = bs?.summary?.threeStars || [];

  // Boxscore player stats
  const pbg        = bs?.playerByGameStats;
  const carKey     = home ? 'homeTeam' : 'awayTeam';
  const oppKey     = home ? 'awayTeam' : 'homeTeam';
  const carPlayers = pbg ? [
    ...(pbg[carKey]?.forwards   || []),
    ...(pbg[carKey]?.defensemen || []),
  ] : [];
  const carGoalies = pbg?.[carKey]?.goalies || [];

  // Opponent skaters + goalies
  const oppPlayers_raw = pbg ? [
    ...(pbg[oppKey]?.forwards   || []),
    ...(pbg[oppKey]?.defensemen || []),
  ] : [];
  const oppPlayers = [...oppPlayers_raw]
    .sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goals || 0) - (a.goals || 0));
  const oppGoalies = pbg?.[oppKey]?.goalies || [];

  // All CAR skaters sorted by points desc, then toi
  const carPlayers_sorted = [...carPlayers]
    .sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goals || 0) - (a.goals || 0));
  // reassign for use below (override earlier carPlayers with sorted version)
  carPlayers.length = 0;
  carPlayers_sorted.forEach(p => carPlayers.push(p));

  // Helper: find a team stat value by category
  function getStat(category, teamAbbr) {
    const row = teamStats.find(s =>
      s.category?.toLowerCase().includes(category.toLowerCase())
    );
    if (!row) return null;
    return teamAbbr === CAR_ABBR
      ? (home ? row.homeValue : row.awayValue)
      : (home ? row.awayValue : row.homeValue);
  }

  // Map every raw NHL API category key -> human label + optional value transformer
  // The right-rail returns camelCase keys like "sog", "faceoffWinningPctg", "blockedShots", etc.
  const STAT_CONFIG = {
    // key (lowercase)            label                          formatter
    sog:                        { label: 'Shots on Goal',           fmt: null },
    hits:                       { label: 'Hits',                    fmt: null },
    blockedshots:               { label: 'Blocked Shots',           fmt: null },
    blockedshot:                { label: 'Blocked Shots',           fmt: null },
    blocked:                    { label: 'Blocked Shots',           fmt: null },
    faceoffwinningpctg:         { label: 'Faceoff Win %',           fmt: v => `${(parseFloat(v)*100).toFixed(1)}%` },
    faceoffwinpct:              { label: 'Faceoff Win %',           fmt: v => `${parseFloat(v).toFixed(1)}%` },
    faceoffpct:                 { label: 'Faceoff Win %',           fmt: v => {
      const n = parseFloat(v);
      return n <= 1 ? `${(n*100).toFixed(1)}%` : `${n.toFixed(1)}%`;
    }},
    powerplaypctg:              { label: 'Power Play %',            fmt: v => `${(parseFloat(v)*100).toFixed(1)}%` },
    powerplay:                  { label: 'Power Play',              fmt: null },
    pim:                        { label: 'Penalty Minutes',         fmt: null },
    penaltyminutes:             { label: 'Penalty Minutes',         fmt: null },
    giveaways:                  { label: 'Giveaways',               fmt: null },
    takeaways:                  { label: 'Takeaways',               fmt: null },
    shots:                      { label: 'Shots on Goal',           fmt: null },
  };

  function getStatConfig(rawCategory) {
    if (!rawCategory) return null;
    const key = rawCategory.toLowerCase().replace(/[^a-z]/g, '');
    return STAT_CONFIG[key] || null;
  }

  function formatStatValue(rawCategory, value) {
    if (value == null) return '—';
    const cfg = getStatConfig(rawCategory);
    if (cfg?.fmt) return cfg.fmt(value);
    return String(value);
  }

  function getStatLabel(rawCategory) {
    const cfg = getStatConfig(rawCategory);
    // If we have a known label use it; otherwise convert camelCase to Title Case
    if (cfg?.label) return cfg.label;
    return rawCategory
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="game-popup" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={`gp-header ${won ? 'gp-win' : 'gp-loss'}`}>
          <div className="gp-header-inner">
            <div className="gp-team-col">
              <TeamLogo abbr="CAR" size={36} />
              <span className="gp-abbr" style={{ color: 'var(--red-bright)' }}>CAR</span>
              <span className="gp-score-big" style={{ color: 'var(--red-bright)' }}>{carScore ?? '—'}</span>
            </div>
            <div className="gp-center-col">
              <div className={`gp-result-badge ${won ? 'win' : 'loss'}`}>{won ? 'W' : 'L'}</div>
              <div className="gp-date">{formatGameDate(game.gameDate)}</div>
              <div className="gp-venue">{home ? '📍 Home' : '✈ Away'}</div>
            </div>
            <div className="gp-team-col right">
              <TeamLogo abbr={oppAbbr} size={36} color={oppColor} />
              <span className="gp-abbr" style={{ color: oppColor }}>{oppAbbr}</span>
              <span className="gp-score-big" style={{ color: oppColor }}>{oppScore ?? '—'}</span>
            </div>
          </div>
          <button className="gp-close" onClick={onClose} aria-label="Close game details">✕</button>
        </div>

        <div className="gp-body">
          {/* ── AI Game Summary Card ── */}
          {summary && (
            <div className="gp-summary-card">
              <div className="gp-summary-header">
                <span className="gp-summary-label">Game Summary</span>
                <span className="gp-summary-badge">⚡ EyeWall AI</span>
              </div>
              <p className="gp-summary-narrative">{summary.narrative}</p>
              <div className="gp-summary-chips">
                <span className="gp-summary-chip" style={{color: summary.cfPct >= 50 ? 'var(--green)' : 'var(--red-bright)'}}>
                  CF% {summary.cfPct}%
                </span>
                {summary.topScorer && summary.topScorer !== 'Unknown' && (
                  <span className="gp-summary-chip">🚨 {summary.topScorer}</span>
                )}
                {summary.carGoalie && summary.carGoalie.svPct != null && (
                  <span className="gp-summary-chip">
                    🥅 {summary.carGoalie.name.split(' ').pop()}{' '}
                    {typeof summary.carGoalie.svPct === 'number'
                      ? (summary.carGoalie.svPct <= 1
                          ? summary.carGoalie.svPct.toFixed(3)
                          : (summary.carGoalie.svPct / 100).toFixed(3))
                      : summary.carGoalie.svPct}
                  </span>
                )}
                <span className="gp-summary-chip" style={{color: summary.won ? 'var(--green)' : 'var(--red-bright)'}}>
                  {summary.won ? '✓ W' : '✗ L'} {summary.carScore}–{summary.oppScore}
                </span>
              </div>
              <button
                className="gp-summary-share"
                onClick={() => {
                  const text = `CAR ${summary.carScore}–${summary.oppScore} ${summary.oppAbbr} | ${summary.narrative} — EyeWall Analytics eyewallanalytics.com`;
                  if (navigator.share) {
                    navigator.share({ title: 'EyeWall Analytics Game Summary', text }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).then(() =>
                      alert('Summary copied to clipboard!')
                    ).catch(() => {});
                  }
                }}
              >
                ↗ Share summary
              </button>
            </div>
          )}

          {loading && (
            <div className="gp-loading">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 12, marginBottom: 10, width: `${60 + i * 8}%` }} />
              ))}
            </div>
          )}

          {!loading && data && (
            <>
              {/* Period table + three stars side by side */}
              {scoring.length > 0 && (
                <div className="gp-period-stars-row">
                  <div className="gp-section gp-period-col">
                    <div className="gp-section-label">Scoring by period</div>
                    <PeriodTable scoring={scoring} home={home} carAbbr={CAR_ABBR} oppAbbr={oppAbbr} />
                  </div>
                  {starsList.length > 0 && (
                    <div className="gp-section gp-stars-col">
                      <div className="gp-section-label">Three stars</div>
                      {starsList.map((s, i) => (
                        <div key={i} className="gp-star-row">
                          <span className="gp-star-num">
                            {i === 0 ? '⭐' : i === 1 ? '⭐⭐' : '⭐⭐⭐'}
                          </span>
                          <div className="gp-star-info">
                            <span className="gp-star-name">{s.name?.default || s.player}</span>
                            <span className="gp-star-team" style={{ color: TEAM_COLORS[s.teamAbbrev?.default || s.teamAbbrev] || 'var(--text-muted)' }}>
                              {s.teamAbbrev?.default || s.teamAbbrev}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Goals — CAR on left, opponent on right */}
              {scoring.length > 0 && (
                <div className="gp-section">
                  <div className="gp-section-label">Goals</div>
                  <GoalsList scoring={scoring} carAbbr={CAR_ABBR} oppAbbr={oppAbbr} oppColor={oppColor} />
                </div>
              )}

              {/* Team stats comparison */}
              {teamStats.length > 0 && (
                <div className="gp-section">
                  <div className="gp-section-label">Team stats</div>
                  <div className="gp-team-stat-header">
                    <span style={{ color: 'var(--red-bright)' }}>CAR</span>
                    <span />
                    <span style={{ color: oppColor }}>{oppAbbr}</span>
                  </div>
                  {teamStats.map((row, i) => {
                    const rawCarVal = home ? row.homeValue : row.awayValue;
                    const rawOppVal = home ? row.awayValue : row.homeValue;
                    const carDisplay = formatStatValue(row.category, rawCarVal);
                    const oppDisplay = formatStatValue(row.category, rawOppVal);
                    const label      = getStatLabel(row.category);
                    // For bar sizing always use raw numeric (strip % if present)
                    const carNum = parseFloat(String(rawCarVal).replace('%','')) || 0;
                    const oppNum = parseFloat(String(rawOppVal).replace('%','')) || 0;
                    const total  = carNum + oppNum || 1;
                    const carPct = Math.round((carNum / total) * 100);
                    return (
                      <div key={i} className="gp-stat-row">
                        <span className="gp-stat-val car">{carDisplay}</span>
                        <div className="gp-stat-center">
                          <div className="gp-stat-label">{label}</div>
                          <div className="dual-bar">
                            <div className="fill-red"  style={{ width: `${carPct}%` }} />
                            <div className="fill-blue" style={{ width: `${100 - carPct}%` }} />
                          </div>
                        </div>
                        <span className="gp-stat-val opp">{oppDisplay}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Skater table with team toggle */}
              {/* ── Corsi / Fenwick / PDO / Puck Luck ── */}
              {advStats && (
                <div className="gp-section">
                  <div className="gp-section-label">
                    Shot Attempts &amp; Puck Luck
                    <InfoTip position="above" text="Corsi = all shot attempts (goals+shots+misses+blocks). Fenwick excludes blocks. PDO = SH%+SV%×100, avg=100. Puck Luck = actual goals vs expected from shot share." />
                  </div>
                  <div className="gp-adv-grid">
                    <div className="gp-adv-row header">
                      <span></span><span className="red">CAR</span><span></span><span className="muted">OPP</span>
                    </div>
                    {[
                      ['Corsi (CF)',   advStats.carCorsi,   advStats.oppCorsi,   'All shot attempts incl. blocked'],
                      ['Fenwick (FF)', advStats.carFenwick, advStats.oppFenwick, 'Unblocked shot attempts (excl. blocks)'],
                      ['Shots on Goal',advStats.car.goals+advStats.car.sog, advStats.opp.goals+advStats.opp.sog, 'Shots that reached the goalie'],
                      ['Missed Shots', advStats.car.missed, advStats.opp.missed, 'Attempts that missed the net'],
                      ['Blocked Shots',advStats.car.blocked,advStats.opp.blocked,'Attempts blocked by a skater'],
                    ].map(([label, car, opp, help]) => {
                      const tot = car + opp || 1;
                      return (
                        <div key={label} className="gp-adv-row">
                          <span className="gp-adv-label">{label}</span>
                          <span className="red">{car}</span>
                          <div className="gp-adv-bar">
                            <div className="gp-adv-fill red"   style={{width:`${Math.round(car/tot*100)}%`}} />
                            <div className="gp-adv-fill muted" style={{width:`${Math.round(opp/tot*100)}%`}} />
                          </div>
                          <span className="muted">{opp}</span>
                        </div>
                      );
                    })}
                    <div className="gp-adv-chips">
                      <span className="gp-adv-chip"
                        style={{color: advStats.corsiForPct>=50?'var(--green)':'var(--red-bright)'}}>
                        CF% {advStats.corsiForPct}%
                      <InfoTip text="Corsi For% — CAR share of all shot attempts" position="above" /></span>
                      <span className="gp-adv-chip"
                        style={{color: advStats.fenwickForPct>=50?'var(--green)':'var(--red-bright)'}}>
                        FF% {advStats.fenwickForPct}%
                      <InfoTip text="Fenwick For% — CAR share of unblocked attempts" position="above" /></span>
                      {pdoStats && (
                        <span className="gp-adv-chip" title={`PDO = SH%+SV%×100. Avg=100. ${pdoStats.luck}`}
                          style={{color: pdoStats.pdo>102?'var(--amber)':pdoStats.pdo<98?'var(--blue-bright)':'var(--text-muted)'}}>
                          PDO {pdoStats.pdo}
                        </span>
                      )}
                      {luckStats && (
                        <span className="gp-adv-chip"
                          style={{color: luckStats.color}}>
                          Luck {luckStats.luckDelta>=0?'+':''}{luckStats.luckDelta}G
                        <InfoTip text="Puck Luck: ${luckStats.label}. Expected ${luckStats.expectedGF}G from ${luckStats.fenwickForPct}% shot share." position="above" /></span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Skater table with team toggle */}
              {(carPlayers.length > 0 || oppPlayers.length > 0) && (
                <div className="gp-section">
                  <div className="gp-skater-toggle">
                    <button
                      className={"skater-toggle-btn" + (skaterTeam === "car" ? " active-car" : "")}
                      onClick={() => setSkaterTeam("car")}
                    >
                      <TeamLogo abbr="CAR" size={14} />
                      CAR Skaters
                    </button>
                    <button
                      className={"skater-toggle-btn" + (skaterTeam === "opp" ? " active-opp" : "")}
                      onClick={() => setSkaterTeam("opp")}
                    >
                      <TeamLogo abbr={oppAbbr} size={14} color={oppColor} />
                      {oppAbbr} Skaters
                    </button>
                  </div>
                  <SkaterTable
                    players={skaterTeam === "car" ? carPlayers : oppPlayers}
                    goalies={(skaterTeam === "car" ? carGoalies : oppGoalies).filter(
                      g => (g.toi && g.toi !== "00:00") || (g.shotsAgainst ?? 0) > 0
                    )}
                  />
                </div>
              )}

              {!teamStats.length && !carPlayers.length && !scoring.length && (
                <div className="gp-no-data">
                  Detailed stats not available for this game yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Period scoring table ─────────────────────────────────────

function PeriodTable({ scoring, home, carAbbr, oppAbbr }) {
  // scoring is array of periods, each with goals array
  const periods = scoring.map((p, i) => {
    const num = p.period || i + 1;
    const label = num <= 3 ? `P${num}` : num === 4 ? 'OT' : `OT${num - 3}`;
    let carG = 0, oppG = 0;
    (p.goals || []).forEach(g => {
      if (g.teamAbbrev?.default === carAbbr) carG++;
      else oppG++;
    });
    return { label, carG, oppG };
  });

  const carTotal = periods.reduce((s, p) => s + p.carG, 0);
  const oppTotal = periods.reduce((s, p) => s + p.oppG, 0);

  return (
    <div className="period-table">
      <div className="period-row header">
        <span />
        {periods.map(p => <span key={p.label}>{p.label}</span>)}
        <span>T</span>
      </div>
      <div className="period-row car-row">
        <span style={{ color: 'var(--red-bright)', fontWeight: 600 }}>CAR</span>
        {periods.map(p => <span key={p.label}>{p.carG}</span>)}
        <span className="period-total">{carTotal}</span>
      </div>
      <div className="period-row">
        <span style={{ color: 'var(--text-muted)' }}>{oppAbbr}</span>
        {periods.map(p => <span key={p.label}>{p.oppG}</span>)}
        <span className="period-total">{oppTotal}</span>
      </div>
    </div>
  );
}

// ── Skater table (shared between CAR and OPP) ───────────────

function SkaterTable({ players, goalies }) {
  function fmtSvPct(v) {
    if (v == null) return '—';
    return v <= 1 ? v.toFixed(3) : (v / 100).toFixed(3);
  }

  return (
    <>
      <div className="gp-skater-table">
        <div className="gp-skater-header">
          <span className="col-name">Player</span>
          <span title="Goals">G</span>
          <span title="Assists">A</span>
          <span title="Points">PTS</span>
          <span title="Plus/Minus">+/−</span>
          <span title="Shots on Goal">SOG</span>
          <span title="Hits">HIT</span>
          <span title="Blocked Shots">BLK</span>
          <span title="Time on Ice">TOI</span>
        </div>
        {players.map((p, i) => {
          const pm = p.plusMinus;
          const pmStr   = pm != null ? (pm >= 0 ? "+" + pm : "" + pm) : "—";
          const pmColor = pm > 0 ? "var(--green)" : pm < 0 ? "var(--red-bright)" : "var(--text-muted)";
          return (
            <div key={i} className={"gp-skater-row" + ((p.points ?? 0) > 0 ? " has-points" : "")}>
              <span className="col-name">
                <span className="gp-player-name">{p.name?.default || ("#" + p.sweaterNumber)}</span>
                <span className="gp-player-num">{"#" + p.sweaterNumber}</span>
              </span>
              <span>{p.goals ?? 0}</span>
              <span>{p.assists ?? 0}</span>
              <span className={(p.points ?? 0) > 0 ? "gp-pts-highlight" : ""}>{p.points ?? 0}</span>
              <span style={{ color: pmColor }}>{pmStr}</span>
              <span>{p.shots ?? p.sog ?? 0}</span>
              <span>{p.hits ?? 0}</span>
              <span>{p.blockedShots ?? p.blocks ?? 0}</span>
              <span className="gp-toi">{p.toi ?? "—"}</span>
            </div>
          );
        })}
      </div>

      {goalies.length > 0 && goalies.map((g, i) => (
        <div key={i} className="gp-goalie-row" style={{ marginTop: 8 }}>
          <span className="gp-player-name">{g.name?.default || ("#" + g.sweaterNumber)}</span>
          <div className="gp-goalie-stats">
            <span className="gp-goalie-stat"><span className="gp-goalie-label">SA</span>{g.shotsAgainst ?? "—"}</span>
            <span className="gp-goalie-stat"><span className="gp-goalie-label">SV</span>{g.saves ?? "—"}</span>
            <span className="gp-goalie-stat"><span className="gp-goalie-label">SV%</span>{fmtSvPct(g.savePctg)}</span>
            <span className="gp-goalie-stat"><span className="gp-goalie-label">TOI</span>{g.toi ?? "—"}</span>
            {(() => { const gsax = computeGSAx(g.shotsAgainst, g.saves); return gsax ? (
              <span className="gp-goalie-stat">
                <span className="gp-goalie-label">GSAx</span>
                <span style={{color:gsax.color}}>{gsax.label} <InfoTip text={gsax.note} position="above" /></span>
              </span>
            ) : null; })()}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Goals list ───────────────────────────────────────────────

// Strength codes from NHL API — 'EV'/'ev' = even strength (don't show chip)
// Show a chip only for PP, SH, EN goals
function strengthChip(strength) {
  if (!strength) return null;
  const s = strength.toUpperCase();
  if (s === 'EV' || s === '5V5') return null; // even strength — no chip
  const config = {
    PP:  { label: 'PP',  color: '#ffaa22', bg: 'rgba(255,170,34,0.15)' },
    SH:  { label: 'SH',  color: '#4477ee', bg: 'rgba(68,119,238,0.15)' },
    EN:  { label: 'EN',  color: '#8899aa', bg: 'rgba(136,153,170,0.15)' },
  };
  // Handle numeric situation codes: 1451=PP, 1541=SH, etc.
  // The API also returns string like 'pp', 'sh', 'en'
  const key = Object.keys(config).find(k => s.includes(k)) || null;
  if (!key) return null;
  const c = config[key];
  return (
    <span className="goal-strength-chip" style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  );
}

function GoalsList({ scoring, carAbbr, oppAbbr, oppColor }) {
  // Flatten all goals, annotating each with period label and team side
  const allGoals = scoring.flatMap((p, pi) => {
    const num = p.period || pi + 1;
    const periodLabel = num <= 3 ? `P${num}` : num === 4 ? 'OT' : `OT${num - 3}`;
    return (p.goals || []).map(g => ({ ...g, periodLabel, periodNum: num }));
  });

  if (!allGoals.length) return <div className="gp-no-data">No scoring data available.</div>;

  // Group goals by period for the side-by-side layout
  const byPeriod = {};
  allGoals.forEach(g => {
    const key = g.periodLabel;
    if (!byPeriod[key]) byPeriod[key] = { label: key, carGoals: [], oppGoals: [] };
    const teamAbbr = g.teamAbbrev?.default || g.teamAbbrev || '';
    if (teamAbbr === carAbbr) byPeriod[key].carGoals.push(g);
    else                       byPeriod[key].oppGoals.push(g);
  });

  const periods = Object.values(byPeriod);

  return (
    <div className="goals-two-col">
      {/* Column headers — single row, no border */}
      <div className="goals-header-row">
        <span className="goals-col-header" style={{ color: 'var(--red-bright)' }}>{carAbbr}</span>
        <span />
        <span className="goals-col-header right" style={{ color: oppColor || 'var(--text-muted)' }}>{oppAbbr}</span>
      </div>

      {periods.map(({ label, carGoals, oppGoals }) => {
        const maxRows = Math.max(carGoals.length, oppGoals.length, 1);
        return (
          <div key={label} className="goals-period-group">
            {/* Period divider spanning full width */}
            <div className="goals-period-divider">
              <span className="goals-period-label">{label}</span>
            </div>

            {/* Goal rows side by side */}
            {Array.from({ length: maxRows }).map((_, rowIdx) => {
              const carG = carGoals[rowIdx] || null;
              const oppG = oppGoals[rowIdx] || null;
              return (
                <div key={rowIdx} className="goals-row-pair">
                  {/* CAR goal — left column */}
                  <div className="goal-cell car">
                    {carG && <GoalEntry goal={carG} isCar side="left" />}
                  </div>
                  {/* Centre spacer */}
                  <div className="goal-cell-mid" />
                  {/* OPP goal — right column */}
                  <div className="goal-cell opp">
                    {oppG && <GoalEntry goal={oppG} isCar={false} side="right" />}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function GoalEntry({ goal: g, isCar, side }) {
  const scorer = g.name?.default ||
    [g.firstName?.default, g.lastName?.default].filter(Boolean).join(' ') ||
    'Unknown';

  let assistNames = [];
  if (Array.isArray(g.assists) && g.assists.length) {
    assistNames = g.assists.map(a =>
      a.name?.default ||
      [a.firstName?.default, a.lastName?.default].filter(Boolean).join(' ') ||
      `#${a.playerId}`
    ).filter(Boolean);
  } else {
    assistNames = [
      g.assist1Name?.default, g.assist2Name?.default,
      g.assist1?.name?.default, g.assist2?.name?.default,
    ].filter(Boolean);
  }

  const chip  = strengthChip(g.strength || g.situationCode);
  const color = isCar ? 'var(--red-bright)' : 'var(--blue-bright)';
  const align = side === 'right' ? 'right' : 'left';

  return (
    <div className={`goal-entry ${side}`}>
      <div className="goal-entry-top" style={{ textAlign: align }}>
        <span className="goal-entry-time">{g.timeInPeriod}</span>
        {chip}
      </div>
      <div className="goal-entry-scorer" style={{ color, textAlign: align }}>
        🚨 {scorer}
        {g.goalsToDate != null && (
          <span className="goal-season-num"> ({g.goalsToDate})</span>
        )}
      </div>
      {assistNames.length > 0 ? (
        <div className="goal-entry-assists" style={{ textAlign: align }}>
          {assistNames.join(', ')}
        </div>
      ) : (
        <div className="goal-entry-assists unassisted" style={{ textAlign: align }}>
          Unassisted
        </div>
      )}
    </div>
  );
}


// ── Series card ──────────────────────────────────────────────

function SeriesCard({ series }) {
  const oppAbbr  = series.opponent?.abbrev || '???';
  const oppColor = TEAM_COLORS[oppAbbr] || '#7a8899';
  const total    = series.carWins + series.oppWins;
  return (
    <div className={`series-card card ${series.isActive ? 'series-active' : ''}`}>
      <div className="series-top">
        <div className="series-top-left">
          <span className="series-round-label">{series.roundLabel}</span>
          <span className="series-status">
            {series.isActive ? '🔴 In progress' : series.carAdvance ? '✅ Advanced' : '❌ Eliminated'}
          </span>
        </div>
        <span className="series-games-played">{total} game{total !== 1 ? 's' : ''} played</span>
        {series.carWins === 4 && series.oppWins === 0 && (
          <span className="series-sweep">🧹 Sweep!</span>
        )}
        {series.oppWins === 4 && series.carWins === 0 && (
          <span className="series-swept">🧹 Swept</span>
        )}
      </div>
      <div className="series-body">

        {/* CAR column: logo+name+score in a row, pips underneath */}
        <div className="series-side">
          <div className="series-row">
            <TeamLogo abbr="CAR" size={30} />
            <span className="series-abbr" style={{ color: 'var(--red-bright)' }}>CAR</span>
            <span className="series-city">Carolina</span>
            <span className="series-wins">{series.carWins}</span>
          </div>
          <div className="series-pips">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`pip ${i < series.carWins ? 'pip-red' : 'pip-empty'}`} />
            ))}
          </div>
        </div>

        {/* Centre dash */}
        <div className="series-centre">
          <span className="series-divider">–</span>
        </div>

        {/* OPP column: mirror layout, right-aligned */}
        <div className="series-side right">
          <div className="series-row right">
            <span className="series-wins">{series.oppWins}</span>
            <span className="series-city">{series.opponent?.placeName?.default || oppAbbr}</span>
            <span className="series-abbr" style={{ color: oppColor }}>{oppAbbr}</span>
            <TeamLogo abbr={oppAbbr} size={30} color={oppColor} />
          </div>
          <div className="series-pips">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`pip ${i < series.oppWins ? 'pip-opp' : 'pip-empty'}`} style={{ '--opp-color': oppColor }} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sort bar ─────────────────────────────────────────────────

function SortBar({ sortOrder, setSortOrder, completedCount, upcomingCount, label }) {
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

// ── Shared game card ─────────────────────────────────────────

function GameCard({ game, isCompleted, isSelected, isPlayoff, onClick, odds, cardFavoured }) {
  const home     = isHomeGame(game);
  const opp      = getOpponent(game);
  const oppColor = TEAM_COLORS[opp?.abbrev] || '#7a8899';
  const carScore = getCarScore(game);
  const oppScore = getOppScore(game);
  const won      = isCompleted && carScore != null && carScore > oppScore;
  const lost     = isCompleted && carScore != null && carScore < oppScore;
  const oppCity  = opp?.placeName?.default || '';
  const oppName  = opp?.commonName?.default || opp?.abbrev || '';

  return (
    <div
      className={`game-card card ${isSelected ? 'selected' : ''} ${isPlayoff ? 'playoff-game' : ''} ${isCompleted ? 'clickable' : 'upcoming-clickable'}`}
      onClick={onClick}
    >
      <div className="gc-top">
        <span className="gc-date">{formatGameDate(game.gameDate)}</span>
        {isCompleted && carScore != null ? (
          <span className={`gc-result ${won ? 'won' : 'lost'}`}>
            {won ? 'W' : lost ? 'L' : 'OT'} {carScore}–{oppScore}
          </span>
        ) : (
          <span className="gc-time">{formatGameTime(game.startTimeUTC)}</span>
        )}
        <span className="gc-venue">{home ? '📍 Lenovo Center' : '✈ Away'}</span>
        {isCompleted && <span className="gc-tap-hint">Tap for stats →</span>}
        {!isCompleted && odds && (
          <div className="gc-odds">
            <span className="gc-odds-car" title="CAR moneyline">{fmtOdds(odds.carOdds)}</span>
            <span className="gc-odds-sep">/</span>
            <span className="gc-odds-opp" title="OPP moneyline">{fmtOdds(odds.oppOdds)}</span>
            <span className="gc-odds-book">{odds.book}</span>
          </div>
        )}
      </div>
      <div className="gc-matchup">
        <div className="gc-team-block">
          <TeamLogo abbr="CAR" size={32} />
          <div className="gc-team-text">
            <span className="gc-abbr" style={{ color: 'var(--red-bright)' }}>CAR</span>
            <span className="gc-full">Carolina Hurricanes</span>
          </div>
        </div>
        <div className="gc-vs">{home ? 'vs' : '@'}</div>
        <div className="gc-team-block right">
          <div className="gc-team-text right">
            <span className="gc-abbr" style={{ color: oppColor }}>{opp?.abbrev}</span>
            <span className="gc-full">{oppCity} {oppName}</span>
          </div>
          <TeamLogo abbr={opp?.abbrev} size={32} color={oppColor} />
        </div>
      </div>
      {!isCompleted && (
        <div className="gc-bottom-row">
          {cardFavoured && (
            <span className={`gc-favoured-chip ${cardFavoured.favoured ? 'fav' : 'dog'}`}>
              {cardFavoured.favoured ? `✓ CAR ${cardFavoured.pct}%` : `⚠ ${opp?.abbrev} ${100 - cardFavoured.pct}%`}
            </span>
          )}
          <span className="gc-expand-hint">{isSelected ? '▲ Close' : '▼ Matchup breakdown'}</span>
        </div>
      )}
    </div>
  );
}

// ── Shared win probability model ─────────────────────────────
// Used by both GameCard chip and MatchupDetail probability bar.
// Returns { pct: number, favoured: bool }
function computeWinPct(carStanding, oppStanding, game, playoffSeries) {
  if (!carStanding || !oppStanding) return null;
  const isPlayoff = game?.gameType === 3;
  const isHome    = game?.homeTeam?.abbrev === 'CAR';
  const cgp = carStanding.gamesPlayed || 1;
  const ogp = oppStanding.gamesPlayed || 1;
  const carGpg = (carStanding.goalFor     ?? 0) / cgp;
  const oppGpg = (oppStanding.goalFor     ?? 0) / ogp;
  const carGag = (carStanding.goalAgainst ?? 0) / cgp;
  const oppGag = (oppStanding.goalAgainst ?? 0) / ogp;
  const carSF  = carStanding.shotsForPerGame || 0;
  const oppSF  = oppStanding.shotsForPerGame || 0;
  const carPP  = typeof carStanding.powerPlayPct === 'number'
    ? (carStanding.powerPlayPct <= 1 ? carStanding.powerPlayPct * 100 : carStanding.powerPlayPct) : 22;
  const oppPK  = typeof oppStanding.penaltyKillPct === 'number'
    ? (oppStanding.penaltyKillPct <= 1 ? oppStanding.penaltyKillPct * 100 : oppStanding.penaltyKillPct) : 80;

  let cs = 0, os = 0;
  if (carGpg > oppGpg) cs += 0.7; else os += 0.7;
  if (carGag < oppGag) cs += 0.7; else os += 0.7;
  if (carSF  > oppSF)  cs += 0.5; else os += 0.5;
  if ((carPP - (100 - oppPK)) > 0) cs += 0.4; else os += 0.4;
  if (!isPlayoff) {
    const ptsDiff = (carStanding.points ?? 0) - (oppStanding.points ?? 0);
    if (ptsDiff > 0) cs += Math.min(ptsDiff / 20, 0.5);
    else             os += Math.min(-ptsDiff / 20, 0.5);
  }
  if (carStanding.streakCode === 'W') cs += 0.3;
  if (oppStanding.streakCode === 'W') os += 0.3;
  if (isHome) cs += 0.25; else os += 0.25;

  // Playoff series record
  if (isPlayoff && playoffSeries) {
    const oppAbbr = isHome ? game.awayTeam?.abbrev : game.homeTeam?.abbrev;
    const round   = (() => {
      const id = String(game.id);
      return (id.length === 10 && id.slice(4,6) === '03') ? parseInt(id[7], 10) : null;
    })();
    const s = playoffSeries.find(s => s.round === round && s.opponent?.abbrev === oppAbbr);
    if (s) {
      const lead = s.carWins - s.oppWins;
      if (lead > 0) cs += Math.min(lead * 0.5, 1.0);
      else if (lead < 0) os += Math.min(-lead * 0.5, 1.0);
    }
  }

  const t = cs + os || 1;
  const pct = Math.round(cs / t * 100);
  return { pct, favoured: pct >= 50 };
}

// ── Matchup detail (upcoming games) ─────────────────────────

function MatchupDetail({ game, oppStanding, carStanding, odds, playoffSeries }) {
  const [mdTab, setMdTab] = React.useState('prediction');
  const opp     = getOpponent(game);
  const oppAbbr = opp?.abbrev || 'OPP';
  const oppColor = TEAM_COLORS[oppAbbr] || '#7a8899';

  // Auto-save prediction — must be before any early returns (Rules of Hooks)
  React.useEffect(() => {
    if (!game?.id || !carStanding || !oppStanding) return;
    const cgp   = carStanding.gamesPlayed || 1;
    const ogp   = oppStanding.gamesPlayed || 1;
    const cGpg  = (carStanding.goalFor     ?? 0) / cgp;
    const oGpg  = (oppStanding.goalFor     ?? 0) / ogp;
    const cGag  = (carStanding.goalAgainst ?? 0) / cgp;
    const oGag  = (oppStanding.goalAgainst ?? 0) / ogp;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const isHome_ = game.homeTeam?.abbrev === 'CAR';
    const adj     = isHome_ ? 0.12 : -0.12;
    const pCar    = +(clamp(Math.sqrt(Math.max(cGpg,0.5)*Math.max(oGag,0.5))+adj,1.5,5.0)).toFixed(1);
    const pOpp    = +(clamp(Math.sqrt(Math.max(oGpg,0.5)*Math.max(cGag,0.5))-adj,1.5,5.0)).toFixed(1);
    const cPts    = carStanding.points ?? 0;
    const oPts    = oppStanding.points ?? 0;
    savePrediction({
      gameId:            game.id,
      gameDate:          game.gameDate,
      opponent:          oppAbbr,
      predictedCarWin:   cPts >= oPts,
      predictedCarPct:   Math.round(cPts / (cPts + oPts + 1) * 100),
      predictedCarScore: pCar,
      predictedOppScore: pOpp,
    });
  }, [game?.id]);

  // Guard: if standings data unavailable show a graceful message with debug info
  if (!carStanding || !oppStanding) {
    return (
      <div className="matchup-detail card">
        <div className="md-note">
          📊 Loading standings data…
          {!carStanding && ' CAR standings not found.'}
          {!oppStanding && ` ${oppAbbr} standings not found.`}
        </div>
        {odds && (
          <div className="md-odds-row" style={{ marginTop: 12 }}>
            <div className="md-odds-item">
              <span className="md-odds-team" style={{ color: 'var(--red-bright)' }}>CAR</span>
              <span className={`md-odds-val ${odds.carOdds < 0 ? 'fav' : 'dog'}`}>{fmtOdds(odds.carOdds)}</span>
              <span className="md-odds-implied">{oddsToImplied(odds.carOdds)}% implied</span>
            </div>
            <div className="md-odds-book">{odds.book}</div>
            <div className="md-odds-item right">
              <span className="md-odds-team" style={{ color: oppColor }}>{oppAbbr}</span>
              <span className={`md-odds-val ${odds.oppOdds < 0 ? 'fav' : 'dog'}`}>{fmtOdds(odds.oppOdds)}</span>
              <span className="md-odds-implied">{oddsToImplied(odds.oppOdds)}% implied</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const carGp  = carStanding.gamesPlayed || 1;
  const oppGp  = oppStanding.gamesPlayed || 1;
  const carGpg = (carStanding.goalFor  ?? 0) / carGp;
  const oppGpg = (oppStanding.goalFor  ?? 0) / oppGp;
  const carGag = (carStanding.goalAgainst ?? 0) / carGp;
  const oppGag = (oppStanding.goalAgainst ?? 0) / oppGp;
  const carWin = (carStanding.wins ?? 0) / carGp;
  const oppWin = (oppStanding.wins ?? 0) / oppGp;
  const carPts = carStanding.points ?? 0;
  const oppPts = oppStanding.points ?? 0;
  const carPP  = carStanding.powerPlayPct ?? 22;
  const oppPK  = oppStanding.penaltyKillPct ?? 80;
  const carPK  = carStanding.penaltyKillPct ?? 80;
  const oppPP  = oppStanding.powerPlayPct ?? 22;

  // Series record this playoff round (if applicable)
  const id = String(game.id);
  const round = (id.length === 10 && id.slice(4,6) === '03') ? parseInt(id[7], 10) : null;
  const seriesEntry = playoffSeries?.find(
    s => s.round === round && s.opponent?.abbrev === oppAbbr
  );

  // ── Win probability — uses shared model (matches game card chip) ──
  const isPlayoff_  = game?.gameType === 3;
  const isHome_     = game?.homeTeam?.abbrev === 'CAR';

  // Re-derive factors for display (mirrors computeWinPct logic)
  const carSF    = carStanding.shotsForPerGame || 0;
  const oppSF    = oppStanding.shotsForPerGame || 0;
  const ppEdge   = carPP - (100 - oppPK);
  const carStreak = carStanding.streakCode;
  const oppStreak = oppStanding.streakCode;
  const factors  = [
    { label: 'Offence (GF/GP)',    carEdge: carGpg >= oppGpg },
    { label: 'Defence (GA/GP)',    carEdge: carGag <= oppGag },
    { label: 'Possession (SOG/GP)', carEdge: carSF >= oppSF },
    { label: 'PP vs PK',           carEdge: ppEdge >= 0 },
    ...(!isPlayoff_ ? [{ label: 'Standings', carEdge: carPts >= oppPts }] : []),
    ...((carStreak || oppStreak) ? [{ label: 'Recent form', carEdge: carStreak === 'W' && oppStreak !== 'W' }] : []),
    { label: 'Home ice',           carEdge: isHome_ },
    ...(isPlayoff_ && seriesEntry ? [{ label: 'Series lead', carEdge: (seriesEntry.carWins - seriesEntry.oppWins) >= 0 }] : []),
  ];

  // Get model win % from shared function
  const winResult  = computeWinPct(carStanding, oppStanding, game, playoffSeries);
  const carImplied = odds ? oddsToImplied(odds.carOdds) : null;
  const oppImplied = odds ? oddsToImplied(odds.oppOdds) : null;

  // Blend with market odds if available (60/40)
  let carModelPct = winResult?.pct ?? 50;
  if (carImplied) carModelPct = Math.round(carModelPct * 0.6 + carImplied * 0.4);
  const carFavoured = carModelPct >= 50;

  const modelTooltip = [
    'How we predict:',
    '• GF/GP & GA/GP — offensive and defensive efficiency',
    '• SOG/GP — possession proxy (shot attempt share)',
    '• PP vs PK matchup — special teams edge',
    isPlayoff_ ? '• Series record — current series lead/deficit' : '• Standings points — season performance',
    '• Recent form — current streak',
    '• Home ice — ~0.25 goal advantage',
    carImplied ? '• Market odds — 40% weight when available' : null,
    isPlayoff_ ? 'Playoff mode: standings points excluded.' : null,
  ].filter(Boolean).join('\n');


  // ── Score prediction (Pythagorean expectation) ───────────
  // Expected goals = geometric mean of team's attack rate vs opponent's defense rate.
  // Home teams average ~0.15 more goals, away ~0.15 less.
  const isHomeGame_  = game?.homeTeam?.abbrev === CAR_ABBR ||
                       game?.homeTeam?.abbrev === 'CAR';
  const homeAdj      = isHomeGame_ ? 0.12 : -0.12;
  const rawCarExp    = Math.sqrt(Math.max(carGpg, 0.5) * Math.max(oppGag, 0.5));
  const rawOppExp    = Math.sqrt(Math.max(oppGpg, 0.5) * Math.max(carGag, 0.5));
  // Clamp to realistic NHL range (1.5 – 5.0 per team)
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const predCarScore = +(clamp(rawCarExp + homeAdj, 1.5, 5.0)).toFixed(1);
  const predOppScore = +(clamp(rawOppExp - homeAdj, 1.5, 5.0)).toFixed(1);

  // ── Save prediction + track record ───────────────────────
  const predStats   = getPredictionStats();
  const { useEffect } = window.React || {};

  return (
    <div className="matchup-detail card">
      {/* Tab bar: Prediction vs Scouting */}
      <div className="md-tabs">
        <button className={`md-tab${mdTab === 'prediction' ? ' active' : ''}`}
          onClick={() => setMdTab('prediction')}>Prediction</button>
        <button className={`md-tab${mdTab === 'scouting' ? ' active' : ''}`}
          onClick={() => setMdTab('scouting')}>Scouting</button>
      </div>

      {mdTab === 'scouting' ? (
        <ScoutingTab oppAbbr={oppAbbr} oppStanding={oppStanding} carStanding={carStanding} isPlayoff={game?.gameType === 3} />
      ) : (<>
      <div className="md-header">
        <div>
          <span className="md-title">CAR vs {oppAbbr} — Matchup breakdown</span>
          {predStats.total > 0 && (
            <div className="md-track-record" >
              📊 {predStats.correct}/{predStats.total} correct ({predStats.pct}%)
            </div>
          )}
        </div>
      </div>

      {/* Series score if in playoffs */}
      {seriesEntry && (
        <div className="md-series-score">
          <span style={{ color: 'var(--red-bright)' }}>CAR {seriesEntry.carWins}</span>
          <span style={{ color: 'var(--text-dim)' }}> – </span>
          <span style={{ color: oppColor }}>{seriesEntry.oppWins} {oppAbbr}</span>
          <span className="md-series-label">in this series</span>
        </div>
      )}

      {/* Win prediction bar */}
      <div className="md-prediction">
        <div className="md-pred-label">
          <span>Predicted win probability</span>
          <InfoTip text={modelTooltip} position="above" />
          {odds && <span className="md-pred-source">Stats + {odds.book} odds</span>}
          {!odds && <span className="md-pred-source">Based on season stats</span>}
        </div>
        <div className="md-pred-bar">
          <div className="md-pred-fill car" style={{ width: `${carModelPct}%` }}>
            {carModelPct >= 20 && <span>{carModelPct}%</span>}
          </div>
          <div className="md-pred-fill opp" style={{ width: `${100 - carModelPct}%` }}>
            {(100 - carModelPct) >= 20 && <span>{100 - carModelPct}%</span>}
          </div>
        </div>
        <div className="md-pred-teams">
          <span style={{ color: 'var(--red-bright)' }}>CAR</span>
          <span style={{ color: oppColor }}>{oppAbbr}</span>
        </div>
      </div>

      {/* Predicted score — auto-saved when card opens (useEffect at top of component) */}
      <div className="md-score-pred">
        <div className="md-score-pred-label">Predicted score</div>
        <div className="md-score-pred-val">
          <span style={{color:'var(--red-bright)'}}>CAR {predCarScore}</span>
          <span style={{color:'var(--text-dim)'}}> – </span>
          <span style={{color:oppColor}}>{oppAbbr} {predOppScore}</span>
        </div>
        <div className="md-score-pred-subtext">Expected goals projection</div>
        <div className="md-pred-note">Prediction auto-saved · {predStats.total > 0 ? `${predStats.correct}/${predStats.total} correct (${predStats.pct}%)` : 'No results yet'}</div>
      </div>

      {/* EyeWall AI Analysis */}
      <PredictionAnalysis gameId={game?.id} oppAbbr={oppAbbr} oppColor={oppColor} />

      {/* Odds row */}
      {odds && (
        <div className="md-odds-row">
          <div className="md-odds-item">
            <span className="md-odds-team" style={{ color: 'var(--red-bright)' }}>CAR</span>
            <span className={`md-odds-val ${odds.carOdds < 0 ? 'fav' : 'dog'}`}>{fmtOdds(odds.carOdds)}</span>
            <span className="md-odds-implied">{carImplied}% implied</span>
          </div>
          <div className="md-odds-book">{odds.book}</div>
          <div className="md-odds-item right">
            <span className="md-odds-team" style={{ color: oppColor }}>{oppAbbr}</span>
            <span className={`md-odds-val ${odds.oppOdds < 0 ? 'fav' : 'dog'}`}>{fmtOdds(odds.oppOdds)}</span>
            <span className="md-odds-implied">{oppImplied}% implied</span>
          </div>
        </div>
      )}
      {!odds && (
        <div className="md-note">
          💡 Add a free Odds API key to <code>.env</code> to show live moneylines.
        </div>
      )}

      {/* Stat comparison */}
      <div className="md-stats" style={{ marginTop: 12 }}>
        {!isPlayoff_ && (
          <StatBar label="Points in standings"
            leftPct={Math.round((carPts/(carPts+oppPts||1))*100)}
            leftVal={`CAR ${carPts}`} rightVal={`${oppAbbr} ${oppPts}`} />
        )}
        <StatBar label="Goals for / game"
          leftPct={Math.round((carGpg/(carGpg+oppGpg||1))*100)}
          leftVal={`CAR ${carGpg.toFixed(2)}`} rightVal={`${oppAbbr} ${oppGpg.toFixed(2)}`} />
        <StatBar label="Goals against / game"
          leftPct={Math.round((oppGag/(carGag+oppGag||1))*100)}
          leftVal={`CAR ${carGag.toFixed(2)}`} rightVal={`${oppAbbr} ${oppGag.toFixed(2)}`}
          leftColor="green" />
        <StatBar label="Win rate"
          leftPct={Math.round((carWin/(carWin+oppWin||1))*100)}
          leftVal={`CAR ${(carWin*100).toFixed(0)}%`} rightVal={`${oppAbbr} ${(oppWin*100).toFixed(0)}%`}
          leftColor="green" />
        <StatBar label="PP% vs opp PK%"
          leftPct={Math.round((carPP/(carPP+(100-oppPK)||1))*100)}
          leftVal={`CAR PP ${carPP.toFixed(1)}%`} rightVal={`${oppAbbr} PK ${oppPK.toFixed(1)}%`}
          leftColor={carPP > (100-oppPK) ? 'green' : 'red'} />
      </div>

      {/* Edge checklist */}
      <div className="md-factors">
        {factors.map((f, i) => (
          <div key={i} className={`md-factor ${f.carEdge ? 'car-edge' : 'opp-edge'}`}>
            <span>{f.carEdge ? '✓' : '✗'}</span>
            <span>{f.label}</span>
            <span>{f.carEdge ? 'CAR' : oppAbbr}</span>
          </div>
        ))}
      </div>
      </>)}
    </div>
  );
}

// ── EyeWall AI Prediction Analysis ───────────────────────────
function PredictionAnalysis({ gameId, oppAbbr, oppColor }) {
  const [analysis,  setAnalysis]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [requested, setRequested] = useState(false);

  const workerUrl = import.meta.env.VITE_WORKER_URL;

  // Auto-load if already cached — no button press needed
  useEffect(() => {
    if (!gameId || !workerUrl) return;
    fetch(`${workerUrl}/cache/${encodeURIComponent(`prediction:${gameId}`)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.narrative) setAnalysis(d); })
      .catch(() => {});
  }, [gameId]);

  const fetchAnalysis = async () => {
    if (!workerUrl || !gameId) return;
    setLoading(true);
    setError(null);
    setRequested(true);
    try {
      const res  = await fetch(`${workerUrl}/prediction/analyze?gameId=${gameId}`);
      const data = await res.json();
      if (data.narrative) setAnalysis(data);
      else setError(data.error || 'Analysis unavailable');
    } catch {
      setError('Could not reach EyeWall AI');
    } finally {
      setLoading(false);
    }
  };

  if (!workerUrl) return null;

  return (
    <div className="md-ai-section">
      <div className="md-ai-header">
        <span className="md-ai-label">⚡ EyeWall AI</span>
        <InfoTip
          text="AI analysis synthesizes possession metrics, recent form, head-to-head record, and key matchup factors into a plain-English preview. Generated once and cached for all users."
          position="above"
        />
      </div>

      {analysis ? (
        <div className="md-ai-narrative">{analysis.narrative}</div>
      ) : loading ? (
        <div className="md-ai-loading">Analyzing matchup…</div>
      ) : error ? (
        <div className="md-ai-error">{error}</div>
      ) : (
        <button className="md-ai-btn" onClick={fetchAnalysis}>
          Get AI analysis
        </button>
      )}
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
