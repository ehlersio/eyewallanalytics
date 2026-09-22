// utils/liveGameHold.js
// Keeps a game "live" through a poll or two that stops saying so, until
// the schedule actually reports it finished. getLiveGame() (nhlApi.js)
// reads the cached season schedule, and one read of it can come back
// empty (a failed fetch is `[]`, not an error) or a step behind -- each of
// which used to flip the shot map out of live mode for a poll: the live
// rink and Recent Events vanished, the page fell back to the last
// completed game, and came back on the next poll. Seen in the first
// minutes of the 2026 preseason.
//
// Returns hold(live, games): `live` is this poll's live game (or null),
// `games` the schedule it came from. It answers the game to treat as live.
export function createLiveGameHold(isCompleted, missTolerance = 3) {
  let held = null; // { game, misses }
  return function hold(live, games) {
    if (live) {
      held = { game: live, misses: 0 };
      return live;
    }
    if (!held) return null;
    const now = (games || []).find(g => g.id === held.game.id);
    if ((now && isCompleted(now)) || ++held.misses >= missTolerance) {
      held = null;
      return null;
    }
    return held.game;
  };
}
