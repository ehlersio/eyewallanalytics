// hooks/useLiveGame.js
// The team's live game and its play-by-play, from the shared poller in
// utils/liveGameStore.js: every component that uses this for the same team
// shares one poll. `enabled` false (e.g. the Topbar on a non-NHL route)
// subscribes to nothing and returns the empty state.
import { useState, useEffect, useCallback, useRef } from 'react';
import { liveGameStore, EMPTY_LIVE_STATE } from '../utils/liveGameStore';

export function useLiveGame(team, enabled = true) {
  const on = enabled && !!team;
  const [state, setState] = useState(() => on ? liveGameStore.getSnapshot(team) : EMPTY_LIVE_STATE);
  const teamRef = useRef(team);
  useEffect(() => { teamRef.current = team; }, [team]);

  useEffect(() => {
    if (!on) {
      setState(EMPTY_LIVE_STATE);
      return undefined;
    }
    setState(liveGameStore.getSnapshot(teamRef.current));
    return liveGameStore.subscribe(teamRef.current, setState);
  }, [on, team?.abbr]);

  const refresh = useCallback(
    (opts) => liveGameStore.refresh(teamRef.current, opts),
    []
  );

  return { game: state.game, pbp: state.pbp, checked: state.checked, refresh };
}
