// utils/situationCode.js
// A play's situationCode is four digits: [awayGoalie][awaySkaters]
// [homeSkaters][homeGoalie], e.g. '1551' is 5-on-5 with both goalies in,
// '1541' a home power play, '0651' the away team's goalie pulled.
//
// The NHL's feed sometimes carries one that can't be true -- CAR-NSH's
// 2026-09-24 preseason game had a goal coded '1020' (no away skaters, two
// home skaters, no home goalie). Read literally, the score bar showed an
// empty net for CAR, and at another point for both teams at once. A code
// is only believed when each side has 3-6 skaters (5-on-3 is the fewest,
// 6 with a goalie pulled the most) and each goalie digit is 0 or 1;
// callers skip anything else and use the last real one.
export function isValidSituationCode(sc) {
  if (typeof sc !== 'string' || !/^[01]\d\d[01]$/.test(sc)) return false;
  const awaySkaters = Number(sc[1]);
  const homeSkaters = Number(sc[2]);
  return awaySkaters >= 3 && awaySkaters <= 6 && homeSkaters >= 3 && homeSkaters <= 6;
}
