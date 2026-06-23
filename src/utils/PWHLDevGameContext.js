/**
 * PWHLDevGameContext — injects mock live PWHL game data into PWHLShotMapView
 * for dev replay. Only used in development.
 *
 * Usage:
 *   <PWHLDevGameProvider value={devValue}>
 *     <PWHLShotMapView />
 *   </PWHLDevGameProvider>
 *
 * devValue shape:
 *   {
 *     liveGame: { gameId, homeTeamId, awayTeamId, homeTeamCode, awayTeamCode,
 *                 homeScore, awayScore, status: 'live'|'final' },
 *     liveData: { gameId, homeTeamId, awayTeamId, homeScore, awayScore,
 *                 gameStatus, events[], goalieStats[], faceoffStats{} }
 *   }
 */
import { createContext, useContext } from 'react';

export const PWHLDevGameContext = createContext(null);

export function usePWHLDevGame() {
  return useContext(PWHLDevGameContext);
}
