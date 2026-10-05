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

// The same team with the id the game on screen gives it (teamIdInGame()),
// for the game view's own panels: a 2024-25 Utah game's play-by-play says
// 59, not today's 68. Keeps whatever else the provider above says --
// favorite or guest.
export function GameTeamIdProvider({ teamId, children }) {
  const outer = useGameTeam();
  const value = useMemo(
    () => teamId === outer.team.teamId ? outer : { ...outer, team: { ...outer.team, teamId } },
    [outer, teamId]
  );
  return <GameTeamContext.Provider value={value}>{children}</GameTeamContext.Provider>;
}
