// hooks/usePWHLPeriodSummary.js
//
// Derives period and game summaries from PWHL live/PBP event data.
// Data sources:
//   - liveData.events  — normalized events from /pwhl/live/:gameId (live games)
//   - pbpData          — fetchPWHLPBP's stored rows from /pwhl/pbp?gameId=
//                        (completed games), turned into the live shape by
//                        pwhlEventsFromStoredPBP (utils/pwhlStoredPbp.js)
//   - /pwhl/summary?gameId= — HockeyTech gameSummary for goal enrichment + MVPs
//
// PWHL event shape (normalized by Worker):
//   eventType, period (integer, OT=4), time "MM:SS", teamId (integer)
//   goals:     { scoredBy: { firstName, lastName }, assists: [], isPowerPlay... }
//   penalties: { takenBy: { firstName, lastName }, description, minutes }
//   faceoffs:  { homeWin: bool, homePlayer, visitingPlayer }
//   hits:      { player, onPlayer, teamId }
//   shots:     { teamId, shooter, isGoal, x, y (HockeyTech's 600x300 rink) }
// Every HockeyTech shot event is a shot on goal (blocked ones are
// blocked_shot), and a goal arrives twice: a shot with isGoal, then a goal.

import { useState, useEffect, useRef, useCallback } from 'react';
import { finalSuffix } from '../utils/scoreboard';
import { hockeyTechPenaltyParties } from '../utils/hockeyTechPenalty';
import { pwhlEventsFromStoredPBP, pwhlSummaryPlayerNames } from '../utils/pwhlStoredPbp';

const WORKER_URL = typeof import.meta !== 'undefined'
  ? import.meta.env?.VITE_WORKER_URL
  : null;

const SESSION_KEY      = 'eyewall_pwhl_period_summaries';
const GAME_SUMMARY_KEY = 'eyewall_pwhl_game_summary';

// ── Storage helpers ───────────────────────────────────────────

function loadStored(gameId) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.gameId === String(gameId) ? parsed : null;
  } catch { return null; }
}

function saveStored(gameId, summaries) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ gameId: String(gameId), summaries }));
  } catch {}
}

function loadStoredGame(gameId) {
  try {
    const raw = sessionStorage.getItem(GAME_SUMMARY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.gameId === String(gameId) ? parsed.summary : null;
  } catch { return null; }
}

function saveStoredGame(gameId, summary) {
  try {
    sessionStorage.setItem(GAME_SUMMARY_KEY, JSON.stringify({ gameId: String(gameId), summary }));
  } catch {}
}

// ── HockeyTech gameSummary fetch ──────────────────────────────
// Returns { periods, mvps, homeTeamStats, visitingTeamStats } or null.
// In-memory cached per gameId to avoid re-fetching within a session.
const summaryCache = {};

async function fetchHTSummary(gameId) {
  if (!gameId) return null;
  if (summaryCache[gameId]) return summaryCache[gameId];
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}/pwhl/summary?gameId=${gameId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.periods) {
      summaryCache[gameId] = data;
      return data;
    }
  } catch {}
  return null;
}

// ── Helpers ───────────────────────────────────────────────────

// Regular-season period 5 is a shootout ('SO'); playoffs never have one
// (full OT periods instead) — see usePeriodSummary.js's NHL equivalent,
// which this mirrors.
function periodLabel(p, isPlayoff = false) {
  if (p <= 3) return `Period ${p}`;
  if (p === 4) return 'OT';
  if (isPlayoff) return `${p - 3}OT`;
  return p === 5 ? 'SO' : `${p - 3}OT`;
}

function periodShort(p, isPlayoff = false) {
  if (p <= 3) return `P${p}`;
  if (p === 4) return 'OT';
  if (isPlayoff) return `${p - 3}OT`;
  return p === 5 ? 'SO' : `${p - 3}OT`;
}

