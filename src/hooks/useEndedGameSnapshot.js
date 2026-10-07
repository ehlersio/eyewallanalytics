// hooks/useEndedGameSnapshot.js
// The game that was just live, for the game-event popup hooks once it has
// ended. When a game ends the shot maps stop polling it (AHL/ECHL/PWHL
// passed the popup hook null once their /today said final; the NHL page
// moves on to another game), so the hook never saw the final state and
// the win popup could not fire (audit 2026-10-06 §14).
//
// While a game is live this keeps its latest data. Once it isn't live it
// returns that last live data at once (so the popup hook never sees the
// game drop out, which would reset it), and fetches the game until it
// reports final -- every `intervalMs`, at most `maxTries` times -- then
// stops. Each answer replaces the data returned.
//
//   const ended = useEndedGameSnapshot(isLive ? liveGame.id : null, isLive, liveData, fetchLive, isFinal)
//   useXGameEvents(isLive ? liveData : ended, isLive, ...)
//
// Returns null while a game is live, and before any game has been. A game
// going live (the same one again, or a new one) starts over.

import { useState, useEffect, useRef } from 'react';

export function useEndedGameSnapshot(liveGameId, isLive, liveData, fetchGame, isFinal, { intervalMs = 30_000, maxTries = 20 } = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const lastLiveIdRef = useRef(null);
  const fetchRef = useRef(fetchGame);
  const isFinalRef = useRef(isFinal);
  useEffect(() => { fetchRef.current = fetchGame; isFinalRef.current = isFinal; });

  useEffect(() => {
    if (!isLive || liveGameId == null) return;
    lastLiveIdRef.current = liveGameId;
    setSnapshot(liveData ?? null);
  }, [isLive, liveGameId, liveData]);

  useEffect(() => {
    const id = lastLiveIdRef.current;
    if (isLive || id == null) return;
    let cancelled = false;
    let timer = null;
    let tries = 0;
    const again = () => { if (++tries < maxTries) timer = setTimeout(tick, intervalMs); };
    function tick() {
      Promise.resolve()
        .then(() => fetchRef.current(id))
        .then(data => {
          if (cancelled) return;
          if (data) setSnapshot(data);
          if (!data || !isFinalRef.current(data)) again();
        }, () => { if (!cancelled) again(); });
    }
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isLive, intervalMs, maxTries]);

  return isLive ? null : snapshot;
}
