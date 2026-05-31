/**
 * ppUnits.js — Known CAR power play unit configurations by season.
 *
 * Player IDs match NHL API / Supabase players table.
 * Update each season when units change.
 *
 * PP1: Jarvis, Aho, Ehlers, Gostisbehere, Svechnikov
 * PP2: Hall, Stankoven, Ehlers, Blake, K'Andre Miller
 */
export const CAR_PP_UNITS = {
  20252026: {
    pp1: [
      8482093, // Seth Jarvis
      8478427, // Sebastian Aho
      8477940, // Nikolaj Ehlers
      8476906, // Shayne Gostisbehere
      8480830, // Andrei Svechnikov
    ],
    pp2: [
      8475791, // Taylor Hall
      8482702, // Logan Stankoven
      8477940, // Nikolaj Ehlers
      8482809, // Jackson Blake
      8480817, // K'Andre Miller
    ],
  },
};

/**
 * Given a season and a set of player IDs seen in a PP opportunity,
 * returns 1 (PP1), 2 (PP2), or null if no confident match.
 * Requires at least 2 overlapping players to assign a unit.
 */
export function inferPPUnit(season, playerIds) {
  const units = CAR_PP_UNITS[season];
  if (!units || !playerIds?.length) return null;

  const pp1Overlap = playerIds.filter(id => units.pp1.includes(id)).length;
  const pp2Overlap = playerIds.filter(id => units.pp2.includes(id)).length;

  if (pp1Overlap >= 2 && pp1Overlap >= pp2Overlap) return 1;
  if (pp2Overlap >= 2) return 2;
  return null;
}
