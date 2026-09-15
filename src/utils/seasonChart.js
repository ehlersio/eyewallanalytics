// utils/seasonChart.js
// Shared helpers for the season-over-season charts: the player popups'
// Compare-tab trend chart (NHL, PWHL, AHL, ECHL) and TeamComparisonPopup's
// season overlay. These used to be copied into each of those components.

// One stat def's value from one box-score game row: a direct field read,
// using def.perGameKey when the box-score column is named differently
// (pim -> penalty_minutes). Fits PWHL/AHL/ECHL box scores; NHL's popup
// derives some per-game stats and keeps its own perGameRawValue.
export function perGameValue(def, game) {
  if (!game) return null;
  const raw = game[def.perGameKey || def.key];
  return raw == null ? null : Number(raw);
}

function hexToRgba(hex, alpha) {
  const clean = String(hex).replace('#', '');
  if (clean.length !== 6) return hex; // not a hex color -- pass through
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Newest selected season (index 0 of a newest-first list) gets the full
// team color; older seasons fade toward MIN_ALPHA so 3-4 overlaid lines
// still read instead of becoming a knot of full-opacity lines.
export function seasonRampColor(baseHex, index, total) {
  if (total <= 1) return baseHex;
  const MIN_ALPHA = 0.35;
  const alpha = 1 - (index / (total - 1)) * (1 - MIN_ALPHA);
  return hexToRgba(baseHex, Number(alpha.toFixed(2)));
}

// Secondary cue alongside the color ramp. Cycles past 3 seasons, so it's
// never the only thing distinguishing two lines.
export const CHART_DASH_PATTERNS = [undefined, '6 4', '2 3'];
