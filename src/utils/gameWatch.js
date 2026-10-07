// utils/gameWatch.js
// Which game a live-game popup hook (useGameEvents, usePWHLGameEvents,
// useHockeyTechGameEvents) is watching, and whether it has seen that game
// live. The win popup only fires for a game watched live, so opening the
// app on a finished game doesn't celebrate it.
//
// The hooks used to keep this in two effects, `[isLive]` setting the flag
// and `[gameId]` clearing it, declared in that order. The game's data
// arrives in the same render as isLive turning true, or after it, so the
// clear always ran last and the flag stayed false for the whole game: the
// win popup never fired on a real game in any league (audit 2026-10-06
// §14). One effect calling watchGame() has no order to get wrong.
//
// A render with no data (gameId null: between polls, or the view dropping
// the live data as the game ends) is not a change of game: the flag and
// the hook's per-game state survive it.

export const NO_GAME = Object.freeze({ gameId: null, wasLive: false });

// Returns the next watch state. A new object only when something changed,
// so `next.gameId !== prev.gameId` tells the caller to reset its per-game
// state for next.gameId.
export function watchGame(prev, gameId, isLive) {
  if (gameId == null) return prev;
  const changed = gameId !== prev.gameId;
  const wasLive = (!changed && prev.wasLive) || !!isLive;
  if (!changed && wasLive === prev.wasLive) return prev;
  return { gameId, wasLive };
}

// A /pwhl, /ahl or /echl /live/:gameId payload for a finished game.
export function isHockeyTechFinal(liveData) {
  return liveData?.gameStatus === 'final';
}
