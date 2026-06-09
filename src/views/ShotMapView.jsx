import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { usePoll, useFetch } from '../hooks/useFetch';
import {
  getLiveGame, getAllGames, getGameDetail, getGameBoxscore, getGameRightRail,
  getRecentGames, getPlayoffGames, extractShotEvents,
  getCarScore, getOppScore, getOpponent, isHomeGame,
  getTeamStats, getTeamPlayoffStats, formatGameDate, getRoster, buildPlayerMap,
  bustLiveGameCache, TEAM_COLORS, GAME_TYPE,
} from '../utils/nhlApi';
import IceRink from '../components/IceRink';
import { GoalPopup, PenaltyPopup, WinPopup, PuckDropPopup, useGameEvents } from '../components/GameEvents';
import { computeShotAttempts, computePDO, computePuckLuck, computeGSAx } from '../utils/advancedStats';
import { getGoalieAnalytics, getGameXG, getGameLogInsights } from '../utils/supabaseClient';
import { CAR_PP_UNITS, inferPPUnit, CAR_PK_UNITS, inferPKUnit } from '../utils/ppUnits';
import InfoTip from '../components/InfoTip';
import { StatBar, MetCard, MetCardSkeleton } from '../components/StatBar';
import TeamLogo from '../components/TeamLogo';
import './ShotMapView.css';
import { publishClock, getClockDisplay, publishMomentum } from '../utils/liveClockStore';
import { useDevGame } from '../utils/DevGameContext';
import { useWakeLock } from '../hooks/useWakeLock';
import PeriodSummary from '../components/PeriodSummary';
import { usePeriodSummary, useGameSummary } from '../hooks/usePeriodSummary';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';

const CAR_ABBR = 'CAR';