// A shot's spot in feet (NHL rink coords, the net 89 ft from center): the
// stored rows carry it as xFeet/yFeet; a live event has HockeyTech's raw
// 600x300 x/y, converted as PWHLShotMapView's adaptLiveShot does. Null
// when the event has no location.
function shotFeet(e) {
  if (e.xFeet != null && e.yFeet != null) return { x: e.xFeet, y: e.yFeet };
  if (e.x == null || e.y == null) return null;
  return { x: (e.x / 600 - 0.5) * 200, y: (e.y / 300 - 0.5) * 85 };
}

// High danger as the NHL summaries count it (usePeriodSummary.js): within
// 15 ft of either net.
function isHighDanger(e) {
  const f = shotFeet(e);
  if (!f) return false;
  return Math.sqrt((Math.abs(f.x) - 89) ** 2 + f.y ** 2) < 15;
}

// Shot stats from PWHL events (live shape) for a period, or all when null.
// SOG counts shot events, goals included (isGoal); the separate goal event
// isn't counted again. Corsi adds blocked shots (HockeyTech logs no missed
// shots, so Fenwick is the shots on goal).
export function computePWHLShotStats(events, teamId, period = null) {
  const evts = period != null ? events.filter(e => e.period === period) : events;

  let carCorsi = 0, oppCorsi = 0;
  let carFenwick = 0, oppFenwick = 0;
  let carSOG = 0, oppSOG = 0;
  let carHDCF = 0, oppHDCF = 0;

  for (const e of evts) {
    const type = e.eventType;
    if (type !== 'shot' && type !== 'blocked_shot') continue;
    const isCar = e.teamId === teamId;
    if (isCar) carCorsi++; else oppCorsi++;
    if (type === 'shot') {
      if (isCar) { carFenwick++; carSOG++; } else { oppFenwick++; oppSOG++; }
    }
    if (isHighDanger(e)) { if (isCar) carHDCF++; else oppHDCF++; }
  }

  const totalCorsi   = carCorsi + oppCorsi || 1;
  const totalFenwick = carFenwick + oppFenwick || 1;

  return {
    carCorsi, oppCorsi, carFenwick, oppFenwick,
    carSOG, oppSOG, carHDCF, oppHDCF,
    corsiForPct:   Math.round((carCorsi   / totalCorsi)   * 100),
    fenwickForPct: Math.round((carFenwick / totalFenwick) * 100),
  };
}

// Annotate faceoff events with _carWonFO based on homeWin + whether our team is home
function annotateFaceoffs(events, teamId, homeTeamId) {
  return events.map(e => {
    if (e.eventType !== 'faceoff' || e.homeWin == null) return e;
    const carIsHome = homeTeamId === teamId;
    return { ...e, _carWonFO: carIsHome ? e.homeWin : !e.homeWin };
  });
}

// The game's events in the live shape, faceoffs annotated: the live feed
// for a live game, the stored rows for a finished one. htSummary only lends
// the stored rows names they're missing, by player id. Rows for another
// game (the last one picked, still showing while this one's load) count as
// none.
export function pwhlSummaryEvents({ isLive, liveData, pbpData, teamId, gameId = null, htSummary = null }) {
  const otherGame = !isLive && gameId != null && pbpData?.gameId != null
    && String(pbpData.gameId) !== String(gameId);
  const raw = isLive
    ? (liveData?.events || [])
    : otherGame ? [] : pwhlEventsFromStoredPBP(pbpData, pwhlSummaryPlayerNames(htSummary));
  const homeTeamId = isLive
    ? (liveData?.homeTeamId ?? null)
    : (pbpData?.homeTeamId ?? pbpData?.home_team_id ?? null);
  return annotateFaceoffs(raw, teamId, homeTeamId);
}

// Strength from the summary's goal, else the live event's own flags; the
// stored rows have neither, so it stays null.
function goalStrength(ht, e) {
  if (ht?.properties) {
    const p = ht.properties;
    return p.isPowerPlay === '1' ? 'pp'
      : p.isShortHanded === '1' ? 'sh'
      : p.isEmptyNet === '1' ? 'en'
      : 'ev';
  }
  if (e?.isPowerPlay == null && e?.isShortHanded == null && e?.isEmptyNet == null) return null;
  return e.isPowerPlay ? 'pp' : e.isShortHanded ? 'sh' : e.isEmptyNet ? 'en' : 'ev';
}

