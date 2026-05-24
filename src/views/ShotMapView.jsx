import { useMemo, useState, useCallback } from 'react';
import { usePoll, useFetch } from '../hooks/useFetch';
import {
  getLiveGame, getGameDetail, getGameBoxscore, getGameRightRail,
  getRecentGames, getPlayoffGames, extractShotEvents,
  getCarScore, getOppScore, getOpponent, isHomeGame,
  getTeamStats, formatGameDate, getRoster, buildPlayerMap,
  bustLiveGameCache, TEAM_COLORS, GAME_TYPE,
} from '../utils/nhlApi';
import IceRink from '../components/IceRink';
import { GoalPopup, PenaltyPopup, WinPopup, useGameEvents } from '../components/GameEvents';
import { computeShotAttempts, computePDO, computePuckLuck, computeGSAx } from '../utils/advancedStats';
import InfoTip from '../components/InfoTip';
import { StatBar, MetCard, MetCardSkeleton } from '../components/StatBar';
import TeamLogo from '../components/TeamLogo';
import './ShotMapView.css';

const CAR_ABBR = 'CAR';

export default function ShotMapView() {
  // Live game polling
  const { data: liveGame }  = usePoll(getLiveGame, 30000);

  // Most recent completed game as fallback
  const { data: recentGames } = useFetch(getRecentGames);
  const lastGame  = recentGames?.[0] || null;
  const activeGame = liveGame || lastGame;
  const isLive     = !!liveGame;

  // Are we currently in playoffs? Check if any playoff games exist this season
  const { data: playoffGames } = useFetch(getPlayoffGames);
  const inPlayoffs = (playoffGames?.length || 0) > 0;

  // Determine context of the active game
  const activeIsPlayoff = activeGame?.gameType === GAME_TYPE.PLAYOFFS;

  // Play-by-play for shot map — poll every 20s during live games
  const gameId = activeGame?.id;
  const LIVE_POLL_MS = 20_000; // 20s — NHL updates PBP roughly every 15-30s

  const { data: pbp } = usePoll(
    () => {
      if (!gameId) return Promise.resolve(null);
      if (isLive) bustLiveGameCache(gameId); // bypass cache for live data
      return getGameDetail(gameId);
    },
    isLive ? LIVE_POLL_MS : 300_000, // poll fast when live, every 5min otherwise
    [gameId, isLive]
  );

  // Boxscore — poll same rate as PBP during live
  const { data: boxscore } = usePoll(
    () => gameId ? getGameBoxscore(gameId) : Promise.resolve(null),
    isLive ? LIVE_POLL_MS : 300_000,
    [gameId, isLive]
  );

  // Right-rail changes rarely — fetch once per game
  const { data: rightRail } = useFetch(
    () => gameId ? getGameRightRail(gameId) : Promise.resolve(null),
    [gameId]
  );

  // Team stats — we fetch once; we pick the right context (reg vs playoff) below
  const { data: teamStats, loading: statsLoading } = useFetch(() => getTeamStats(CAR_ABBR));

  // Roster for player name resolution in shot tooltips
  const { data: roster } = useFetch(() => getRoster(CAR_ABBR));

  const shotEvents = pbp ? extractShotEvents(pbp) : [];

  const opp        = activeGame ? getOpponent(activeGame) : null;
  const carScore   = activeGame ? getCarScore(activeGame) : null;
  const oppScore   = activeGame ? getOppScore(activeGame) : null;
  const oppAbbr    = opp?.abbrev;
  const oppColor   = TEAM_COLORS[oppAbbr] || 'var(--text-muted)';
  const gameHome   = activeGame ? isHomeGame(activeGame) : true;

  // ── Live situation: strength + on-ice players ─────────────
  // situationCode digits: [awayGoalie][awaySkaters][homeSkaters][homeGoalie]
  // e.g. "1551" = 5v5 | "1541" = home PP (home 5, away 4)
  const currentSituation = useMemo(() => {
    if (!pbp?.plays?.length) return null;
    const plays = [...pbp.plays];
    for (let i = plays.length - 1; i >= 0; i--) {
      const sc = plays[i].situationCode;
      if (sc && sc.length === 4) {
        const awaySkaters = parseInt(sc[1]);
        const homeSkaters = parseInt(sc[2]);
        const awayGoalie  = sc[0] === '1';
        const homeGoalie  = sc[3] === '1';
        const carSkaters  = gameHome ? homeSkaters : awaySkaters;
        const oppSkaters  = gameHome ? awaySkaters : homeSkaters;
        const carGoalie   = gameHome ? homeGoalie  : awayGoalie;
        let strength = 'EV';
        if (carSkaters > oppSkaters)                               strength = 'PP';
        else if (carSkaters < oppSkaters)                          strength = 'SH';
        else if (carSkaters === oppSkaters && carSkaters < 5)      strength = '4v4';
        if (!carGoalie) strength = `${strength} (EN)`;
        return { carSkaters, oppSkaters, strength, code: sc };
      }
    }
    return null;
  }, [pbp, gameHome]);

  // On-ice players from live boxscore situation
  const onIcePlayers = useMemo(() => {
    if (!boxscore?.situation || !pbp) return null;
    const rawMap = buildPlayerMap(pbp);
    const strMap = {};
    Object.entries(rawMap).forEach(([k, v]) => { strMap[String(k)] = v; });
    const pName = id => { const n = strMap[String(id)]; return n?.trim() || null; };
    const sit    = boxscore.situation;
    const carKey = gameHome ? 'homeTeam' : 'awayTeam';
    const oppKey = gameHome ? 'awayTeam' : 'homeTeam';
    const toPlayers = arr => (arr || []).map(p => ({
      name:     pName(p.playerId) || `#${p.sweaterNumber}`,
      number:   p.sweaterNumber,
      position: p.positionCode,
    }));
    return {
      car: toPlayers(sit[carKey]?.onIce),
      opp: toPlayers(sit[oppKey]?.onIce),
    };
  }, [boxscore, pbp, gameHome]);

  // ── Game event animations ────────────────────────────────
  const playerMapForEvents = pbp ? buildPlayerMap(pbp) : {};
  const strMapForEvents = {};
  Object.entries(playerMapForEvents).forEach(([k,v]) => { strMapForEvents[String(k)] = v; });
  const { goalPopup, clearGoal, penaltyPopup, clearPenalty, winPopup, clearWin } =
    useGameEvents(pbp, isLive, strMapForEvents, gameHome);

  // ── Compute game-level metrics from right-rail ──────────────
  const teamGameStats = rightRail?.teamGameStats || [];
  function getGameStat(category) {
    const row = teamGameStats.find(r =>
      r.category?.toLowerCase().replace(/[^a-z]/g, '').includes(category.toLowerCase().replace(/[^a-z]/g, ''))
    );
    if (!row) return { car: null, opp: null };
    return {
      car: gameHome ? row.homeValue : row.awayValue,
      opp: gameHome ? row.awayValue : row.homeValue,
    };
  }

  // Stat drill-down state
  const [drillStat, setDrillStat] = useState(null); // { label, rows }

  // Build drill-down data from play-by-play
  const buildDrillDown = useCallback((statKey) => {
    if (!pbp?.plays) return;
    const plays = pbp.plays;
    const rosterMap = roster || {};
    const carId = 12; // CAR team ID
    const oppId = opp?.id || null;

    // Build a string-keyed map from rosterSpots so lookups always work
    // regardless of whether event IDs come back as numbers or strings
    const rawMap = buildPlayerMap(pbp); // keyed by playerId (number or string)
    const playerMap = {};
    Object.entries(rawMap).forEach(([k, v]) => { playerMap[String(k)] = v; });
    const pName = (id) => {
      if (!id) return '—';
      const name = playerMap[String(id)];
      return name && name.trim() ? name : `#${id}`;
    };

    const periodLabel = n => n === 4 ? 'OT' : n === 5 ? 'SO' : `P${n}`;

    if (statKey === 'sog') {
      // Shots on goal by CAR
      const shots = plays.filter(p =>
        (p.typeDescKey === 'shot-on-goal' || p.typeDescKey === 'goal') &&
        (p.details?.eventOwnerTeamId === carId)
      );
      const byPlayer = {};
      shots.forEach(p => {
        const id = p.details?.shootingPlayerId || p.details?.scoringPlayerId;
        const per = periodLabel(p.periodDescriptor?.number);
        const key = id || 'unknown';
        if (!byPlayer[key]) byPlayer[key] = { name: pName(id), periods: {}, total: 0 };
        byPlayer[key].periods[per] = (byPlayer[key].periods[per] || 0) + 1;
        byPlayer[key].total++;
      });
      const rows = Object.values(byPlayer).sort((a, b) => b.total - a.total);
      setDrillStat({ label: 'CAR Shots on Goal', rows, type: 'shots' });

    } else if (statKey === 'hits') {
      const hits = plays.filter(p =>
        p.typeDescKey === 'hit' && p.details?.hittingPlayerId != null &&
        p.details?.eventOwnerTeamId === carId
      );
      const byPlayer = {};
      hits.forEach(p => {
        const id  = p.details?.hittingPlayerId;
        const per = periodLabel(p.periodDescriptor?.number);
        const key = id || 'unknown';
        if (!byPlayer[key]) byPlayer[key] = { name: pName(id), periods: {}, total: 0 };
        byPlayer[key].periods[per] = (byPlayer[key].periods[per] || 0) + 1;
        byPlayer[key].total++;
      });
      const rows = Object.values(byPlayer).sort((a, b) => b.total - a.total);
      setDrillStat({ label: 'CAR Hits', rows, type: 'hits' });

    } else if (statKey === 'faceoff') {
      const fos = plays.filter(p => p.typeDescKey === 'faceoff');
      const byPlayer = {};
      fos.forEach(p => {
        const winnerId = p.details?.winningPlayerId;
        const loserId  = p.details?.losingPlayerId;
        const per = periodLabel(p.periodDescriptor?.number);
        const winTeam = p.details?.eventOwnerTeamId;
        // Only count CAR players
        const carPlayerId = winTeam === carId ? winnerId : loserId;
        const carWon      = winTeam === carId;
        if (!carPlayerId) return;
        const key = carPlayerId;
        if (!byPlayer[key]) byPlayer[key] = { name: pName(carPlayerId), won: {}, lost: {}, totalWon: 0, totalLost: 0 };
        if (carWon) {
          byPlayer[key].won[per]  = (byPlayer[key].won[per]  || 0) + 1;
          byPlayer[key].totalWon++;
        } else {
          byPlayer[key].lost[per] = (byPlayer[key].lost[per] || 0) + 1;
          byPlayer[key].totalLost++;
        }
      });
      const rows = Object.values(byPlayer)
        .map(r => ({ ...r, total: r.totalWon + r.totalLost }))
        .sort((a, b) => b.total - a.total);
      setDrillStat({ label: 'CAR Faceoffs', rows, type: 'faceoff' });

    } else if (statKey === 'pp') {
      // Power play goals and opportunities from plays
      const ppGoals = plays.filter(p =>
        p.typeDescKey === 'goal' &&
        p.details?.eventOwnerTeamId === carId &&
        p.details?.situationCode?.toString().startsWith('1')
      );
      const rows = ppGoals.map(p => ({
        name: pName(p.details?.scoringPlayerId),
        period: periodLabel(p.periodDescriptor?.number),
        assists: [p.details?.assist1PlayerId, p.details?.assist2PlayerId]
          .filter(Boolean).map(pName).filter(n => n !== 'Unknown'),
        total: 1,
        periods: {},
      }));
      setDrillStat({ label: 'CAR Power Play Goals', rows, type: 'ppgoals' });
    }
  }, [pbp, roster, opp]);

  const gameSog      = getGameStat('sog');
  const gameHits     = getGameStat('hits');
  const gameFaceoff  = getGameStat('faceoff');
  const gamePP       = getGameStat('powerPlay');

  // ── Shot danger breakdown from coordinate data ──────────────
  const dangerCounts = useMemo(() => {
    const carShots = shotEvents.filter(e => e.isCanes);
    const dist = e => Math.sqrt(Math.pow(Math.abs(e.x) - 89, 2) + e.y * e.y);
    const hiShots  = carShots.filter(e => dist(e) < 15);
    const medShots = carShots.filter(e => dist(e) >= 15 && dist(e) < 30);
    const loShots  = carShots.filter(e => dist(e) >= 30);
    return {
      hi: hiShots.length, hiShots,
      med: medShots.length, medShots,
      lo: loShots.length, loShots,
      total: carShots.length,
    };
  }, [shotEvents]);

  // ── Danger zone drill-down builder ─────────────────────────
  const buildDangerDrill = useCallback((zone) => {
    if (!dangerCounts.hiShots) return;
    const periodLabel = n => n === 4 ? 'OT' : n === 5 ? 'SO' : `P${n}`;
    const shotSets = {
      hi:  { shots: dangerCounts.hiShots,  label: '🔴 High Danger Shots (<15 ft)' },
      med: { shots: dangerCounts.medShots, label: '🟡 Medium Danger Shots (15–30 ft)' },
      lo:  { shots: dangerCounts.loShots,  label: '⚪ Low Danger Shots (>30 ft)' },
    };
    const { shots, label } = shotSets[zone];
    // Shot events already have shooterName resolved from rosterSpots
    const byPlayer = {};
    shots.forEach(e => {
      const name = e.shooterName || '—';
      const per  = periodLabel(e.period);
      if (!byPlayer[name]) byPlayer[name] = { name, periods: {}, total: 0 };
      byPlayer[name].periods[per] = (byPlayer[name].periods[per] || 0) + 1;
      byPlayer[name].total++;
    });
    const rows = Object.values(byPlayer).sort((a, b) => b.total - a.total);
    setDrillStat({ label, rows, type: 'shots' });
  }, [dangerCounts]);

  // ── Top CAR scorers from boxscore ────────────────────────────
  const pbgKey     = gameHome ? 'homeTeam' : 'awayTeam';
  const playerByGame = boxscore?.playerByGameStats?.[pbgKey];
  const allSkaters = [
    ...(playerByGame?.forwards   || []),
    ...(playerByGame?.defensemen || []),
  ].sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goals || 0) - (a.goals || 0));
  const topScorers = allSkaters.filter(p => (p.points || 0) > 0).slice(0, 4);

  // ── Goalies ──────────────────────────────────────────────────
  // Pick the goalie who actually played — filter by toi > 0 or shotsAgainst > 0.
  // The boxscore lists all rostered goalies; backup who didn't dress has 0s.
  const oppKey     = gameHome ? 'awayTeam' : 'homeTeam';

  function activeGoalie(goalies = []) {
    // Prefer the one with shots against > 0, then toi, then fall back to first
    const played = goalies.filter(g =>
      (g.shotsAgainst != null && g.shotsAgainst > 0) ||
      (g.toi && g.toi !== '00:00' && g.toi !== '0:00')
    );
    return played[0] || null;
  }

  const carGoalie = activeGoalie(boxscore?.playerByGameStats?.[pbgKey]?.goalies || []);
  const oppGoalie = activeGoalie(boxscore?.playerByGameStats?.[oppKey]?.goalies  || []);

  // ── Context label for top metrics ───────────────────────────
  // Use playoff team stats if in playoffs, otherwise regular season
  const ctxLabel    = inPlayoffs ? 'Playoff avg' : 'Season avg';
  // teamStats comes from standings which is always current reg season
  // For now we show reg season avg with a label — future: fetch playoff-specific team stats

  // ── Period scoring ───────────────────────────────────────────
  const scoring    = boxscore?.summary?.scoring || [];
  const periods    = scoring.map((p, i) => {
    const num = p.period || i + 1;
    const label = num <= 3 ? `P${num}` : num === 4 ? 'OT' : `OT${num - 3}`;
    let carG = 0, oppG = 0;
    (p.goals || []).forEach(g => {
      if (g.teamAbbrev?.default === CAR_ABBR) carG++;
      else oppG++;
    });
    return { label, carG, oppG };
  });

  return (
    <>
    <div className="page">

      {/* ── Score bar ── */}
      <div className="score-card card">
        {activeGame ? (
          <div className="score-inner">
            {/* CAR side */}
            <div className="score-team-wrap">
              <div className="score-team">
                <TeamLogo abbr="CAR" size={30} />
                <span className="score-abbr red">CAR</span>
                <span className="score-num red">{carScore ?? '—'}</span>
              </div>
              {/* CAR PP indicator */}
              {isLive && currentSituation?.strength === 'PP' && (
                <div className="pp-indicator car-pp">
                  ⚡ Power Play
                  {pbp?.clock?.secondsRemaining != null && (
                    <span className="pp-time"> · {Math.floor(pbp.clock.secondsRemaining/60)}:{String(pbp.clock.secondsRemaining%60).padStart(2,'0')}</span>
                  )}
                </div>
              )}
            </div>

            {/* Center — period/clock/state */}
            <div className="score-center">
              {isLive ? (
                <>
                  {/* Intermission display */}
                  {pbp?.clock?.inIntermission ? (
                    <>
                      <div className="score-period">
                        {pbp.periodDescriptor?.number === 1 ? '1st' :
                         pbp.periodDescriptor?.number === 2 ? '2nd' : '3rd'} Intermission
                      </div>
                      <div className="score-clock">{pbp.clock.timeRemaining}</div>
                    </>
                  ) : (
                    <>
                      <div className="score-period">
                        {pbp?.periodDescriptor
                          ? (pbp.periodDescriptor.periodType === 'REG'
                              ? `P${pbp.periodDescriptor.number}`
                              : pbp.periodDescriptor.periodType || `P${pbp.periodDescriptor.number}`)
                          : '—'}
                      </div>
                      <div className="score-clock">{pbp?.clock?.timeRemaining || '—'}</div>
                    </>
                  )}
                  <div className="score-state pill pill-red" style={{marginTop:4}}>🔴 LIVE</div>
                </>
              ) : (
                <>
                  <div className="score-period">Final</div>
                  <div className="score-state" style={{fontSize:10,color:'var(--text-dim)'}}>
                    {activeIsPlayoff ? '🏒 Playoff · ' : ''}{formatGameDate(activeGame.gameDate)}
                  </div>
                </>
              )}
            </div>

            {/* OPP side */}
            <div className="score-team-wrap">
              <div className="score-team">
                <span className="score-num muted">{oppScore ?? '—'}</span>
                <span className="score-abbr muted">{oppAbbr}</span>
                <TeamLogo abbr={oppAbbr} size={30} color={oppColor} />
              </div>
              {/* Opponent PP indicator */}
              {isLive && currentSituation?.strength === 'SH' && (
                <div className="pp-indicator opp-pp">
                  ⚡ {oppAbbr} Power Play
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="no-game-msg">
            <span>Loading game data…</span>
          </div>
        )}
      </div>

      {/* ── Game metrics row ── */}
      <div className="metrics-grid">
        <MetCard
          label="Shots on goal"
          value={gameSog.car ?? '—'}
          sub={gameSog.opp != null ? `Opp ${gameSog.opp}` : 'this game'}
          color={gameSog.car > gameSog.opp ? 'green' : null}
          onClick={pbp ? () => buildDrillDown('sog') : null}
        />
        <MetCard
          label="Hits"
          value={gameHits.car ?? '—'}
          sub={gameHits.opp != null ? `Opp ${gameHits.opp}` : 'this game'}
          color={gameHits.car > gameHits.opp ? 'green' : null}
          onClick={pbp ? () => buildDrillDown('hits') : null}
        />
        <MetCard
          label="Faceoff %"
          value={gameFaceoff.car != null
            ? `${(parsePct(gameFaceoff.car)).toFixed(1)}%`
            : '—'}
          sub="this game"
          color={parsePct(gameFaceoff.car) > 50 ? 'green' : null}
          onClick={pbp ? () => buildDrillDown('faceoff') : null}
        />
        <MetCard
          label={inPlayoffs ? 'PP % (season)' : 'PP %'}
          value={teamStats?.powerPlayPct ? `${(teamStats.powerPlayPct * 100).toFixed(1)}%` : '—'}
          sub={ctxLabel}
          color="green"
          onClick={pbp ? () => buildDrillDown('pp') : null}
        />
      </div>

      {/* ── Shot Volume + Corsi/Fenwick/PDO ── */}
      {pbp?.plays && (
        <AdvancedGamePanel pbp={pbp} gameHome={gameHome} isLive={isLive} boxscore={boxscore} />
      )}

      {/* ── Context label — reg season vs playoff ── */}
      <div className="context-banner">
        <span className={`context-pill ${inPlayoffs ? 'playoffs' : 'regular'}`}>
          {inPlayoffs ? '🏒 Playoffs' : '📅 Regular season'}
        </span>
        <span className="context-game-label">
          {activeIsPlayoff ? 'Playoff game' : 'Regular season game'}
          {activeGame ? ` · ${isHomeGame(activeGame) ? 'Home' : 'Away'} vs ${oppAbbr}` : ''}
        </span>
      </div>

      <div className="two-col">
        {/* ── Left: rink + event log ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="sec-label">Shot map</div>
            <IceRink events={shotEvents} roster={roster || {}} />
          </div>

          {/* On-ice players — only shown during live games */}
          {isLive && onIcePlayers && onIcePlayers.car?.length > 0 && (
            <OnIcePanel
              car={onIcePlayers.car}
              opp={onIcePlayers.opp}
              oppAbbr={oppAbbr}
              situation={currentSituation}
            />
          )}

          {/* Event log — live only */}
          {isLive && pbp?.plays?.length > 0 && (
            <div className="card">
              <div className="sec-label">Recent events</div>
              <EventLog plays={pbp.plays} playerMap={buildPlayerMap(pbp)} />
            </div>
          )}
        </div>

        {/* ── Right: game summary panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Period by period */}
          {periods.length > 0 && (
            <div className="card">
              <div className="sec-label">Scoring by period</div>
              <div className="period-grid">
                <div className="period-grid-header">
                  <span />
                  {periods.map(p => <span key={p.label}>{p.label}</span>)}
                  <span>T</span>
                </div>
                <div className="period-grid-row car">
                  <span>CAR</span>
                  {periods.map(p => <span key={p.label}>{p.carG}</span>)}
                  <span className="period-total">{carScore ?? '—'}</span>
                </div>
                <div className="period-grid-row">
                  <span style={{color:'var(--text-muted)'}}>{oppAbbr}</span>
                  {periods.map(p => <span key={p.label}>{p.oppG}</span>)}
                  <span className="period-total">{oppScore ?? '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Shot danger breakdown — derived from shot map coords */}
          {dangerCounts.total > 0 && (
            <div className="card">
              <div className="sec-label">CAR shot quality</div>
              <div className="danger-grid">
                <div className="danger-cell high clickable" onClick={() => buildDangerDrill('hi')}>
                  <div className="danger-num">{dangerCounts.hi}</div>
                  <div className="danger-label">🔴 High danger</div>
                  <div className="danger-sub">&lt;15 ft</div>
                </div>
                <div className="danger-cell med clickable" onClick={() => buildDangerDrill('med')}>
                  <div className="danger-num">{dangerCounts.med}</div>
                  <div className="danger-label">🟡 Medium</div>
                  <div className="danger-sub">15–30 ft</div>
                </div>
                <div className="danger-cell lo clickable" onClick={() => buildDangerDrill('lo')}>
                  <div className="danger-num">{dangerCounts.lo}</div>
                  <div className="danger-label">⚪ Low</div>
                  <div className="danger-sub">&gt;30 ft</div>
                </div>
              </div>
            </div>
          )}

          {/* Top point-getters in this game */}
          {topScorers.length > 0 && (
            <div className="card">
              <div className="sec-label">CAR scoring — this game</div>
              {topScorers.map((p, i) => (
                <div key={i} className="scorer-row">
                  <span className="scorer-name">{p.name?.default || `#${p.sweaterNumber}`}</span>
                  <div className="scorer-stats">
                    {p.goals > 0 && <span className="scorer-chip goal">{p.goals}G</span>}
                    {p.assists > 0 && <span className="scorer-chip assist">{p.assists}A</span>}
                    <span className="scorer-chip pts">{p.points}PTS</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Goalie comparison */}
          {(carGoalie || oppGoalie) && (
            <div className="card">
              <div className="sec-label">Goalies</div>
              {carGoalie && (
                <GoalieRow
                  name={carGoalie.name?.default || `#${carGoalie.sweaterNumber}`}
                  abbr="CAR"
                  saves={carGoalie.saves}
                  shotsAgainst={carGoalie.shotsAgainst}
                  savePctg={carGoalie.savePctg}
                  color="var(--red-bright)"
                />
              )}
              {oppGoalie && (
                <GoalieRow
                  name={oppGoalie.name?.default || `#${oppGoalie.sweaterNumber}`}
                  abbr={oppAbbr}
                  saves={oppGoalie.saves}
                  shotsAgainst={oppGoalie.shotsAgainst}
                  savePctg={oppGoalie.savePctg}
                  color={oppColor}
                />
              )}
            </div>
          )}

          {/* Team stat bars — game level */}
          {teamGameStats.length > 0 && (
            <div className="card">
              <div className="sec-label">Team stats — this game</div>
              <div className="gm-stat-header">
                <span style={{color:'var(--red-bright)'}}>CAR</span>
                <span />
                <span style={{color:oppColor}}>{oppAbbr}</span>
              </div>
              {teamGameStats.slice(0, 6).map((row, i) => {
                const carVal = gameHome ? row.homeValue : row.awayValue;
                const oppVal = gameHome ? row.awayValue : row.homeValue;
                // Detect percentage stats (faceoff %, PP %) — format as % if raw is a decimal
                const catKey = (row.category || '').toLowerCase().replace(/[^a-z]/g, '');
                const isPct  = catKey.includes('pct') || catKey.includes('pctg');
                const fmtVal = v => {
                  if (v == null) return '—';
                  const n = parseFloat(v);
                  if (isNaN(n)) return v;
                  if (isPct) return n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`;
                  return v;
                };
                const carN   = isPct ? parsePct(carVal) : (parseFloat(String(carVal).replace('%','')) || 0);
                const oppN   = isPct ? parsePct(oppVal) : (parseFloat(String(oppVal).replace('%','')) || 0);
                const total  = carN + oppN || 1;
                return (
                  <div key={i} className="gm-stat-row">
                    <span className="gm-stat-val red">{fmtVal(carVal)}</span>
                    <div className="gm-stat-mid">
                      <div className="gm-stat-label">{humanLabel(row.category)}</div>
                      <div className="dual-bar">
                        <div className="fill-red"  style={{width:`${Math.round(carN/total*100)}%`}} />
                        <div className="fill-blue" style={{width:`${Math.round(oppN/total*100)}%`}} />
                      </div>
                    </div>
                    <span className="gm-stat-val muted">{fmtVal(oppVal)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    {drillStat     && <StatDrillPopup drillStat={drillStat} onClose={() => setDrillStat(null)} />}
    {goalPopup     && <GoalPopup    goal={goalPopup}       onDismiss={clearGoal}    />}
    {penaltyPopup  && <PenaltyPopup penalty={penaltyPopup} onDismiss={clearPenalty} />}
    {winPopup      && <WinPopup     score={winPopup.score} onDismiss={clearWin}     />}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────

function GoalieRow({ name, abbr, saves, shotsAgainst, savePctg, color }) {
  const svPct = savePctg != null
    ? (savePctg <= 1 ? savePctg.toFixed(3) : (savePctg / 100).toFixed(3))
    : '—';
  const gsax = computeGSAx(shotsAgainst, saves);
  return (
    <div className="goalie-card">
      <div className="goalie-header">
        <span className="goalie-abbr" style={{color}}>{abbr}</span>
        <span className="goalie-name">{name}</span>
      </div>
      <div className="goalie-stats-grid">
        <div className="goalie-stat-col">
          <span className="goalie-stat-label">SV/SA</span>
          <span className="goalie-stat-val">{saves ?? '—'}/{shotsAgainst ?? '—'}</span>
        </div>
        <div className="goalie-stat-col">
          <span className="goalie-stat-label">SV%</span>
          <span className="goalie-stat-val goalie-svpct">{svPct}</span>
        </div>
        {gsax && (
          <div className="goalie-stat-col">
            <span className="goalie-stat-label">
              GSAx <InfoTip text={gsax.note} />
            </span>
            <span className="goalie-stat-val" style={{color: gsax.color}}>{gsax.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── On-Ice Players Panel ─────────────────────────────────────
function OnIcePanel({ car, opp, oppAbbr, situation }) {
  const fwd  = p => ['C','L','R','F'].includes(p.position);
  const def  = p => p.position === 'D';
  const goal = p => p.position === 'G';

  const Row = ({ players, label }) => {
    if (!players.length) return null;
    return (
      <div className="onice-row">
        <span className="onice-pos">{label}</span>
        <div className="onice-names">
          {players.map((p, i) => (
            <span key={i} className={`onice-chip ${goal(p) ? 'onice-goalie' : ''}`}>
              {p.name.split(' ').pop()}{/* Last name only for space */}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const isPP  = situation?.strength?.startsWith('PP');
  const isSH  = situation?.strength?.startsWith('SH');

  return (
    <div className="card onice-card">
      <div className="onice-header">
        <div className="sec-label" style={{marginBottom:0}}>On Ice</div>
        {situation && (
          <span className={`onice-strength ${isPP ? 'strength-pp' : isSH ? 'strength-sh' : 'strength-ev'}`}>
            {situation.strength} {situation.carSkaters}v{situation.oppSkaters}
          </span>
        )}
      </div>

      <div className="onice-team">
        <span className="onice-team-label car-label">CAR</span>
        <div className="onice-lines">
          <Row players={car.filter(fwd)}  label="F" />
          <Row players={car.filter(def)}  label="D" />
          <Row players={car.filter(goal)} label="G" />
        </div>
      </div>

      <div className="onice-team onice-opp">
        <span className="onice-team-label">{oppAbbr}</span>
        <div className="onice-lines">
          <Row players={opp.filter(fwd)}  label="F" />
          <Row players={opp.filter(def)}  label="D" />
          <Row players={opp.filter(goal)} label="G" />
        </div>
      </div>
    </div>
  );
}

// ── Event Log ─────────────────────────────────────────────────
function EventLog({ plays, playerMap = {} }) {
  const pName = id => {
    if (!id) return null;
    const n = playerMap[String(id)];
    return n && n.trim() ? n : null;
  };
  const periodLabel = n => {
    if (!n) return '—';
    return n === 4 ? 'OT' : n === 5 ? 'SO' : `P${n}`;
  };

  const relevant = [...plays]
    .reverse()
    .filter(p => ['goal','shot-on-goal','penalty','hit','blocked-shot'].includes(p.typeDescKey))
    .slice(0, 12);

  const typeStyle = {
    'goal':         'log-goal',
    'shot-on-goal': 'log-shot',
    'penalty':      'log-pen',
    'hit':          'log-hit',
    'blocked-shot': 'log-block',
  };

  const typeLabel = {
    'goal':         'GOAL',
    'shot-on-goal': 'SHOT',
    'penalty':      'PENALTY',
    'hit':          'HIT',
    'blocked-shot': 'BLOCK',
  };

  return (
    <div className="event-log">
      {relevant.map((p, i) => {
        const d    = p.details || {};
        const per  = periodLabel(p.periodDescriptor?.number);
        const time = p.timeInPeriod || '';
        const type = p.typeDescKey;

        let headline = null;
        let sub      = null;

        if (type === 'goal') {
          const scorer  = pName(d.scoringPlayerId);
          const a1      = pName(d.assist1PlayerId);
          const a2      = pName(d.assist2PlayerId);
          const assists = [a1, a2].filter(Boolean);
          headline = scorer || '—';
          sub = assists.length ? `Assists: ${assists.join(', ')}` : 'Unassisted';
        } else if (type === 'shot-on-goal') {
          headline = pName(d.shootingPlayerId) || '—';
          sub = d.shotType ? d.shotType : null;
        } else if (type === 'penalty') {
          const committed = pName(d.committedByPlayerId);
          const drawn     = pName(d.drawnByPlayerId);
          headline = committed || '—';
          const mins = d.duration != null ? `${d.duration} min` : '';
          const desc = d.descKey ? d.descKey.replace(/-/g, ' ') : '';
          sub = [mins, desc, drawn ? `drawn by ${drawn}` : ''].filter(Boolean).join(' · ');
        } else if (type === 'hit') {
          const hitter = pName(d.hittingPlayerId);
          const hittee = pName(d.hitteePlayerId);
          headline = hitter || '—';
          sub = hittee ? `hit ${hittee}` : null;
        } else if (type === 'blocked-shot') {
          const blocker  = pName(d.blockingPlayerId);
          const shooter  = pName(d.shootingPlayerId);
          headline = blocker || '—';
          sub = shooter ? `blocked ${shooter}` : null;
        }

        return (
          <div key={i} className="log-row">
            <div className="log-left">
              <span className="log-time">{per} {time}</span>
              <span className={`log-badge ${typeStyle[type] || ''}`}>
                {typeLabel[type] || type}
              </span>
            </div>
            <div className="log-right">
              {headline && <span className="log-player">{headline}</span>}
              {sub      && <span className="log-sub">{sub}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── Stat Drill-Down Popup ───────────────────────────────────
function StatDrillPopup({ drillStat, onClose }) {
  if (!drillStat) return null;
  const periods = ['P1', 'P2', 'P3', 'OT'];

  return (
    <div className="drill-overlay" onClick={onClose}>
      <div className="drill-popup" onClick={e => e.stopPropagation()}>
        <div className="drill-header">
          <span className="drill-title">{drillStat.label}</span>
          <button className="drill-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drill-body">
          {drillStat.rows.length === 0 && (
            <div className="drill-empty">No data available for this game.</div>
          )}

          {drillStat.type === 'faceoff' && (
            <div className="drill-table">
              <div className="drill-col-header fo">
                <span>Player</span><span>Won</span><span>Lost</span><span>Win%</span>
              </div>
              {drillStat.rows.map((r, i) => (
                <div key={i}>
                  <div className="drill-row-grid fo">
                    <span className="drill-name">{r.name}</span>
                    <span className="drill-val green">{r.totalWon}</span>
                    <span className="drill-val red">{r.totalLost}</span>
                    <span className="drill-val">{r.total > 0 ? `${((r.totalWon/r.total)*100).toFixed(0)}%` : '—'}</span>
                  </div>
                  {periods.some(p => r.won[p] || r.lost[p]) && (
                    <div className="drill-periods" style={{padding: '0 16px 8px'}}>
                      {periods.filter(p => r.won[p] || r.lost[p]).map(p => (
                        <span key={p} className="period-chip">
                          {p}: <span className="c-green">{r.won[p]||0}W</span>/<span className="c-red">{r.lost[p]||0}L</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {drillStat.type === 'ppgoals' && (
            <div className="drill-table">
              {drillStat.rows.map((r, i) => (
                <div key={i} className="drill-row">
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span className="drill-name">{r.name}</span>
                    <span className="drill-period-badge">{r.period}</span>
                  </div>
                  {r.assists.length > 0 && (
                    <div className="drill-assists">Assists: {r.assists.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(drillStat.type === 'shots' || drillStat.type === 'hits') && (
            <div className="drill-table">
              <div className="drill-col-header shots">
                <span>Player</span><span>P1</span><span>P2</span><span>P3</span><span>OT</span><span>Total</span>
              </div>
              {drillStat.rows.map((r, i) => (
                <div key={i} className="drill-row-grid shots">
                  <span className="drill-name">{r.name}</span>
                  {periods.map(p => (
                    <span key={p} className={`drill-val ${r.periods[p] ? '' : 'dim'}`}>
                      {r.periods[p] || '—'}
                    </span>
                  ))}
                  <span className="drill-val total">{r.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Advanced Game Panel (Corsi / Fenwick / PDO / Puck Luck) ──
function AdvancedGamePanel({ pbp, gameHome, isLive, boxscore }) {
  const plays = pbp?.plays || [];
  const sa    = computeShotAttempts(plays);
  const pdo   = computePDO(plays);
  const luck  = computePuckLuck(plays);

  const Row = ({ label, car, opp, help }) => {
    const tot = (Number(car)||0) + (Number(opp)||0) || 1;
    const carN = Number(car)||0, oppN = Number(opp)||0;
    return (
      <div className="sv-row">
        <div className="sv-label-wrap"><span className="sv-label">{label}</span><InfoTip text={help} /></div>
        <span className="sv-num red">{car ?? '—'}</span>
        <div className="sv-bar-wrap">
          <div className="sv-fill red"   style={{width:`${Math.round(carN/tot*100)}%`}} />
          <div className="sv-fill muted" style={{width:`${Math.round(oppN/tot*100)}%`}} />
        </div>
        <span className="sv-num muted">{opp ?? '—'}</span>
      </div>
    );
  };

  const StatChip = ({ label, value, color, help }) => (
    <div className="adv-chip" onClick={e => e.stopPropagation()}>
      <div style={{display:'flex',alignItems:'center',gap:2}}><span className="adv-chip-label">{label}</span><InfoTip text={help} /></div>
      <span className="adv-chip-val" style={{color}}>{value}</span>
    </div>
  );

  return (
    <div className="card shot-volume-section">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <div className="sec-label" style={{marginBottom:0}}>Shot Attempts</div>
        <span style={{fontSize:9,color:'var(--text-dim)',textAlign:'right'}}>
          Corsi = all attempts · Fenwick excludes blocks
        </span>
      </div>

      <div className="sv-header">
        <span className="sv-team red">CAR</span>
        <span className="sv-diff" style={{color: sa.corsiDiff >= 0 ? 'var(--green)' : 'var(--red-bright)'}}>
          {sa.corsiDiff >= 0 ? '+' : ''}{sa.corsiDiff} CF
        </span>
        <span className="sv-team muted">OPP</span>
      </div>

      <div className="sv-wrap">
        <Row label="Corsi (CF)"
             car={sa.carCorsi} opp={sa.oppCorsi}
             help="All shot attempts: goals + shots + misses + blocks. True possession proxy." />
        <Row label="Fenwick (FF)"
             car={sa.carFenwick} opp={sa.oppFenwick}
             help="Shot attempts excluding blocked shots. More predictive than Corsi." />
        <Row label="Shots on Goal"
             car={sa.car.goals + sa.car.sog} opp={sa.opp.goals + sa.opp.sog}
             help="Shots that reached the goalie (goals + saves)" />
        <Row label="Missed Shots"
             car={sa.car.missed} opp={sa.opp.missed}
             help="Attempts that missed the net" />
        <Row label="Blocked Shots"
             car={sa.car.blocked} opp={sa.opp.blocked}
             help="Attempts blocked by a skater before reaching the goalie" />
      </div>

      {/* Corsi%, Fenwick%, PDO, Puck Luck chips */}
      <div className="adv-chips-row">
        <StatChip
          label="CF%"
          value={`${sa.corsiForPct}%`}
          color={sa.corsiForPct >= 50 ? 'var(--green)' : 'var(--red-bright)'}
          help="Corsi For%: CAR share of all shot attempts. ≥50% = controlling play."
        />
        <StatChip
          label="FF%"
          value={`${sa.fenwickForPct}%`}
          color={sa.fenwickForPct >= 50 ? 'var(--green)' : 'var(--red-bright)'}
          help="Fenwick For%: CAR share of unblocked attempts. Better predictor than Corsi."
        />
        <StatChip
          label="PDO"
          value={pdo.pdo}
          color={pdo.pdo > 102 ? 'var(--amber)' : pdo.pdo < 98 ? 'var(--blue-bright)' : 'var(--text-muted)'}
          help="PDO = SH% + SV% × 100. League avg = 100. Far from 100 suggests luck component."
        />
        <StatChip
          label="Luck"
          value={luck.luckDelta >= 0 ? `+${luck.luckDelta}G` : `${luck.luckDelta}G`}
          color={luck.color}
          help={`Puck Luck: actual goals vs expected from shot share. ${luck.label}`}
        />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatFaceoff(val) {
  if (val == null) return '—';
  const n = parseFloat(String(val).replace('%',''));
  if (isNaN(n)) return '—';
  // Could be 0-1 decimal or 0-100 percentage
  return n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`;
}

function parsePct(val) {
  if (val == null) return 0;
  const n = parseFloat(String(val).replace('%',''));
  return n <= 1 ? n * 100 : n;
}

const LABEL_MAP = {
  sog: 'Shots on Goal', hits: 'Hits', blockedshots: 'Blocked Shots',
  blockedshot: 'Blocked Shots', blocked: 'Blocked Shots',
  faceoffwinningpctg: 'Faceoff Win %', faceoffwinpct: 'Faceoff Win %',
  faceoffpct: 'Faceoff Win %', powerplaypctg: 'Power Play %',
  powerplay: 'Power Play', pim: 'Penalty Min', penaltyminutes: 'Penalty Min',
  giveaways: 'Giveaways', takeaways: 'Takeaways', shots: 'Shots on Goal',
};
function humanLabel(raw) {
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return raw.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}
