/**
 * DevGameContext — injects mock live game data into ShotMapView for dev replay.
 * Only used in development. ShotMapView checks this context before making API calls.
 *
 * Usage:
 *   <DevGameProvider gameId={id} playheadSecs={t}>
 *     <ShotMapView />
 *   </DevGameProvider>
 */
import { createContext, useContext } from 'react';

export const DevGameContext = createContext(null);

export function useDevGame() {
  return useContext(DevGameContext);
}
