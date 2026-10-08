// hooks/useHockeyTechPeriodSummary.js
// AHL/ECHL period and final summaries for one game (contract C8), the port
// of usePWHLPeriodSummary.js parametrised by `league`
// (utils/hockeyTechLeagues.js). The builders are utils/hockeyTechSummary.js.
//
// `liveData` is the game's /{league}/live answer: the shared poller's while
// the game is live (hockeyTechLiveStore.js), the ended game's last snapshot
// once it's over (useEndedGameSnapshot.js), or a final's own /live.
//
// Period boundaries: the feed has no period-end marker, so a new period's
// first event closes the one before (as PWHL's does). A live game's last
// period, and every period of a game that's already over, is built once
// the data says final -- or straight away for a final opened as one.
//
// Kept in sessionStorage per league AND team, so a guest view
// (HockeyTechGuestGameView) never writes over the followed team's.

import { useState, useEffect, useRef, useCallback } from 'react';
import { buildHockeyTechSummary, buildHockeyTechGameSummary, summaryPeriods } from '../utils/hockeyTechSummary';
import { sameGame, withSummary } from '../utils/summaryList';

export const periodSummaryStorageKey = (leagueKey, teamId) => `eyewall_${leagueKey}_period_summaries:${teamId}`;
export const gameSummaryStorageKey = (leagueKey, teamId) => `eyewall_${leagueKey}_game_summary:${teamId}`;

function load(key, gameId) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || 'null');
    return parsed && parsed.gameId === String(gameId) ? parsed : null;
  } catch { return null; }
}

function save(key, gameId, value) {
  try { sessionStorage.setItem(key, JSON.stringify({ gameId: String(gameId), ...value })); } catch { /* private mode etc. */ }
}

const isFinalData = data => data?.gameStatus === 'final';

// /{league}/summary for a game. A final's answer never changes, so it's
// kept for the session; a live game's is read again for each period (its
// goals and stars keep coming).
const finalSummaries = new Map();
async function fetchHTSummary(league, gameId, isFinal) {
  const key = `${league.key}:${gameId}`;
  if (finalSummaries.has(key)) return finalSummaries.get(key);
  const data = await league.api.fetchGameSummary(gameId).catch(() => null);
  if (data?.periods && isFinal) finalSummaries.set(key, data);
  return data?.periods ? data : null;
}

export function useHockeyTechPeriodSummary({ league, liveData, isLive, gameId, teamId }) {
  const [summaries, setSummaries] = useState([]);
  const [newSummary, setNewSummary] = useState(null);
  const storageKey = periodSummaryStorageKey(league.key, teamId);

  const builtRef      = useRef(new Set());
  const lastPeriodRef = useRef(0);
  const gameIdRef     = useRef(gameId);
  gameIdRef.current   = gameId;
  const dataRef       = useRef(liveData);
  dataRef.current     = liveData;

  // Restored for this game and team, or a clean slate.
  useEffect(() => {
    const stored = gameId && teamId != null ? load(storageKey, gameId) : null;
    setSummaries(stored?.summaries || []);
    builtRef.current = new Set((stored?.summaries || []).map(s => s.period));
    setNewSummary(null);
    lastPeriodRef.current = 0;
  }, [gameId, teamId, storageKey]);

  const buildAndStore = useCallback(async (period, showAsNew) => {
    if (builtRef.current.has(period)) return;
    builtRef.current.add(period);
    const data = dataRef.current;
    const htSummary = await fetchHTSummary(league, gameId, isFinalData(data));
    if (!sameGame(gameIdRef.current, gameId)) return;
    const summary = buildHockeyTechSummary(period, {
      events: dataRef.current?.events || [], teamId, htSummary, gameId,
      homeTeamId: dataRef.current?.homeTeamId ?? null, headshotSize: league.headshotSize,
    });
    setSummaries(prev => {
      const next = withSummary(prev, summary, gameIdRef.current);
      if (next !== prev) save(storageKey, gameId, { summaries: next });
      return next;
    });
    if (showAsNew) setNewSummary(summary);
  }, [league, gameId, teamId, storageKey]);

  const sameGameData = liveData && sameGame(liveData.gameId, gameId);
  const eventCount = sameGameData ? liveData.events?.length ?? 0 : 0;
  const final = sameGameData && isFinalData(liveData);

  useEffect(() => {
    if (!gameId || teamId == null || !sameGameData || !eventCount) return;
    const periods = summaryPeriods(liveData.events);
    if (!periods.length) return;
    if (final) {
      // Over: every period, the last one included. Popped up as new only
      // when it was watched live.
      periods.forEach(p => buildAndStore(p, false));
      return;
    }
    if (!isLive) return;
    // Live: the periods before the one being played are over.
    const current = periods.at(-1);
    if (lastPeriodRef.current > 0 && current > lastPeriodRef.current) {
      periods.filter(p => p < current).forEach(p => buildAndStore(p, p === lastPeriodRef.current));
    } else {
      // Opened mid-game: the periods already over, quietly.
      periods.filter(p => p < current).forEach(p => buildAndStore(p, false));
    }
    lastPeriodRef.current = current;
  }, [gameId, teamId, isLive, sameGameData, eventCount, final, buildAndStore]);

  const dismissNewSummary = useCallback(() => setNewSummary(null), []);

  const updateSummaryNarrative = useCallback((period, narrative) => {
    if (!sameGame(gameIdRef.current, gameId)) return;
    setSummaries(prev => {
      const next = prev.map(s => (s.period === period ? { ...s, aiNarrative: narrative, aiLoading: false } : s));
      save(storageKey, gameId, { summaries: next });
      return next;
    });
    setNewSummary(prev => (prev?.period === period ? { ...prev, aiNarrative: narrative, aiLoading: false } : prev));
  }, [gameId, storageKey]);

  return { summaries, newSummary, dismissNewSummary, updateSummaryNarrative };
}

export function useHockeyTechGameSummary({ league, liveData, gameId, teamId }) {
  const [gameSummary, setGameSummary] = useState(null);
  const builtRef = useRef(false);
  const storageKey = gameSummaryStorageKey(league.key, teamId);

  useEffect(() => {
    const stored = gameId && teamId != null ? load(storageKey, gameId) : null;
    setGameSummary(stored?.summary || null);
    builtRef.current = !!stored?.summary;
  }, [gameId, teamId, storageKey]);

  const ready = !!gameId && teamId != null && !!liveData && sameGame(liveData.gameId, gameId)
    && isFinalData(liveData) && (liveData.events || []).some(e => e.eventType === 'shot' || e.eventType === 'goal');

  useEffect(() => {
    if (!ready || builtRef.current) return;
    builtRef.current = true;
    let cancelled = false;
    (async () => {
      const htSummary = await fetchHTSummary(league, gameId, true);
      if (cancelled || !sameGame(liveData.gameId, gameId)) return;
      const summary = buildHockeyTechGameSummary({
        events: liveData.events, teamId, htSummary, gameId, homeTeamId: liveData.homeTeamId ?? null,
        homeScore: liveData.homeScore, awayScore: liveData.awayScore, headshotSize: league.headshotSize,
      });
      setGameSummary(summary);
      save(storageKey, gameId, { summary });
    })();
    return () => { cancelled = true; builtRef.current = false; };
  }, [ready, gameId, teamId]);

  const updateGameNarrative = useCallback(narrative => {
    setGameSummary(prev => {
      if (!prev) return prev;
      const next = { ...prev, aiNarrative: narrative, aiLoading: false };
      save(storageKey, gameId, { summary: next });
      return next;
    });
  }, [gameId, storageKey]);

  return { gameSummary, updateGameNarrative };
}