// One goal event as the summaries list it, enriched by the matching goal in
// /pwhl/summary when there is one.
function pwhlSummaryGoal(e, ht, teamId) {
  const eventScorer = e.scoredBy
    ? (`${e.scoredBy.firstName || ''} ${e.scoredBy.lastName || ''}`.trim() || null)
    : (e.scorerName ?? null);
  return {
    isCar:  e.teamId === teamId,
    period: e.period,
    time:   e.time || ht?.time || '—',
    scorerName: ht
      ? `${ht.scoredBy?.firstName || ''} ${ht.scoredBy?.lastName || ''}`.trim()
      : eventScorer,
    scorerHeadshot: ht?.scoredBy?.playerImageURL?.replace('/120x160/', '/240x240/') || null,
    assists: ht
      ? (ht.assists || []).map(a => ({ name: { default: `${a.firstName || ''} ${a.lastName || ''}`.trim() } }))
      : (e.assists || []).map(a => ({ name: { default: `${a.firstName || ''} ${a.lastName || ''}`.trim() } })),
    strength: goalStrength(ht, e),
  };
}

// The team's goalies in net -- in one period, or the whole game when period
// is null -- from /pwhl/summary's goalieLog (one row per stint), in order.
// Grounds the AI summary. Not the three stars' goalie, which was used before
// and is often the other team's. A summary without goalieLog names no one.
export function pwhlGoaliesInNet(htSummary, teamId, period = null) {
  const names = [];
  for (const s of htSummary?.goalieLog || []) {
    if (Number(s.teamId) !== Number(teamId)) continue;
    if (period != null && ((s.periodStart ?? 0) > period || (s.periodEnd ?? Infinity) < period)) continue;
    const name = `${s.firstName || ''} ${s.lastName || ''}`.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

// One live penalty event as the period and game summaries list it, in
// usePeriodSummary.js's summaryPenalty shape. A bench penalty's takenBy
// names no one (see hockeyTechPenalty.js): playerName stays null and
// teamPenalty/benchMinor say so, with the skater who serves it.
// A stored row (pwhlStoredPbp.js) brings its parties already worked out.
export function pwhlSummaryPenalty(e, teamId) {
  const parties = e.parties ?? hockeyTechPenaltyParties(e);
  return {
    period:       e.period,
    time:         e.time || '—',
    isCar:        e.teamId === teamId,
    playerName:   parties.committedName,
    servedByName: parties.servedByName,
    teamPenalty:  parties.teamPenalty,
    benchMinor:   parties.benchMinor,
    type:         e.description || null,
    duration:     e.minutes ?? null,
  };
}

// ── Build a single period summary ────────────────────────────

export function buildPWHLSummary(period, events, teamId, htSummary, gameId, isPlayoff = false) {
  const periodEvts = events.filter(e => e.period === period);
  const shots      = computePWHLShotStats(events, teamId, period);

  // Faceoffs
  const faceoffs = periodEvts.filter(e => e.eventType === 'faceoff');
  const totalFO  = faceoffs.length;
  const carFOwon = faceoffs.filter(e => e._carWonFO).length;
  const carFOPct = totalFO > 0 ? Math.round((carFOwon / totalFO) * 100) : null;

  // Hits
  const carHits = periodEvts.filter(e => e.eventType === 'hit' && e.teamId === teamId).length;

  // Goals — basic from events, enriched from htSummary
  const goalEvts = periodEvts.filter(e => e.eventType === 'goal');
  const htPeriod = htSummary?.periods?.find(p => p.info?.id === period);
  const htGoals  = htPeriod?.goals || [];

  const goals = goalEvts.map((e, i) => pwhlSummaryGoal(e, htGoals[i] || null, teamId));

  // Penalties
  const penalties = periodEvts
    .filter(e => e.eventType === 'penalty')
    .map(e => pwhlSummaryPenalty(e, teamId));

  // Cumulative score through this period from htSummary
  let homeScore = 0, awayScore = 0;
  if (htSummary?.periods) {
    const periodsToNow = htSummary.periods.filter(p => p.info?.id <= period);
    homeScore = periodsToNow.reduce((s, p) => s + (p.stats?.homeGoals    || 0), 0);
    awayScore = periodsToNow.reduce((s, p) => s + (p.stats?.visitingGoals || 0), 0);
  }

  // Three stars — only on the final period
  const maxPeriod  = Math.max(...events.map(e => e.period || 0), 0);
  const threeStars = period === maxPeriod
    ? (htSummary?.mvps || []).map(mvp => ({
        name:       { default: `${mvp.player?.info?.firstName || ''} ${mvp.player?.info?.lastName || ''}`.trim() },
        headshot:   mvp.playerImage || null,
        teamAbbrev: { default: mvp.team?.abbreviation || '' },
        stats:      mvp.player?.stats || {},
        isGoalie:   !!mvp.isGoalie,
      }))
    : [];

  return {
    period,
    periodLabel:   periodLabel(period, isPlayoff),
    periodShort:   periodShort(period, isPlayoff),
    generatedAt:   Date.now(),
    isGameSummary: false,
    // Shot stats
    carCorsi:      shots.carCorsi,
    oppCorsi:      shots.oppCorsi,
    carSOG:        shots.carSOG,
    oppSOG:        shots.oppSOG,
    corsiForPct:   shots.corsiForPct,
    fenwickForPct: shots.fenwickForPct,
    carHDCF:       shots.carHDCF,
    oppHDCF:       shots.oppHDCF,
    // Period stats
    carFOPct,
    carHits,
    carTK: 0, carGV: 0, // not in HockeyTech PBP
    carGoals: goals.filter(g => g.isCar).length,
    oppGoals: goals.filter(g => !g.isCar).length,
    // Events
    goals,
    penalties,
    threeStars,
    // Score
    homeScore,
    awayScore,
    // AI
    aiNarrative: null,
    aiLoading:   true,
    goalieNames: pwhlGoaliesInNet(htSummary, teamId, period),
    gameId,
  };
}

// ── Build game summary ────────────────────────────────────────

export function buildPWHLGameSummary(events, teamId, htSummary, gameId) {
  const shots = computePWHLShotStats(events, teamId);

  // Per-period breakdown
  const periods = [...new Set(events.map(e => e.period).filter(Boolean))].sort((a, b) => a - b);
  const periodStats = periods.map(p => {
    const ps = computePWHLShotStats(events, teamId, p);
    return { period: p, corsiForPct: ps.corsiForPct, carSOG: ps.carSOG, oppSOG: ps.oppSOG };
  });
  const bestPeriod  = [...periodStats].sort((a, b) => b.corsiForPct - a.corsiForPct)[0];
  const worstPeriod = [...periodStats].sort((a, b) => a.corsiForPct - b.corsiForPct)[0];

  // All goals — enrich from htSummary
  const allHtGoals = (htSummary?.periods || []).flatMap(p => p.goals || []);
  const goalEvts   = events.filter(e => e.eventType === 'goal');
  const goals = goalEvts.map((e, i) => pwhlSummaryGoal(e, allHtGoals[i] || null, teamId));

  // All penalties
  const penalties = events
    .filter(e => e.eventType === 'penalty')
    .map(e => pwhlSummaryPenalty(e, teamId));

  // Faceoffs + hits
  const faceoffs = events.filter(e => e.eventType === 'faceoff');
  const totalFO  = faceoffs.length;
  const carFOwon = faceoffs.filter(e => e._carWonFO).length;
  const carHits  = events.filter(e => e.eventType === 'hit' && e.teamId === teamId).length;

  // Final score from htSummary periods
  const homeScore = (htSummary?.periods || []).reduce((s, p) => s + (p.stats?.homeGoals    || 0), 0);
  const awayScore = (htSummary?.periods || []).reduce((s, p) => s + (p.stats?.visitingGoals || 0), 0);

  // Three stars
  const threeStars = (htSummary?.mvps || []).map(mvp => ({
    name:       { default: `${mvp.player?.info?.firstName || ''} ${mvp.player?.info?.lastName || ''}`.trim() },
    headshot:   mvp.playerImage || null,
    teamAbbrev: { default: mvp.team?.abbreviation || '' },
    stats:      mvp.player?.stats || {},
    isGoalie:   !!mvp.isGoalie,
  }));

  return {
    period:        'game',
    periodLabel:   `Final${finalSuffix(htSummary?.endedIn)}`,
    periodShort:   `FINAL${finalSuffix(htSummary?.endedIn)}`,
    generatedAt:   Date.now(),
    isGameSummary: true,
    // Shot stats
    carCorsi:      shots.carCorsi,
    oppCorsi:      shots.oppCorsi,
    carSOG:        shots.carSOG,
    oppSOG:        shots.oppSOG,
    corsiForPct:   shots.corsiForPct,
    fenwickForPct: shots.fenwickForPct,
    carHDCF:       shots.carHDCF,
    oppHDCF:       shots.oppHDCF,
    // Game stats
    carFOPct: totalFO > 0 ? Math.round((carFOwon / totalFO) * 100) : null,
    carHits,
    carTK: 0, carGV: 0,
    carGoals: goals.filter(g => g.isCar).length,
    oppGoals: goals.filter(g => !g.isCar).length,
    // Events
    goals,
    penalties,
    periodStats,
    bestPeriod,
    worstPeriod,
    threeStars,
    // Score
    homeScore,
    awayScore,
    // AI
    aiNarrative:       null,
    aiLoading:         true,
    goalieNames:       pwhlGoaliesInNet(htSummary, teamId),
    gameId,
  };
}

// ── Main hook: usePWHLPeriodSummary ──────────────────────────

export function usePWHLPeriodSummary({ liveData, pbpData, isLive, gameId, teamId, isPlayoff = false }) {
  const [summaries,   setSummaries]   = useState([]);
  const [newSummary,  setNewSummary]  = useState(null);

  const lastProcessedPeriod = useRef(0);
  const buildingRef         = useRef(new Set());
  const htSummaryRef        = useRef(null);
  const lastPeriodRef       = useRef(0);

  // Restore from sessionStorage on gameId change
  useEffect(() => {
    if (!gameId) return;
    const stored = loadStored(gameId);
    if (stored?.summaries?.length) {
      setSummaries(stored.summaries);
      lastProcessedPeriod.current = Math.max(...stored.summaries.map(s => s.period));
    } else {
      setSummaries([]);
      lastProcessedPeriod.current = 0;
    }
    setNewSummary(null);
    buildingRef.current  = new Set();
    htSummaryRef.current = null;
    lastPeriodRef.current = 0;
  }, [gameId]);

  const getHTSummary = useCallback(async () => {
    if (htSummaryRef.current) return htSummaryRef.current;
    const data = await fetchHTSummary(gameId);
    htSummaryRef.current = data;
    return data;
  }, [gameId]);

  const getEvents = useCallback(
    (htSummary = null) => pwhlSummaryEvents({ isLive, liveData, pbpData, teamId, gameId, htSummary }),
    [isLive, liveData, pbpData, teamId, gameId]);

  const buildAndStore = useCallback(async (period, showAsNew = false) => {
    if (buildingRef.current.has(period)) return;
    buildingRef.current.add(period);
    try {
      const htSummary = await getHTSummary();
      const events    = getEvents(htSummary);
      const summary   = buildPWHLSummary(period, events, teamId, htSummary, gameId, isPlayoff);

      setSummaries(prev => {
        const next = [...prev.filter(s => s.period !== period), summary]
          .sort((a, b) => a.period - b.period);
        saveStored(gameId, next);
        return next;
      });
      if (showAsNew) setNewSummary(summary);
    } finally {
      buildingRef.current.delete(period);
    }
  }, [gameId, teamId, isPlayoff, getEvents, getHTSummary]);

  // Live: detect period transitions
  useEffect(() => {
    if (!isLive || !liveData?.events?.length || !gameId) return;
    const events        = liveData.events;
    const lastEvt       = events[events.length - 1];
    const currentPeriod = lastEvt?.period || 0;
    const gameStatus    = liveData.gameStatus || '';

    // Build summary when period changes (new period = previous period ended)
    if (currentPeriod > lastPeriodRef.current && lastPeriodRef.current > 0) {
      const prevPeriod = lastPeriodRef.current;
      if (prevPeriod > lastProcessedPeriod.current) {
        lastProcessedPeriod.current = prevPeriod;
        buildAndStore(prevPeriod, true);
      }
    }

    // Also build on intermission status
    if (gameStatus === 'intermission' && currentPeriod > 0 && currentPeriod > lastProcessedPeriod.current) {
      lastProcessedPeriod.current = currentPeriod;
      buildAndStore(currentPeriod, true);
    }

    lastPeriodRef.current = currentPeriod;
  }, [isLive, liveData?.events?.length, liveData?.gameStatus, gameId, buildAndStore]);

  // Completed game: build all periods on load
  useEffect(() => {
    if (isLive || !gameId) return;
    const events = getEvents();
    if (!events.length) return;
    const periods = [...new Set(events.map(e => e.period).filter(Boolean))].sort((a, b) => a - b);
    if (!periods.length) return;

    const stored       = loadStored(gameId);
    const builtPeriods = new Set(stored?.summaries?.map(s => s.period) || []);
    periods.forEach(p => {
      if (!builtPeriods.has(p) && !buildingRef.current.has(p)) {
        buildAndStore(p, false);
      }
    });
  }, [gameId, isLive, pbpData, buildAndStore, getEvents]);

  const dismissNewSummary = useCallback(() => setNewSummary(null), []);

  const updateSummaryNarrative = useCallback((period, narrative) => {
    setSummaries(prev => {
      const next = prev.map(s =>
        s.period === period ? { ...s, aiNarrative: narrative, aiLoading: false } : s
      );
      saveStored(gameId, next);
      return next;
    });
    setNewSummary(prev =>
      prev?.period === period ? { ...prev, aiNarrative: narrative, aiLoading: false } : prev
    );
  }, [gameId]);

  return { summaries, newSummary, dismissNewSummary, updateSummaryNarrative };
}

// ── Game summary hook ─────────────────────────────────────────

export function usePWHLGameSummary({ liveData, pbpData, isLive, gameId, teamId }) {
  const [gameSummary, setGameSummary] = useState(null);
  const builtRef = useRef(false);

  useEffect(() => {
    if (!gameId) { builtRef.current = false; setGameSummary(null); return; }
    const stored = loadStoredGame(gameId);
    if (stored) {
      setGameSummary(stored);
      builtRef.current = true;
    } else {
      setGameSummary(null);
      builtRef.current = false;
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId || builtRef.current) return;

    const events     = pwhlSummaryEvents({ isLive, liveData, pbpData, teamId, gameId });
    const gameStatus = liveData?.gameStatus || '';
    const isFinal    = gameStatus === 'final' || gameStatus === 'official';
    const hasGoals   = events.some(e => e.eventType === 'goal');

    // Live: wait for final status. Completed: build as soon as events available.
    if (isLive && !isFinal) return;
    if (!events.length || !hasGoals) return;

    builtRef.current = true;

    (async () => {
      const htSummary = await fetchHTSummary(gameId);
      const summary   = buildPWHLGameSummary(
        pwhlSummaryEvents({ isLive, liveData, pbpData, teamId, gameId, htSummary }), teamId, htSummary, gameId);
      setGameSummary(summary);
      saveStoredGame(gameId, summary);
    })();
  }, [gameId, isLive, liveData, pbpData, teamId]);

  const updateNarrative = useCallback((narrative) => {
    setGameSummary(prev => {
      if (!prev) return prev;
      const next = { ...prev, aiNarrative: narrative, aiLoading: false };
      saveStoredGame(gameId, next);
      return next;
    });
  }, [gameId]);

  return { gameSummary, updateGameNarrative: updateNarrative };
}
