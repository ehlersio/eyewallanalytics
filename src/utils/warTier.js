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
// WAR_TIER_MIN_GP is 20 GP, twice the 10 GP the percentile pools use
// (eyewall-pipeline moneypuck.py MIN_GP): a per-82 pace over 10-19 games
// could still read "MVP candidate" on a hot streak (2025-26: Josh Doan at
// 11 GP, Owen Beck at 12, after the #456 re-tune), so tiers wait for 20.

export const WAR_TIER_MIN_GP = 20
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
// Re-set 2026-11-21 for WAR's measured weights (eyewall-pipeline #283:
// 6.21 goals per win, penalties by count, finishing shrunk by shot volume)
// on the stint RAPM (#281). Skaters with 60+ GP over 2023-24..2025-26
// (1,455 player-seasons): median +0.47, the top 12.7% at +1.0, the top 1.7%
// (6-10 a season) at +1.7, league high +3.0. Each cut-off keeps the share of
// regulars it was meant to hold. Replacement level is 0 by construction
// (about 5% fall below it).
//   >= 1.7   MVP candidate      about the top 1-2% of regulars
//   >= 1.0   Top player         about the top 12-13%
//   >= 0.36  Solid contributor  the typical regular, up to the top group
//   >= 0     Replacement level  0 up to about the lowest 35-40% of regulars
//   <  0     Below replacement
// (Before: 1.7 / 1.05 / 0.35 on #281's WAR; 1.2 / 0.7 / 0.2 on #191's.)
const TIERS = [
  { min: 1.7,  key: 'tierMvp',              color: '#4ade80' },
  { min: 1.0,  key: 'tierTop',              color: '#4ade80' },
  { min: 0.36, key: 'tierSolid',            color: '#fbbf24' },
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
