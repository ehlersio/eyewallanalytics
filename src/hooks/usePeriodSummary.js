// hooks/usePeriodSummary.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { getGameLanding } from '../utils/nhlApi';
import { computeShotAttempts } from '../utils/advancedStats';

const WORKER_URL = typeof import.meta !== 'undefined'
  ? import.meta.env?.VITE_WORKER_URL
  : null;

const SESSION_KEY = 'eyewall_period_summaries';

// Fetch a cached narrative from Worker KV — returns string or null
async function fetchCachedNarrative(gameId, period) {
  if (!WORKER_URL || !gameId) return null;
  try {
    const key = `narrative:${period}:${gameId}`;
    const res = await fetch(`${WORKER_URL}/cache/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.narrative || null;
  } catch { return null; }
}

function loadStored(gameId) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.gameId === gameId ? parsed : null;
  } catch { return null; }
}

function saveStored(gameId, summaries) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ gameId, summaries }));
  } catch {}
}

// Build player ID -> name map from PBP roster data
function buildRosterMap(pbp) {
  const map = {};
  const rosters = [
    ...(pbp?.homeTeam?.players || []),
    ...(pbp?.awayTeam?.players || []),
    ...(pbp?.rosterSpots || []),
  ];
  rosters.forEach(p => {
    if (p?.playerId) {
      map[p.playerId] = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim()
        || p.name?.default || null;
    }
  });
  return map;
}

// Extract CAR goalie name from rosterSpots — used to ground the AI prompt
function getPrimaryGoalieName(pbp, carTeamId) {
  const spots = pbp?.rosterSpots || [];
  const carGoalies = spots.filter(p =>
    p.teamId === carTeamId && p.positionCode === 'G'
  );
  // Prefer the first listed goalie (starter) — roster spots are typically ordered
  if (!carGoalies.length) return null;
  const g = carGoalies[0];
  return `${g.firstName?.default || ''} ${g.lastName?.default || ''}`.trim() || null;
}

function buildSummary(period, plays, carTeamId, landingData, pbp, gameId, isPlayoff = false) {
  const periodPlays = plays.filter(p => p.periodDescriptor?.number === period);
  const rosterMap = buildRosterMap(pbp);

  // Shot stats for this period
  const shotStats = computeShotAttempts(periodPlays, carTeamId);

  // High-danger chances — matches Shot Map formula exactly:
  // dist < 15 (strict), includes blocked shots, uses |xCoord| - 89 distance
  const isHighDanger = (p) => {
    const x = Math.abs(p.details?.xCoord || 0);
    const y = p.details?.yCoord || 0;
    return Math.sqrt((x - 89) ** 2 + y ** 2) < 15;
  };
  const shotTypes = new Set(['goal', 'shot-on-goal', 'missed-shot', 'blocked-shot']);
  const carHDCF = periodPlays.filter(p => shotTypes.has(p.typeDescKey) && p.details?.eventOwnerTeamId === carTeamId && isHighDanger(p)).length;
  const oppHDCF = periodPlays.filter(p => shotTypes.has(p.typeDescKey) && p.details?.eventOwnerTeamId !== carTeamId && isHighDanger(p)).length;

  // Faceoffs
  const carFOwon = periodPlays.filter(p => p.typeDescKey === 'faceoff' && p.details?.eventOwnerTeamId === carTeamId).length;
  const totalFO = periodPlays.filter(p => p.typeDescKey === 'faceoff').length;
  const carFOPct = totalFO > 0 ? Math.round((carFOwon / totalFO) * 100) : null;

  // Takeaways / Giveaways
  const carTK = periodPlays.filter(p => p.typeDescKey === 'takeaway' && p.details?.eventOwnerTeamId === carTeamId).length;
  const carGV = periodPlays.filter(p => p.typeDescKey === 'giveaway' && p.details?.eventOwnerTeamId === carTeamId).length;
  const carHits = periodPlays.filter(p => p.typeDescKey === 'hit' && p.details?.eventOwnerTeamId === carTeamId).length;

  // Goals from PBP
  const goals = periodPlays
    .filter(p => p.typeDescKey === 'goal')
    .map(p => ({
      time:      p.timeInPeriod,
      teamId:    p.details?.eventOwnerTeamId,
      isCar:     p.details?.eventOwnerTeamId === carTeamId,
      scorerId:  p.details?.scoringPlayerId,
      awayScore: p.details?.awayScore,
      homeScore: p.details?.homeScore,
      highlightClip: null, discreteClip: null,
      highlightClipSharingUrl: null, scorerName: null,
      scorerHeadshot: null, assists: [], strength: 'ev', shotType: null,
    }));

  // Penalties — include player names
  const penalties = periodPlays
    .filter(p => p.typeDescKey === 'penalty')
    .map(p => ({
      time:          p.timeInPeriod,
      teamId:        p.details?.eventOwnerTeamId,
      isCar:         p.details?.eventOwnerTeamId === carTeamId,
      type:          p.details?.descKey,
      duration:      p.details?.duration,
      playerId:      p.details?.committedByPlayerId,
      playerName:    rosterMap[p.details?.committedByPlayerId] || null,
      drawnById:     p.details?.drawnByPlayerId,
      drawnByName:   rosterMap[p.details?.drawnByPlayerId] || null,
    }));

  // Enrich goals from landing
  const landingGoals = landingData?.summary?.scoring
    ?.find(s => s.periodDescriptor?.number === period)?.goals || [];
  const enrichedGoals = goals.map((g, i) => {
    const lg = landingGoals[i];
    return {
      ...g,
      highlightClip:           lg?.highlightClip || null,
      discreteClip:            lg?.discreteClip || null,
      highlightClipSharingUrl: lg?.highlightClipSharingUrl || null,
      scorerName:              lg?.name?.default || rosterMap[g.scorerId] || null,
      scorerHeadshot:          lg?.headshot || null,
      assists:                 lg?.assists || [],
      strength:                lg?.strength || 'ev',
      shotType:                lg?.shotType || null,
    };
  });

  // Three stars (final period only)
  const maxPeriod = Math.max(...plays.map(p => p.periodDescriptor?.number || 0));
  const threeStars = period === maxPeriod ? (landingData?.summary?.threeStars || []) : [];

  // Period-end score from last goal or period-end event
  const lastGoal = goals[goals.length - 1];
  const periodEndPlay = periodPlays.findLast(p => p.typeDescKey === 'period-end' || p.typeDescKey === 'game-end');
  const awayScore = lastGoal?.awayScore ?? null;
  const homeScore = lastGoal?.homeScore ?? null;

  return {
    period,
    // Period label — playoff OT periods are full 20min (OT, 2OT, 3OT...)
    // Regular season: period 4 = OT (5min 3v3), period 5 = SO
    periodLabel: period <= 3 ? `Period ${period}`
      : isPlayoff ? (period === 4 ? 'OT' : `${period - 3}OT`)
      : period === 4 ? 'OT' : 'SO',
    periodShort: period <= 3 ? `P${period}`
      : isPlayoff ? (period === 4 ? 'OT' : `${period - 3}OT`)
      : period === 4 ? 'OT' : 'SO',
    generatedAt: Date.now(),
    // Shot stats
    carCorsi:     shotStats.carCorsi,
    oppCorsi:     shotStats.oppCorsi,
    carSOG:       shotStats.car?.sog || 0,
    oppSOG:       shotStats.opp?.sog || 0,
    corsiForPct:  shotStats.corsiForPct,
    fenwickForPct: shotStats.carFenwick + shotStats.oppFenwick > 0
      ? Math.round((shotStats.carFenwick / (shotStats.carFenwick + shotStats.oppFenwick)) * 100)
      : 50,
    // Period-specific stats
    carHDCF, oppHDCF,
    carFOPct,
    carTK, carGV,
    carHits,
    carGoals: enrichedGoals.filter(g => g.isCar).length,
    oppGoals: enrichedGoals.filter(g => !g.isCar).length,
    // Events
    goals: enrichedGoals,
    penalties,
    // Score
    awayScore, homeScore,
    // Three stars
    threeStars,
    // AI — check Worker KV cache first before showing loading state
    aiNarrative: null,
    aiLoading: true,
    gameId,
    primaryGoalieName: getPrimaryGoalieName(pbp, carTeamId),
  };
}

export function usePeriodSummary({ pbp, isLive, gameId, carTeamId, isPlayoff = false }) {
  const [summaries, setSummaries] = useState([]);
  const [newSummary, setNewSummary] = useState(null);
  const lastProcessedPeriod = useRef(0);
  const lastInIntermission = useRef(false);
  const buildingRef = useRef(new Set());
  const landingRef = useRef(null);

  // Restore from sessionStorage on mount / gameId change
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
    buildingRef.current = new Set();
    landingRef.current = null;
  }, [gameId]);

  const fetchLanding = useCallback(async () => {
    if (landingRef.current || !gameId) return landingRef.current;
    try { landingRef.current = await getGameLanding(gameId); } catch {}
    return landingRef.current;
  }, [gameId]);

  const buildAndStoreSummary = useCallback(async (period, plays, showAsNew = false) => {
    if (buildingRef.current.has(period)) return;
    buildingRef.current.add(period);
    try {
      const landing = await fetchLanding();
      const summary = buildSummary(period, plays, carTeamId, landing, pbp, gameId, isPlayoff);

      // Pre-fetch cached narrative from Worker KV — if found, skip the AI loading state
      const cachedNarrative = await fetchCachedNarrative(gameId, String(period));
      if (cachedNarrative) {
        summary.aiNarrative = cachedNarrative;
        summary.aiLoading   = false;
      }

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
  }, [gameId, carTeamId, pbp, fetchLanding]);

  // Live: detect period transitions
  useEffect(() => {
    if (!isLive || !pbp || !gameId) return;
    const inIntermission = pbp?.clock?.inIntermission || false;
    const currentPeriod = pbp?.periodDescriptor?.number || 0;
    if (inIntermission && !lastInIntermission.current && currentPeriod > 0) {
      if (currentPeriod > lastProcessedPeriod.current) {
        lastProcessedPeriod.current = currentPeriod;
        buildAndStoreSummary(currentPeriod, pbp?.plays || [], true);
      }
    }
    lastInIntermission.current = inIntermission;
  }, [pbp?.clock?.inIntermission, pbp?.periodDescriptor?.number, isLive, gameId, buildAndStoreSummary]);

  // Completed game: build all periods on first load
  useEffect(() => {
    if (isLive || !pbp || !gameId) return;
    const plays = pbp?.plays || [];
    const periods = [...new Set(plays.map(p => p.periodDescriptor?.number).filter(Boolean))].sort();
    if (!periods.length) return;
    // Check which periods are already stored — don't overwrite them
    const stored = loadStored(gameId);
    const builtPeriods = new Set(stored?.summaries?.map(s => s.period) || []);
    periods.forEach(p => {
      if (!builtPeriods.has(p) && !buildingRef.current.has(p)) {
        buildAndStoreSummary(p, plays, false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, isLive, pbp?.plays?.length]);

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

// ── Full game summary ─────────────────────────────────────────
// Built once when all periods are complete (completed games on load,
// live games when gameState goes FINAL).
function buildGameSummary(plays, carTeamId, landingData, pbp, gameId) {
  const rosterMap = buildRosterMap(pbp);
  const shotStats = computeShotAttempts(plays, carTeamId);

  // Aggregate per-period stats for comparison
  const periods = [...new Set(plays.map(p => p.periodDescriptor?.number).filter(Boolean))].sort();
  const periodStats = periods.map(period => {
    const pp = plays.filter(p => p.periodDescriptor?.number === period);
    const ps = computeShotAttempts(pp, carTeamId);
    return { period, corsiForPct: ps.corsiForPct, carSOG: ps.car?.sog || 0, oppSOG: ps.opp?.sog || 0 };
  });

  // Best and worst period for CAR
  const bestPeriod = [...periodStats].sort((a,b) => b.corsiForPct - a.corsiForPct)[0];
  const worstPeriod = [...periodStats].sort((a,b) => a.corsiForPct - b.corsiForPct)[0];

  // All goals
  const allGoals = plays.filter(p => p.typeDescKey === 'goal').map(p => ({
    period: p.periodDescriptor?.number,
    time: p.timeInPeriod,
    isCar: p.details?.eventOwnerTeamId === carTeamId,
    scorerId: p.details?.scoringPlayerId,
    awayScore: p.details?.awayScore,
    homeScore: p.details?.homeScore,
  }));
  const landingGoals = landingData?.summary?.scoring?.flatMap(s => s.goals || []) || [];
  const enrichedGoals = allGoals.map((g, i) => {
    const lg = landingGoals[i];
    return { ...g, scorerName: lg?.name?.default || rosterMap[g.scorerId] || null,
      assists: lg?.assists || [], strength: lg?.strength || 'ev',
      discreteClip: lg?.discreteClip || null, scorerHeadshot: lg?.headshot || null };
  });

  // Penalties
  const allPenalties = plays.filter(p => p.typeDescKey === 'penalty').map(p => ({
    period: p.periodDescriptor?.number, time: p.timeInPeriod,
    isCar: p.details?.eventOwnerTeamId === carTeamId,
    type: p.details?.descKey, duration: p.details?.duration,
    playerName: rosterMap[p.details?.committedByPlayerId] || null,
  }));

  // Faceoffs, hits, TK/GV
  const carFOwon = plays.filter(p => p.typeDescKey === 'faceoff' && p.details?.eventOwnerTeamId === carTeamId).length;
  const totalFO = plays.filter(p => p.typeDescKey === 'faceoff').length;
  const carTK = plays.filter(p => p.typeDescKey === 'takeaway' && p.details?.eventOwnerTeamId === carTeamId).length;
  const carGV = plays.filter(p => p.typeDescKey === 'giveaway' && p.details?.eventOwnerTeamId === carTeamId).length;
  const carHits = plays.filter(p => p.typeDescKey === 'hit' && p.details?.eventOwnerTeamId === carTeamId).length;

  const isHighDanger = (p) => {
    const x = Math.abs(p.details?.xCoord || 0);
    const y = p.details?.yCoord || 0;
    return Math.sqrt((x-89)**2 + y**2) < 15;
  };
  const shotTypes = new Set(['goal','shot-on-goal','missed-shot','blocked-shot']);
  const carHDCF = plays.filter(p => shotTypes.has(p.typeDescKey) && p.details?.eventOwnerTeamId === carTeamId && isHighDanger(p)).length;
  const oppHDCF = plays.filter(p => shotTypes.has(p.typeDescKey) && p.details?.eventOwnerTeamId !== carTeamId && isHighDanger(p)).length;

  // Final score from last goal or last play
  const lastGoal = [...allGoals].reverse()[0];

  return {
    period: 'game',
    periodLabel: 'Final',
    periodShort: 'FINAL',
    generatedAt: Date.now(),
    isGameSummary: true,
    // Shot stats
    carCorsi: shotStats.carCorsi, oppCorsi: shotStats.oppCorsi,
    carSOG: shotStats.car?.sog || 0, oppSOG: shotStats.opp?.sog || 0,
    corsiForPct: shotStats.corsiForPct,
    fenwickForPct: shotStats.carFenwick + shotStats.oppFenwick > 0
      ? Math.round((shotStats.carFenwick / (shotStats.carFenwick + shotStats.oppFenwick)) * 100) : 50,
    carHDCF, oppHDCF,
    carFOPct: totalFO > 0 ? Math.round((carFOwon / totalFO) * 100) : null,
    carTK, carGV, carHits,
    carGoals: enrichedGoals.filter(g => g.isCar).length,
    oppGoals: enrichedGoals.filter(g => !g.isCar).length,
    // Events
    goals: enrichedGoals,
    penalties: allPenalties,
    // Period breakdown
    periodStats, bestPeriod, worstPeriod,
    // Score
    awayScore: lastGoal?.awayScore ?? null,
    homeScore: lastGoal?.homeScore ?? null,
    // Three stars
    threeStars: landingData?.summary?.threeStars || [],
    // AI
    aiNarrative: null, aiLoading: true,
    gameId,
    primaryGoalieName: getPrimaryGoalieName(pbp, carTeamId),
  };
}

const GAME_SUMMARY_KEY = 'eyewall_game_summary';

function loadStoredGame(gameId) {
  try {
    const raw = sessionStorage.getItem(GAME_SUMMARY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.gameId === gameId ? parsed.summary : null;
  } catch { return null; }
}

function saveStoredGame(gameId, summary) {
  try {
    sessionStorage.setItem(GAME_SUMMARY_KEY, JSON.stringify({ gameId, summary }));
  } catch {}
}

export function useGameSummary({ pbp, isLive, gameId, carTeamId }) {
  const [gameSummary, setGameSummary] = useState(null);
  const builtRef = useRef(false);

  // Restore from sessionStorage on gameId change
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
    if (!pbp || !gameId || builtRef.current) return;
    const plays = pbp?.plays || [];
    const periods = [...new Set(plays.map(p => p.periodDescriptor?.number).filter(Boolean))];
    const hasGameEnd = plays.some(p => p.typeDescKey === 'game-end');
    // Require at least 3 regulation periods to have played — OT periods are additive
    const regulationPeriods = periods.filter(p => p <= 3);
    if (!hasGameEnd || regulationPeriods.length < 3) return;
    builtRef.current = true;
    (async () => {
      let landing = null;
      try { landing = await getGameLanding(gameId); } catch {}
      const summary = buildGameSummary(plays, carTeamId, landing, pbp, gameId);

      // Pre-fetch cached narrative from Worker KV
      const cachedNarrative = await fetchCachedNarrative(gameId, 'game');
      if (cachedNarrative) {
        summary.aiNarrative = cachedNarrative;
        summary.aiLoading   = false;
      }

      setGameSummary(summary);
      saveStoredGame(gameId, summary);
    })();
  }, [gameId, pbp?.plays?.length, carTeamId]);

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

