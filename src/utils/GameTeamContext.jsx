/**
 * GameTeamContext — which team the game view is watching FROM.
 *
 * The game view (ShotMapView) is written from one team's side: "our"
 * score on the left, "our" shots as the rink's own dots, "our" power
 * play. That team used to be read straight off TEAM_CONFIG, the user's
 * saved favorite, which made watching any other game impossible without
 * changing the favorite -- a full reload, a Supabase write, and a
 * different app afterwards.
 *
 * Outside a provider (every existing route) this answers the favorite,
 * so nothing changes for them. The /game/:gameId?as=BOS route wraps the
 * view in a provider for the guest team, and only code inside it sees
 * that team: nothing is written to localStorage or the user's
 * preferences, and the rest of the app keeps reading TEAM_CONFIG.
 *
 * Usage:
 *   <GameTeamProvider team={getTeamByAbbr('BOS')} gameId={2025020123}>
 *     <ShotMapView />
 *   </GameTeamProvider>
 */
import { createContext, useContext, useMemo } from 'react';
import { TEAM_CONFIG } from './teamConfig';

const FAVORITE = { team: TEAM_CONFIG, guestGameId: null, isGuest: false };

const GameTeamContext = createContext(FAVORITE);

export function GameTeamProvider({ team, gameId, children }) {
  const value = useMemo(
    () => ({ team, guestGameId: gameId, isGuest: true }),
    [team, gameId]
  );
  return <GameTeamContext.Provider value={value}>{children}</GameTeamContext.Provider>;
}

export function useGameTeam() {
  return useContext(GameTeamContext);
}
