// src/hooks/useLiveGoalReplay.js
// Keeps the live rink supplied with the most recent goal's tracking replay,
// as soon as the NHL has published it and not before.
//
// ShotMapView already polls the play-by-play every 10s during a live game,
// so this hook needs no poller of its own: it reacts to each new `plays`
// array, and asks the Worker for a replay at most once per RETRY_MS per
// goal (see liveGoalReplay.js for why that number, and when it gives up).
//
// The replay is fetched BEFORE the control is offered, not when it is
// tapped. Two reasons: the control must never be a dead option -- a replay
// that turns out not to exist should never have been offered -- and a
// prefetched replay (~38KB) starts instantly when tapped.

import { useEffect, useRef, useState } from 'react';
import { getGoalReplay } from '../utils/nhlApi';
import { latestReplayableGoal, markFetching, shouldFetch, trackFetch } from '../utils/liveGoalReplay';

export default function useLiveGoalReplay(gameId, plays, enabled = true) {
  // eventId -> { status, firstAskedAt, nextTryAt } — a ref, not state: it
  // tracks in-flight requests and retry deadlines, which must not themselves
  // trigger a render (that would re-enter this effect on every poll).
  const tracking = useRef(new Map());
  const [ready, setReady] = useState(null); // { goal, replay }

  useEffect(() => {
    if (!enabled || !gameId) return;
    const goal = latestReplayableGoal(plays);
    if (!goal) return;

    // Already have this one.
    if (ready?.goal?.eventId === goal.eventId) return;

    const entry = tracking.current.get(goal.eventId);
    if (!shouldFetch(entry)) return;

    let cancelled = false;
    tracking.current.set(goal.eventId, markFetching(entry));

    getGoalReplay(gameId, goal.eventId)
      .then((replay) => {
        if (cancelled) return;
        const prev = tracking.current.get(goal.eventId);
        tracking.current.set(goal.eventId, trackFetch(prev, replay ? 'ready' : 'missing'));
        if (replay) setReady({ goal, replay });
      })
      .catch(() => {
        if (cancelled) return;
        const prev = tracking.current.get(goal.eventId);
        tracking.current.set(goal.eventId, trackFetch(prev, 'missing'));
      });

    return () => { cancelled = true; };
  }, [gameId, plays, enabled, ready]);

  // A new game means none of the previous game's tracking applies.
  useEffect(() => {
    tracking.current = new Map();
    setReady(null);
  }, [gameId]);

  return ready;
}
