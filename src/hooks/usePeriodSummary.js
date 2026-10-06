// hooks/usePeriodSummary.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { getGameLanding } from '../utils/nhlApi';
import { computeShotAttempts } from '../utils/advancedStats';
import { finalSuffix } from '../utils/scoreboard';
import { penaltyParties } from '../utils/penaltyText';
import { withoutShootout, isShootoutPlay, hasShotTracking, nhlPeriodLabel } from '../utils/gamePlays';
import { fetchCachedNarrative, nhlNarrativeCacheKey } from '../utils/narrativeCache';

const SESSION_KEY = 'eyewall_period_summaries';
const GAME_SUMMARY_KEY = 'eyewall_game_summary';

// Pair a play-by-play goal with its `landing` entry (video clip, assists,
// headshot). Both feeds give a goal the same eventId -- checked against real
// games back to 2021. Position was used before, which is right only while
// landing lists a period's goals in exactly the play-by-play's order and
// neither feed omits one; when that slipped, a goal took another goal's
// scorer, assists and video. Position stays as a fallback for a feed with
// no ids at all, where it's the old behaviour rather than nothing.
export function landingGoalPicker(landingGoals) {
  const byId = new Map((landingGoals || []).filter(g => g?.eventId != null).map(g => [g.eventId, g]));
  return (goal, index) => byId.get(goal?.eventId) ?? (landingGoals || [])[index];
}

// Stored per team as well as per game: a summary is written from one
// team's side (carTeamId), and the same game can be watched from either
// side -- the favorite's, or a guest team's off the Scoreboard (see
// GameTeamContext.jsx). One shared slot let each overwrite the other, and
// a guest view of the favorite's opponent read the favorite's summaries.
const storedKey = (base, teamId) => `${base}:${teamId}`;

// Every team's stored period and game summaries -- DevReplayView starts a
// replay from nothing with this.
export function clearStoredSummaries() {
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(`${SESSION_KEY}:`) || k.startsWith(`${GAME_SUMMARY_KEY}:`))
      .forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

