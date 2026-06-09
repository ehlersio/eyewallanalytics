/**
 * ppUnits.js — Special teams unit configurations by team and season.
 *
 * Player IDs match NHL API / Supabase players table.
 * Used in ShotMapView to infer which PP/PK unit is on the ice during live games.
 *
 * Teams without an entry will have inferPPUnit / inferPKUnit return null —
 * the UI handles this gracefully by omitting the unit indicator.
 *
 * To add a team: add a key matching their NHL API abbreviation with
 * a season map in the same format as CAR below.
 */

// ── Power play units ─────────────────────────────────────────
const PP_UNITS = {
  CAR: {
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
  },
  // Add other teams here as needed:
  // COL: { 20252026: { pp1: [...], pp2: [...] } },
};

// ── Penalty kill units ───────────────────────────────────────
const PK_UNITS = {
  CAR: {
    20252026: {
      pk1: [
        8473533, // Jordan Staal
        8476921, // Jordan Martinook
        8476958, // Jaccob Slavin
        8478970, // Jalen Chatfield
      ],
      pk2: [
        8478427, // Sebastian Aho
        8482093, // Seth Jarvis
        8480817, // K'Andre Miller
        8480336, // Sean Walker
      ],
    },
  },
  // COL: { 20252026: { pk1: [...], pk2: [...] } },
};

/**
 * Given a team, season, and set of player IDs seen in a PP opportunity,
 * returns 1 (PP1), 2 (PP2), or null if no confident match.
 * Requires at least 2 overlapping players to assign a unit.
 */
export function inferPPUnit(teamAbbr, season, playerIds) {
  const units = PP_UNITS[teamAbbr]?.[season];
  if (!units || !playerIds?.length) return null;

  const pp1Overlap = playerIds.filter(id => units.pp1.includes(id)).length;
  const pp2Overlap = playerIds.filter(id => units.pp2.includes(id)).length;

  if (pp1Overlap >= 2 && pp1Overlap >= pp2Overlap) return 1;
  if (pp2Overlap >= 2) return 2;
  return null;
}

/**
 * Given a team, season, and set of player IDs seen in a PK opportunity,
 * returns 1 (PK1), 2 (PK2), or null if no confident match.
 * Requires at least 2 overlapping players to assign a unit.
 */
export function inferPKUnit(teamAbbr, season, playerIds) {
  const units = PK_UNITS[teamAbbr]?.[season];
  if (!units || !playerIds?.length) return null;

  const pk1Overlap = playerIds.filter(id => units.pk1.includes(id)).length;
  const pk2Overlap = playerIds.filter(id => units.pk2.includes(id)).length;

  if (pk1Overlap >= 2 && pk1Overlap >= pk2Overlap) return 1;
  if (pk2Overlap >= 2) return 2;
  return null;
}

// Legacy named exports — kept for any existing imports
export const CAR_PP_UNITS = PP_UNITS.CAR;
export const CAR_PK_UNITS = PK_UNITS.CAR;

// Full map exports — used in ShotMapView for unitConfig chip display
export const PP_UNITS_BY_TEAM = PP_UNITS;
export const PK_UNITS_BY_TEAM = PK_UNITS;
