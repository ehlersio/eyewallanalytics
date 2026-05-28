import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { usePoll, useFetch } from '../hooks/useFetch';
import {
  getLiveGame, getGameDetail, getGameBoxscore, getGameRightRail,
  getRecentGames, getPlayoffGames, extractShotEvents,
  getCarScore, getOppScore, getOpponent, isHomeGame,
  getTeamStats, getTeamPlayoffStats, formatGameDate, getRoster, buildPlayerMap,
  bustLiveGameCache, TEAM_COLORS, GAME_TYPE,
} from '../utils/nhlApi';
import IceRink from '../components/IceRink';
import { GoalPopup, PenaltyPopup, WinPopup, useGameEvents } from '../components/GameEvents';
import { computeShotAttempts, computePDO, computePuckLuck, computeGSAx } from '../utils/advancedStats';
import InfoTip from '../components/InfoTip';
import { StatBar, MetCard, MetCardSkeleton } from '../components/StatBar';
import TeamLogo from '../components/TeamLogo';
import './ShotMapView.css';
import { publishClock, getClockDisplay } from '../utils/liveClockStore';

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
  const LIVE_POLL_MS = 10_000; // 10s — faster live polling

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

  // Playoff-specific PP% when in playoffs
  const { data: poAdv } = useFetch(
    () => inPlayoffs ? getTeamPlayoffStats() : Promise.resolve(null),
    [inPlayoffs]
  );
  const ppPct = inPlayoffs && poAdv?.pp?.powerPlayPct
    ? poAdv.pp.powerPlayPct
    : teamStats?.powerPlayPct;

  // Roster for player name resolution in shot tooltips
  const { data: roster } = useFetch(() => getRoster(CAR_ABBR));

  // ── Publish clock to shared store when PBP updates ──────────
  useEffect(() => {
    if (!isLive || !pbp?.clock?.timeRemaining) return;
    publishClock(pbp.clock.timeRemaining, pbp.clock.inIntermission, pbp.clock.running !== false);
  }, [pbp?.clock?.timeRemaining, pbp?.clock?.inIntermission, isLive]);

  // ── Tick display from shared store (same math as Topbar → no drift) ──
  useEffect(() => {
    if (!isLive) return;
    if (clockRef.current) clearInterval(clockRef.current);
    clockRef.current = setInterval(() => {
      const r = getClockDisplay();
      if (r) {
        setDisplayClock(r.display);
        setClockRunning(r.running !== false);
      }
    }, 250);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, [isLive]);

  // ── Scroll → show/hide top button ──
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const onScroll = () => setShowTopBtn(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

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
        const oppGoalie   = gameHome ? awayGoalie  : homeGoalie;
        let strength = 'EV';
        if (carSkaters > oppSkaters)                               strength = 'PP';
        else if (carSkaters < oppSkaters)                          strength = 'SH';
        else if (carSkaters === oppSkaters && carSkaters < 5)      strength = '4v4';
        if (!carGoalie) strength = `${strength} (EN)`;
        return { carSkaters, oppSkaters, strength, code: sc, carEN: !carGoalie, oppEN: !oppGoalie };
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
  const { goalPopup, clearGoalPopup, penaltyPopup, clearPenaltyPopup, winPopup, clearWinPopup } =
    useGameEvents(pbp, isLive, strMapForEvents, gameHome);

  // ── Debug panel (5 taps on score bar, dev only) ──────────────
  const [debugOpen,  setDebugOpen]  = useState(false);
  const [debugTaps,  setDebugTaps]  = useState(0);
  const debugTapRef = useRef(null);
  const [debugGoalPopup,    setDebugGoalPopup]    = useState(null);
  const [debugPenaltyPopup, setDebugPenaltyPopup] = useState(null);
  const [debugWinPopup,     setDebugWinPopup]     = useState(null);
  const [debugSituation,    setDebugSituation]    = useState(null);

  const handleDebugTap = () => {
    const next = debugTaps + 1;
    setDebugTaps(next);
    clearTimeout(debugTapRef.current);
    if (next >= 5) { setDebugOpen(o => !o); setDebugTaps(0); return; }
    debugTapRef.current = setTimeout(() => setDebugTaps(0), 2000);
  };

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
  const [drillStat,     setDrillStat]     = useState(null);
  const [showTopBtn,    setShowTopBtn]    = useState(false);
  const [displayClock,  setDisplayClock]  = useState(null);
  const [clockRunning,  setClockRunning]  = useState(true);
  const pageRef    = useRef(null);
  const clockRef   = useRef(null);
  const lastSyncRef = useRef(null);

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

    // Helper: build per-player period breakdown for a filtered set of plays
    function buildPlayerRows(filteredPlays, getPlayerId) {
      const byPlayer = {};
      filteredPlays.forEach(p => {
        const id  = getPlayerId(p);
        const per = periodLabel(p.periodDescriptor?.number);
        const key = id || 'unknown';
        if (!byPlayer[key]) byPlayer[key] = { name: pName(id), periods: {}, total: 0 };
        byPlayer[key].periods[per] = (byPlayer[key].periods[per] || 0) + 1;
        byPlayer[key].total++;
      });
      return Object.values(byPlayer).sort((a, b) => b.total - a.total);
    }

    if (statKey === 'sog') {
      const carRows = buildPlayerRows(
        plays.filter(p => (p.typeDescKey === 'shot-on-goal' || p.typeDescKey === 'goal') && p.details?.eventOwnerTeamId === carId),
        p => p.details?.shootingPlayerId || p.details?.scoringPlayerId
      );
      const oppRows = buildPlayerRows(
        plays.filter(p => (p.typeDescKey === 'shot-on-goal' || p.typeDescKey === 'goal') && p.details?.eventOwnerTeamId !== carId),
        p => p.details?.shootingPlayerId || p.details?.scoringPlayerId
      );
      setDrillStat({ label: 'Shots on Goal', carRows, oppRows, type: 'shots' });

    } else if (statKey === 'hits') {
      const carRows = buildPlayerRows(
        plays.filter(p => p.typeDescKey === 'hit' && p.details?.eventOwnerTeamId === carId),
        p => p.details?.hittingPlayerId
      );
      const oppRows = buildPlayerRows(
        plays.filter(p => p.typeDescKey === 'hit' && p.details?.eventOwnerTeamId !== carId),
        p => p.details?.hittingPlayerId
      );
      setDrillStat({ label: 'Hits', carRows, oppRows, type: 'shots' });

    } else if (statKey === 'blocked') {
      const carRows = buildPlayerRows(
        plays.filter(p => p.typeDescKey === 'blocked-shot' && p.details?.eventOwnerTeamId !== carId && p.details?.blockingPlayerId != null),
        p => p.details?.blockingPlayerId
      );
      const oppRows = buildPlayerRows(
        plays.filter(p => p.typeDescKey === 'blocked-shot' && p.details?.eventOwnerTeamId === carId && p.details?.blockingPlayerId != null),
        p => p.details?.blockingPlayerId
      );
      setDrillStat({ label: 'Blocked Shots', carRows, oppRows, type: 'shots' });

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
      // Power play goals — CAR goals scored while CAR had more skaters than opponent
      const ppGoals = plays.filter(p => {
        if (p.typeDescKey !== 'goal') return false;
        if (p.details?.eventOwnerTeamId !== carId) return false;
        const sc = p.situationCode; // 4-digit string on the play, not details
        if (!sc || sc.length < 4) return false;
        const awayS = parseInt(sc[1]);
        const homeS = parseInt(sc[2]);
        const carS  = gameHome ? homeS : awayS;
        const oppS  = gameHome ? awayS : homeS;
        return carS > oppS; // CAR had more skaters = PP goal
      });
      const rows = ppGoals.map(p => ({
        name: pName(p.details?.scoringPlayerId),
        period: periodLabel(p.periodDescriptor?.number),
        time: p.timeInPeriod || null,
        assists: [p.details?.assist1PlayerId, p.details?.assist2PlayerId]
          .filter(Boolean).map(pName).filter(n => n !== '—'),
        total: 1,
        periods: {},
      }));
      setDrillStat({ label: 'CAR Power Play Goals', rows, type: 'ppgoals' });
    } else if (statKey === 'penalties') {
      const penPlays = plays.filter(p => p.typeDescKey === 'penalty');
      const buildPenRows = (teamId) => penPlays
        .filter(p => p.details?.eventOwnerTeamId === teamId)
        .map(p => ({
          name:        pName(p.details?.committedByPlayerId || p.details?.drawnByPlayerId),
          description: (p.details?.descKey || 'penalty').replace(/-/g, ' '),
          penaltyType: p.details?.typeCode || '—',
          duration:    p.details?.duration ?? 2,
          period:      periodLabel(p.periodDescriptor?.number),
          time:        p.timeInPeriod || '—',
        }));
      setDrillStat({
        label: 'Penalties',
        carRows:  buildPenRows(carId),
        oppRows:  buildPenRows(oppId),
        type: 'penalties',
      });
    }
  }, [pbp, roster, opp]);

  // ── Live MetCard stats from PBP (updates every poll) ─────────
  // These replace rightRail.teamGameStats which only fetches once
  const liveStats = useMemo(() => {
    const plays  = pbp?.plays || [];
    const carId  = gameHome ? pbp?.homeTeam?.id : pbp?.awayTeam?.id;

    let carSOG = 0, oppSOG = 0;
    let carHits = 0, oppHits = 0;
    let carBlocks = 0, oppBlocks = 0;
    let carFOW = 0, carFOL = 0;
    let carPPGoals = 0, carPPOpps = 0;
    let carPens = 0, oppPens = 0; // track PP goals and opportunities

    // Track power play opportunities from penalty events
    const activePP = new Set(); // sortOrder when PP started
    plays.forEach(p => {
      const isCar = p.details?.eventOwnerTeamId === carId;
      switch (p.typeDescKey) {
        case 'shot-on-goal': isCar ? carSOG++ : oppSOG++; break;
        case 'goal':         isCar ? carSOG++ : oppSOG++; break;
        case 'hit':          isCar ? carHits++ : oppHits++; break;
        case 'blocked-shot':
          isCar ? oppBlocks++ : carBlocks++; break;
        case 'faceoff':
          if (p.details?.winningPlayerId) {
            const winTeam = p.details?.eventOwnerTeamId;
            winTeam === carId ? carFOW++ : carFOL++;
          }
          break;
        case 'penalty':
          // Opponent penalty = CAR PP opportunity
          if (!isCar) carPPOpps++;
          isCar ? carPens++ : oppPens++;
          break;
      }
    });

    // CAR PP goals = goals scored while CAR had more skaters
    plays.forEach(p => {
      if (p.typeDescKey !== 'goal') return;
      const isCar = p.details?.eventOwnerTeamId === carId;
      if (!isCar) return;
      const sc = p.situationCode;
      if (!sc || sc.length < 4) return;
      const awayS = parseInt(sc[1]);
      const homeS = parseInt(sc[2]);
      const carS  = gameHome ? homeS : awayS;
      const oppS  = gameHome ? awayS : homeS;
      if (carS > oppS) carPPGoals++;
    });

    // PP stats from boxscore (more reliable for PP%)
    const bs       = boxscore?.playerByGameStats;
    const ppRaw    = getGameStat('powerPlay');

    return {
      sog:      { car: carSOG,    opp: oppSOG },
      hits:     { car: carHits,   opp: oppHits },
      blocked:  { car: carBlocks, opp: oppBlocks },
      faceoff:  { car: carFOW + carFOL > 0 ? carFOW / (carFOW + carFOL) * 100 : null, opp: null },
      penalties:{ car: carPens,   opp: oppPens },
      pp:       { gamePPGoals: carPPGoals, gamePPOpps: carPPOpps },
    };
  }, [pbp, boxscore, gameHome]);

  // Fall back to rightRail when no PBP available (pre-game)
  const gameSog      = pbp?.plays?.length ? liveStats.sog     : getGameStat('sog');
  const gameHits     = pbp?.plays?.length ? liveStats.hits    : getGameStat('hits');
  const gameBlocked  = pbp?.plays?.length ? liveStats.blocked : getGameStat('blocked');
  const gameFaceoff  = pbp?.plays?.length ? liveStats.faceoff : getGameStat('faceoff');
  const gamePP       = getGameStat('powerPlay'); // always from rightRail (season stat)

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

  // ── Top CAR scorers — built from PBP goals (always current, no boxscore lag) ──
  const topScorers = useMemo(() => {
    if (!pbp?.plays) return [];
    const playerMap = buildPlayerMap(pbp);
    const pName = id => { const n = playerMap[String(id)]; return n?.trim() || null; };
    const byPlayer = {};
    pbp.plays
      .filter(p => p.typeDescKey === 'goal' && p.details?.eventOwnerTeamId === 12)
      .forEach(p => {
        const d = p.details || {};
        // Count goals
        const sid = String(d.scoringPlayerId);
        if (sid && sid !== 'undefined') {
          if (!byPlayer[sid]) byPlayer[sid] = { name: pName(d.scoringPlayerId), goals: 0, assists: 0 };
          byPlayer[sid].goals++;
          byPlayer[sid].points = (byPlayer[sid].goals || 0) + (byPlayer[sid].assists || 0);
        }
        // Count assists
        [d.assist1PlayerId, d.assist2PlayerId].filter(Boolean).forEach(aid => {
          const as = String(aid);
          if (!byPlayer[as]) byPlayer[as] = { name: pName(aid), goals: 0, assists: 0 };
          byPlayer[as].assists++;
          byPlayer[as].points = (byPlayer[as].goals || 0) + (byPlayer[as].assists || 0);
        });
      });
    return Object.values(byPlayer)
      .filter(p => p.name)
      .sort((a, b) => b.points - a.points || b.goals - a.goals)
      .map(p => ({
        name: p.name,
        goals: p.goals,
        assists: p.assists,
        points: p.points,
      }));
  }, [pbp?.plays?.length]);

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

  const carGoalie = activeGoalie(boxscore?.playerByGameStats?.[gameHome ? 'homeTeam' : 'awayTeam']?.goalies || []);
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
    <div className="page" ref={pageRef}>

      {/* ── Score bar ── */}
      <div className="score-card card" onClick={handleDebugTap} style={{ userSelect: 'none' }}>
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
              {(isLive || debugSituation) && (debugSituation?.team === 'CAR' || currentSituation?.strength === 'PP') && (
                <div className="pp-indicator car-pp">
                  ⚡ {(debugSituation?.carSkaters === 5 && debugSituation?.oppSkaters === 3) ? '5v3 ' : currentSituation && currentSituation.carSkaters !== 5 ? `${currentSituation.carSkaters}v${currentSituation.oppSkaters} ` : ''}Power Play
                </div>
              )}
              {(isLive || debugSituation?.carEN) && (currentSituation?.carEN || debugSituation?.carEN) && (
                <div className="pp-indicator en-indicator car-en">🥅 CAR Empty Net</div>
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
                      <div className="score-clock">{displayClock || pbp.clock.timeRemaining}</div>
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
                      <div className="score-clock">
                        {displayClock || pbp?.clock?.timeRemaining || '—'}
                        {!clockRunning && <span className="clock-stopped">⏸</span>}
                      </div>
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
              {(isLive || debugSituation) && (debugSituation?.team === 'OPP' || currentSituation?.strength === 'SH') && (
                <div className="pp-indicator opp-pp">
                  ⚡ {currentSituation && currentSituation.oppSkaters < 4 ? `${currentSituation.oppSkaters}v${currentSituation.carSkaters} ` : ''}{oppAbbr || 'OPP'} Power Play
                </div>
              )}
              {(isLive || debugSituation?.oppEN) && (currentSituation?.oppEN || debugSituation?.oppEN) && (
                <div className="pp-indicator en-indicator opp-en">🥅 {oppAbbr || 'OPP'} Empty Net</div>
              )}
              {/* 4v4 or 3v3 (both teams penalized) */}
              {(isLive && currentSituation?.strength === '4v4') || debugSituation?.strength === '4v4' ? (
                <div className="pp-indicator" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)', border: '0.5px solid rgba(148,163,184,0.3)' }}>
                  {debugSituation?.carSkaters || currentSituation?.carSkaters}v{debugSituation?.oppSkaters || currentSituation?.oppSkaters} — Coincidental
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="no-game-msg">
            <span>Loading game data…</span>
          </div>
        )}
      </div>

      {/* ── Live / Game Insights (below score) ── */}
      {pbp?.plays?.length > 0 && (
        <LiveInsights
          pbp={pbp}
          boxscore={boxscore}
          gameHome={gameHome}
          carScore={carScore}
          oppScore={oppScore}
          oppAbbr={oppAbbr}
          topScorers={topScorers}
          isLive={isLive}
        />
      )}

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
          label="Blocks"
          value={gameBlocked.car ?? '—'}
          sub={gameBlocked.opp != null ? `Opp ${gameBlocked.opp}` : 'this game'}
          color={gameBlocked.car > gameBlocked.opp ? 'green' : null}
          help="Shots blocked by CAR skaters"
          onClick={pbp ? () => buildDrillDown('blocked') : null}
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
        {(() => {
          const pens = liveStats?.penalties;
          const carP = pens?.car ?? 0;
          const oppP = pens?.opp ?? 0;
          // Fewer penalties = better; amber if equal, green if fewer, red if more
          const color = carP < oppP ? 'green' : carP > oppP ? null : null;
          return (
            <MetCard
              label="Penalties"
              value={carP ?? '—'}
              sub={`Opp ${oppP ?? '—'}`}
              color={color}
              onClick={pbp ? () => buildDrillDown('penalties') : null}
            />
          );
        })()}
        {(() => {
          const gpp = liveStats?.pp;
          const hasGamePP = gpp?.gamePPOpps > 0;
          const gamePPPct = hasGamePP ? gpp.gamePPGoals / gpp.gamePPOpps * 100 : null;
          const avgPct    = ppPct ? (ppPct * 100).toFixed(1) : null;
          const avgLabel  = inPlayoffs ? 'PO avg' : 'Szn avg';
          return (
            <MetCard
              label="PP %"
              value={gamePPPct != null ? `${gamePPPct.toFixed(1)}%` : (avgPct ? `${avgPct}%` : '—')}
              sub={gamePPPct != null
                ? `${gpp.gamePPGoals}/${gpp.gamePPOpps} · ${avgLabel} ${avgPct}%`
                : `${avgLabel}${avgPct ? ` ${avgPct}%` : ''}`}
              color={gamePPPct != null && avgPct && gamePPPct >= parseFloat(avgPct) ? 'green' : null}
              onClick={pbp ? () => buildDrillDown('pp') : null}
            />
          );
        })()}
      </div>

      {/* ── Shot Volume + Corsi/Fenwick/PDO ── */}
      {pbp?.plays && (
        <AdvancedGamePanel pbp={pbp} gameHome={gameHome} isLive={isLive} boxscore={boxscore} />
      )}

      {/* ── Shot Quality — below Shot Attempts ── */}
      {dangerCounts.total > 0 && (
        <div className="card danger-quality-card">
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

          {/* Top point-getters in this game */}
          {topScorers.length > 0 && (
            <div className="card">
              <div className="sec-label">CAR scoring — this game</div>
              {topScorers.map((p, i) => (
                <div key={i} className="scorer-row">
                  <span className="scorer-name">{p.name || `#${p.sweaterNumber}`}</span>
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
    {drillStat     && <StatDrillPopup drillStat={drillStat} onClose={() => setDrillStat(null)} oppAbbr={oppAbbr} />}
    {goalPopup     && <GoalPopup    data={goalPopup}       onClose={clearGoalPopup}    />}
    {penaltyPopup  && <PenaltyPopup data={penaltyPopup}    onClose={clearPenaltyPopup} />}
    {winPopup      && <WinPopup     data={winPopup}        onClose={clearWinPopup}     />}

    {/* ── Debug popups ── */}
    {debugGoalPopup    && <GoalPopup    data={debugGoalPopup}    onClose={() => setDebugGoalPopup(null)}    />}
    {debugPenaltyPopup && <PenaltyPopup data={debugPenaltyPopup} onClose={() => setDebugPenaltyPopup(null)} />}
    {debugWinPopup     && <WinPopup     data={debugWinPopup}     onClose={() => setDebugWinPopup(null)}     />}

    {/* ── Debug panel (5 taps on score bar) ── */}
    {debugOpen && (
      <div className="debug-panel" onClick={e => e.stopPropagation()}>
        <div className="debug-panel-title">🛠 Event Debug</div>
        <div className="debug-panel-sub">Tap to fire each game event</div>
        <div className="debug-panel-btns">
          <button className="debug-btn goal" onClick={() => {
            setDebugGoalPopup({ scorer: 'Sebastian Aho', assists: ['Andrei Svechnikov', 'Jaccob Slavin'], shotType: 'Wrist', period: 'P2', time: '14:32' });
            setDebugOpen(false);
          }}>🚨 CAR Goal</button>
          <button className="debug-btn penalty" onClick={() => {
            setDebugPenaltyPopup({ id: 'debug-1', player: 'Brad Marchand', description: 'Hooking', duration: 2, period: 'P2', time: '08:17' });
            setDebugOpen(false);
          }}>⚡ PP Notification</button>
          <button className="debug-btn win" onClick={() => {
            setDebugWinPopup({ score: 'CAR 4 – BOS 2' });
            setDebugOpen(false);
          }}>🏆 Win Popup</button>
          <button className="debug-btn pp-car" onClick={() => {
            setDebugSituation({ strength: 'PP', team: 'CAR' });
            setDebugOpen(false);
            setTimeout(() => setDebugSituation(null), 15000);
          }}>🟢 CAR Power Play (5v4)</button>
          <button className="debug-btn pp-car" onClick={() => {
            setDebugSituation({ strength: 'PP', team: 'CAR', carSkaters: 5, oppSkaters: 3 });
            setDebugOpen(false);
            setTimeout(() => setDebugSituation(null), 15000);
          }}>🟢🟢 CAR 5v3 Power Play</button>
          <button className="debug-btn pp-opp" onClick={() => {
            setDebugSituation({ strength: 'PP', team: 'OPP' });
            setDebugOpen(false);
            setTimeout(() => setDebugSituation(null), 15000);
          }}>🟡 Opp Power Play (4v5)</button>
          <button className="debug-btn close" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)' }} onClick={() => {
            setDebugSituation({ strength: '4v4', carSkaters: 4, oppSkaters: 4 });
            setDebugOpen(false);
            setTimeout(() => setDebugSituation(null), 15000);
          }}>⚪ 4v4 Coincidental</button>
          <button className="debug-btn close" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)' }} onClick={() => {
            setDebugSituation({ strength: '4v4', carSkaters: 3, oppSkaters: 3 });
            setDebugOpen(false);
            setTimeout(() => setDebugSituation(null), 15000);
          }}>⚪ 3v3 OT</button>
          <button className="debug-btn" style={{ background: 'rgba(250,190,30,0.1)', color: '#fbbf24' }} onClick={() => {
            setDebugSituation({ carEN: true });
            setDebugOpen(false);
            setTimeout(() => setDebugSituation(null), 15000);
          }}>🥅 CAR Empty Net</button>
          <button className="debug-btn" style={{ background: 'rgba(250,190,30,0.1)', color: '#fbbf24' }} onClick={() => {
            setDebugSituation({ oppEN: true });
            setDebugOpen(false);
            setTimeout(() => setDebugSituation(null), 15000);
          }}>🥅 Opp Empty Net</button>
          <button className="debug-btn close" onClick={() => setDebugOpen(false)}>✕ Close</button>
        </div>
        <div className="debug-panel-note">Also fires push notification via /push/test</div>
        <button className="debug-btn push" onClick={async () => {
          const url = import.meta.env.VITE_WORKER_URL;
          if (!url) return;
          const res = await fetch(`${url}/push/test?secret=eyewall-2026`).catch(() => null);
          alert(res?.ok ? '✅ Push sent!' : '❌ Push failed');
        }}>📲 Test Push Notification</button>
      </div>
    )}

      {/* ── Back to top button ── */}
      {showTopBtn && (
        <button
          className="shotmap-top-btn"
          onClick={() => pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >↑ Top</button>
      )}
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
              GSAx <InfoTip text={gsax.note} position="above" />
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
    <div className="event-log" style={{maxHeight:'240px', overflowY:'auto'}}>
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
function StatDrillPopup({ drillStat, onClose, oppAbbr }) {
  const [tab, setTab] = useState('car');
  if (!drillStat) return null;
  const periods = ['P1', 'P2', 'P3', 'OT'];

  // Support both old shape (rows) and new shape (carRows/oppRows)
  const carRows = drillStat.carRows ?? drillStat.rows ?? [];
  const oppRows = drillStat.oppRows ?? [];
  const hasOpp  = oppRows.length > 0 || drillStat.oppRows !== undefined;
  const rows    = tab === 'car' ? carRows : oppRows;
  const teamLabel = tab === 'car' ? 'CAR' : (oppAbbr || 'OPP');

  // Period totals for shots/hits type
  const periodTotals = periods.reduce((acc, p) => {
    acc[p] = rows.reduce((sum, r) => sum + (r.periods?.[p] || 0), 0);
    return acc;
  }, {});
  const grandTotal = rows.reduce((sum, r) => sum + (r.total || 0), 0);

  return (
    <div className="drill-overlay" onClick={onClose}>
      <div className="drill-popup" onClick={e => e.stopPropagation()}>
        <div className="drill-header">
          <span className="drill-title">{drillStat.label}</span>
          <button className="drill-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* CAR / OPP tab toggle */}
        {hasOpp && (
          <div className="drill-tabs">
            <button className={`drill-tab ${tab === 'car' ? 'active' : ''}`} onClick={() => setTab('car')}>
              <TeamLogo abbr="CAR" size={18} /> CAR
            </button>
            <button className={`drill-tab ${tab === 'opp' ? 'active' : ''}`} onClick={() => setTab('opp')}>
              <TeamLogo abbr={oppAbbr} size={18} /> {oppAbbr || 'OPP'}
            </button>
          </div>
        )}

        <div className="drill-body">
          {rows.length === 0 && (
            <div className="drill-empty">No {teamLabel} data for this game.</div>
          )}

          {drillStat.type === 'faceoff' && (
            <div className="drill-table">
              <div className="drill-col-header fo">
                <span>Player</span><span>Won</span><span>Lost</span><span>Win%</span>
              </div>
              {rows.map((r, i) => (
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
              {rows.map((r, i) => (
                <div key={i} className="drill-row">
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span className="drill-name">{r.name}</span>
                    <span className="drill-period-badge">{r.time ? `${r.period} · ${r.time}` : r.period}</span>
                  </div>
                  {r.assists?.length > 0 && (
                    <div className="drill-assists">Assists: {r.assists.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(drillStat.type === 'shots') && (
            <div className="drill-table">
              <div className="drill-col-header shots">
                <span>Player</span><span>P1</span><span>P2</span><span>P3</span><span>OT</span><span>Total</span>
              </div>
              {rows.map((r, i) => (
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
              {/* Period totals row */}
              {grandTotal > 0 && (
                <div className="drill-row-grid shots drill-totals-row">
                  <span className="drill-name drill-totals-label">Total</span>
                  {periods.map(p => (
                    <span key={p} className={`drill-val total ${periodTotals[p] ? '' : 'dim'}`}>
                      {periodTotals[p] || '—'}
                    </span>
                  ))}
                  <span className="drill-val total">{grandTotal}</span>
                </div>
              )}
            </div>
          )}

          {drillStat.type === 'penalties' && (
            <div className="drill-table">
              {rows.length === 0
                ? <div className="drill-empty">No {teamLabel} penalties.</div>
                : rows.map((r, i) => {
                    const minor = r.duration <= 2;
                    const color = tab === 'car' ? '#f87171' : '#4ade80';
                    return (
                      <div key={i} className="drill-row pen-row">
                        <div className="pen-row-top">
                          <span className="drill-name">{r.name}</span>
                          <span className="pen-badge" style={{ background: minor ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.2)', color: minor ? '#fbbf24' : '#f87171' }}>
                            {r.duration} min
                          </span>
                          <span className="pen-period">{r.period} · {r.time}</span>
                        </div>
                        <div className="pen-row-bottom">
                          <span className="pen-desc">{r.description}</span>
                          {r.penaltyType && r.penaltyType !== '—' && (
                            <span className="pen-type">{r.penaltyType}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
              }
              {/* Period totals for penalties */}
              {rows.length > 0 && (() => {
                const penByPeriod = rows.reduce((acc, r) => {
                  acc[r.period] = (acc[r.period] || 0) + 1;
                  return acc;
                }, {});
                return (
                  <div className="drill-totals-row pen-totals">
                    <span className="drill-totals-label">Totals</span>
                    {['P1','P2','P3','OT'].filter(p => penByPeriod[p]).map(p => (
                      <span key={p} className="period-chip">{p}: {penByPeriod[p]}</span>
                    ))}
                    <span className="drill-val total">{rows.length} total</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Advanced Game Panel (Corsi / Fenwick / PDO / Puck Luck) ──
// ── Live Insights ────────────────────────────────────────────
function LiveInsights({ pbp, boxscore, gameHome, carScore, oppScore, oppAbbr, topScorers, isLive }) {
  const insights = useMemo(() => {
    const plays   = pbp?.plays || [];
    const carTeam = gameHome ? pbp?.homeTeam?.id : pbp?.awayTeam?.id;
    const results = [];

    // ── Shot advantage by period ──────────────────────────────
    const periodShots = {};
    plays.forEach(p => {
      if (!['shot-on-goal','goal'].includes(p.typeDescKey)) return;
      const per   = p.periodDescriptor?.number || 1;
      const isCar = p.details?.eventOwnerTeamId === carTeam;
      if (!periodShots[per]) periodShots[per] = { car: 0, opp: 0 };
      if (isCar) periodShots[per].car++; else periodShots[per].opp++;
    });

    // During live: show current period. Post-game: show best/worst period
    const currentPeriod = pbp?.periodDescriptor?.number;
    const periodsToCheck = isLive && currentPeriod
      ? [currentPeriod]
      : Object.keys(periodShots).map(Number);

    periodsToCheck.forEach(per => {
      const ps = periodShots[per];
      if (!ps) return;
      const diff = ps.car - ps.opp;
      const periodLabel = per <= 3 ? `P${per}` : 'OT';
      const threshold = isLive ? 4 : 6;
      if (Math.abs(diff) >= threshold) {
        results.push({
          icon: diff > 0 ? '🎯' : '😬',
          text: diff > 0
            ? `CAR dominated ${periodLabel} shots ${ps.car}–${ps.opp}`
            : `${oppAbbr} dominated ${periodLabel} shots ${ps.opp}–${ps.car}`,
          type: diff > 0 ? 'good' : 'warn',
        });
      }
    });

    // ── Momentum — last 10 shot attempts (live only) ──────────
    if (isLive) {
      const recentAttempts = plays
        .filter(p => ['shot-on-goal','goal','missed-shot','blocked-shot'].includes(p.typeDescKey))
        .slice(-10);
      if (recentAttempts.length >= 6) {
        const carRecent = recentAttempts.filter(p => p.details?.eventOwnerTeamId === carTeam).length;
        const oppRecent = recentAttempts.length - carRecent;
        if (carRecent >= 7) results.push({ icon: '🌀', text: `CAR on a roll — ${carRecent} of last ${recentAttempts.length} shot attempts`, type: 'good' });
        else if (oppRecent >= 7) results.push({ icon: '🧱', text: `${oppAbbr} pressing — ${oppRecent} of last ${recentAttempts.length} shot attempts`, type: 'warn' });
      }
    }

    // ── Top scorer callout ────────────────────────────────────
    if (topScorers.length > 0) {
      const leader = topScorers[0];
      if (leader.points >= 2) {
        const pts = [
          leader.goals > 0 ? `${leader.goals}G` : null,
          leader.assists > 0 ? `${leader.assists}A` : null,
        ].filter(Boolean).join(', ');
        results.push({ icon: '⭐', text: `${leader.name} led CAR with ${pts} (${leader.points} pts)`, type: 'good' });
      }
    }

    // ── PK performance ───────────────────────────────────────
    const penalties = plays.filter(p => p.typeDescKey === 'penalty');
    const carPens   = penalties.filter(p => p.details?.eventOwnerTeamId === carTeam).length;
    const oppPens   = penalties.filter(p => p.details?.eventOwnerTeamId !== carTeam).length;
    const ppGoalsAgainst = plays.filter(p =>
      p.typeDescKey === 'goal' &&
      p.details?.eventOwnerTeamId !== carTeam &&
      (p.details?.situationCode?.startsWith('5v4') ||
       p.details?.situationCode?.startsWith('5v3'))
    ).length;
    if (carPens >= 2 && ppGoalsAgainst === 0) {
      results.push({ icon: '🛡️', text: `CAR PK went ${carPens}-for-${carPens} — perfect penalty kill`, type: 'good' });
    } else if (ppGoalsAgainst >= 2) {
      results.push({ icon: '😤', text: `PK struggled — allowed ${ppGoalsAgainst} power play goals`, type: 'warn' });
    }

    // ── Score situation (live only) ──────────────────────────
    if (isLive) {
      const diff = (carScore ?? 0) - (oppScore ?? 0);
      if (diff === 0 && (carScore ?? 0) > 0) {
        results.push({ icon: '⚡', text: `Tied ${carScore}–${oppScore} — anyone's game`, type: 'neutral' });
      } else if (diff >= 3) {
        results.push({ icon: '🏒', text: `CAR up ${diff} — dominant performance`, type: 'good' });
      } else if (diff <= -2 && currentPeriod >= 3) {
        results.push({ icon: '🚨', text: `CAR down ${Math.abs(diff)} in P${currentPeriod} — need a push`, type: 'warn' });
      }
    }

    // ── Final result callout (completed games) ────────────────
    if (!isLive && carScore != null && oppScore != null) {
      const won  = carScore > oppScore;
      const diff = Math.abs(carScore - oppScore);
      // Total shots
      const carTot = Object.values(periodShots).reduce((s, p) => s + p.car, 0);
      const oppTot = Object.values(periodShots).reduce((s, p) => s + p.opp, 0);
      if (carTot !== oppTot) {
        results.push({
          icon: won ? '✅' : '📉',
          text: won
            ? `CAR won ${carScore}–${oppScore} and outshot ${oppAbbr} ${carTot}–${oppTot}`
            : `CAR lost ${carScore}–${oppScore} despite ${carTot > oppTot ? `outshooting ${oppAbbr} ${carTot}–${oppTot}` : `being outshot ${oppTot}–${carTot}`}`,
          type: won ? 'good' : 'warn',
        });
      }
    }

    // ── Empty net (live only) ─────────────────────────────────
    if (isLive) {
      const situation = pbp?.situation;
      if (situation?.awayTeam?.situationDescriptions?.includes('EN') ||
          situation?.homeTeam?.situationDescriptions?.includes('EN')) {
        const carEN = gameHome
          ? situation?.awayTeam?.situationDescriptions?.includes('EN')
          : situation?.homeTeam?.situationDescriptions?.includes('EN');
        results.push({ icon: carEN ? '🥅' : '😤', text: carEN ? `${oppAbbr} has pulled their goalie` : 'CAR goalie pulled', type: carEN ? 'good' : 'warn' });
      }
    }

    return results.slice(0, 4);
  }, [pbp, boxscore, gameHome, carScore, oppScore, oppAbbr, topScorers, isLive]);

  if (!insights.length) return null;

  return (
    <div className="card live-insights">
      <div className="sec-label">{isLive ? '🔴 Live Insights' : '📊 Game Insights'}</div>
      <div className="insights-list">
        {insights.map((ins, i) => (
          <div key={i} className={`insight-row insight-${ins.type}`}>
            <span className="insight-icon">{ins.icon}</span>
            <span className="insight-text">{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
        <div className="sv-label-wrap"><span className="sv-label">{label}</span><InfoTip text={help} position="above" /></div>
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
      <div style={{display:'flex',alignItems:'center',gap:2}}><span className="adv-chip-label">{label}</span><InfoTip text={help} position="above" /></div>
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