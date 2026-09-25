// utils/gamePlays.js
// Helpers for reading a game's play-by-play.

// A shootout is logged as its own period (periodType 'SO', number 5 in
// the regular season), every attempt a 'goal' or 'shot-on-goal' at 0:00.
// None of it is a real goal or shot -- the NHL credits the winning team
// one goal on the scoresheet and no player any -- so counting it gave
// "two quick goals in 0s", shootout scorers in the game's points list and
// shootout attempts in the shot totals. Anything that counts or measures
// the game uses withoutShootout(); the event log still lists them.
export function isShootoutPlay(play) {
  return play?.periodDescriptor?.periodType === 'SO';
}

export function withoutShootout(plays) {
  return (plays || []).filter(p => !isShootoutPlay(p));
}

// 81 -> '1:21', 45 -> '0:45' -- a game-clock-style gap between two events.
export function formatElapsed(totalSeconds) {
  const secs = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