export default function ShotMapView() {
  // ── Dev replay injection ──────────────────────────────────────
  const devGame = useDevGame();

  // ── Adaptive polling interval for live game detection ─────────
  // We use a ref to persist last known state between renders so the interval
  // calculation never creates a circular dependency on liveGameReal itself.
  // getAllGames covers both completed and upcoming games — recentGames only
  // returns completed, so we'd never find a future game time from it.
  const liveStateRef = useRef({ isLive: false, nextGameTime: null });

  const scheduleInterval = useMemo(() => {
    const { isLive: wasLive, nextGameTime } = liveStateRef.current;
    if (wasLive) return 20_000;                         // live game — 20s
    if (!nextGameTime) return 30 * 60_000;              // offseason / no data — 30min
    const minsToGame = (nextGameTime - Date.now()) / 60_000;
    if (minsToGame < 180) return 60_000;                // within 3hrs of puck drop — 1min
    return 5 * 60_000;                                  // between games — 5min
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveStateRef.current.isLive, liveStateRef.current.nextGameTime]);

  // Live game polling — interval adapts to game state
  const { data: liveGameReal, refetch: refetchLive } = usePoll(getLiveGame, scheduleInterval);
  const liveGame = devGame?.liveGame ?? liveGameReal;
  const isLive   = !!liveGame;

  // All games (completed + scheduled) — used to find next upcoming game time
  // for the adaptive interval. useFetch fires once; nhlApi.js caches the result.
  const { data: allGames } = useFetch(getAllGames);

  // Update liveStateRef whenever live status or schedule changes
  useEffect(() => {
    const now = Date.now();
    const nextGame = allGames?.find(g =>
      g.startTimeUTC && new Date(g.startTimeUTC).getTime() > now &&
      !['OFF', 'FINAL', 'F', 'FINAL_OVERTIME', 'FINAL_SHOOTOUT'].includes(g.gameState)
    );
    liveStateRef.current = {
      isLive,
      nextGameTime: nextGame ? new Date(nextGame.startTimeUTC).getTime() : null,
    };
  }, [isLive, allGames]);

  // Most recent completed game as fallback
  const { data: recentGames } = useFetch(getRecentGames);
  const lastGame   = recentGames?.[0] || null;
  const activeGame = liveGame || lastGame;
  useWakeLock(isLive); // keep screen on during live games

  // ── App resume: refetch live data and clear stale popups ─────
  // Refs let the visibilitychange handler access the latest clear functions
  // without needing to re-register the listener every render.
  const clearGoalPopupRef    = useRef(null);
  const clearPenaltyPopupRef = useRef(null);
  const clearWinPopupRef     = useRef(null);
  const clearPuckDropRef     = useRef(null);
  const refetchLiveRef       = useRef(null);

  // Are we currently in playoffs? Check if any playoff games exist this season
  const { data: playoffGames } = useFetch(getPlayoffGames);
  const inPlayoffs = (playoffGames?.length || 0) > 0;

  // Determine context of the active game
  const activeIsPlayoff = activeGame?.gameType === GAME_TYPE.PLAYOFFS;

  // Play-by-play for shot map — poll every 20s during live games
  const gameId = activeGame?.id;
  const LIVE_POLL_MS = 10_000;

  const { data: pbpReal } = usePoll(
    () => {
      if (devGame) return Promise.resolve(null); // dev provides pbp directly
      if (!gameId) return Promise.resolve(null);
      if (isLive) bustLiveGameCache(gameId);
      return getGameDetail(gameId);
    },
    isLive ? LIVE_POLL_MS : 300_000,
    [gameId, isLive, !!devGame]
  );
  const pbp = devGame?.pbp ?? pbpReal;

  // Boxscore — poll same rate as PBP during live
  const { data: boxscoreReal } = usePoll(
    () => {
      if (devGame) return Promise.resolve(null);
      return gameId ? getGameBoxscore(gameId) : Promise.resolve(null);
    },
    isLive ? LIVE_POLL_MS : 300_000,
    [gameId, isLive, !!devGame]
  );
  const boxscore = devGame?.boxscore ?? boxscoreReal;

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

  const pkPct = inPlayoffs && poAdv?.pk?.penaltyKillPct
    ? poAdv.pk.penaltyKillPct
    : teamStats?.penaltyKillPct;

  // Roster for player name resolution in shot tooltips
  const { data: roster } = useFetch(() => getRoster(CAR_ABBR));

  // Season GSAX from Supabase for goalie cards
  const { data: goalieAnalytics } = useFetch(() => getGoalieAnalytics());

  // Game-level xG from MoneyPuck (available ~2-4h post-game, not during live)
  const { data: gameXGData } = useFetch(
    () => gameId && !isLive ? getGameXG(gameId) : Promise.resolve(null),
    [gameId, isLive]
  );

  // ── Publish clock to shared store when PBP updates ──────────
  useEffect(() => {
    if (!isLive || !pbp?.clock?.timeRemaining) return;
    publishClock(pbp.clock.timeRemaining, pbp.clock.inIntermission, pbp.clock.running !== false);
  }, [pbp?.clock?.timeRemaining, pbp?.clock?.inIntermission, isLive]);

  // ── Publish momentum to shared store when PBP updates ───────
  useEffect(() => {
    if (!isLive || !pbp?.plays?.length) return;
    const plays = pbp.plays;
    const CAR_ID = 12;
    const WINDOW_MINS = 5;
    const windowSecs = WINDOW_MINS * 60;

    function playTimeSeconds(play) {
      const period = play.periodDescriptor?.number || 1;
      const t = play.timeInPeriod || '00:00';
      const [m, s] = t.split(':').map(Number);
      return (period - 1) * 1200 + m * 60 + (s || 0);
    }

    function weightedScore(play, isCAR) {
      const d    = play.details || {};
      const zone = d.zoneCode;
      const type = play.typeDescKey;
      const owned = isCAR ? d.eventOwnerTeamId === CAR_ID : (d.eventOwnerTeamId && d.eventOwnerTeamId !== CAR_ID);
      if (type === 'faceoff') {
        const won = d.eventOwnerTeamId === (isCAR ? CAR_ID : d.eventOwnerTeamId);
        return zone === 'O' && owned ? 0.6 : 0;
      }
      if (!owned) return 0;
      if (type === 'shot-on-goal' || type === 'goal')         return zone === 'O' ? 1.0 : 0.5;
      if (type === 'missed-shot'  || type === 'blocked-shot') return zone === 'O' ? 0.7 : 0.3;
      if (type === 'hit'      && zone === 'O') return 0.4;
      if (type === 'takeaway' && zone === 'O') return 0.5;
      return 0;
    }

    const lastPlay = plays[plays.length - 1];
    const nowSecs = playTimeSeconds(lastPlay);
    const cutoff = nowSecs - windowSecs;

    let carScore = 0, oppScore = 0, carShots = 0, oppShots = 0;
    plays.forEach(p => {
      const t = playTimeSeconds(p);
      if (t < cutoff) return;
      carScore += weightedScore(p, true);
      oppScore += weightedScore(p, false);
      const SHOT_TYPES = new Set(['goal', 'shot-on-goal', 'missed-shot', 'blocked-shot']);
      if (SHOT_TYPES.has(p.typeDescKey)) {
        if (p.details?.eventOwnerTeamId === CAR_ID) carShots++;
        else oppShots++;
      }
    });

    const total = carScore + oppScore || 1;
    const carPct = Math.round((carScore / total) * 100);

    publishMomentum({ carPct, oppPct: 100 - carPct, carShots, oppShots, window: WINDOW_MINS, nowSecs });
  }, [pbp?.plays?.length, isLive]);

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

  // Game log insights — team-specific situational stats (scored first win%, H2H record)
  const { data: gameLogInsights } = useFetch(
    () => oppAbbr ? getGameLogInsights(oppAbbr) : Promise.resolve(null),
    [oppAbbr]
  );
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
  const { goalPopup, clearGoalPopup, penaltyPopup, clearPenaltyPopup, winPopup, clearWinPopup, puckDropPopup, clearPuckDropPopup } =
    useGameEvents(pbp, isLive, strMapForEvents, gameHome);

  // Keep refs current so the visibility handler always calls the latest versions
  useEffect(() => { clearGoalPopupRef.current    = clearGoalPopup;    }, [clearGoalPopup]);
  useEffect(() => { clearPenaltyPopupRef.current = clearPenaltyPopup; }, [clearPenaltyPopup]);
  useEffect(() => { clearWinPopupRef.current     = clearWinPopup;     }, [clearWinPopup]);
  useEffect(() => { clearPuckDropRef.current     = clearPuckDropPopup;}, [clearPuckDropPopup]);
  useEffect(() => { refetchLiveRef.current       = refetchLive;       }, [refetchLive]);

  // Visibility change — fires when user returns to the app from another tab/app.
  // Refetch live game immediately (browser may have throttled polling while hidden)
  // and clear any popups that may have fired from stale pre-background PBP data.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      refetchLiveRef.current?.();
      clearGoalPopupRef.current?.();
      clearPenaltyPopupRef.current?.();
      clearWinPopupRef.current?.();
      clearPuckDropRef.current?.();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []); // register once — refs handle stale closure

  // ── Period summaries ──────────────────────────────────────────
  const CAR_TEAM_ID = 12;
  const { summaries: periodSummaries, newSummary, dismissNewSummary, updateSummaryNarrative } =
    usePeriodSummary({ pbp, isLive, gameId, carTeamId: CAR_TEAM_ID, isPlayoff: inPlayoffs });
  const { gameSummary, updateGameNarrative } = useGameSummary({
    pbp, isLive, gameId, carTeamId: CAR_TEAM_ID, summaries: periodSummaries,
  });
  const homeAbbr = activeGame?.homeTeam?.abbrev || 'CAR';
  const awayAbbr = activeGame?.awayTeam?.abbrev || 'OPP';
  const [viewingSummaryPeriod, setViewingSummaryPeriod] = useState(null);

  // Derive the live summary object so narrative updates reflect immediately
  const viewingSummary = viewingSummaryPeriod === null ? null
    : viewingSummaryPeriod === 'game' ? gameSummary
    : periodSummaries.find(s => s.period === viewingSummaryPeriod) || null;

  // Sync summaries + game summary to context so bell can access them
  const { setSummaries: setCtxSummaries, registerOpenHandler } = usePeriodSummaryContext();
  useEffect(() => {
    const all = gameSummary ? [gameSummary, ...periodSummaries] : periodSummaries;
    setCtxSummaries(all);
  }, [periodSummaries, gameSummary, setCtxSummaries]);
  useEffect(() => {
    registerOpenHandler((s) => setViewingSummaryPeriod(s.isGameSummary ? 'game' : s.period));
    return () => registerOpenHandler(null);
  }, [registerOpenHandler]);

  // ── Debug panel (5 taps on score bar, dev only) ──────────────
  const [debugOpen,  setDebugOpen]  = useState(false);
  const [debugTaps,  setDebugTaps]  = useState(0);
  const debugTapRef = useRef(null);
  const [debugGoalPopup,    setDebugGoalPopup]    = useState(null);
  const [debugPenaltyPopup, setDebugPenaltyPopup] = useState(null);
  const [debugWinPopup,     setDebugWinPopup]     = useState(null);
  const [debugPuckDropPopup, setDebugPuckDropPopup] = useState(null);
  const [debugSituation,    setDebugSituation]    = useState(null);
  const [debugInsight,      setDebugInsight]      = useState(null); // injected Live Insight row

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
    const season = 20252026; // update each season

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

    const periodLabel = n => n <= 3 ? `P${n}` : inPlayoffs ? (n === 4 ? "OT" : `${n - 3}OT`) : n === 4 ? "OT" : "SO";

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
      // Build set of CAR player IDs from rosterSpots to verify blocker team
      const carPlayerIds = new Set(
        (pbp?.rosterSpots || [])
          .filter(s => s.teamId === carId)
          .map(s => s.playerId)
      );
      const carRows = buildPlayerRows(
        plays.filter(p =>
          p.typeDescKey === 'blocked-shot' &&
          p.details?.eventOwnerTeamId !== carId &&
          p.details?.blockingPlayerId != null &&
          carPlayerIds.has(p.details.blockingPlayerId)
        ),
        p => p.details?.blockingPlayerId
      );
      const oppRows = buildPlayerRows(
        plays.filter(p =>
          p.typeDescKey === 'blocked-shot' &&
          p.details?.eventOwnerTeamId === carId &&
          p.details?.blockingPlayerId != null &&
          !carPlayerIds.has(p.details.blockingPlayerId)
        ),
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
      // ── Rich PP Analysis ────────────────────────────────────
      // Parse all plays into discrete PP opportunities
      const carId   = 12;
      const isCarPP = (sc) => {
        if (!sc || sc.length < 4) return false;
        const awayS = parseInt(sc[1]), homeS = parseInt(sc[2]);
        const carS  = gameHome ? homeS : awayS;
        const oppS  = gameHome ? awayS : homeS;
        return carS > oppS;
      };

      // Walk plays and group into PP windows
      const opportunities = [];
      let current = null;

      plays.forEach(p => {
        const sc        = p.situationCode;
        const onPP      = isCarPP(sc);
        const sortOrder = p.sortOrder || 0;
        const periodNum = p.periodDescriptor?.number || 1;
        const timeSecs  = (() => {
          const [m, s] = (p.timeInPeriod || '0:00').split(':').map(Number);
          return m * 60 + (s || 0);
        })();

        if (onPP && !current) {
          // PP started
          current = {
            id:        opportunities.length,
            period:    periodNum,
            startTime: timeSecs,
            endTime:   timeSecs,
            startLabel: p.timeInPeriod || '—',
            endLabel:   p.timeInPeriod || '—',
            plays:     [],
            scored:    false,
          };
          opportunities.push(current);
        }
        if (onPP && current) {
          current.plays.push(p);
          current.endTime  = timeSecs;
          current.endLabel = p.timeInPeriod || '—';
        }
        if (!onPP && current) {
          // PP ended
          current = null;
        }
      });

      // Merge opportunities that are < 5s apart (split by goal then immediate resumption)
      const merged = [];
      opportunities.forEach(opp => {
        const prev = merged[merged.length - 1];
        if (prev && opp.period === prev.period && opp.startTime - prev.endTime < 5) {
          prev.plays.push(...opp.plays);
          prev.endTime  = opp.endTime;
          prev.endLabel = opp.endLabel;
        } else {
          merged.push(opp);
        }
      });

      // Enrich each opportunity
      const shotTypes  = ['shot-on-goal', 'goal', 'missed-shot', 'blocked-shot'];
      const ppOpps = merged.map((opp, idx) => {
        const shots    = opp.plays.filter(p => shotTypes.includes(p.typeDescKey));
        const sog      = opp.plays.filter(p => ['shot-on-goal','goal'].includes(p.typeDescKey));
        const goals    = opp.plays.filter(p => p.typeDescKey === 'goal' && p.details?.eventOwnerTeamId === carId);
        const duration = opp.endTime - opp.startTime;

        // xG from shot coordinates
        const xg = shots.reduce((sum, p) => {
          const d = p.details || {};
          const x = d.xCoord, y = d.yCoord;
          if (x == null || y == null) return sum + 0.08;
          const absX = Math.abs(x);
          const dist = Math.sqrt(Math.pow(absX - 89, 2) + y * y);
          const angle = Math.abs(Math.atan2(Math.abs(y), Math.max(89 - absX, 1)) * 180 / Math.PI);
          const raw = Math.min(Math.exp(-dist / 15) * Math.max(Math.cos(angle * Math.PI / 180), 0.2), 1);
          return sum + Math.max(raw * 0.55, 0.02);
        }, 0);

        // Players who appeared (from rosterSpots + event details)
        const playerIds = new Set();
        opp.plays.forEach(p => {
          const d = p.details || {};
          [d.shootingPlayerId, d.scoringPlayerId, d.hittingPlayerId,
           d.assist1PlayerId, d.assist2PlayerId, d.blockingPlayerId
          ].filter(Boolean).forEach(id => {
            // Only include CAR players (heuristic: player in rosterSpots with carId)
            playerIds.add(id);
          });
        });

        // Shot type breakdown
        const shotTypeCounts = {};
        shots.forEach(p => {
          const st = p.details?.shotType || 'Unknown';
          shotTypeCounts[st] = (shotTypeCounts[st] || 0) + 1;
        });

        // Zone entry approximation: first shot attempt within 12s of PP start
        const firstShot = shots.find(p => {
          const [m, s] = (p.timeInPeriod || '0:00').split(':').map(Number);
          return (m * 60 + (s || 0)) - opp.startTime <= 12;
        });
        const quickEntry = !!firstShot;

        // Goal details
        const goalDetails = goals.map(p => ({
          scorer:  pName(p.details?.scoringPlayerId),
          assists: [p.details?.assist1PlayerId, p.details?.assist2PlayerId]
            .filter(Boolean).map(pName).filter(n => n !== '—'),
          time:    p.timeInPeriod,
          shotType: p.details?.shotType || null,
        }));

        // Shot locations for mini-rink — all CAR PP shots, marked as isCanes
        const shotEvents = shots.map(p => ({
          x:        p.details?.xCoord,
          y:        p.details?.yCoord,
          type:     p.typeDescKey,
          t:        p.typeDescKey === 'goal' ? 'g'
                  : p.typeDescKey === 'shot-on-goal' ? 's'
                  : p.typeDescKey === 'missed-shot'  ? 'm' : 'b',
          isCanes:  true,  // all PP shots are CAR → red dots
          id:       p.sortOrder || Math.random(),
          period:   opp.period,
          timeInPeriod: p.timeInPeriod || '0:00',
        })).filter(e => e.x != null && e.y != null);

        return {
          idx,
          period:    periodLabel(opp.period),
          startTime: opp.startLabel,
          endTime:   opp.endLabel,
          duration,
          scored:    goals.length > 0,
          goals:     goalDetails,
          sog:       sog.length,
          shots:     shots.length,
          xg:        parseFloat(xg.toFixed(2)),
          shotTypeCounts,
          quickEntry,
          shotEvents,
          playerIds: [...playerIds],
          rawPlays:  opp.plays, // kept for unit detection below, not rendered
        };
      });

      // ── PP Units from known config ───────────────────────────
      // Use hardcoded unit configs rather than inferring from incomplete
      // event data — play-by-play only captures players who touched the puck.
      const carRosterIds = new Set(
        (pbp.rosterSpots || [])
          .filter(s => s.teamId === carId)
          .map(s => s.playerId)
      );
      const goalieIds = new Set(
        (pbp.rosterSpots || [])
          .filter(s => s.teamId === carId && s.positionCode === 'G')
          .map(s => s.playerId)
      );

      ppOpps.forEach(opp => {
        const skaterIds = new Set();
        (opp.rawPlays || []).forEach(p => {
          const d = p.details || {};
          [d.shootingPlayerId, d.scoringPlayerId,
           d.assist1PlayerId, d.assist2PlayerId,
           d.hittingPlayerId,
          ].filter(Boolean).forEach(id => {
            if (carRosterIds.has(id) && !goalieIds.has(id)) skaterIds.add(id);
          });
        });
        opp.carSkaterIds = [...skaterIds];
        opp.unit = inferPPUnit(season, opp.carSkaterIds);
      });

      // Build display unit arrays from config for the chips at the top
      const unitConfig = CAR_PP_UNITS[season];
      const ppUnit1 = unitConfig?.pp1
        .map(id => pName(id)).filter(n => n !== '—') ?? [];
      const ppUnit2 = unitConfig?.pp2
        .map(id => pName(id)).filter(n => n !== '—') ?? [];

      // Summary totals
      const totalGoals = ppOpps.filter(o => o.scored).length;
      const totalSOG   = ppOpps.reduce((s, o) => s + o.sog, 0);
      const totalXG    = parseFloat(ppOpps.reduce((s, o) => s + o.xg, 0).toFixed(2));

      setDrillStat({
        label: 'CAR Power Play Analysis',
        type: 'ppanalysis',
        ppOpps,
        summary: {
          goals: totalGoals,
          opps:  ppOpps.length,
          sog:   totalSOG,
          xg:    totalXG,
        },
        ppUnit1,
        ppUnit2,
        rosterSpots: pbp.rosterSpots || [],
      });
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
    } else if (statKey === 'pk') {
      // ── Rich PK Analysis ────────────────────────────────────
      const isOppPP = (sc) => {
        if (!sc || sc.length < 4) return false;
        const awayS = parseInt(sc[1]), homeS = parseInt(sc[2]);
        const carS  = gameHome ? homeS : awayS;
        const oppS  = gameHome ? awayS : homeS;
        return oppS > carS;
      };

      // Walk plays and group into PK windows
      const pkOpportunities = [];
      let current = null;
      plays.forEach(p => {
        const sc       = p.situationCode;
        const onPK     = isOppPP(sc);
        const periodNum = p.periodDescriptor?.number || 1;
        const timeSecs  = (() => {
          const [m, s] = (p.timeInPeriod || '0:00').split(':').map(Number);
          return m * 60 + (s || 0);
        })();
        if (onPK && !current) {
          current = { id: pkOpportunities.length, period: periodNum, startTime: timeSecs,
            endTime: timeSecs, startLabel: p.timeInPeriod || '—', endLabel: p.timeInPeriod || '—', plays: [] };
          pkOpportunities.push(current);
        }
        if (onPK && current) { current.plays.push(p); current.endTime = timeSecs; current.endLabel = p.timeInPeriod || '—'; }
        if (!onPK && current) current = null;
      });

      // Merge close windows
      const merged = [];
      pkOpportunities.forEach(opp => {
        const prev = merged[merged.length - 1];
        if (prev && opp.period === prev.period && opp.startTime - prev.endTime < 5) {
          prev.plays.push(...opp.plays); prev.endTime = opp.endTime; prev.endLabel = opp.endLabel;
        } else { merged.push(opp); }
      });

      const shotTypes = ['shot-on-goal', 'goal', 'missed-shot', 'blocked-shot'];

      const pkOpps = merged.map((opp, idx) => {
        const oppShots = opp.plays.filter(p => shotTypes.includes(p.typeDescKey) && p.details?.eventOwnerTeamId !== carId);
        const oppSOG   = opp.plays.filter(p => ['shot-on-goal','goal'].includes(p.typeDescKey) && p.details?.eventOwnerTeamId !== carId);
        const goals    = opp.plays.filter(p => p.typeDescKey === 'goal' && p.details?.eventOwnerTeamId !== carId);
        const blocks   = opp.plays.filter(p => p.typeDescKey === 'blocked-shot' && p.details?.eventOwnerTeamId !== carId);
        const duration = opp.endTime - opp.startTime;

        // Blockers (CAR players doing the blocking)
        const blockerCounts = {};
        blocks.forEach(p => {
          const id = p.details?.blockingPlayerId;
          if (id) blockerCounts[id] = (blockerCounts[id] || 0) + 1;
        });
        const blockerList = Object.entries(blockerCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => ({ name: pName(parseInt(id)), count: n }));

        // xG against from OPP shots
        const xgAgainst = oppShots.reduce((sum, p) => {
          const d = p.details || {};
          const x = d.xCoord, y = d.yCoord;
          if (x == null || y == null) return sum + 0.08;
          const absX = Math.abs(x);
          const dist = Math.sqrt(Math.pow(absX - 89, 2) + y * y);
          const angle = Math.abs(Math.atan2(Math.abs(y), Math.max(89 - absX, 1)) * 180 / Math.PI);
          const raw = Math.min(Math.exp(-dist / 15) * Math.max(Math.cos(angle * Math.PI / 180), 0.2), 1);
          return sum + Math.max(raw * 0.55, 0.02);
        }, 0);

        // Shot type breakdown (OPP shots)
        const shotTypeCounts = {};
        oppShots.forEach(p => {
          const st = p.details?.shotType || 'Unknown';
          shotTypeCounts[st] = (shotTypeCounts[st] || 0) + 1;
        });

        // CAR skaters on this PK from event data (roster sets built below, use loose check for now)
        const carSkaterIds = new Set();
        opp.plays.forEach(p => {
          const d = p.details || {};
          [d.blockingPlayerId, d.shootingPlayerId, d.scoringPlayerId,
           d.assist1PlayerId, d.assist2PlayerId].filter(Boolean).forEach(id => {
            carSkaterIds.add(id); // refined against roster below
          });
        });

        // Shot events for mini rink (OPP shots — show where CAR was defending from)
        const shotEvents = oppShots.map(p => ({
          x:       p.details?.xCoord,
          y:       p.details?.yCoord,
          t:       p.typeDescKey === 'goal' ? 'g' : p.typeDescKey === 'shot-on-goal' ? 's'
                 : p.typeDescKey === 'missed-shot' ? 'm' : 'b',
          isCanes: false, // OPP shots — blue
          id:      p.sortOrder || Math.random(),
        })).filter(e => e.x != null && e.y != null);

        return {
          idx, period: periodLabel(opp.period),
          startTime: opp.startLabel, endTime: opp.endLabel, duration,
          allowed:   goals.length > 0,
          goalDetails: goals.map(p => ({
            scorer:  pName(p.details?.scoringPlayerId),
            assists: [p.details?.assist1PlayerId, p.details?.assist2PlayerId]
              .filter(Boolean).map(pName).filter(n => n !== '—'),
            time:    p.timeInPeriod,
            shotType: p.details?.shotType || null,
          })),
          sog:         oppSOG.length,
          shots:       oppShots.length,
          xgAgainst:   parseFloat(xgAgainst.toFixed(2)),
          shotTypeCounts,
          blockerList,
          shotEvents,
          carSkaterIds: [...carSkaterIds],
          rawPlays: opp.plays,
        };
      });

      // PK unit detection from config
      const carRosterIdsSet = new Set((pbp.rosterSpots || []).filter(s => s.teamId === carId).map(s => s.playerId));
      const goalieIdsSet    = new Set((pbp.rosterSpots || []).filter(s => s.teamId === carId && s.positionCode === 'G').map(s => s.playerId));
      pkOpps.forEach(opp => {
        // Re-collect skater IDs using the roster sets
        const skaterIds = new Set();
        (opp.rawPlays || []).forEach(p => {
          const d = p.details || {};
          [d.blockingPlayerId, d.shootingPlayerId, d.scoringPlayerId,
           d.assist1PlayerId, d.assist2PlayerId].filter(Boolean).forEach(id => {
            if (carRosterIdsSet.has(id) && !goalieIdsSet.has(id)) skaterIds.add(id);
          });
        });
        opp.carSkaterIds = [...skaterIds];
        opp.unit = inferPKUnit(season, opp.carSkaterIds);
      });

      const unitConfig = CAR_PK_UNITS[season];
      const pkUnit1 = unitConfig?.pk1.map(id => pName(id)).filter(n => n !== '—') ?? [];
      const pkUnit2 = unitConfig?.pk2.map(id => pName(id)).filter(n => n !== '—') ?? [];

      const totalGoalsAgainst = pkOpps.filter(o => o.allowed).length;
      const totalSOGAgainst   = pkOpps.reduce((s, o) => s + o.sog, 0);
      const totalXGAgainst    = parseFloat(pkOpps.reduce((s, o) => s + o.xgAgainst, 0).toFixed(2));
      const totalBlocks       = pkOpps.reduce((s, o) => s + o.blockerList.reduce((b, bl) => b + bl.count, 0), 0);

      setDrillStat({
        label: 'CAR Penalty Kill Analysis',
        type: 'pkanalysis',
        pkOpps,
        summary: { goalsAgainst: totalGoalsAgainst, opps: pkOpps.length, sogAgainst: totalSOGAgainst, xgAgainst: totalXGAgainst, blocks: totalBlocks },
        pkUnit1, pkUnit2,
        rosterSpots: pbp.rosterSpots || [],
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

    // xG — simple distance+angle model from shot coordinates
    // Higher weight for closer shots and better angles
    function shotXG(play) {
      const d = play.details || {};
      const x = d.xCoord, y = d.yCoord;
      if (x == null || y == null) return 0.05; // no coords: league avg ~5%
      // Distance from net (net at x=±89, y=0)
      const absX = Math.abs(x);
      const dist  = Math.sqrt(Math.pow(absX - 89, 2) + y * y);
      // Angle from centre (0 = straight on, 90 = behind net)
      const angle = Math.abs(Math.atan2(Math.abs(y), Math.max(89 - absX, 1)) * 180 / Math.PI);
      // Base xG from distance (logistic-ish curve)
      const distFactor = Math.exp(-dist / 15);
      // Angle penalty: straight-on shots are more dangerous
      const angleFactor = Math.cos(angle * Math.PI / 180);
      // Shot type bonus
      const shotBonus = d.shotType === 'Deflected' || d.shotType === 'Tip-In' ? 1.4
        : d.shotType === 'Backhand' ? 0.8 : 1.0;
      const raw = Math.min(distFactor * Math.max(angleFactor, 0.2) * shotBonus, 1);
      // Scale so league avg shot is ~8%
      return Math.round(Math.max(raw * 0.55, 0.02) * 100) / 100;
    }

    let carXG = 0, oppXG = 0;
    plays.forEach(p => {
      if (!['shot-on-goal','goal','missed-shot'].includes(p.typeDescKey)) return;
      const isCar = p.details?.eventOwnerTeamId === carId;
      const xg = shotXG(p);
      if (isCar) carXG += xg; else oppXG += xg;
    });

    // PP stats from boxscore (more reliable for PP%)
    const bs       = boxscore?.playerByGameStats;
    const ppRaw    = getGameStat('powerPlay');

    // PK stats — OPP PP opps = CAR PK opps
    let carPKOpps = 0, carPKGoalsAgainst = 0;
    plays.forEach(p => {
      if (p.typeDescKey !== 'goal') return;
      const sc = p.situationCode;
      if (!sc || sc.length < 4) return;
      const awayS = parseInt(sc[1]), homeS = parseInt(sc[2]);
      const carS  = gameHome ? homeS : awayS;
      const oppS  = gameHome ? awayS : homeS;
      // OPP on PP = CAR killing penalty
      if (oppS > carS && p.details?.eventOwnerTeamId !== carId) carPKGoalsAgainst++;
    });
    // Count distinct OPP PP windows as PK opportunities
    let onOppPP = false;
    plays.forEach(p => {
      const sc = p.situationCode;
      if (!sc || sc.length < 4) return;
      const awayS = parseInt(sc[1]), homeS = parseInt(sc[2]);
      const carS  = gameHome ? homeS : awayS;
      const oppS  = gameHome ? awayS : homeS;
      const isOppPP = oppS > carS;
      if (isOppPP && !onOppPP) { carPKOpps++; onOppPP = true; }
      if (!isOppPP) onOppPP = false;
    });

    return {
      sog:      { car: carSOG,    opp: oppSOG },
      hits:     { car: carHits,   opp: oppHits },
      blocked:  { car: carBlocks, opp: oppBlocks },
      faceoff:  { car: carFOW + carFOL > 0 ? carFOW / (carFOW + carFOL) * 100 : null, opp: null },
      penalties:{ car: carPens,   opp: oppPens },
      pp:       { gamePPGoals: carPPGoals, gamePPOpps: carPPOpps },
      pk:       { gamePKOpps: carPKOpps, gamePKGoalsAgainst: carPKGoalsAgainst },
      xg:       { car: parseFloat(carXG.toFixed(2)), opp: parseFloat(oppXG.toFixed(2)) },
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
    const periodLabel = n => n <= 3 ? `P${n}` : inPlayoffs ? (n === 4 ? "OT" : `${n - 3}OT`) : n === 4 ? "OT" : "SO";
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
  // Return ALL goalies who played (toi > 0 or shotsAgainst > 0), sorted by TOI desc.
  // In a goalie change game this gives us both goalies; normally just one.
  const oppKey = gameHome ? 'awayTeam' : 'homeTeam';

  function activateGoalies(goalies = []) {
    return goalies
      .filter(g =>
        (g.shotsAgainst != null && g.shotsAgainst > 0) ||
        (g.toi && g.toi !== '00:00' && g.toi !== '0:00')
      )
      .sort((a, b) => {
        // Sort by TOI descending so starter appears first
        const toSecs = toi => {
          if (!toi) return 0;
          const [m, s] = toi.split(':').map(Number);
          return (m || 0) * 60 + (s || 0);
        };
        return toSecs(b.toi) - toSecs(a.toi);
      });
  }

  const carGoalies = activateGoalies(boxscore?.playerByGameStats?.[gameHome ? 'homeTeam' : 'awayTeam']?.goalies || []);
  const oppGoalies = activateGoalies(boxscore?.playerByGameStats?.[oppKey]?.goalies || []);
  // Keep single-goalie references for components that expect one
  const carGoalie  = carGoalies[0] || null;
  const oppGoalie  = oppGoalies[0] || null;

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

      {/* ── Period summary auto-popup ── */}
      {newSummary && !viewingSummary && (
        <PeriodSummary
          summary={newSummary}
          onDismiss={dismissNewSummary}
          onNarrativeReady={updateSummaryNarrative}
          carAbbr={CAR_ABBR}
          oppAbbr={oppAbbr}
          homeAbbr={homeAbbr}
          awayAbbr={awayAbbr}
          isPlayoff={inPlayoffs}
        />
      )}

      {/* ── Period summary viewer (from bell) ── */}
      {viewingSummary && (
        <PeriodSummary
          summary={viewingSummary}
          onDismiss={() => setViewingSummaryPeriod(null)}
          onNarrativeReady={viewingSummary.isGameSummary
            ? (_, text) => updateGameNarrative(text)
            : updateSummaryNarrative}
          carAbbr={CAR_ABBR}
          oppAbbr={oppAbbr}
          homeAbbr={homeAbbr}
          awayAbbr={awayAbbr}
          readOnly
          isPlayoff={inPlayoffs}
        />
      )}

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
                        {(() => {
                          const n = pbp.periodDescriptor?.number;
                          if (n === 1) return '1st';
                          if (n === 2) return '2nd';
                          if (n === 3) return '3rd';
                          // OT intermissions: after OT1=period4, OT2=period5, etc.
                          return `OT${n - 3}`;
                        })()} Intermission
                      </div>
                      <div className="score-clock">{displayClock || pbp.clock.timeRemaining}</div>
                    </>
                  ) : (
                    <>
                      <div className="score-period">
                        {(() => {
                          const n = pbp?.periodDescriptor?.number;
                          const t = pbp?.periodDescriptor?.periodType;
                          if (!n) return '—';
                          if (n <= 3) return `P${n}`;
                          // Playoffs: OT1=4, OT2=5, OT3=6 — all full 20min periods
                          // Regular season: period 4 = OT (5min 3v3), period 5 = SO
                          if (inPlayoffs) return n === 4 ? 'OT' : `${n - 3}OT`;
                          return n === 4 ? 'OT' : 'SO';
                        })()}
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
              {/* 4v4 or 3v3 (both teams penalized) — regular season only, playoffs use full strength */}
              {!inPlayoffs && ((isLive && currentSituation?.strength === '4v4') || debugSituation?.strength === '4v4') ? (
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
          debugInsight={debugInsight}
          gameLogInsights={gameLogInsights}
          isPlayoff={inPlayoffs}
        />
      )}

      {/* ── Game metrics — top row: SOG, Hits, Blocks, Penalties ── */}
      <div className="metrics-grid metrics-grid-4">
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
        {(() => {
          const pens = liveStats?.penalties;
          const carP = pens?.car ?? 0;
          const oppP = pens?.opp ?? 0;
          const color = carP < oppP ? 'green' : null;
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
      </div>

      {/* ── Game metrics — bottom row: FO%, PP%, PK% ── */}
      <div className="metrics-grid metrics-grid-3">
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
          const gpp     = liveStats?.pp;
          const hasGamePP = gpp?.gamePPOpps > 0;
          const gamePPPct = hasGamePP ? gpp.gamePPGoals / gpp.gamePPOpps * 100 : null;
          const avgPct    = ppPct ? (ppPct <= 1 ? (ppPct * 100).toFixed(1) : parseFloat(ppPct).toFixed(1)) : null;
          const avgLabel  = inPlayoffs ? 'PO avg' : 'Szn avg';
          return (
            <MetCard
              label="PP %"
              value={hasGamePP ? `${gamePPPct.toFixed(1)}%` : '—'}
              sub={hasGamePP
                ? `${gpp.gamePPGoals}/${gpp.gamePPOpps} · ${avgLabel} ${avgPct ?? '—'}%`
                : `${avgLabel}${avgPct ? ` ${avgPct}%` : ''}`}
              color={hasGamePP && avgPct && gamePPPct >= parseFloat(avgPct) ? 'green' : null}
              onClick={pbp ? () => buildDrillDown('pp') : null}
            />
          );
        })()}
        {(() => {
          const gpk       = liveStats?.pk;
          const hasGamePK = gpk?.gamePKOpps > 0;
          const survived  = hasGamePK ? gpk.gamePKOpps - gpk.gamePKGoalsAgainst : null;
          const gamePKPct = hasGamePK ? survived / gpk.gamePKOpps * 100 : null;
          const avgPct    = pkPct ? (pkPct <= 1 ? (pkPct * 100).toFixed(1) : parseFloat(pkPct).toFixed(1)) : null;
          const avgLabel  = inPlayoffs ? 'PO avg' : 'Szn avg';
          return (
            <MetCard
              label="PK %"
              value={hasGamePK ? `${gamePKPct.toFixed(1)}%` : '—'}
              sub={hasGamePK
                ? `${survived}/${gpk.gamePKOpps} killed · ${avgLabel} ${avgPct ?? '—'}%`
                : `${avgLabel}${avgPct ? ` ${avgPct}%` : ''}`}
              color={hasGamePK && avgPct && gamePKPct >= parseFloat(avgPct) ? 'green' : null}
              onClick={pbp ? () => buildDrillDown('pk') : null}
            />
          );
        })()}
      </div>

      {/* ── Shot Volume + Corsi/Fenwick/PDO ── */}
      {pbp?.plays && (
        <AdvancedGamePanel pbp={pbp} gameHome={gameHome} isLive={isLive} boxscore={boxscore} />
      )}

      {/* ── Momentum ── */}
      {pbp?.plays?.length > 0 && (
        <MomentumCard pbp={pbp} gameHome={gameHome} isLive={isLive} oppAbbr={oppAbbr} />
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
          {(carGoalies.length > 0 || oppGoalies.length > 0) && (
            <div className="card">
              <div className="sec-label">Goalies</div>
              {carGoalies.map((g, i) => (
                <div key={g.playerId || i}>
                  {i === 1 && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', margin: '2px 0', letterSpacing: '0.05em' }}>
                      — goalie change —
                    </div>
                  )}
                  <GoalieRow
                    name={g.name?.default || `#${g.sweaterNumber}`}
                    abbr="CAR"
                    saves={g.saves}
                    shotsAgainst={g.shotsAgainst}
                    savePctg={g.savePctg}
                    color="var(--red-bright)"
                    seasonData={goalieAnalytics?.[String(g.playerId)] || null}
                  />
                </div>
              ))}
              {oppGoalies.map((g, i) => (
                <div key={g.playerId || i}>
                  {i === 1 && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', margin: '2px 0', letterSpacing: '0.05em' }}>
                      — goalie change —
                    </div>
                  )}
                  <GoalieRow
                    name={g.name?.default || `#${g.sweaterNumber}`}
                    abbr={oppAbbr}
                    saves={g.saves}
                    shotsAgainst={g.shotsAgainst}
                    savePctg={g.savePctg}
                    color={oppColor}
                    seasonData={goalieAnalytics?.[String(g.playerId)] || null}
                  />
                </div>
              ))}
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

              {/* Shot attempts (Corsi) + xG — from PBP, prepended to right-rail stats */}
              {pbp?.plays?.length > 0 && (() => {
                const sa = computeShotAttempts(pbp.plays);

                // xG source: MoneyPuck (post-game, 5v5) → coordinate estimate (live fallback)
                const xgCar    = gameXGData?.find(r => r.team === 'CAR');
                const xgOpp    = gameXGData?.find(r => r.team === oppAbbr);
                const mpXG     = xgCar != null && xgOpp != null;
                const carXG    = mpXG ? xgCar.xgf : (liveStats?.xg?.car ?? 0);
                const oppXG    = mpXG ? xgOpp.xgf : (liveStats?.xg?.opp ?? 0);
                const xgHelp   = mpXG
                  ? 'MoneyPuck 5v5 expected goals — their full xG model including shot quality, traffic, and pre-shot movement. Available a few hours after game end.'
                  : `xG estimated from shot distance and angle (live estimate). Replaced by MoneyPuck's full model once the game ends.`;

                const rows = [
                  { label: 'Shot Attempts (CF)', carN: sa.carCorsi, oppN: sa.oppCorsi,
                    help: 'Corsi: all shot attempts including misses and blocks. Best possession proxy.' },
                  { label: `xG${mpXG ? ' 5v5' : ' (est)'}`, carN: carXG, oppN: oppXG,
                    isDecimal: true, help: xgHelp },
                ];
                return rows.map(({ label, carN, oppN, isDecimal, help }) => {
                  const total = (carN || 0) + (oppN || 0) || 1;
                  const fmt   = v => v == null ? '—' : isDecimal ? v.toFixed(2) : v;
                  return (
                    <div key={label} className="gm-stat-row">
                      <span className="gm-stat-val red">{fmt(carN)}</span>
                      <div className="gm-stat-mid">
                        <div className="gm-stat-label">
                          {label}
                          <InfoTip text={help} position="above" />
                        </div>
                        <div className="dual-bar">
                          <div className="fill-red"  style={{width:`${Math.round((carN||0)/total*100)}%`}} />
                          <div className="fill-blue" style={{width:`${Math.round((oppN||0)/total*100)}%`}} />
                        </div>
                      </div>
                      <span className="gm-stat-val muted">{fmt(oppN)}</span>
                    </div>
                  );
                });
              })()}

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
    {drillStat     && <StatDrillPopup drillStat={drillStat} onClose={() => setDrillStat(null)} oppAbbr={oppAbbr} isPlayoff={inPlayoffs} />}
    {puckDropPopup && <PuckDropPopup data={puckDropPopup}  onClose={clearPuckDropPopup} />}
    {goalPopup     && <GoalPopup    data={goalPopup}       onClose={clearGoalPopup}    />}
    {penaltyPopup  && <PenaltyPopup data={penaltyPopup}    onClose={clearPenaltyPopup} />}
    {winPopup      && <WinPopup     data={winPopup}        onClose={clearWinPopup}     />}

    {/* ── Debug popups ── */}
    {debugGoalPopup    && <GoalPopup    data={debugGoalPopup}    onClose={() => setDebugGoalPopup(null)}    />}
    {debugPenaltyPopup && <PenaltyPopup data={debugPenaltyPopup} onClose={() => setDebugPenaltyPopup(null)} />}
    {debugWinPopup     && <WinPopup     data={debugWinPopup}     onClose={() => setDebugWinPopup(null)}     />}
    {debugPuckDropPopup && <PuckDropPopup data={debugPuckDropPopup} onClose={() => setDebugPuckDropPopup(null)} />}

    {/* ── Debug panel (5 taps on score bar) ── */}
    {debugOpen && (
      <div className="debug-panel">
        <div className="debug-panel-header">
          <div>
            <div className="debug-panel-title">🛠 Event Debug</div>
            <div className="debug-panel-sub">Tap to fire game events</div>
          </div>
          <button className="debug-close-btn" onClick={() => setDebugOpen(false)}>✕</button>
        </div>

        <div className="debug-panel-cols">
          {/* Left: Popups + Insights */}
          <div className="debug-col">
            <div className="debug-section-label">Popups</div>
            <div className="debug-panel-btns">
              <button className="debug-btn goal" onClick={() => setDebugGoalPopup({ scorer: 'Sebastian Aho', assists: ['Andrei Svechnikov', 'Jaccob Slavin'], shotType: 'Wrist', period: 'P2', time: '14:32' })}>🚨 CAR Goal</button>
              <button className="debug-btn" style={{ background: 'rgba(204,34,0,0.15)', color: 'var(--red-bright)' }} onClick={() => setDebugPuckDropPopup({ gameId: 'debug' })}>🏒 Puck Drop</button>
              <button className="debug-btn penalty" onClick={() => setDebugPenaltyPopup({ id: 'debug-1', player: 'Brad Marchand', description: 'Hooking', duration: 2, period: 'P2', time: '08:17' })}>⚡ PP Alert</button>
              <button className="debug-btn win" onClick={() => setDebugWinPopup({ score: 'CAR 4 – BOS 2' })}>🏆 Win Popup</button>
            </div>
            <div className="debug-section-label">Insights</div>
            <div className="debug-panel-btns">
              <button className="debug-btn goal" onClick={() => { setDebugInsight({ icon: '✅', text: 'CAR challenge (offside) succeeded — call overturned', type: 'good' }); setTimeout(() => setDebugInsight(null), 10000); }}>✅ Won</button>
              <button className="debug-btn penalty" onClick={() => { setDebugInsight({ icon: '❌', text: 'CAR challenge (goal interference) failed — 2-min penalty', type: 'warn' }); setTimeout(() => setDebugInsight(null), 10000); }}>❌ Lost</button>
              <button className="debug-btn pp-opp" onClick={() => { setDebugInsight({ icon: '😤', text: 'FLA challenge succeeded — call overturned', type: 'warn' }); setTimeout(() => setDebugInsight(null), 10000); }}>😤 Opp Won</button>
              <button className="debug-btn pp-car" onClick={() => { setDebugInsight({ icon: '🎥', text: '1 league-initiated video review this game', type: 'neutral' }); setTimeout(() => setDebugInsight(null), 10000); }}>🎥 Review</button>
            </div>
          </div>

          {/* Right: Situation + Push */}
          <div className="debug-col">
            <div className="debug-section-label">Situation</div>
            <div className="debug-panel-btns">
              <button className="debug-btn pp-car" onClick={() => { setDebugSituation({ strength: 'PP', team: 'CAR' }); setTimeout(() => setDebugSituation(null), 15000); }}>🟢 5v4 PP</button>
              <button className="debug-btn pp-car" onClick={() => { setDebugSituation({ strength: 'PP', team: 'CAR', carSkaters: 5, oppSkaters: 3 }); setTimeout(() => setDebugSituation(null), 15000); }}>🟢🟢 5v3 PP</button>
              <button className="debug-btn pp-opp" onClick={() => { setDebugSituation({ strength: 'PP', team: 'OPP' }); setTimeout(() => setDebugSituation(null), 15000); }}>🟡 Opp PP</button>
              <button className="debug-btn close" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)' }} onClick={() => { setDebugSituation({ strength: '4v4', carSkaters: 4, oppSkaters: 4 }); setTimeout(() => setDebugSituation(null), 15000); }}>⚪ 4v4</button>
              <button className="debug-btn close" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)' }} onClick={() => { setDebugSituation({ strength: '4v4', carSkaters: 3, oppSkaters: 3 }); setTimeout(() => setDebugSituation(null), 15000); }}>⚪ 3v3 OT</button>
              <button className="debug-btn" style={{ background: 'rgba(250,190,30,0.1)', color: '#fbbf24' }} onClick={() => { setDebugSituation({ carEN: true }); setTimeout(() => setDebugSituation(null), 15000); }}>🥅 CAR EN</button>
              <button className="debug-btn" style={{ background: 'rgba(250,190,30,0.1)', color: '#fbbf24' }} onClick={() => { setDebugSituation({ oppEN: true }); setTimeout(() => setDebugSituation(null), 15000); }}>🥅 Opp EN</button>
            </div>
            <div className="debug-section-label">Push</div>
            <div className="debug-panel-btns">
              <button className="debug-btn push" onClick={async () => {
                const url = import.meta.env.VITE_WORKER_URL;
                if (!url) return;
                const res = await fetch(`${url}/push/test?secret=eyewall-2026`).catch(() => null);
                alert(res?.ok ? '✅ Push sent!' : '❌ Push failed');
              }}>📲 Test Push</button>
            </div>
          </div>
        </div>
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

function GoalieRow({ name, abbr, saves, shotsAgainst, savePctg, color, seasonData }) {
  const svPct = savePctg != null
    ? (savePctg <= 1 ? savePctg.toFixed(3) : (savePctg / 100).toFixed(3))
    : '—';
  const gameGsax = computeGSAx(shotsAgainst, saves);

  const seasonGsax = seasonData?.gsax ?? null;
  const seasonGp   = seasonData?.gp ?? null;
  const gsaxColor  = seasonGsax == null ? 'var(--text-muted)'
    : seasonGsax >= 5  ? 'var(--green)'
    : seasonGsax >= 0  ? 'var(--text-muted)'
    : 'var(--red-bright)';

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
        {seasonGsax != null ? (
          <div className="goalie-stat-col">
            <span className="goalie-stat-label">
              GSAX <InfoTip text={`Regular season goals saved above expected (MoneyPuck flurry-adjusted xGoals model). Shown year-round as the larger sample is more reliable than playoff sample sizes. Positive = saving more goals than an average goalie on the same shots. ${seasonGp ? seasonGp + ' GP this season.' : ''}`} position="above" />
            </span>
            <span className="goalie-stat-val" style={{color: gsaxColor}}>
              {seasonGsax > 0 ? '+' : ''}{seasonGsax}
            </span>
          </div>
        ) : gameGsax ? (
          <div className="goalie-stat-col">
            <span className="goalie-stat-label">
              GSAx <InfoTip text={gameGsax.note} position="above" />
            </span>
            <span className="goalie-stat-val" style={{color: gameGsax.color}}>{gameGsax.label}</span>
          </div>
        ) : null}
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
function StatDrillPopup({ drillStat, onClose, oppAbbr, isPlayoff = false }) {
  const [tab, setTab] = useState('car');
  if (!drillStat) return null;

  // Support both old shape (rows) and new shape (carRows/oppRows)
  const carRows = drillStat.carRows ?? drillStat.rows ?? [];
  const oppRows = drillStat.oppRows ?? [];
  const hasOpp  = oppRows.length > 0 || drillStat.oppRows !== undefined;
  const rows    = tab === 'car' ? carRows : oppRows;
  const teamLabel = tab === 'car' ? 'CAR' : (oppAbbr || 'OPP');

  // Derive periods dynamically from actual data so OT2, OT3, SO etc. all appear.
  // Collect every period key that appears in any row, sort numerically by period number.
  const periodLabel = n => {
    if (!n) return n;
    const num = parseInt(n.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num) || num <= 3) return n; // already labelled P1/P2/P3
    if (isPlayoff) return num === 4 ? 'OT' : `${num - 3}OT`;
    return num === 4 ? 'OT' : 'SO';
  };

  // Map a period label back to a sortable number
  // P1→1, P2→2, P3→3, OT→4, SO→5, 2OT→5, 3OT→6 etc.
  function periodSortKey(label) {
    if (!label) return 99;
    if (label === 'SO') return 5;
    if (label === 'OT') return 4;
    const m = label.match(/^(\d+)OT$/);
    if (m) return 3 + parseInt(m[1], 10);
    const digits = parseInt(label.replace(/[^0-9]/g, ''), 10);
    return isNaN(digits) ? 99 : digits;
  }

  const allPeriodKeys = [...new Set(
    [...carRows, ...oppRows].flatMap(r => Object.keys(r.periods || {}))
  )].sort((a, b) => periodSortKey(a) - periodSortKey(b));
  // Fall back to standard periods if no data yet
  const periods = allPeriodKeys.length > 0
    ? allPeriodKeys
    : ['P1', 'P2', 'P3'];

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
          {rows.length === 0 && drillStat.type !== 'ppanalysis' && drillStat.type !== 'pkanalysis' && (
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

          {drillStat.type === 'ppanalysis' && (
            <PPAnalysisPanel drillStat={drillStat} />
          )}

          {drillStat.type === 'pkanalysis' && (
            <PKAnalysisPanel drillStat={drillStat} />
          )}

          {(drillStat.type === 'shots') && (
            <div className="drill-table">
              <div
                className="drill-col-header shots"
                style={{ gridTemplateColumns: `1fr ${periods.map(() => '34px').join(' ')} 42px` }}
              >
                <span>Player</span>
                {periods.map(p => <span key={p}>{periodLabel(p)}</span>)}
                <span>Total</span>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="drill-row-grid shots"
                  style={{ gridTemplateColumns: `1fr ${periods.map(() => '34px').join(' ')} 42px` }}>
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
                <div className="drill-row-grid shots drill-totals-row"
                  style={{ gridTemplateColumns: `1fr ${periods.map(() => '34px').join(' ')} 42px` }}>
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
                    {Object.keys(penByPeriod).sort((a, b) => {
                      const sk = l => {
                        if (l === 'SO') return 5;
                        if (l === 'OT') return 4;
                        const m = l.match(/^(\d+)OT$/);
                        if (m) return 3 + parseInt(m[1], 10);
                        return parseInt(l.replace(/[^0-9]/g, ''), 10) || 99;
                      };
                      return sk(a) - sk(b);
                    }).map(p => (
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


// ── PP Analysis Panel ─────────────────────────────────────────
function PPAnalysisPanel({ drillStat }) {
  const [openIdx, setOpenIdx] = useState(null);
  const { ppOpps, summary, ppUnit1, ppUnit2 } = drillStat;

  if (!ppOpps?.length) {
    return <div className="drill-empty">No CAR power plays this game.</div>;
  }

  const toggle = idx => setOpenIdx(o => o === idx ? null : idx);

  const pctColor = (goals, opps) => {
    const pct = goals / opps;
    return pct >= 0.25 ? 'var(--green)' : pct > 0 ? 'var(--text-muted)' : 'var(--red-bright)';
  };

  const outcomeIcon = opp => opp.scored ? '⚡' : opp.sog >= 3 ? '🎯' : opp.shots === 0 ? '❌' : '🔲';
  const outcomeLabel = opp => opp.scored ? 'GOAL' : opp.sog >= 3 ? 'Shots' : opp.shots === 0 ? 'No shots' : 'No score';
  const outcomeClass = opp => opp.scored ? 'pp-outcome goal' : opp.sog >= 3 ? 'pp-outcome shots' : 'pp-outcome none';

  return (
    <div className="pp-analysis">

      {/* ── Summary bar ───────────────────────────────────── */}
      <div className="pp-summary-row">
        <div className="pp-summary-stat">
          <span className="pp-summary-val" style={{ color: pctColor(summary.goals, summary.opps) }}>
            {summary.goals}/{summary.opps}
          </span>
          <span className="pp-summary-label">PP Goals</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.opps > 0 ? `${Math.round(summary.goals / summary.opps * 100)}%` : '—'}</span>
          <span className="pp-summary-label">PP%</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.sog}</span>
          <span className="pp-summary-label">SOG</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.xg}</span>
          <span className="pp-summary-label">
            xG <InfoTip text="Expected goals on PP shots — estimated from shot distance and angle. Higher = better quality looks." position="above" />
          </span>
        </div>
      </div>

      {/* ── PP Units ──────────────────────────────────────── */}
      {ppUnit1?.length > 0 && (
        <div className="pp-unit-row">
          <span className="pp-unit-label">PP1</span>
          <div className="pp-unit-chips">
            {ppUnit1.map((name, i) => (
              <span key={i} className="pp-unit-chip pp1">{name.split(' ').pop()}</span>
            ))}
          </div>
        </div>
      )}
      {ppUnit2?.length > 0 && (
        <div className="pp-unit-row">
          <span className="pp-unit-label">PP2</span>
          <div className="pp-unit-chips">
            {ppUnit2.map((name, i) => (
              <span key={i} className="pp-unit-chip pp2">{name.split(' ').pop()}</span>
            ))}
          </div>
        </div>
      )}
      {(ppUnit1?.length > 0 || ppUnit2?.length > 0) && (
        <div className="pp-unit-note">
          Units inferred from play-by-play — players who didn't touch the puck may not appear. Some PPs may be untagged if there wasn't enough data to identify the unit.
        </div>
      )}

      {/* ── Per-opportunity breakdown ─────────────────────── */}
      <div className="pp-opps-list">
        {ppOpps.map((opp, i) => (
          <div key={i} className="pp-opp-item">
            {/* Collapsed header — always visible */}
            <div className="pp-opp-header" onClick={() => toggle(i)}>
              <div className="pp-opp-left">
                <span className="pp-opp-num">PP {i + 1}</span>
                {opp.unit && (
                  <span className={`pp-unit-badge pp${opp.unit}`}>PP{opp.unit}</span>
                )}
                <span className="pp-opp-time">{opp.period} · {opp.startTime}</span>
                {opp.quickEntry && <span className="pp-entry-badge">⚡ Quick entry</span>}
              </div>
              <div className="pp-opp-right">
                <span className={outcomeClass(opp)}>{outcomeIcon(opp)} {outcomeLabel(opp)}</span>
                <span className="pp-opp-sog">{opp.sog} SOG</span>
                <span className="pp-opp-chevron">{openIdx === i ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {openIdx === i && (
              <div className="pp-opp-detail">

                {/* Goal details */}
                {opp.goals.map((g, gi) => (
                  <div key={gi} className="pp-goal-row">
                    <span className="pp-goal-icon">🚨</span>
                    <div>
                      <span className="pp-goal-scorer">{g.scorer}</span>
                      {g.shotType && <span className="pp-goal-shottype">{g.shotType}</span>}
                      {g.assists.length > 0 && (
                        <div className="pp-goal-assists">Assists: {g.assists.join(', ')}</div>
                      )}
                    </div>
                    <span className="pp-goal-time">{g.time}</span>
                  </div>
                ))}

                {/* Shot stats row */}
                <div className="pp-detail-stats">
                  <div className="pp-detail-stat">
                    <span className="pp-detail-val">{opp.sog}</span>
                    <span className="pp-detail-label">SOG</span>
                  </div>
                  <div className="pp-detail-stat">
                    <span className="pp-detail-val">{opp.shots}</span>
                    <span className="pp-detail-label">SA</span>
                  </div>
                  <div className="pp-detail-stat">
                    <span className="pp-detail-val">{opp.xg}</span>
                    <span className="pp-detail-label">xG</span>
                  </div>
                  <div className="pp-detail-stat">
                    <span className="pp-detail-val">{opp.duration}s</span>
                    <span className="pp-detail-label" style={{display:'flex',alignItems:'center',gap:2}}>Duration <InfoTip text="Duration — time in seconds between the first and last tracked play of this opportunity. Scores early = shorter duration. May be shorter than the full 2-minute penalty if there were no events near the start or end." position="above" /></span>
                  </div>
                </div>

                {/* Shot type breakdown */}
                {Object.keys(opp.shotTypeCounts).length > 0 && (
                  <div className="pp-shottype-row">
                    {Object.entries(opp.shotTypeCounts).map(([type, count]) => (
                      <span key={type} className="pp-shottype-chip">
                        {type} ×{count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Mini shot map */}
                {opp.shotEvents.length > 0 && (
                  <div className="pp-mini-rink">
                    <div className="pp-mini-rink-label">Shot locations</div>
                    <IceRink
                      events={opp.shotEvents}
                      roster={{}}
                      readOnly
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



// ── PK Analysis Panel ─────────────────────────────────────────
function PKAnalysisPanel({ drillStat }) {
  const [openIdx, setOpenIdx] = useState(null);
  const { pkOpps, summary, pkUnit1, pkUnit2 } = drillStat;

  if (!pkOpps?.length) {
    return <div className="drill-empty">No CAR penalty kills this game.</div>;
  }

  const toggle = idx => setOpenIdx(o => o === idx ? null : idx);

  const pctColor = (against, opps) => {
    const pct = against / opps;
    return pct === 0 ? 'var(--green)' : pct <= 0.25 ? 'var(--text-muted)' : 'var(--red-bright)';
  };

  const outcomeIcon  = opp => opp.allowed ? '🚨' : opp.sog >= 4 ? '🛡️' : '✅';
  const outcomeLabel = opp => opp.allowed ? 'Goal' : opp.sog >= 4 ? 'Held' : 'Killed';
  const outcomeClass = opp => opp.allowed ? 'pp-outcome none' : opp.sog >= 4 ? 'pp-outcome shots' : 'pp-outcome goal';

  const survived = summary.opps - summary.goalsAgainst;

  return (
    <div className="pp-analysis">

      {/* ── Summary bar ───────────────────────────────────── */}
      <div className="pp-summary-row">
        <div className="pp-summary-stat">
          <span className="pp-summary-val" style={{ color: pctColor(summary.goalsAgainst, summary.opps) }}>
            {survived}/{summary.opps}
          </span>
          <span className="pp-summary-label">PK Kills</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.opps > 0 ? `${Math.round(survived / summary.opps * 100)}%` : '—'}</span>
          <span className="pp-summary-label">PK%</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.sogAgainst}</span>
          <span className="pp-summary-label">SOG vs</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.blocks}</span>
          <span className="pp-summary-label">Blocks</span>
        </div>
        <div className="pp-summary-divider" />
        <div className="pp-summary-stat">
          <span className="pp-summary-val">{summary.xgAgainst}</span>
          <span className="pp-summary-label">
            xGA <InfoTip text="Expected goals against on PK shots — estimated from shot distance and angle. Lower is better." position="above" />
          </span>
        </div>
      </div>

      {/* ── PK Units ──────────────────────────────────────── */}
      {pkUnit1?.length > 0 && (
        <div className="pp-unit-row">
          <span className="pp-unit-label">PK1</span>
          <div className="pp-unit-chips">
            {pkUnit1.map((name, i) => (
              <span key={i} className="pp-unit-chip pp1">{name.split(' ').pop()}</span>
            ))}
          </div>
        </div>
      )}
      {pkUnit2?.length > 0 && (
        <div className="pp-unit-row">
          <span className="pp-unit-label">PK2</span>
          <div className="pp-unit-chips">
            {pkUnit2.map((name, i) => (
              <span key={i} className="pp-unit-chip pp2">{name.split(' ').pop()}</span>
            ))}
          </div>
        </div>
      )}
      {(pkUnit1?.length > 0 || pkUnit2?.length > 0) && (
        <div className="pp-unit-note">
          Units inferred from play-by-play — players who didn't touch the puck may not appear.
        </div>
      )}

      {/* ── Per-PK breakdown ──────────────────────────────── */}
      <div className="pp-opps-list">
        {pkOpps.map((opp, i) => (
          <div key={i} className="pp-opp-item">
            <div className="pp-opp-header" onClick={() => toggle(i)}>
              <div className="pp-opp-left">
                <span className="pp-opp-num">PK {i + 1}</span>
                {opp.unit && (
                  <span className={`pp-unit-badge pp${opp.unit}`}>PK{opp.unit}</span>
                )}
                <span className="pp-opp-time">{opp.period} · {opp.startTime}</span>
              </div>
              <div className="pp-opp-right">
                <span className={outcomeClass(opp)}>{outcomeIcon(opp)} {outcomeLabel(opp)}</span>
                <span className="pp-opp-sog">{opp.sog} SOG vs</span>
                <span className="pp-opp-chevron">{openIdx === i ? '▲' : '▼'}</span>
              </div>
            </div>

            {openIdx === i && (
              <div className="pp-opp-detail">
                {/* Goal details */}
                {opp.goalDetails.map((g, gi) => (
                  <div key={gi} className="pp-goal-row">
                    <span className="pp-goal-icon">🚨</span>
                    <div>
                      <span className="pp-goal-scorer">{g.scorer}</span>
                      {g.shotType && <span className="pp-goal-shottype">{g.shotType}</span>}
                      {g.assists.length > 0 && <div className="pp-goal-assists">Assists: {g.assists.join(', ')}</div>}
                    </div>
                    <span className="pp-goal-time">{g.time}</span>
                  </div>
                ))}

                {/* Stat chips */}
                <div className="pp-detail-stats">
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.sog}</span><span className="pp-detail-label">SOG vs</span></div>
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.shots}</span><span className="pp-detail-label">SA</span></div>
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.xgAgainst}</span><span className="pp-detail-label">xGA</span></div>
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.blockerList.reduce((s, b) => s + b.count, 0)}</span><span className="pp-detail-label">Blocks</span></div>
                  <div className="pp-detail-stat"><span className="pp-detail-val">{opp.duration}s</span><span className="pp-detail-label" style={{display:'flex',alignItems:'center',gap:2}}>Duration <InfoTip text="Duration — time in seconds between the first and last tracked play of this opportunity. Scores early = shorter duration. May be shorter than the full 2-minute penalty if there were no events near the start or end." position="above" /></span></div>
                </div>

                {/* Blockers */}
                {opp.blockerList.length > 0 && (
                  <div className="pp-shottype-row">
                    {opp.blockerList.map(b => (
                      <span key={b.name} className="pp-shottype-chip">🛡️ {b.name.split(' ').pop()} ×{b.count}</span>
                    ))}
                  </div>
                )}

                {/* Shot type breakdown */}
                {Object.keys(opp.shotTypeCounts).length > 0 && (
                  <div className="pp-shottype-row">
                    {Object.entries(opp.shotTypeCounts).map(([type, count]) => (
                      <span key={type} className="pp-shottype-chip">{type} ×{count}</span>
                    ))}
                  </div>
                )}

                {/* Mini shot map — OPP shots against, shown from OPP offensive zone perspective */}
                {opp.shotEvents.length > 0 && (
                  <div className="pp-mini-rink">
                    <div className="pp-mini-rink-label">OPP shot locations</div>
                    <IceRink
                      events={opp.shotEvents}
                      roster={{}}
                      readOnly
                      flipPerspective
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Advanced Game Panel (Corsi / Fenwick / PDO / Puck Luck) ──

// ── Live Insights ────────────────────────────────────────────
function LiveInsights({ pbp, boxscore, gameHome, carScore, oppScore, oppAbbr, topScorers, isLive, debugInsight, gameLogInsights, isPlayoff = false }) {
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
      const periodLabel = per <= 3 ? `P${per}` : isPlayoff ? (per === 4 ? 'OT' : `${per - 3}OT`) : per === 4 ? 'OT' : 'SO';
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
    // situationCode lives on the play itself, not inside details
    const ppGoalsAgainst = plays.filter(p => {
      if (p.typeDescKey !== 'goal') return false;
      if (p.details?.eventOwnerTeamId === carTeam) return false;
      const sc = p.situationCode;
      if (!sc || sc.length < 4) return false;
      // OPP PP = OPP has more skaters than CAR
      // situationCode: [awayGoalie][awaySkaters][homeSkaters][homeGoalie]
      const awayS = parseInt(sc[1]);
      const homeS = parseInt(sc[2]);
      const carS  = gameHome ? homeS : awayS;
      const oppS  = gameHome ? awayS : homeS;
      return oppS > carS;
    }).length;

    // Only show "perfect PK" after OPP PP has expired — don't fire while penalty is still active
    const lastPlay = plays[plays.length - 1];
    const lastSc   = lastPlay?.situationCode;
    const oppCurrentlyOnPP = lastSc && lastSc.length === 4 && (() => {
      const awayS = parseInt(lastSc[1]);
      const homeS = parseInt(lastSc[2]);
      return gameHome ? awayS > homeS : homeS > awayS;
    })();

    if (carPens >= 2 && ppGoalsAgainst === 0 && !oppCurrentlyOnPP) {
      results.push({ icon: '🛡️', text: `CAR PK went ${carPens}-for-${carPens} — perfect penalty kill`, type: 'good' });
    } else if (ppGoalsAgainst >= 2) {
      results.push({ icon: '😤', text: `PK struggled — allowed ${ppGoalsAgainst} power play goals`, type: 'warn' });
    }

    // ── Coach's challenges & video reviews ───────────────────
    const stoppages = plays.filter(p =>
      p.typeDescKey === 'stoppage' && p.details?.reason?.startsWith('chlg-')
    );
    const leagueReviews = plays.filter(p =>
      p.typeDescKey === 'stoppage' && p.details?.reason === 'video-review'
    );

    stoppages.forEach(chlg => {
      const reason = chlg.details.reason; // e.g. 'chlg-hm-goal-interference'
      const isHome = reason.includes('-hm-');
      const isCar  = (isHome && gameHome) || (!isHome && !gameHome);
      const type   = reason.includes('goal-interference') ? 'goal interference'
                   : reason.includes('off-side')          ? 'offside'
                   : reason.includes('missed-stoppage')   ? 'missed stoppage'
                   : 'call';

      // Check if the next nearby penalty is an unsuccessful challenge
      const unsuccessful = plays.find(p =>
        p.typeDescKey === 'penalty' &&
        p.sortOrder > chlg.sortOrder &&
        p.sortOrder < chlg.sortOrder + 8 &&
        p.details?.descKey === 'delaying-game-unsuccessful-challenge'
      );
      const succeeded = !unsuccessful;

      if (isCar) {
        results.push({
          icon: succeeded ? '✅' : '❌',
          text: succeeded
            ? `CAR challenge (${type}) succeeded — call overturned`
            : `CAR challenge (${type}) failed — 2-min penalty`,
          type: succeeded ? 'good' : 'warn',
        });
      } else {
        results.push({
          icon: succeeded ? '😤' : '🛡️',
          text: succeeded
            ? `${oppAbbr} challenge (${type}) succeeded — call overturned`
            : `${oppAbbr} challenge (${type}) failed`,
          type: succeeded ? 'warn' : 'good',
        });
      }
    });

    if (leagueReviews.length > 0) {
      results.push({
        icon: '🎥',
        text: `${leagueReviews.length} league-initiated video review${leagueReviews.length > 1 ? 's' : ''} this game`,
        type: 'neutral',
      });
    }


    // ── OPP shot attempts limited by period ──────────────────
    // Only fire for completed periods
    const completedPeriods = Object.keys(periodShots).map(Number)
      .filter(per => !isLive || per < (currentPeriod || 99));
    completedPeriods.forEach(per => {
      const ps = periodShots[per];
      if (!ps) return;
      const periodLabel = per <= 3 ? `P${per}` : isPlayoff ? (per === 4 ? 'OT' : `${per - 3}OT`) : per === 4 ? 'OT' : 'SO';
      // ≤8 OPP shot attempts in a period is strong suppression (league avg ~12)
      if (ps.opp <= 8 && ps.car >= 5) {
        results.push({
          icon: '🔒',
          text: `CAR held ${oppAbbr} to just ${ps.opp} shot attempts in ${periodLabel}`,
          type: 'good',
        });
      }
    });

    // ── OPP SOG limited by period ─────────────────────────────
    const periodSOG = {};
    plays.forEach(p => {
      if (!['shot-on-goal','goal'].includes(p.typeDescKey)) return;
      const per   = p.periodDescriptor?.number || 1;
      const isCar = p.details?.eventOwnerTeamId === carTeam;
      if (!periodSOG[per]) periodSOG[per] = { car: 0, opp: 0 };
      if (isCar) periodSOG[per].car++; else periodSOG[per].opp++;
    });
    completedPeriods.forEach(per => {
      const ps = periodSOG[per];
      if (!ps) return;
      const periodLabel = per <= 3 ? `P${per}` : isPlayoff ? (per === 4 ? 'OT' : `${per - 3}OT`) : per === 4 ? 'OT' : 'SO';
      // ≤5 OPP SOG in a completed period is excellent (league avg ~8-9)
      if (ps.opp <= 5 && ps.car >= 4) {
        results.push({
          icon: '🧱',
          text: `CAR held ${oppAbbr} to ${ps.opp} shots on goal in ${periodLabel}`,
          type: 'good',
        });
      }
    });

    // ── Faceoff dominance ─────────────────────────────────────
    let carFOW = 0, totalFO = 0;
    plays.forEach(p => {
      if (p.typeDescKey !== 'faceoff') return;
      totalFO++;
      if (p.details?.winningPlayerId &&
          p.details?.eventOwnerTeamId === carTeam) carFOW++;
    });
    if (totalFO >= 10) {
      const foPct = Math.round(carFOW / totalFO * 100);
      if (foPct >= 58) {
        results.push({
          icon: '🏒',
          text: `CAR controlling faceoffs — winning ${foPct}% (${carFOW}/${totalFO})`,
          type: 'good',
        });
      } else if (foPct <= 42) {
        results.push({
          icon: '😬',
          text: `${oppAbbr} winning faceoffs — CAR at ${foPct}% (${carFOW}/${totalFO})`,
          type: 'warn',
        });
      }
    }

    // ── Scoring drought (live only) ───────────────────────────
    if (isLive && currentPeriod >= 2) {
      const carGoals = plays.filter(p =>
        p.typeDescKey === 'goal' && p.details?.eventOwnerTeamId === carTeam
      );
      if (carGoals.length === 0) {
        results.push({
          icon: '🥶',
          text: `CAR hasn't scored yet — looking for the first one`,
          type: 'warn',
        });
      } else {
        const lastGoal = carGoals[carGoals.length - 1];
        const lastGoalPeriod = lastGoal?.periodDescriptor?.number || 1;
        const droughtPeriods = (currentPeriod || 1) - lastGoalPeriod;
        if (droughtPeriods >= 2) {
          results.push({
            icon: '🥶',
            text: `CAR hasn't scored in ${droughtPeriods} periods — last goal in P${lastGoalPeriod}`,
            type: 'warn',
          });
        }
      }
    }

    // ── First goal advantage ──────────────────────────────────
    const firstGoal = plays.find(p => p.typeDescKey === 'goal');
    if (firstGoal) {
      const carScoredFirst = firstGoal.details?.eventOwnerTeamId === carTeam;
      const gl = gameLogInsights;
      const winPct = carScoredFirst ? gl?.scoredFirstWinPct : gl?.didntScoreFirstWinPct;
      const gamesN = carScoredFirst ? gl?.scoredFirstGames : null;
      const teamStat = winPct != null && gamesN != null
        ? `CAR wins ${winPct}% of games when scoring first this season (${gamesN} games)`
        : winPct != null
        ? `${oppAbbr} wins ${winPct}% of games when scoring first this season`
        : carScoredFirst
        ? `CAR struck first — teams that score first win ~65% of NHL games`
        : `${oppAbbr} struck first`;
      results.push({
        icon: carScoredFirst ? '🚀' : '😤',
        text: teamStat,
        type: carScoredFirst ? 'good' : 'warn',
      });
    }

    // ── Back-to-back goals ────────────────────────────────────
    const allGoals = plays.filter(p => p.typeDescKey === 'goal');
    for (let i = 1; i < allGoals.length; i++) {
      const prev = allGoals[i - 1];
      const curr = allGoals[i];
      if (curr.details?.eventOwnerTeamId !== carTeam) continue;
      if (prev.details?.eventOwnerTeamId !== carTeam) continue;
      // Convert times to absolute seconds
      const toSecs = (p) => {
        const [m, s] = (p.timeInPeriod || '0:00').split(':').map(Number);
        const periodOffset = ((p.periodDescriptor?.number || 1) - 1) * 1200;
        return periodOffset + m * 60 + s;
      };
      const gap = toSecs(curr) - toSecs(prev);
      if (gap <= 180) { // within 3 minutes
        const scorer1 = prev.details?.scoringPlayerId;
        const scorer2 = curr.details?.scoringPlayerId;
        results.push({
          icon: '🔥',
          text: `CAR scored twice in ${gap}s — two quick goals${scorer1 && scorer2 && scorer1 === scorer2 ? ' from the same player!' : ''}`,
          type: 'good',
        });
        break; // only report the first back-to-back
      }
    }

    // ── Consecutive saves (goalie on a run) ───────────────────
    // Count shots faced since the last goal against
    let consecutiveSaves = 0;
    const shotTypes = ['shot-on-goal', 'goal'];
    for (let i = plays.length - 1; i >= 0; i--) {
      const p = plays[i];
      if (!shotTypes.includes(p.typeDescKey)) continue;
      if (p.details?.eventOwnerTeamId === carTeam) continue; // OPP shots only
      if (p.typeDescKey === 'goal') break; // stop at last goal against
      consecutiveSaves++;
    }
    if (consecutiveSaves >= 15) {
      results.push({
        icon: '🧤',
        text: `CAR goalie has stopped ${consecutiveSaves} straight shots`,
        type: 'good',
      });
    }

    // ── High danger suppression ───────────────────────────────
    // High danger zone: within ~25ft of net, ±17ft wide (slot area)
    // Using rink coords: net at x=±89, high danger = |x| > 64 AND |y| < 17
    if (completedPeriods.length > 0) {
      const lastCompletedPer = Math.max(...completedPeriods);
      const perPlays = plays.filter(p =>
        (p.periodDescriptor?.number || 1) === lastCompletedPer
      );
      const oppAttempts = perPlays.filter(p =>
        ['shot-on-goal','goal','missed-shot'].includes(p.typeDescKey) &&
        p.details?.eventOwnerTeamId !== carTeam
      );
      const hdAttempts = oppAttempts.filter(p => {
        const x = p.details?.xCoord, y = p.details?.yCoord;
        if (x == null || y == null) return false;
        return Math.abs(x) > 64 && Math.abs(y) < 17;
      });
      if (oppAttempts.length >= 6 && hdAttempts.length === 0) {
        const pLabel = lastCompletedPer <= 3 ? `P${lastCompletedPer}` : 'OT';
        results.push({
          icon: '🔒',
          text: `CAR kept ${oppAbbr} to the perimeter in ${pLabel} — zero high danger attempts`,
          type: 'good',
        });
      }
    }

    // ── OPP shot attempts on PP limited ──────────────────────
    // Per PP: ≤3 OPP shot attempts is exceptional PK work
    // Computed from periodShots on OPP PP windows
    const oppPPAttempts = plays.filter(p => {
      if (!['shot-on-goal','goal','missed-shot','blocked-shot'].includes(p.typeDescKey)) return false;
      if (p.details?.eventOwnerTeamId === carTeam) return false;
      const sc = p.situationCode;
      if (!sc || sc.length < 4) return false;
      const awayS = parseInt(sc[1]), homeS = parseInt(sc[2]);
      const carS  = gameHome ? homeS : awayS;
      const oppS  = gameHome ? awayS : homeS;
      return oppS > carS;
    });
    const totalCarPens = plays.filter(p =>
      p.typeDescKey === 'penalty' && p.details?.eventOwnerTeamId === carTeam
    ).length;
    if (totalCarPens >= 2 && oppPPAttempts.length <= totalCarPens * 3) {
      results.push({
        icon: '🛡️',
        text: `PK limiting OPP chances — only ${oppPPAttempts.length} shot attempts across ${totalCarPens} penalties`,
        type: 'good',
      });
    }

    // ── Head-to-head record ───────────────────────────────────
    if (gameLogInsights?.vsOppRecord?.gp >= 2) {
      const { w, l, gp } = gameLogInsights.vsOppRecord;
      results.push({
        icon: w > l ? '📈' : w < l ? '📉' : '⚖️',
        text: `CAR is ${w}-${l} vs ${oppAbbr} this season (${gp} games)`,
        type: w > l ? 'good' : w < l ? 'warn' : 'neutral',
      });
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

    return results.slice(0, 6);
  }, [pbp, boxscore, gameHome, carScore, oppScore, oppAbbr, topScorers, isLive, gameLogInsights]);

  if (!insights.length && !debugInsight) return null;
  const displayInsights = debugInsight ? [debugInsight, ...insights].slice(0, 5) : insights;

  return <LiveInsightsCard insights={displayInsights} isLive={isLive} />;
}

function LiveInsightsCard({ insights, isLive }) {
  const [expanded, setExpanded] = useState(true);
  const timerRef = useRef(null);

  // Reset expansion and start collapse timer whenever insights change (live only)
  const insightKey = insights.map(i => i.text).join('|');
  useEffect(() => {
    if (!isLive) return;
    setExpanded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setExpanded(false), 8000);
    return () => clearTimeout(timerRef.current);
  }, [insightKey, isLive]);

  const handleTap = () => {
    if (!isLive) return;
    setExpanded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setExpanded(false), 8000);
  };

  return (
    <div
      className={`card live-insights${isLive && !expanded ? ' insights-collapsed' : ''}`}
      onClick={handleTap}
    >
      <div className={`insights-header${expanded ? '' : ' insights-header-collapsed'}`}>
        <span className="sec-label" style={{ marginBottom: 0 }}>
          {isLive ? '🔴 Live Insights' : '📊 Game Insights'}
        </span>
        {isLive && !expanded && (
          <span className="insights-peek">
            {insights[0]?.icon} {insights[0]?.text}
          </span>
        )}
        {isLive && (
          <span className="insights-chevron" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ›
          </span>
        )}
      </div>
      {expanded && (
        <div className="insights-list">
          {insights.map((ins, i) => (
            <div key={i} className={`insight-row insight-${ins.type}`}>
              <span className="insight-icon">{ins.icon}</span>
              <span className="insight-text">{ins.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Momentum Card ─────────────────────────────────────────────
function MomentumCard({ pbp, gameHome, isLive, oppAbbr }) {
  const [window, setWindow] = useState(5);
  const plays = pbp?.plays || [];
  const CAR_ID = 12;

  // Event weights — combines shot attempts with zone entries proxy
  // zoneCode: O = offensive, N = neutral, D = defensive (from the event owner's perspective)
  function eventScore(play, teamId) {
    const d    = play.details || {};
    const zone = d.zoneCode;           // O, N, D
    const type = play.typeDescKey;
    const isOwner = d.eventOwnerTeamId === teamId;

    if (type === 'faceoff') {
      // Faceoff winner is in details.winningPlayerId's team
      const won = d.winningPlayerId && play.details?.eventOwnerTeamId === teamId;
      if (zone === 'O' && won)  return  0.6;  // won OZ faceoff — territorial
      if (zone === 'D' && !won) return -0.3;  // lost DZ faceoff — pressure against
      return 0;
    }
    if (!isOwner) return 0; // remaining events only score for the owning team
    if (type === 'shot-on-goal' || type === 'goal')    return zone === 'O' ? 1.0 : 0.5;
    if (type === 'missed-shot'  || type === 'blocked-shot') return zone === 'O' ? 0.7 : 0.3;
    if (type === 'hit'      && zone === 'O') return  0.4;
    if (type === 'takeaway' && zone === 'O') return  0.5;
    if (type === 'giveaway' && zone === 'D') return -0.3;
    return 0;
  }

  function playTimeSecs(play) {
    const period = play.periodDescriptor?.number || 1;
    const [m, s] = (play.timeInPeriod || '00:00').split(':').map(Number);
    return (period - 1) * 1200 + m * 60 + (s || 0);
  }

  const nowSecs = plays.length ? playTimeSecs(plays[plays.length - 1]) : 0;

  function computeWindow(mins) {
    const cutoff = mins === 0 ? 0 : nowSecs - mins * 60;
    let car = 0, opp = 0, carEvents = 0, oppEvents = 0;
    plays.forEach(p => {
      const t = playTimeSecs(p);
      if (t < cutoff) return;
      const cs = eventScore(p, CAR_ID);
      const os = eventScore(p, -1); // opp = any non-CAR team
      // Recalculate for opp by checking if owner is not CAR
      const oppOwned = p.details?.eventOwnerTeamId && p.details.eventOwnerTeamId !== CAR_ID;
      const d = p.details || {};
      const zone = d.zoneCode;
      const type = p.typeDescKey;
      let oppScore = 0;
      if (type === 'faceoff') {
        const oppWon = d.winningPlayerId && d.eventOwnerTeamId !== CAR_ID;
        if (zone === 'O' && oppWon)  oppScore =  0.6;
        if (zone === 'D' && !oppWon) oppScore = -0.3;
      } else if (oppOwned) {
        if (type === 'shot-on-goal' || type === 'goal')         oppScore = zone === 'O' ? 1.0 : 0.5;
        if (type === 'missed-shot'  || type === 'blocked-shot') oppScore = zone === 'O' ? 0.7 : 0.3;
        if (type === 'hit'      && zone === 'O') oppScore =  0.4;
        if (type === 'takeaway' && zone === 'O') oppScore =  0.5;
        if (type === 'giveaway' && zone === 'D') oppScore = -0.3;
      }
      if (cs > 0) { car += cs; carEvents++; }
      if (oppScore > 0) { opp += oppScore; oppEvents++; }
    });
    const total = car + opp || 1;
    return { car: carEvents, opp: oppEvents, carPct: Math.round(car / total * 100) };
  }

  // Waveform — rolling 3-min weighted score sampled every 60s
  const wavePoints = useMemo(() => {
    const pts = [];
    const WAVE_WIN = 180, STEP = 60;
    for (let t = WAVE_WIN; t <= nowSecs + STEP; t += STEP) {
      let wc = 0, wo = 0;
      plays.forEach(p => {
        const pt = playTimeSecs(p);
        if (pt < t - WAVE_WIN || pt > t) return;
        const d = p.details || {};
        const zone = d.zoneCode;
        const type = p.typeDescKey;
        const isCAR = d.eventOwnerTeamId === CAR_ID;
        const isOpp = d.eventOwnerTeamId && d.eventOwnerTeamId !== CAR_ID;
        const score =
          (type === 'shot-on-goal' || type === 'goal')         ? (zone === 'O' ? 1.0 : 0.5) :
          (type === 'missed-shot'  || type === 'blocked-shot') ? (zone === 'O' ? 0.7 : 0.3) :
          type === 'hit'      && zone === 'O' ? 0.4 :
          type === 'takeaway' && zone === 'O' ? 0.5 : 0;
        if (type === 'faceoff') {
          if (zone === 'O' && d.eventOwnerTeamId === CAR_ID) wc += 0.6;
          if (zone === 'O' && isOpp) wo += 0.6;
        } else {
          if (isCAR) wc += score;
          if (isOpp) wo += score;
        }
      });
      const wt = wc + wo || 1;
      pts.push(Math.round(wc / wt * 100));
    }
    return pts;
  }, [plays.length]);

  const { car, opp, carPct } = computeWindow(window);
  const totalGame = useMemo(() => computeWindow(0), [plays.length]);

  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !wavePoints.length) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width * dpr;
    const H = rect.height * dpr;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const lW = rect.width;
    const lH = rect.height;
    const mid = lH / 2;

    ctx.clearRect(0, 0, lW, lH);

    const pts = wavePoints.length;
    const step = pts > 1 ? lW / (pts - 1) : lW;

    // CAR area above midline
    ctx.beginPath();
    ctx.moveTo(0, mid);
    wavePoints.forEach((v, i) => {
      const x = i * step;
      const y = mid - ((Math.max(50, v) - 50) / 50) * (mid - 6);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(lW, mid);
    ctx.closePath();
    ctx.fillStyle = 'rgba(204,34,0,0.18)';
    ctx.fill();

    // OPP area below midline
    ctx.beginPath();
    ctx.moveTo(0, mid);
    wavePoints.forEach((v, i) => {
      const x = i * step;
      const y = mid + ((Math.max(0, 50 - v)) / 50) * (mid - 6);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(lW, mid);
    ctx.closePath();
    ctx.fillStyle = 'rgba(136,135,128,0.12)';
    ctx.fill();

    // CAR line
    ctx.beginPath();
    wavePoints.forEach((v, i) => {
      const x = i * step;
      const y = mid - ((v - 50) / 50) * (mid - 6);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'var(--red-bright, #cc2200)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Period dividers
    const totalMinutes = Math.ceil(nowSecs / 60);
    [20, 40].forEach(min => {
      if (min * 60 > nowSecs) return;
      const x = (min / totalMinutes) * lW;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, lH);
      ctx.strokeStyle = 'rgba(136,135,128,0.25)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 50% midline
    ctx.beginPath();
    ctx.moveTo(0, mid); ctx.lineTo(lW, mid);
    ctx.strokeStyle = 'rgba(136,135,128,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Current position dot
    if (pts > 0) {
      const lastX = (pts - 1) * step;
      const lastV = wavePoints[pts - 1];
      const lastY = mid - ((lastV - 50) / 50) * (mid - 6);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#cc2200';
      ctx.fill();
    }
  }, [wavePoints]);

  const tooltipText = 'Weighted territorial score combining shot attempts, zone faceoff wins, offensive zone hits and takeaways — inspired by NHL Edge Ice Tilt. Zone location matters: an offensive zone shot counts more than a neutral zone attempt. Above 50% = CAR controlling play.';

  return (
    <div className="card momentum-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="sec-label" style={{ marginBottom: 0 }}>
          Momentum
          <InfoTip text={tooltipText} position="above" />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[5, 10, 0].map(w => (
            <button key={w}
              className={`rink-btn${window === w ? ' on' : ''}`}
              style={{ padding: '2px 8px', fontSize: 10, minHeight: 'unset', minWidth: 'unset' }}
              onClick={() => setWindow(w)}>
              {w === 0 ? 'Full' : `${w}m`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, marginBottom: 5 }}>
          <span style={{ color: 'var(--red-bright)' }}>CAR {carPct}%</span>
          <span style={{ color: 'var(--text-muted)' }}>{100 - carPct}% {oppAbbr}</span>
        </div>
        <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${carPct}%`,
            background: carPct >= 50 ? 'var(--red-bright)' : 'var(--text-dim)',
            borderRadius: 4, transition: 'width 0.4s ease'
          }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border-2)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
          <span>{car} events</span>
          <span>{opp} events</span>
        </div>
      </div>

      <canvas ref={canvasRef}
        style={{ width: '100%', height: 80, display: 'block' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
        <span>P1</span><span>P2</span><span>P3{nowSecs > 3600 ? '+' : ''}</span><span>Now</span>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red-bright)', opacity: 0.7 }} />
          CAR above neutral
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-dim)', opacity: 0.5 }} />
          {oppAbbr} above neutral
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
          Game: {totalGame.carPct}%
        </div>
      </div>
    </div>
  );
}

// ── Advanced Game Panel ───────────────────────────────────────
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