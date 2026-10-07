// hooks/useHockeyTechLiveGame.js
// The followed PWHL/AHL/ECHL team's live game, from the shared poller in
// utils/hockeyTechLiveStore.js (one poll per league and team however many
// components use it). `leagueKey` null subscribes to nothing.
import { useState, useEffect } from 'react';
import { createHockeyTechLiveStore, EMPTY_HT_LIVE_STATE } from '../utils/hockeyTechLiveStore';
import { onPushReceived } from '../utils/livePolling';
import { fetchAHLToday, fetchAHLLive } from '../utils/ahlApi';
import { fetchECHLToday, fetchECHLLive } from '../utils/echlApi';
import { fetchPWHLToday, fetchPWHLLive } from '../utils/pwhlApi';

export const hockeyTechLiveStore = createHockeyTechLiveStore({
  apis: {
    pwhl: { fetchToday: () => fetchPWHLToday(), fetchLive: fetchPWHLLive },
    ahl:  { fetchToday: () => fetchAHLToday(),  fetchLive: fetchAHLLive },
    echl: { fetchToday: () => fetchECHLToday(), fetchLive: fetchECHLLive },
  },
  onPushReceived,
});

export function useHockeyTechLiveGame(leagueKey, teamId) {
  const on = !!leagueKey && teamId != null;
  const [state, setState] = useState(() => on ? hockeyTechLiveStore.getSnapshot(leagueKey, teamId) : EMPTY_HT_LIVE_STATE);
  useEffect(() => {
    if (!on) {
      setState(EMPTY_HT_LIVE_STATE);
      return undefined;
    }
    setState(hockeyTechLiveStore.getSnapshot(leagueKey, teamId));
    return hockeyTechLiveStore.subscribe(leagueKey, teamId, setState);
  }, [on, leagueKey, teamId]);
  return state;
}
