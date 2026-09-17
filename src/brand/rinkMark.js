// src/brand/rinkMark.js
//
// Single source of truth for the EyeWall "faceoff E" mark: a faceoff circle
// with hash marks, a block E, and the faceoff dot at dead center, drawn on a
// 100x100 grid. Two color schemes:
//
//   light — "Ice Rink":   ice-white sheet, red circle and dot, navy E
//   dark  — "Night Rink": navy sheet, red circle and dot, white E
//
// Consumed by scripts/brand/build-brand-assets.mjs (app icon, splash,
// favicons, header logo SVGs) and by FaceoffIntro/FaceoffLoader, so every
// rendering of the mark stays geometrically identical. Plain JS with no
// React or DOM imports -- it has to load under bare Node for the script.
//
// Replaced the hurricane-swirl mark in Sept 2026 after App Store review
// flagged it (Guideline 4.1(a)) as resembling a team logo.

export const RINK_PALETTES = {
  light: { sheet: '#F3F7FA', red: '#D6203A', ink: '#0B1426' },
  dark:  { sheet: '#0B1426', red: '#E0364C', ink: '#FFFFFF' },
};

export const MARK = {
  center: 50,
  ring:   { r: 31, stroke: 4.5 },
  // Hash marks: y positions, and the x spans on each side of the ring.
  hashes: { ys: [42, 58], left: [9, 19.5], right: [80.5, 91], stroke: 4.5 },
  // Block E. The middle bar deliberately runs into the dot so the letter
  // doesn't read as a C (an earlier draft left a gap there).
  E: {
    spine:  { x: 35, y: 30, w: 8,  h: 40 },
    top:    { x: 35, y: 30, w: 28, h: 8 },
    middle: { x: 35, y: 46, w: 15, h: 8 },
    bottom: { x: 35, y: 62, w: 28, h: 8 },
    radius: 1,
  },
  dot: { r: 6 },
};

function markBody({ red, ink }) {
  const { center: c, ring, hashes, E, dot } = MARK;
  const hashLines = hashes.ys.flatMap(y => [
    `<line x1="${hashes.left[0]}" y1="${y}" x2="${hashes.left[1]}" y2="${y}"/>`,
    `<line x1="${hashes.right[0]}" y1="${y}" x2="${hashes.right[1]}" y2="${y}"/>`,
  ]).join('');
  const bar = (b, rounded = true) =>
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"${rounded ? ` rx="${E.radius}"` : ''}/>`;
  return [
    `<g fill="none" stroke="${red}" stroke-width="${ring.stroke}">`,
    `<circle cx="${c}" cy="${c}" r="${ring.r}"/>${hashLines}</g>`,
    `<g fill="${ink}">${bar(E.spine)}${bar(E.top)}${bar(E.bottom)}${bar(E.middle, false)}</g>`,
    `<circle cx="${c}" cy="${c}" r="${dot.r}" fill="${red}"/>`,
  ].join('');
}

// SVG markup for the mark.
//   mode:  'light' | 'dark' — which palette
//   sheet: true draws the full-bleed background (app icon style);
//          false leaves it transparent (header logo style)
//   inset: fraction of the canvas to pad on every side, for splash screens
//          and maskable icons that need a safe zone around the mark
//   palette: overrides the palette entirely (used for the tinted iOS icon)
export function rinkMarkSvg({ mode = 'light', sheet = true, inset = 0, size, palette } = {}) {
  const p = palette || RINK_PALETTES[mode];
  const scale = 1 - inset * 2;
  const offset = inset * 100;
  const dims = size ? ` width="${size}" height="${size}"` : '';
  const bg = sheet ? `<rect width="100" height="100" fill="${p.sheet}"/>` : '';
  const body = inset
    ? `<g transform="translate(${offset} ${offset}) scale(${scale})">${markBody(p)}</g>`
    : markBody(p);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dims}>${bg}${body}</svg>\n`;
}
