// ─── Contract value scoring + cap limits ─────────────────────
// The scoring helpers the player popup uses on top of a contract row from
// the Worker's /contracts routes (nhlApi.js: getTeamContracts,
// getPlayerContract), which serve the open nhl-contracts dataset
// (github.com/ehlersio/nhl-contracts, CC0) for every NHL team. Until
// 2026-10 these lived in carContracts.js next to a hand-typed list of
// Carolina's deals; that list is gone, the Worker is the only source now.
//
// Cap limits follow teamConfig.js's CURRENT_SEASON pattern: `let`s seeded
// with the league's announced 2026-27 figures and refreshed in place from
// GET /config/cap at module load, so a reader that asks after the fetch
// lands gets the live season's limits. Read them through `capLimits()`
// (or the named exports) at render time, never copy them into a constant.

import i18n from '../i18n';
import { getCapLimits } from './nhlApi';

export let CAP_SEASON  = '2026-27';
export let CAP_CEILING = 104_000_000;
export let CAP_FLOOR   =  77_000_000;
export let MIN_SALARY  =    850_000;

export function capLimits() {
  return { season: CAP_SEASON, ceiling: CAP_CEILING, floor: CAP_FLOOR, minSalary: MIN_SALARY };
}

// Apply a /config/cap payload ({ current, seasons: { 'YYYY-YY': { ceiling,
// floor, minSalary } } }). Only a complete entry for the current season
// replaces the seed; nothing is projected for seasons the league has not
// announced. Returns true when the limits changed.
export function applyCapConfig(config) {
  const season = config?.current;
  const limits = season ? config?.seasons?.[season] : null;
  if (!limits || !(limits.ceiling > 0) || !(limits.floor > 0) || !(limits.minSalary > 0)) return false;
  const changed = season !== CAP_SEASON || limits.ceiling !== CAP_CEILING
    || limits.floor !== CAP_FLOOR || limits.minSalary !== MIN_SALARY;
  CAP_SEASON  = season;
  CAP_CEILING = limits.ceiling;
  CAP_FLOOR   = limits.floor;
  MIN_SALARY  = limits.minSalary;
  return changed;
}

export async function refreshCapLimits() {
  try {
    const config = await getCapLimits();
    if (applyCapConfig(config) && typeof window !== 'undefined') {
      window.dispatchEvent(new window.CustomEvent('eyewall:nhl-cap-updated', { detail: capLimits() }));
    }
  } catch (e) {
    console.warn('Live NHL cap limits lookup failed, using fallback:', e.message);
  }
}

// Fire-and-forget at module load in the browser, like CURRENT_SEASON. Unit
// tests (no window) keep the seed.
if (typeof window !== 'undefined') refreshCapLimits();

// ─── Contract value score (skaters) ──────────────────────────
// Blended score: 60% points/$M + 40% WAR/$M (scaled to same range).
// If WAR is unavailable, falls back to points/$M only.
// ELC contracts are excluded — their tiny cap hit makes the metric
// nonsensical vs market-rate deals.
//
// WAR scaling: WAR/$M is multiplied by WAR_SCALE to bring it onto the
// same axis as points/$M. The scale was 6 when a top skater's season
// was taken to be 2-4 WAR; in the current model (eyewall-pipeline#191)
// the same players post about 0.7-1.2 (see TIERS in warTier.js: Top
// player 2 -> 0.7, MVP candidate 4 -> 1.2), roughly a third, so the
// scale is 18 and WAR keeps its intended weight in the blend. A
// player with 1.0 WAR on a $4M deal scores 4.5 on this axis, as a
// 3.0-WAR player did at the old scale.
//
// Blended scale (market-rate skaters):
//   >= 8.0  → Exceptional value
//   >= 5.0  → Great value
//   >= 3.0  → Good value
//   >= 1.8  → Fair value
//   >= 1.0  → Below average
//    < 1.0  → Overpaid
export const WAR_SCALE = 18;

export function contractValue(points, gamesPlayed, capHit, isELC, war = null) {
  if (!capHit || !gamesPlayed) return null;
  if (isELC || capHit < 1_200_000) return null;

  const capM     = capHit / 1_000_000;
  const p82      = (points / gamesPlayed) * 82;
  const pointsPerM = p82 / capM;

  if (war != null && !isNaN(war)) {
    const warPerM   = war / capM;
    const warScaled = warPerM * WAR_SCALE;
    const blended   = (pointsPerM * 0.6) + (warScaled * 0.4);
    return { score: Math.round(blended * 10) / 10, method: 'blended' };
  }

  return { score: Math.round(pointsPerM * 10) / 10, method: 'points' };
}

// ─── Points per 60 ───────────────────────────────────────────
export function pointsPer60(points, toiSeconds) {
  if (!toiSeconds || !points) return null;
  const hours = toiSeconds / 3600;
  return Math.round((points / hours) * 10) / 10;
}

// ─── Goalie contract value (GSAX/$M) ─────────────────────────
// Goals saved above expected per $1M of cap hit.
// GSAX already accounts for shot quality and volume, making it a
// more honest measure than raw SV% vs league average.
// A positive GSAX means the goalie saved more goals than an average
// goalie would have faced the same shots — negative means they allowed
// more. Dividing by cap hit tells you how much of that value you're
// getting per dollar spent.
//
// Scale:
//   >= 4.0  → Exceptional value  (elite goalie on reasonable deal)
//   >= 2.0  → Great value
//   >= 0.0  → Fair value
//   >= -2.0 → Below average
//    < -2.0 → Overpaid
export function goalieContractValue(gsax, gamesPlayed, capHit, isELC) {
  if (!capHit || !gamesPlayed || gsax == null) return null;
  if (isELC || capHit < 1_200_000) return null;
  const capM = capHit / 1_000_000;
  const score = gsax / capM;
  return Math.round(score * 10) / 10;
}

export function goalieValueLabel(score) {
  if (score == null) return null;
  if (score >=  4.0) return { label: i18n.t('playerPopup.contract.tierExceptional'), color: '#3dba7e' };
  if (score >=  2.0) return { label: i18n.t('playerPopup.contract.tierGreat'),       color: '#5ab4f0' };
  if (score >=  0.0) return { label: i18n.t('playerPopup.contract.tierFair'),        color: '#a0c878' };
  if (score >= -2.0) return { label: i18n.t('playerPopup.contract.tierBelowAvg'),    color: '#f0c030' };
  return               { label: i18n.t('playerPopup.contract.tierOverpaid'),         color: '#e04040' };
}

// ─── Value rating label ───────────────────────────────────────
export function valueLabel(score) {
  if (score == null) return null;
  if (score >= 8.0)  return { label: i18n.t('playerPopup.contract.tierExceptional'), color: '#3dba7e' };
  if (score >= 5.0)  return { label: i18n.t('playerPopup.contract.tierGreat'),       color: '#5ab4f0' };
  if (score >= 3.0)  return { label: i18n.t('playerPopup.contract.tierGood'),        color: '#a0c878' };
  if (score >= 1.8)  return { label: i18n.t('playerPopup.contract.tierFair'),        color: '#f0c030' };
  if (score >= 1.0)  return { label: i18n.t('playerPopup.contract.tierBelowAvg'),    color: '#f07830' };
  return               { label: i18n.t('playerPopup.contract.tierOverpaid'),         color: '#e04040' };
}
