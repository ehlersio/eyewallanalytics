import React, { useState, useEffect, useRef } from 'react';
import { useFetch } from '../hooks/useFetch';
import { recordOutcome } from '../utils/predictionStore';
import {
  getRegularSeasonGames, getPlayoffGames, getPlayoffSeries, getStandings,
  buildCarPlayoffSummary, formatGameDate,
  getOpponent, isHomeGame, getCarScore, getOppScore,
  TEAM_COLORS, getNhlOdds, findGameOdds, extractMoneyline, oddsToImplied,
  TEAM_CONFIG,
} from '../utils/nhlApi';
import TeamLogo from '../components/TeamLogo';
import { CalendarView } from '../components/CalendarView';
import { GameStatsPopup } from '../components/GameStatsPopup';
import { SeriesCard, SortBar, GameCard } from '../components/GameCard';
import { MatchupDetail, computeWinPct } from '../components/MatchupDetail';
import './ScheduleView.css';

const TABS = ['Playoffs', 'Regular Season'];

export default function ScheduleView() {
  const [tab, setTab]                   = useState('Playoffs');
  const [selectedGame, setSelectedGame] = useState(null);
  const [popupGame, setPopupGame]       = useState(null);
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
  const { data: playoffRounds, loading: prLoading }  = useFetch(getPlayoffSeries);

  // 'Playoffs' is the default `tab` above so a genuinely-live playoff run
  // opens straight to it, but that default is a guess made before either
  // fetch above resolves. Once both have settled, if there's no real
  // playoff data (the same check that already hides the Playoffs tab
  // button, just below) and the user hasn't manually switched tabs
  // themselves, correct the guess to 'Regular Season' rather than leaving
  // the content pane stuck showing "Playoffs not yet started" under a tab
  // button that's no longer even in the list (e.g. right after an
  // intentional early season flip, once the new season's schedule is
  // published well before playoffs -- or any real offseason).
  useEffect(() => {
    if (poLoading || prLoading) return;
    const hasPlayoffData = (playoffRounds?.length > 0) || (playoffGames?.length > 0);
    if (!hasPlayoffData) setTab(t => t === 'Playoffs' ? 'Regular Season' : t);
  }, [poLoading, prLoading, playoffRounds, playoffGames]);

  // The NHL's own /standings/now redirects to whatever date it last actually
  // resolved standings for — which stays pinned to last season's final date
  // until real games exist for the new one (confirmed: still redirects to
  // 2026-04-17, last season's finale, mid-July 2026). Every row carries its
  // own `seasonId`, so compare that against our resolved season rather than
  // trusting "now" to mean "this season" — otherwise a full prior season's
  // 82-game record (real GF/GA, PP%/PK%, streak) silently feeds computeWinPct
  // and the auto-saved prediction as if it were this season's partial form.
  // Only reject on an EXPLICIT mismatch — an absent seasonId (e.g. a test
  // stub) isn't evidence of staleness, the real NHL API always includes it.
  const standingsAreStale = standings?.[0]?.seasonId != null
    && String(standings[0].seasonId) !== TEAM_CONFIG.season;

  const standingMap = {};
  if (!standingsAreStale) (standings || []).forEach(t => {
    // Key by the abbreviation — handle both { default: "CAR" } and plain "CAR"
    const abbr = t.teamAbbrev?.default || t.teamAbbrev;
    if (abbr) {
      standingMap[abbr] = t;
      standingMap[abbr.toLowerCase()] = t; // also store lowercase for safe lookup
    }
  });

  const carStanding    = standingMap[TEAM_CONFIG.abbr];

  // Auto-record prediction outcomes for any completed games
  useEffect(() => {
    const allGames = [...(regGames || []), ...(playoffGames || [])];
    const completed = allGames.filter(g =>
      ['OFF','FINAL','F','FINAL_OVERTIME','FINAL_SHOOTOUT'].includes(g.gameState)
    );
    completed.forEach(g => {
      const isHome    = g.homeTeam?.abbrev === TEAM_CONFIG.abbr;
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
        <h2 className="sched-title">{TEAM_CONFIG.season.slice(0,4)}–{TEAM_CONFIG.season.slice(6)} Schedule</h2>
        {carStanding && (
          <div className="sched-record">
            Regular season: <strong>{carStanding.wins}–{carStanding.losses}–{carStanding.otLosses}</strong>
            <span className="pts-badge">{carStanding.points} pts</span>
            <span className="div-badge">{carStanding.divisionName}</span>
          </div>
        )}
      </div>

      <div className="sched-tabs">
        {TABS
          // Hide the Playoffs tab entirely during offseason (no rounds scheduled yet)
          .filter(t => t !== 'Playoffs' || (playoffRounds?.length > 0 || (playoffGames?.length > 0)))
          .map(t => (
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
          playoffRounds={playoffRounds || []}
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
          oddsData={oddsData}
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

function PlayoffsTab({ loading, playoffGames, playoffSeries, playoffRounds, standingMap, carStanding, selectedGame, setSelectedGame, onGamePopup, oddsData }) {
  // Hooks must be called before any early returns
  const isCompletedGame = g => ['OFF','FINAL','F'].includes(g.gameState);

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

  const [collapsed, setCollapsed] = React.useState(() =>
    Object.fromEntries(roundNums.map(r => [r, r < maxRound]))
  );
  const toggleRound = r => setCollapsed(prev => ({ ...prev, [r]: !prev[r] }));

  if (loading) return <LoadingCards count={3} />;

  if (!playoffGames.length) {
    // League-wide rounds exist but this team has no games → missed playoffs
    if (playoffRounds.length > 0) {
      return (
        <div className="card empty-state">
          <div className="empty-icon">🏒</div>
          <div className="empty-title">{TEAM_CONFIG.abbr} did not qualify for the playoffs</div>
          <div className="empty-sub">Better luck next season. Go {TEAM_CONFIG.abbr}!</div>
        </div>
      );
    }
    // No league-wide rounds either → offseason, tab should already be hidden
    // but render a fallback just in case
    return (
      <div className="card empty-state">
        <div className="empty-icon">🏒</div>
        <div className="empty-title">Playoffs not yet started</div>
        <div className="empty-sub">Check back once the {TEAM_CONFIG.season.slice(0,4)}–{TEAM_CONFIG.season.slice(6)} playoffs begin.</div>
      </div>
    );
  }

  const ROUND_LABELS = {
    1: 'First Round', 2: 'Second Round',
    3: 'Conference Finals', 4: 'Stanley Cup Final',
  };

  // Build series map keyed by round
  const seriesByRound = {};
  playoffSeries.forEach(s => { seriesByRound[s.round] = s; });

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
                        cardFavoured={!completed ? (() => {
                          const wr = computeWinPct(carStanding, oppStanding, game, playoffSeries);
                          if (!wr) return null;
                          let pct = wr.pct;
                          if (ml) pct = Math.round(pct * 0.6 + oddsToImplied(ml.carOdds) * 0.4);
                          return { pct, favoured: pct >= 50 };
                        })() : null}
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



function RegularSeasonTab({ games, loading, standingMap, carStanding, selectedGame, setSelectedGame, onGamePopup, sortOrder, setSortOrder, oddsData }) {
  if (loading) return <LoadingCards count={4} />;

  if (!games.length) {
    const isOffseason = new Date() > new Date('2026-07-01');
    return (
      <div className="card empty-state">
        <div className="empty-icon">📅</div>
        <div className="empty-title">Regular season complete</div>
        <div className="empty-sub">
          {isOffseason
            ? 'Final record shown above. See you next season.'
            : 'Final record shown above. Playoffs are underway.'}
        </div>
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
                <TeamLogo abbr={TEAM_CONFIG.abbr} size={20} />
                <span className="result-abbr team-primary-text">{TEAM_CONFIG.abbr}</span>
                <span className="result-num team-primary-text">{carScore ?? '—'}</span>
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

        const gameOdds    = !completed ? findGameOdds(oddsData, game) : null;
        const winResult   = computeWinPct(carStanding, oppStanding, game, null);
        let blendedPct    = winResult?.pct ?? 50;
        if (gameOdds) {
          const carImplied = oddsToImplied(gameOdds.carOdds);
          blendedPct = Math.round(blendedPct * 0.6 + carImplied * 0.4);
        }
        const cardFavoured = winResult ? { pct: blendedPct, favoured: blendedPct >= 50 } : null;

        return (
          <div key={game.id}>
            <GameCard
              game={game}
              isCompleted={false}
              isSelected={isSelected}
              cardFavoured={cardFavoured}
              onClick={() => setSelectedGame(isSelected ? null : game)}
            />
            {isSelected && (
              <MatchupDetail game={game} oppStanding={oppStanding} carStanding={carStanding} odds={gameOdds} />
            )}
          </div>
        );
      })}
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