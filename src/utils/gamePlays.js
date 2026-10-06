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

// A period's short label: P1-P3, then OT. Past OT, a playoff game plays
// more full overtimes (period 5 is 2OT, 6 is 3OT...) while a preseason or
// regular-season game goes to a shootout (period 5 is SO). isPlayoff is
// the game's own type (gameType 3) -- it used to be "the team has playoff
// games this season", so a 2026 playoff double-OT winner opened in October
// was labelled SO, and the live goal popup called every period 5 SO.
export function nhlPeriodLabel(number, isPlayoff = false) {
  const n = Number(number);
  if (!n) return '';
  if (n <= 3) return `P${n}`;
  if (n === 4) return 'OT';
  return isPlayoff ? `${n - 3}OT` : 'SO';
}

// Whether the feed tracks shots: some games' feeds carry only goals and
// penalties (common in the preseason -- CAR-NSH 2026-09-24, 2026010044),
// with no shots, misses, blocks or faceoffs. Shot counts, Corsi and xG
// built from such a feed would count only the goals.
const TRACKED_TYPES = new Set(['shot-on-goal', 'missed-shot', 'blocked-shot', 'faceoff']);
export function hasShotTracking(plays) {
  return (plays || []).some(p => TRACKED_TYPES.has(p.typeDescKey));
}