function loadStored(gameId, teamId) {
  try {
    const raw = sessionStorage.getItem(storedKey(SESSION_KEY, teamId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.gameId === gameId ? parsed : null;
  } catch { return null; }
}

function saveStored(gameId, teamId, summaries) {
  try {
    sessionStorage.setItem(storedKey(SESSION_KEY, teamId), JSON.stringify({ gameId, summaries }));
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

// The team's goalies who actually faced shots in these plays, in the order
// they first appeared -- used to ground the AI prompt. Every shot, miss and
// goal names the goalie in net (goalieInNetId). This used to take the first
// goalie in rosterSpots, which isn't ordered by who starts, so the summary
// often credited the backup. No shots against = no name, never a guess.
export function goaliesInNet(plays, rosterMap, teamId) {
  const ids = [];
  for (const p of plays) {
    if (!['shot-on-goal', 'missed-shot', 'goal'].includes(p.typeDescKey)) continue;
    const id = p.details?.goalieInNetId;
    if (!id || p.details?.eventOwnerTeamId === teamId || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids.map(id => rosterMap[id]).filter(Boolean);
}

// One penalty play as the period and game summaries list it. playerName is
// whoever committed it; a bench minor has none (committedByPlayerId is
// absent) and names the skater who serves it instead -- see penaltyText.js.
export function summaryPenalty(play, rosterMap, carTeamId) {
  const d = play?.details || {};
  const parties = penaltyParties(d, id => rosterMap[id]);
  return {
    time:         play?.timeInPeriod,
    teamId:       d.eventOwnerTeamId,
    isCar:        d.eventOwnerTeamId === carTeamId,
    type:         d.descKey,
    typeCode:     d.typeCode ?? null,
    duration:     d.duration,
    playerId:     d.committedByPlayerId ?? null,
    playerName:   parties.committedName,
    servedById:   d.servedByPlayerId ?? null,
    servedByName: parties.servedByName,
    teamPenalty:  parties.teamPenalty,
    benchMinor:   parties.benchMinor,
    drawnById:    d.drawnByPlayerId,
    drawnByName:  rosterMap[d.drawnByPlayerId] || null,
  };
}

// The game's type decides what period 5 is (2OT in the playoffs, SO
// otherwise) -- the play-by-play's own gameType, else what the caller says.
function playoffGame(pbp, isPlayoff) {
  return pbp?.gameType != null ? pbp.gameType === 3 : !!isPlayoff;
}

// The score at the end of `period`: the last goal at or before it, from
// every period so far, or 0-0 before any goal. Reading only the goals IN
// the period left a scoreless period with no score at all ('CAR – – FLA'
// for P3 of FLA@CAR 2026-09-22, 2-2 at the time). Shootout plays never
// reach here: their goals carry the tied pre-shootout score.
export function scoreAfterPeriod(plays, period) {
  const goals = (plays || []).filter(p => p.typeDescKey === 'goal' && (p.periodDescriptor?.number || 0) <= period);
  const last = goals[goals.length - 1];
  if (!last) return { awayScore: 0, homeScore: 0 };
  return { awayScore: last.details?.awayScore ?? null, homeScore: last.details?.homeScore ?? null };
}

// carScore / oppScore: a score from the summary team's side, for lists
// that show it without knowing which side that team was (the bell).
function teamScore(pbp, carTeamId, awayScore, homeScore) {
  const home = pbp?.homeTeam?.id, away = pbp?.awayTeam?.id;
  if (carTeamId !== home && carTeamId !== away) return { carScore: null, oppScore: null };
  const carIsHome = carTeamId === home;
  return { carScore: carIsHome ? homeScore : awayScore, oppScore: carIsHome ? awayScore : homeScore };
}

// Shot-based numbers are null when the game's feed tracks no shots
// (goals and penalties only, see hasShotTracking) -- they'd count only
// the goals. Never a made-up 50%.
function shotSummary(plays, carTeamId, tracked) {
  if (!tracked) {
    return { carCorsi: null, oppCorsi: null, carSOG: null, oppSOG: null, corsiForPct: null, fenwickForPct: null };
  }
  const shotStats = computeShotAttempts(plays, carTeamId);
  return {
    carCorsi:      shotStats.carCorsi,
    oppCorsi:      shotStats.oppCorsi,
    carSOG:        shotStats.car.sog,
    oppSOG:        shotStats.opp.sog,
    corsiForPct:   shotStats.corsiForPct,
    fenwickForPct: shotStats.fenwickForPct == null ? null : Math.round(shotStats.fenwickForPct),
  };
}

export function buildSummary(period, allPlays, carTeamId, landingData, pbp, gameId, isPlayoff = false) {
  // A shootout is no period of play (see gamePlays.js): no summary is
  // built for it, and its attempts count nowhere.
  const plays = withoutShootout(allPlays);
  const tracked = hasShotTracking(plays);
  const periodPlays = plays.filter(p => p.periodDescriptor?.number === period);
  const rosterMap = buildRosterMap(pbp);
  const playoff = playoffGame(pbp, isPlayoff);

  // Shot stats for this period
  const shots = shotSummary(periodPlays, carTeamId, tracked);

  // High-danger chances — matches Shot Map formula exactly:
  // dist < 15 (strict), includes blocked shots, uses |xCoord| - 89 distance
  const isHighDanger = (p) => {
    const x = Math.abs(p.details?.xCoord || 0);
    const y = p.details?.yCoord || 0;
    return Math.sqrt((x - 89) ** 2 + y ** 2) < 15;
  };
  const shotTypes = new Set(['goal', 'shot-on-goal', 'missed-shot', 'blocked-shot']);
  const carHDCF = tracked ? periodPlays.filter(p => shotTypes.has(p.typeDescKey) && p.details?.eventOwnerTeamId === carTeamId && isHighDanger(p)).length : null;
  const oppHDCF = tracked ? periodPlays.filter(p => shotTypes.has(p.typeDescKey) && p.details?.eventOwnerTeamId !== carTeamId && isHighDanger(p)).length : null;

  // Faceoffs
  const carFOwon = periodPlays.filter(p => p.typeDescKey === 'faceoff' && p.details?.eventOwnerTeamId === carTeamId).length;
  const totalFO = periodPlays.filter(p => p.typeDescKey === 'faceoff').length;
  const carFOPct = totalFO > 0 ? Math.round((carFOwon / totalFO) * 100) : null;

  // Takeaways / Giveaways
  const carTK = tracked ? periodPlays.filter(p => p.typeDescKey === 'takeaway' && p.details?.eventOwnerTeamId === carTeamId).length : null;
  const carGV = tracked ? periodPlays.filter(p => p.typeDescKey === 'giveaway' && p.details?.eventOwnerTeamId === carTeamId).length : null;
  const carHits = tracked ? periodPlays.filter(p => p.typeDescKey === 'hit' && p.details?.eventOwnerTeamId === carTeamId).length : null;

  // Goals from PBP
  const goals = periodPlays
    .filter(p => p.typeDescKey === 'goal')
    .map(p => ({
      eventId:   p.eventId,
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
    .map(p => summaryPenalty(p, rosterMap, carTeamId));

  // Enrich goals from landing -- see landingGoalPicker().
  const landingGoals = landingData?.summary?.scoring
    ?.find(s => s.periodDescriptor?.number === period)?.goals || [];
  const pickLanding = landingGoalPicker(landingGoals);
  const enrichedGoals = goals.map((g, i) => {
    const lg = pickLanding(g, i);
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

  // Score at the end of the period, from every goal so far
  const { awayScore, homeScore } = scoreAfterPeriod(plays, period);

  return {
    period,
    // Period label — playoff OT periods are full 20min (OT, 2OT, 3OT...)
    // Regular season: period 4 = OT (5min 3v3)
    periodLabel: period <= 3 ? `Period ${period}` : nhlPeriodLabel(period, playoff),
    periodShort: nhlPeriodLabel(period, playoff),
    generatedAt: Date.now(),
    // Shot stats
    ...shots,
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
    // Score at the end of the period, and the same from the team's side
    awayScore, homeScore,
    ...teamScore(pbp, carTeamId, awayScore, homeScore),
    // Three stars
    threeStars,
    // AI — check Worker KV cache first before showing loading state
    aiNarrative: null,
    aiLoading: true,
    gameId,
    carGoalieNames: goaliesInNet(periodPlays, rosterMap, carTeamId),
  };
}

// For a render or two after gameId changes, the pbp on hand is still the
// previous game's (usePoll keeps its last result until the new fetch lands).
// Building from it would file one game's periods under the other's id.
function isOtherGame(pbp, gameId) {
  return pbp.id != null && String(pbp.id) !== String(gameId);
}

// carAbbr: the team the game is watched as (a guest team's on a guest
// view) -- the Worker caches one narrative per team, under its abbr.
export function usePeriodSummary({ pbp, isLive, gameId, carTeamId, carAbbr, isPlayoff = false }) {
  const [summaries, setSummaries] = useState([]);
  const [newSummary, setNewSummary] = useState(null);
  const lastProcessedPeriod = useRef(0);
  const buildingRef = useRef(new Set());
  const landingRef = useRef(null);

  // Restore from sessionStorage on mount / gameId change
  useEffect(() => {
    if (!gameId) return;
    const stored = loadStored(gameId, carTeamId);
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
      const cached = await fetchCachedNarrative(nhlNarrativeCacheKey(period, gameId, carAbbr));
      if (cached) {
        summary.aiNarrative   = cached.narrative;
        summary.cardNarrative = cached.cardNarrative;
        summary.aiLoading     = false;
      }

      setSummaries(prev => {
        const next = [...prev.filter(s => s.period !== period), summary]
          .sort((a, b) => a.period - b.period);
        saveStored(gameId, carTeamId, next);
        return next;
      });
      if (showAsNew) setNewSummary(summary);
    } finally {
      buildingRef.current.delete(period);
    }
  }, [gameId, carTeamId, carAbbr, pbp, fetchLanding, isPlayoff]);

  // Live: show each period's summary once its intermission is on. Keyed on
  // "in an intermission for a period not yet summarized", not on catching
  // the poll where inIntermission flipped false -> true: that edge was easy
  // to miss (the page briefly dropping out of live mode, or the pbp on
  // screen still being another game's for a render), and a missed edge
  // meant no summary for that intermission at all -- the 1st Intermission
  // one went missing in the 2026 preseason while the 2nd showed.
  // lastProcessedPeriod already stops a repeat.
  useEffect(() => {
    if (!isLive || !pbp || !gameId || isOtherGame(pbp, gameId)) return;
    const inIntermission = pbp?.clock?.inIntermission || false;
    const currentPeriod = pbp?.periodDescriptor?.number || 0;
    if (pbp?.periodDescriptor?.periodType === 'SO') return; // no shootout summary
    if (inIntermission && currentPeriod > lastProcessedPeriod.current) {
      lastProcessedPeriod.current = currentPeriod;
      buildAndStoreSummary(currentPeriod, pbp?.plays || [], true);
    }
  }, [pbp?.clock?.inIntermission, pbp?.periodDescriptor?.number, pbp?.id, isLive, gameId, buildAndStoreSummary]);

  // Completed game: build all periods on first load
  useEffect(() => {
    if (isLive || !pbp || !gameId || isOtherGame(pbp, gameId)) return;
    const plays = pbp?.plays || [];
    // Every period but a shootout (see buildSummary)
    const periods = [...new Set(withoutShootout(plays).map(p => p.periodDescriptor?.number).filter(Boolean))].sort((a, b) => a - b);
    if (!periods.length) return;
    // Check which periods are already stored — don't overwrite them
    const stored = loadStored(gameId, carTeamId);
    const builtPeriods = new Set(stored?.summaries?.map(s => s.period) || []);
    periods.forEach(p => {
      if (!builtPeriods.has(p) && !buildingRef.current.has(p)) {
        buildAndStoreSummary(p, plays, false);
      }
    });
   
  }, [gameId, isLive, pbp?.id, pbp?.plays?.length]);

  const dismissNewSummary = useCallback(() => setNewSummary(null), []);

  // Builds one period's summary on demand -- a tapped End of P1
  // notification can arrive mid-P2, when only the current intermission's
  // summary gets built on its own. Returns false if that period isn't over
  // in the pbp on hand (or the pbp is still another game's), so the caller
  // can stop waiting for it.
  const requestSummary = useCallback((period) => {
    if (!pbp || !gameId || isOtherGame(pbp, gameId)) return false;
    const plays = pbp.plays || [];
    if (plays.some(p => isShootoutPlay(p) && p.periodDescriptor?.number === period)) return false;
    const over = plays.some(p => p.typeDescKey === 'period-end' && p.periodDescriptor?.number === period)
      || (pbp.clock?.inIntermission && pbp.periodDescriptor?.number === period);
    if (!over) return false;
    buildAndStoreSummary(period, plays, false);
    return true;
  }, [pbp, gameId, buildAndStoreSummary]);

  const updateSummaryNarrative = useCallback((period, narrative) => {
    setSummaries(prev => {
      const next = prev.map(s =>
        s.period === period ? { ...s, aiNarrative: narrative, aiLoading: false } : s
      );
      saveStored(gameId, carTeamId, next);
      return next;
    });
    setNewSummary(prev =>
      prev?.period === period ? { ...prev, aiNarrative: narrative, aiLoading: false } : prev
    );
  }, [gameId]);

  return { summaries, newSummary, dismissNewSummary, updateSummaryNarrative, requestSummary };
}

// ── Full game summary ─────────────────────────────────────────
// Built once when all periods are complete (completed games on load,
// live games when gameState goes FINAL).
export function buildGameSummary(allPlays, carTeamId, landingData, pbp, gameId) {
  // Without the shootout: its attempts aren't shots or goals (the NHL
  // credits the winner one goal, no player any), and its goals carry the
  // tied pre-shootout score -- a Final/SO card read 'CAR 4 – COL 4' for a
  // 5-4 shootout win (2025020121).
  const plays = withoutShootout(allPlays);
  const tracked = hasShotTracking(plays);
  const playoff = playoffGame(pbp);
  const rosterMap = buildRosterMap(pbp);
  const carIsHome = pbp?.homeTeam?.id === carTeamId;
  const shots = shotSummary(plays, carTeamId, tracked);
  if (!tracked) {
    // A goals-only feed still has the NHL's own shots-on-goal totals.
    const home = pbp?.homeTeam?.sog, away = pbp?.awayTeam?.sog;
    if (home != null && away != null) {
      shots.carSOG = carIsHome ? home : away;
      shots.oppSOG = carIsHome ? away : home;
    }
  }

  // Aggregate per-period stats for comparison (none without shot tracking)
  const periods = tracked
    ? [...new Set(plays.map(p => p.periodDescriptor?.number).filter(Boolean))].sort((a, b) => a - b)
    : [];
  const periodStats = periods.map(period => {
    const ps = computeShotAttempts(plays.filter(p => p.periodDescriptor?.number === period), carTeamId);
    return { period, label: nhlPeriodLabel(period, playoff), corsiForPct: ps.corsiForPct, carSOG: ps.car.sog, oppSOG: ps.opp.sog };
  });

  // Best and worst period for CAR (of those with any shot attempt)
  const ranked = periodStats.filter(ps => ps.corsiForPct != null);
  const bestPeriod = [...ranked].sort((a,b) => b.corsiForPct - a.corsiForPct)[0] ?? null;
  const worstPeriod = [...ranked].sort((a,b) => a.corsiForPct - b.corsiForPct)[0] ?? null;

  // All goals
  const allGoals = plays.filter(p => p.typeDescKey === 'goal').map(p => ({
    eventId: p.eventId,
    period: p.periodDescriptor?.number,
    time: p.timeInPeriod,
    isCar: p.details?.eventOwnerTeamId === carTeamId,
    scorerId: p.details?.scoringPlayerId,
    awayScore: p.details?.awayScore,
    homeScore: p.details?.homeScore,
  }));
  // Same eventId matching as buildSummary() above.
  const landingGoals = landingData?.summary?.scoring?.flatMap(s => s.goals || []) || [];
  const pickLanding = landingGoalPicker(landingGoals);
  const enrichedGoals = allGoals.map((g, i) => {
    const lg = pickLanding(g, i);
    return { ...g, scorerName: lg?.name?.default || rosterMap[g.scorerId] || null,
      assists: lg?.assists || [], strength: lg?.strength || 'ev',
      discreteClip: lg?.discreteClip || null, scorerHeadshot: lg?.headshot || null };
  });

  // Penalties
  const allPenalties = plays.filter(p => p.typeDescKey === 'penalty').map(p => ({
    period: p.periodDescriptor?.number,
    ...summaryPenalty(p, rosterMap, carTeamId),
  }));

  // Faceoffs, hits, TK/GV
  const carFOwon = plays.filter(p => p.typeDescKey === 'faceoff' && p.details?.eventOwnerTeamId === carTeamId).length;
  const totalFO = plays.filter(p => p.typeDescKey === 'faceoff').length;
  const carTK = tracked ? plays.filter(p => p.typeDescKey === 'takeaway' && p.details?.eventOwnerTeamId === carTeamId).length : null;
  const carGV = tracked ? plays.filter(p => p.typeDescKey === 'giveaway' && p.details?.eventOwnerTeamId === carTeamId).length : null;
  const carHits = tracked ? plays.filter(p => p.typeDescKey === 'hit' && p.details?.eventOwnerTeamId === carTeamId).length : null;

  const isHighDanger = (p) => {
    const x = Math.abs(p.details?.xCoord || 0);
    const y = p.details?.yCoord || 0;
    return Math.sqrt((x-89)**2 + y**2) < 15;
  };
  const shotTypes = new Set(['goal','shot-on-goal','missed-shot','blocked-shot']);
  const carHDCF = tracked ? plays.filter(p => shotTypes.has(p.typeDescKey) && p.details?.eventOwnerTeamId === carTeamId && isHighDanger(p)).length : null;
  const oppHDCF = tracked ? plays.filter(p => shotTypes.has(p.typeDescKey) && p.details?.eventOwnerTeamId !== carTeamId && isHighDanger(p)).length : null;

  // Final score: the game's own (a shootout winner gets its extra goal
  // there), else the last goal's.
  const lastGoal = allGoals[allGoals.length - 1];
  const finalAway = pbp?.awayTeam?.score ?? lastGoal?.awayScore ?? null;
  const finalHome = pbp?.homeTeam?.score ?? lastGoal?.homeScore ?? null;

  // Final, Final/OT or Final/SO: the game's last period type ('REG' | 'OT' |
  // 'SO'), from the PBP's own outcome or else its last play.
  const lastPlay = allPlays[allPlays.length - 1];
  const ended = finalSuffix(pbp?.gameOutcome?.lastPeriodType ?? lastPlay?.periodDescriptor?.periodType);

  return {
    period: 'game',
    periodLabel: `Final${ended}`,
    periodShort: `FINAL${ended}`,
    generatedAt: Date.now(),
    isGameSummary: true,
    // Shot stats
    ...shots,
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
    awayScore: finalAway,
    homeScore: finalHome,
    ...teamScore(pbp, carTeamId, finalAway, finalHome),
    // Three stars
    threeStars: landingData?.summary?.threeStars || [],
    // AI
    aiNarrative: null, aiLoading: true,
    gameId,
    carGoalieNames: goaliesInNet(plays, rosterMap, carTeamId),
  };
}

function loadStoredGame(gameId, teamId) {
  try {
    const raw = sessionStorage.getItem(storedKey(GAME_SUMMARY_KEY, teamId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.gameId === gameId ? parsed.summary : null;
  } catch { return null; }
}

function saveStoredGame(gameId, teamId, summary) {
  try {
    sessionStorage.setItem(storedKey(GAME_SUMMARY_KEY, teamId), JSON.stringify({ gameId, summary }));
  } catch {}
}

export function useGameSummary({ pbp, _isLive, gameId, carTeamId }) {
  const [gameSummary, setGameSummary] = useState(null);
  const builtRef = useRef(false);
  // The game on screen now, so a build that finishes after a switch to
  // another game is dropped rather than shown as this one's.
  const gameIdRef = useRef(gameId);
  gameIdRef.current = gameId;

  // Restore from sessionStorage on gameId change
  useEffect(() => {
    if (!gameId) { builtRef.current = false; setGameSummary(null); return; }
    const stored = loadStoredGame(gameId, carTeamId);
    if (stored) {
      setGameSummary(stored);
      builtRef.current = true;
    } else {
      setGameSummary(null);
      builtRef.current = false;
    }
  }, [gameId]);

  useEffect(() => {
    // isOtherGame: right after a switch, the pbp on hand is still the last
    // game's -- building from it filed that game's final under this one
    // (opening a final from a notification, or picking another game while
    // the first was loading).
    if (!pbp || !gameId || builtRef.current || isOtherGame(pbp, gameId)) return;
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
      // No Worker KV pre-fetch here, unlike a period's: a game summary
      // reads the stored one first, in the viewer's language
      // (PeriodSummary.jsx's generateNarrative), and the KV narrative,
      // English only, would win over it.

      if (gameIdRef.current !== gameId) return;
      setGameSummary(summary);
      saveStoredGame(gameId, carTeamId, summary);
    })();
  }, [gameId, pbp?.id, pbp?.plays?.length, carTeamId]);

  const updateNarrative = useCallback((narrative) => {
    setGameSummary(prev => {
      if (!prev) return prev;
      const next = { ...prev, aiNarrative: narrative, aiLoading: false };
      saveStoredGame(gameId, carTeamId, next);
      return next;
    });
  }, [gameId]);

  return { gameSummary, updateGameNarrative: updateNarrative };
}

