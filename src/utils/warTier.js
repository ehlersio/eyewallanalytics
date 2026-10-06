// utils/warTier.js
// The player popup's regular-season WAR tier ("Solid contributor",
// "Replacement level", ...) and the WAR side of the contract value score.
//
// WAR grows with games played: eyewall-pipeline#191 (2026-10-05) scales the
// replacement term by min(1, GP / season games), so a skater with 3 GP has
// a WAR near 0 however well he has played. The tier thresholds below are
// full-season numbers, so a season-to-date WAR can't be read against them.
// Instead:
//   - under WAR_TIER_MIN_GP games there is no tier (too few games to rate);
//   - from there to a full 82 games the tier reads WAR per 82 games played;
//   - at 82+ games it reads the WAR itself.
// The WAR shown in the popup stays the real season-to-date value.
//
// WAR_TIER_MIN_GP is the same 10 GP the MoneyPuck percentile pools use
// (eyewall-pipeline moneypuck.py MIN_GP; the PercentileBar rows and
// EDGE_MIN_GP in EdgeTrackingSection.jsx follow it too).

export const WAR_TIER_MIN_GP = 10
export const WAR_PACE_GAMES = 82

// WAR per 82 games played, or null when there's no WAR or too few games.
// At 82+ games the WAR itself (no projection needed).
export function warPer82(war, gp) {
  if (war == null || !Number.isFinite(Number(war))) return null
  const games = Number(gp) || 0
  if (games < WAR_TIER_MIN_GP) return null
  if (games >= WAR_PACE_GAMES) return Number(war)
  return (Number(war) / games) * WAR_PACE_GAMES
}

// The tier a WAR rating maps to. `rating` is a full-season figure: WAR per
// 82 games (warPer82). Keys are i18n keys under playerPopup.analytics.skater.
//
// Set from the recalculated 2023-24, 2024-25 and 2025-26 regular seasons
// (eyewall-pipeline#191). Replacement level is 0 by construction, so a
// negative WAR is below replacement (about 15-20% of regulars). Skaters
// with 60+ GP, in all three seasons: the median is about +0.25, the top
// 10% start near +0.7, and 5-8 a season reach +1.2 (the league high was
// +1.5 to +1.8).
//   >= 1.2  MVP candidate      about the top 1-2% of regulars
//   >= 0.7  Top player         about the top 10-15%
//   >= 0.2  Solid contributor  the typical regular, up to the top group
//   >= 0    Replacement level  0 up to about the lowest 35-40% of regulars
//   <  0    Below replacement
const TIERS = [
  { min: 1.2,  key: 'tierMvp',              color: '#4ade80' },
  { min: 0.7,  key: 'tierTop',              color: '#4ade80' },
  { min: 0.2,  key: 'tierSolid',            color: '#fbbf24' },
  { min: 0,    key: 'tierReplacement',      color: '#f87171' },
  { min: -Infinity, key: 'tierBelowReplacement', color: '#f87171' },
]

// { key, color, pace } for a skater's WAR and games played, where `pace` is
// the WAR per 82 games when that differs from the WAR (fewer than 82 GP),
// else null. Returns null under WAR_TIER_MIN_GP games or without a WAR.
export function warTier(war, gp) {
  const rating = warPer82(war, gp)
  if (rating == null) return null
  const tier = TIERS.find(x => rating >= x.min)
  return {
    key: tier.key,
    color: tier.color,
    pace: Number(gp) < WAR_PACE_GAMES ? rating : null,
  }
}
