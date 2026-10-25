// The league-wide contract index for cap-hit annotations (utils/
// capAnnotations.js): one fetch of the Worker's /contracts/players,
// memoized in nhlApi.js, turned into a Map by playerId. `enabled` false
// skips the fetch (a card that is not showing anything yet).
import { useMemo } from 'react';
import { useFetch } from './useFetch';
import { getLeagueContractPlayers } from '../utils/nhlApi';
import { contractIndex } from '../utils/capAnnotations';

export function useContractIndex(enabled = true) {
  const { data } = useFetch(() => (enabled ? getLeagueContractPlayers() : Promise.resolve(null)), [enabled]);
  return useMemo(() => contractIndex(data), [data]);
}
