/**
 * ppUnits.js — Special teams unit inference helpers.
 *
 * Unit data is no longer stored here — it lives in the `special_teams_units`
 * Supabase table and is fetched at runtime via getSpecialTeamsUnits() in
 * supabaseClient.js (Worker KV → Supabase fallback).
 *
 * This file now only exports the inference functions that consume that data.
 * ShotMapView fetches the map with getSpecialTeamsUnits(season) and passes
 * it in.
 *
 * The static exports this file used to carry (CAR_PP_UNITS, PP_UNITS_BY_TEAM
 * and friends) are gone. They were emptied when the data moved to Supabase
 * but kept as a compatibility shim, and ShotMapView went on reading them for
 * the whole life of that shim — so the PP/PK unit chips and the per-
 * opportunity PP1/PP2 badges silently rendered nothing that entire time.
 * Deleting them rather than re-emptying them is what makes that
 * unrecoverable rather than merely unlikely.
 */

/**
 * Given a team, the set of player IDs seen in a PP opportunity, and the
 * fetched special teams map, returns 1 (PP1), 2 (PP2), or null. The map is
 * already scoped to one season by the Worker, so no season is passed here.
 * Requires at least 2 overlapping players to assign a unit.
 *
 * @param {string}   teamAbbr        - e.g. 'CAR'
 * @param {number[]} playerIds       - player IDs currently on ice
 * @param {object}   specialTeamsMap - fetched from getSpecialTeamsUnits()
 */
export function inferPPUnit(teamAbbr, playerIds, specialTeamsMap) {
  const units = specialTeamsMap?.[teamAbbr]?.PP;
  if (!units || !playerIds?.length) return null;

  const pp1 = units[1] || [];
  const pp2 = units[2] || [];

  const pp1Overlap = playerIds.filter(id => pp1.includes(id)).length;
  const pp2Overlap = playerIds.filter(id => pp2.includes(id)).length;

  if (pp1Overlap >= 2 && pp1Overlap >= pp2Overlap) return 1;
  if (pp2Overlap >= 2) return 2;
  return null;
}

/**
 * Given a team, the set of player IDs seen in a PK opportunity, and the
 * fetched special teams map, returns 1 (PK1), 2 (PK2), or null. The map is
 * already scoped to one season by the Worker, so no season is passed here.
 * Requires at least 2 overlapping players to assign a unit.
 *
 * @param {string}   teamAbbr        - e.g. 'CAR'
 * @param {number[]} playerIds       - player IDs currently on ice
 * @param {object}   specialTeamsMap - fetched from getSpecialTeamsUnits()
 */
export function inferPKUnit(teamAbbr, playerIds, specialTeamsMap) {
  const units = specialTeamsMap?.[teamAbbr]?.PK;
  if (!units || !playerIds?.length) return null;

  const pk1 = units[1] || [];
  const pk2 = units[2] || [];

  const pk1Overlap = playerIds.filter(id => pk1.includes(id)).length;
  const pk2Overlap = playerIds.filter(id => pk2.includes(id)).length;

  if (pk1Overlap >= 2 && pk1Overlap >= pk2Overlap) return 1;
  if (pk2Overlap >= 2) return 2;
  return null;
}

