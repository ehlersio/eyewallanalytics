/**
 * ppUnits.js — Special teams unit inference helpers.
 *
 * Unit data is no longer stored here — it lives in the `special_teams_units`
 * Supabase table and is fetched at runtime via getSpecialTeamsUnits() in
 * supabaseClient.js (Worker KV → Supabase fallback).
 *
 * This file now only exports the inference functions that consume that data.
 * Pass the fetched `specialTeamsMap` from ShotMapView into inferPPUnit /
 * inferPKUnit instead of reading from the static constants.
 *
 * Legacy static exports are kept below for any imports that haven't been
 * updated yet — they return empty objects and will gracefully return null
 * from the inference functions.
 */

/**
 * Given a team, season, set of player IDs seen in a PP opportunity, and
 * the fetched special teams map, returns 1 (PP1), 2 (PP2), or null.
 * Requires at least 2 overlapping players to assign a unit.
 *
 * @param {string}   teamAbbr        - e.g. 'CAR'
 * @param {number}   season          - e.g. 20252026 (unused — map is pre-filtered)
 * @param {number[]} playerIds       - player IDs currently on ice
 * @param {object}   specialTeamsMap - fetched from getSpecialTeamsUnits()
 */
export function inferPPUnit(teamAbbr, season, playerIds, specialTeamsMap) {
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
 * Given a team, season, set of player IDs seen in a PK opportunity, and
 * the fetched special teams map, returns 1 (PK1), 2 (PK2), or null.
 * Requires at least 2 overlapping players to assign a unit.
 *
 * @param {string}   teamAbbr        - e.g. 'CAR'
 * @param {number}   season          - e.g. 20252026 (unused — map is pre-filtered)
 * @param {number[]} playerIds       - player IDs currently on ice
 * @param {object}   specialTeamsMap - fetched from getSpecialTeamsUnits()
 */
export function inferPKUnit(teamAbbr, season, playerIds, specialTeamsMap) {
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

// ── Legacy exports ────────────────────────────────────────────────────────────
// Kept for backward compatibility. These are empty — unit data now comes from
// getSpecialTeamsUnits() in supabaseClient.js.
// Remove once all imports have been updated to use the new signature.
export const CAR_PP_UNITS      = {};
export const CAR_PK_UNITS      = {};
export const PP_UNITS_BY_TEAM  = {};
export const PK_UNITS_BY_TEAM  = {};
