// hooks/usePWHLPeriodSummary.js
//
// Derives period and game summaries from PWHL live/PBP event data.
// Data sources:
//   - liveData.events  — normalized events from /pwhl/live/:gameId (live games)
//   - pbpData.events   — Supabase PBP rows from /pwhl/pbp?gameId= (completed games)
//   - /pwhl/summary?gameId= — HockeyTech gameSummary for goal enrichment + MVPs
//
// PWHL event shape (normalized by Worker):
//   eventType, period (integer, OT=4), time "MM:SS", teamId (integer)
//   goals:     { scoredBy: { firstName, lastName }, assists: [], isPowerPlay... }
//   penalties: { takenBy: { firstName, lastName }, description, minutes }
//   faceoffs:  { homeWin: bool, homePlayer, visitingPlayer }
//   hits:      { player, onPlayer, teamId }
//   shots:     { teamId, shooter, isGoal, x_norm, y_norm }

import { useState, useEffect, useRef, useCallback } from 'react';

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

// Compute shot stats from normalized PWHL events for a period (or all).
// Events use { eventType, teamId, period, x_norm, y_norm, isGoal }
function computePWHLShotStats(events, teamId, period = null) {
  const evts = period != null ? events.filter(e => e.period === period) : events;

  let carCorsi = 0, oppCorsi = 0;
  let carFenwick = 0, oppFenwick = 0;
  let carSOG = 0, oppSOG = 0;
  let carHDCF = 0, oppHDCF = 0;

  // High danger: attacking zone, close to net
  // x_norm in [-1,1]: |x| > 0.75 and |y| < 0.35 approximates slot/crease area
  const isHD = (e) => {
    const x = e.x_norm ?? e.xNorm ?? null;
    const y = e.y_norm ?? e.yNorm ?? null;
    if (x == null || y == null) return false;
    return Math.abs(x) > 0.75 && Math.abs(y) < 0.35;
  };

  for (const e of evts) {
    const isCar = e.teamId === teamId;
    const type  = e.eventType;

    if (type === 'goal') {
      isCar ? (carCorsi++, carFenwick++, carSOG++) : (oppCorsi++, oppFenwick++, oppSOG++);
      if (isHD(e)) isCar ? carHDCF++ : oppHDCF++;
    } else if (type === 'shot') {
      if (e.isGoal) {
        isCar ? (carCorsi++, carFenwick++, carSOG++) : (oppCorsi++, oppFenwick++, oppSOG++);
      } else {
        isCar ? (carCorsi++, carFenwick++) : (oppCorsi++, oppFenwick++);
      }
      if (isHD(e)) isCar ? carHDCF++ : oppHDCF++;
    } else if (type === 'blocked_shot') {
      isCar ? carCorsi++ : oppCorsi++;
    }
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
    if (e.eventType !== 'faceoff') return e;
    const carIsHome = homeTeamId === teamId;
    return { ...e, _carWonFO: carIsHome ? e.homeWin : !e.homeWin };
  });
}

// ── Build a single period summary ────────────────────────────

function buildPWHLSummary(period, events, teamId, htSummary, gameId, isPlayoff = false) {
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

  const goals = goalEvts.map((e, i) => {
    const ht    = htGoals[i] || null;
    const isCar = e.teamId === teamId;
    return {
      isCar,
      time:       e.time || ht?.time || '—',
      period,
      scorerName: ht
        ? `${ht.scoredBy?.firstName || ''} ${ht.scoredBy?.lastName || ''}`.trim()
        : (e.scoredBy ? `${e.scoredBy.firstName || ''} ${e.scoredBy.lastName || ''}`.trim() : null),
      scorerHeadshot: ht?.scoredBy?.playerImageURL?.replace('/120x160/', '/240x240/') || null,
      assists: (ht?.assists || []).map(a => ({
        name: { default: `${a.firstName || ''} ${a.lastName || ''}`.trim() },
      })),
      strength: ht?.properties?.isPowerPlay    === '1' ? 'pp'
        : ht?.properties?.isShortHanded  === '1'       ? 'sh'
        : ht?.properties?.isEmptyNet     === '1'       ? 'en'
        : 'ev',
    };
  });

  // Penalties
  const penalties = periodEvts
    .filter(e => e.eventType === 'penalty')
    .map(e => ({
      period,
      time:       e.time || '—',
      isCar:      e.teamId === teamId,
      playerName: e.takenBy
        ? `${e.takenBy.firstName || ''} ${e.takenBy.lastName || ''}`.trim()
        : null,
      type:     e.description || 'Penalty',
      duration: e.minutes ?? 2,
    }));

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
    gameId,
  };
}

// ── Build game summary ────────────────────────────────────────

function buildPWHLGameSummary(events, teamId, htSummary, gameId) {
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
  const goals = goalEvts.map((e, i) => {
    const ht = allHtGoals[i] || null;
    return {
      isCar:  e.teamId === teamId,
      period: e.period,
      time:   e.time || ht?.time || '—',
      scorerName: ht
        ? `${ht.scoredBy?.firstName || ''} ${ht.scoredBy?.lastName || ''}`.trim()
        : (e.scoredBy ? `${e.scoredBy.firstName || ''} ${e.scoredBy.lastName || ''}`.trim() : null),
      scorerHeadshot: ht?.scoredBy?.playerImageURL?.replace('/120x160/', '/240x240/') || null,
      assists: (ht?.assists || []).map(a => ({
        name: { default: `${a.firstName || ''} ${a.lastName || ''}`.trim() },
      })),
      strength: ht?.properties?.isPowerPlay   === '1' ? 'pp'
        : ht?.properties?.isShortHanded === '1'       ? 'sh'
        : ht?.properties?.isEmptyNet    === '1'       ? 'en'
        : 'ev',
    };
  });

  // All penalties
  const penalties = events
    .filter(e => e.eventType === 'penalty')
    .map(e => ({
      period:     e.period,
      time:       e.time || '—',
      isCar:      e.teamId === teamId,
      playerName: e.takenBy
        ? `${e.takenBy.firstName || ''} ${e.takenBy.lastName || ''}`.trim()
        : null,
      type:     e.description || 'Penalty',
      duration: e.minutes ?? 2,
    }));

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

  // Primary goalie (for AI grounding) — prefer MVP goalie
  const mvpGoalie = (htSummary?.mvps || []).find(m => m.isGoalie);
  const primaryGoalieName = mvpGoalie
    ? `${mvpGoalie.player?.info?.firstName || ''} ${mvpGoalie.player?.info?.lastName || ''}`.trim() || null
    : null;

  return {
    period:        'game',
    periodLabel:   'Final',
    periodShort:   'FINAL',
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
    primaryGoalieName,
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

  const getEvents = useCallback(() => {
    const raw        = isLive ? (liveData?.events || []) : (pbpData?.events || []);
    const homeTeamId = liveData?.homeTeamId ?? pbpData?.home_team_id ?? null;
    return annotateFaceoffs(raw, teamId, homeTeamId);
  }, [isLive, liveData, pbpData, teamId]);

  const buildAndStore = useCallback(async (period, showAsNew = false) => {
    if (buildingRef.current.has(period)) return;
    buildingRef.current.add(period);
    try {
      const events    = getEvents();
      const htSummary = await getHTSummary();
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
  }, [gameId, isLive, pbpData?.events?.length, buildAndStore, getEvents]);

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

    const events     = isLive ? (liveData?.events || []) : (pbpData?.events || []);
    const gameStatus = liveData?.gameStatus || '';
    const isFinal    = gameStatus === 'final' || gameStatus === 'official';
    const hasGoals   = events.some(e => e.eventType === 'goal');

    // Live: wait for final status. Completed: build as soon as events available.
    if (isLive && !isFinal) return;
    if (!events.length || !hasGoals) return;

    builtRef.current = true;

    (async () => {
      const homeTeamId = liveData?.homeTeamId ?? pbpData?.home_team_id ?? null;
      const annotated  = annotateFaceoffs(events, teamId, homeTeamId);
      const htSummary  = await fetchHTSummary(gameId);
      const summary    = buildPWHLGameSummary(annotated, teamId, htSummary, gameId);
      setGameSummary(summary);
      saveStoredGame(gameId, summary);
    })();
  }, [gameId, isLive, liveData?.gameStatus, liveData?.events?.length, pbpData?.events?.length, teamId]);

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
