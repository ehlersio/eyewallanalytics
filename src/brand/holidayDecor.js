// src/brand/holidayDecor.js
//
// Holiday decorations layered on the faceoff intro (FaceoffRink.jsx draws
// them, src/brand/introThemes.js picks one per holiday). Like
// faceoffTimeline.js, everything here is a pure function of elapsed time, so
// a frame can be rendered or tested at any moment. Randomness is a fixed
// hash of the particle index, never Math.random, so every run looks the same.
//
// Coordinates are the mark's 100x100 grid. The SVG draws with overflow
// visible, so particles fill the whole screen around it: on a phone the
// screen spans roughly x -50..150 and y -170..270 in these units.

import { MARK } from './rinkMark.js';

export const PARTICLE_POOL = 72;

// Shapes, each drawn about 1 unit in radius around (0, 0). Shapes without
// their own fill take the particle's color.
export const DECOR_SHAPES = {
  snow: [['circle', { r: 1 }]],
  confetti: [['rect', { x: -1, y: -0.5, width: 2, height: 1, rx: 0.15 }]],
  spark: [['circle', { r: 1 }]],
  star: [['polygon', {
    points: Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? 0.42 : 1;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      return `${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`;
    }).join(' '),
  }]],
  // A summer sun: disc and eight rays, in the accent's fill/stroke color.
  sun: [
    ['circle', { r: 0.5 }],
    ['path', {
      d: Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const p = r => `${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`;
        return `M${p(0.68)} L${p(1)}`;
      }).join(' '),
      fill: 'none', strokeWidth: 0.14, strokeLinecap: 'round',
    }],
  ],
  // Six arms, each with a V near its tip; drawn in the accent's stroke color.
  snowflake: [['path', {
    d: [0, 60, 120, 180, 240, 300].map(deg => {
      const a = (deg * Math.PI) / 180;
      const at = (r, da = 0) => `${(Math.cos(a + da) * r).toFixed(3)},${(Math.sin(a + da) * r).toFixed(3)}`;
      return `M0,0 L${at(1)} M${at(0.6)} L${at(0.85, 0.35)} M${at(0.6)} L${at(0.85, -0.35)}`;
    }).join(' '),
    fill: 'none', strokeWidth: 0.16, strokeLinecap: 'round',
  }]],
  // Upright, its brim centered on (0, 0).
  santaHat: [
    ['path', { d: 'M-0.72,0.1 Q-0.1,-1.3 1.08,-0.82 L0.72,0.1Z', fill: '#D6203A' }],
    ['rect', { x: -0.86, y: -0.1, width: 1.72, height: 0.38, rx: 0.19, fill: '#FFFFFF' }],
    ['circle', { cx: 1.12, cy: -0.82, r: 0.25, fill: '#FFFFFF' }],
  ],
  heart: [['path', { d: 'M0,0.75 C-1.4,-0.2 -0.7,-1.25 0,-0.4 C0.7,-1.25 1.4,-0.2 0,0.75Z' }]],
  leaf: [
    ['path', { d: 'M0,-1.3 C1,-0.7 1,0.7 0,1.3 C-1,0.7 -1,-0.7 0,-1.3Z' }],
    ['path', { d: 'M0,-1 V1.5', stroke: 'rgba(0,0,0,0.25)', strokeWidth: 0.12, fill: 'none' }],
  ],
  shamrock: [
    ['circle', { cx: 0, cy: -0.62, r: 0.58 }],
    ['circle', { cx: -0.58, cy: 0.1, r: 0.58 }],
    ['circle', { cx: 0.58, cy: 0.1, r: 0.58 }],
    ['path', { d: 'M-0.08,0.2 L0.12,0.2 L0.45,1.25 L0.25,1.3Z' }],
  ],
  maple: [['polygon', {
    points: '0,-1 0.2,-0.6 0.4,-0.7 0.35,-0.2 0.7,-0.5 0.65,-0.35 0.9,-0.3 0.75,-0.05 0.85,0.05 '
      + '0.4,0.3 0.45,0.5 0.05,0.42 0.05,0.9 -0.05,0.9 -0.05,0.42 -0.45,0.5 -0.4,0.3 -0.85,0.05 '
      + '-0.75,-0.05 -0.9,-0.3 -0.65,-0.35 -0.7,-0.5 -0.35,-0.2 -0.4,-0.7 -0.2,-0.6',
  }]],
  pumpkin: [
    ['ellipse', { rx: 1.15, ry: 0.95, fill: '#E8772E' }],
    ['path', {
      d: 'M0,-0.9 V0.9 M-0.55,-0.85 Q-0.85,0 -0.55,0.85 M0.55,-0.85 Q0.85,0 0.55,0.85',
      stroke: '#B9531A', strokeWidth: 0.12, fill: 'none',
    }],
    ['rect', { x: -0.15, y: -1.3, width: 0.3, height: 0.45, rx: 0.08, fill: '#4E7A2B' }],
  ],
  // The faceoff dot as a turkey's body, tail feathers fanned out behind.
  turkey: [
    ...['#B5402A', '#D2691E', '#E0A030', '#C8862B', '#E0A030', '#D2691E', '#B5402A'].map((fill, i) => ['ellipse', {
      cx: 0, cy: -0.62, rx: 0.24, ry: 0.6, fill, transform: `translate(0 0.3) rotate(${-72 + i * 24})`,
      stroke: 'var(--brand-sheet)', strokeWidth: 0.05,
    }]),
    ['circle', { cx: 0, cy: 0.3, r: 0.48, fill: '#7A4A24', stroke: 'var(--brand-sheet)', strokeWidth: 0.05 }],
    ['circle', { cx: 0, cy: -0.12, r: 0.25, fill: '#B88457' }],
    ['circle', { cx: -0.09, cy: -0.17, r: 0.045, fill: '#1B1B1B' }],
    ['circle', { cx: 0.09, cy: -0.17, r: 0.045, fill: '#1B1B1B' }],
    ['polygon', { points: '-0.07,-0.07 0.07,-0.07 0,0.06', fill: '#F2A33A' }],
    ['ellipse', { cx: 0.06, cy: 0.1, rx: 0.045, ry: 0.1, fill: '#D6203A' }],
  ],
  jackOLantern: [
    ['circle', { r: 1, fill: '#E8772E', stroke: 'var(--brand-sheet)', strokeWidth: 0.06 }],
    ['path', {
      d: 'M0,-0.95 V0.95 M-0.55,-0.85 Q-0.85,0 -0.55,0.85 M0.55,-0.85 Q0.85,0 0.55,0.85',
      stroke: '#C9601F', strokeWidth: 0.07, fill: 'none',
    }],
    ['polygon', { points: '-0.6,-0.1 -0.35,-0.5 -0.1,-0.1', fill: '#2A1606' }],
    ['polygon', { points: '0.1,-0.1 0.35,-0.5 0.6,-0.1', fill: '#2A1606' }],
    ['path', {
      d: 'M-0.62,0.18 L-0.42,0.38 L-0.22,0.22 L0,0.42 L0.22,0.22 L0.42,0.38 L0.62,0.18 Q0,0.82 -0.62,0.18Z',
      fill: '#2A1606',
    }],
    ['rect', { x: -0.13, y: -1.22, width: 0.26, height: 0.34, rx: 0.06, fill: '#4E7A2B' }],
  ],
  // Four petals, outlined in the sheet color so they read apart from the
  // red dot underneath, around a dark center.
  poppy: [
    ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => ['circle', {
      cx: dx * 0.4, cy: dy * 0.4, r: 0.56, stroke: 'var(--brand-sheet)', strokeWidth: 0.07,
    }]),
    ['circle', { r: 0.3, fill: '#1B1B1B' }],
    ...[0, 1, 2, 3, 4, 5].map(i => ['circle', {
      cx: Math.cos(i * Math.PI / 3) * 0.17, cy: Math.sin(i * Math.PI / 3) * 0.17, r: 0.045, fill: '#5A5A5A',
    }]),
  ],
};

const RED = 'var(--brand-red)';
const INK = 'var(--brand-ink)';
const GOLD = '#F2C14E';
const BLUE = '#4C7BD9';
const PINK = '#F28AB2';
const GREENS = ['#2E9E5B', '#3DBB6C', '#23804A'];
const AUTUMN = ['#D2691E', '#E0A030', '#B5402A', '#C8862B'];
const SNOW = 'var(--holiday-snow)';

const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, k) => a + (b - a) * k;

// Fixed pseudo-random number in [0, 1) for particle i, channel k.
export function rand(i, k) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// The visible screen in the mark's 100x100 units, for a W x H container
// with the mark (markPx wide) centered in it -- where particles may go.
export function screenBounds(widthPx, heightPx, markPx) {
  const k = markPx / 100;
  const halfW = widthPx / 2 / k;
  const halfH = heightPx / 2 / k;
  return { x0: MARK.center - halfW, x1: MARK.center + halfW, y0: MARK.center - halfH, y1: MARK.center + halfH };
}

// A phone (375x812 pt, mark 190 pt): the default when no screen is given.
export const PHONE_BOUNDS = screenBounds(375, 812, 190);
const PHONE_AREA = (PHONE_BOUNDS.x1 - PHONE_BOUNDS.x0) * (PHONE_BOUNDS.y1 - PHONE_BOUNDS.y0);

// Fade in over the first 400 ms and out over the last 500 ms of the intro,
// so it starts and ends on the plain mark.
const edges = (ms, totalMs) => seg(ms, 0, 400) * (1 - seg(ms, totalMs - 500, totalMs));

// Things drifting down the whole screen (snow, leaves, shamrocks): already
// falling when the intro opens, wrapping around just off-screen. Bigger
// screens get more of them, so the density matches a phone.
function falling(ms, totalMs, b, { kind, count, colors, speed: [vMin, vMax], size: [sMin, sMax], sway, spin }) {
  const width = b.x1 - b.x0;
  const top = b.y0 - 10;
  const height = b.y1 - b.y0 + 20;
  const n = Math.min(PARTICLE_POOL, Math.round(count * (width * (height - 20)) / PHONE_AREA));
  const sec = ms / 1000;
  return Array.from({ length: n }, (_, i) => {
    const v = lerp(vMin, vMax, rand(i, 2));
    return {
      kind,
      x: b.x0 + rand(i, 0) * width + sway * Math.sin(sec * (1 + rand(i, 3)) + rand(i, 4) * TAU),
      y: top + ((rand(i, 1) * height + v * sec) % height),
      rot: rand(i, 5) * 360 + spin * sec * (rand(i, 6) > 0.5 ? 1 : -1),
      s: lerp(sMin, sMax, rand(i, 7)),
      fill: colors[i % colors.length],
      opacity: edges(ms, totalMs),
    };
  });
}

// A burst out of the faceoff dot (confetti, hearts) at `at` ms.
function burst(ms, { kind, count, at, colors, speed: [vMin, vMax], gravity, angles, size: [sMin, sMax], life, seed = 0, spin = 0 }) {
  return Array.from({ length: count }, (_, i) => {
    const j = i + seed;
    const age = (ms - at) / 1000;
    if (age < 0 || age > life) return null;
    const a = lerp(angles[0], angles[1], rand(j, 0));
    const v = lerp(vMin, vMax, rand(j, 1));
    return {
      kind,
      x: MARK.center + Math.cos(a) * v * age,
      y: MARK.center + Math.sin(a) * v * age + 0.5 * gravity * age * age,
      rot: rand(j, 2) * 360 + spin * age * (rand(j, 3) > 0.5 ? 1 : -1),
      s: lerp(sMin, sMax, rand(j, 4)),
      fill: colors[j % colors.length],
      opacity: 1 - seg(age, life * 0.55, life),
    };
  }).filter(Boolean);
}

// Fireworks over the whole intro, in the sky above the mark: `fx` is across
// the screen (0-1), `fy` from near the top (0) down to just above the mark
// (1). Each rocket rises for ROCKET_S, then bursts into a ring of sparks
// with an inner ring trailing behind.
const FIREWORKS = [
  { fx: 0.3, fy: 0.75, at: 500, color: RED },
  { fx: 0.75, fy: 0.5, at: 900, color: INK },
  { fx: 0.5, fy: 0.15, at: 1300, color: BLUE },
  { fx: 0.15, fy: 0.35, at: 1700, color: INK },
  { fx: 0.85, fy: 0.85, at: 2100, color: RED },
  { fx: 0.6, fy: 0.55, at: 2500, color: BLUE },
  { fx: 0.3, fy: 0.08, at: 2900, color: RED },
];
const ROCKET_S = 0.35;
const BURST_S = 1;
const SPARKS = 16;

function fireworks(ms, b) {
  const skyTop = b.y0 + (b.y1 - b.y0) * 0.1;
  const skyBottom = MARK.center - 50;
  return FIREWORKS.flatMap((fw, n) => {
    const age = (ms - fw.at) / 1000;
    if (age < -ROCKET_S || age > BURST_S) return [];
    const x = lerp(b.x0, b.x1, fw.fx);
    const y = lerp(skyTop, skyBottom, fw.fy);
    if (age < 0) {
      return [{
        kind: 'spark', x, y: lerp(y + 80, y, easeOut(1 + age / ROCKET_S)), rot: 0,
        s: 1.3, fill: fw.color, opacity: 0.9,
      }];
    }
    return Array.from({ length: SPARKS }, (_, i) => {
      const inner = i % 2 === 1;
      const a = (i / SPARKS) * TAU + n;
      const reach = (inner ? 22 : 36) * easeOut(clamp01(age / 0.7));
      return {
        kind: 'spark',
        x: x + Math.cos(a) * reach,
        y: y + Math.sin(a) * reach + 8 * age * age,
        rot: 0,
        s: lerp(inner ? 2 : 2.8, 1, age / BURST_S),
        fill: fw.color,
        opacity: 1 - seg(age, BURST_S * 0.5, BURST_S),
      };
    });
  });
}

// How far an overlay on the faceoff dot (maple leaf, poppy) has bloomed:
// with the dot as it grows back, 2650-3000 on the 3300-unit timeline.
const bloom = (ms, baseMs) => easeOut(seg(ms, baseMs * (2650 / 3300), baseMs * (3000 / 3300)));

// The finished mark's accent for each holiday -- what the top bar logo
// (HolidayMark.jsx) shows all day. `onDot` accents replace the faceoff dot;
// the rest sit on the mark beside it. Dot overlays match the intro's last
// frame, so the intro hands over to the same logo.
const dotAccent = (kind, s, extra = {}) => ({ kind, x: MARK.center, y: MARK.center, s, onDot: true, ...extra });
const MARK_ACCENTS = {
  'new-year': [dotAccent('star', 9, { fill: GOLD })],
  valentines: [dotAccent('heart', 11, { fill: RED })],
  'st-patricks': [dotAccent('shamrock', 10, { fill: GREENS[0] })],
  'memorial-day': [dotAccent('poppy', 9, { fill: RED })],
  'canada-day': [dotAccent('maple', 10, { fill: RED })],
  'independence-day': [dotAccent('star', 9, { fill: '#FFFFFF', stroke: RED, strokeWidth: 0.16 })],
  thanksgiving: [dotAccent('leaf', 9, { fill: AUTUMN[0], rot: 35 })],
  halloween: [dotAccent('jackOLantern', 9)],
  'veterans-day': [dotAccent('star', 9, { fill: '#FFFFFF', stroke: RED, strokeWidth: 0.16 })],
  'thanksgiving-us': [dotAccent('turkey', 13)],
  christmas: [{ kind: 'santaHat', x: 42, y: 30, s: 9, rot: -12 }],
};
MARK_ACCENTS['boxing-day'] = MARK_ACCENTS.christmas;
// Seasons (introHolidays.js SEASONS).
MARK_ACCENTS.fall = MARK_ACCENTS.thanksgiving;
MARK_ACCENTS.spooky = MARK_ACCENTS.halloween;
MARK_ACCENTS.winter = [dotAccent('snowflake', 9, { stroke: '#5FA8E8' })];
MARK_ACCENTS['christmas-season'] = MARK_ACCENTS.christmas;
MARK_ACCENTS['off-season'] = [dotAccent('sun', 8, { fill: GOLD, stroke: GOLD })];
export function markAccents(holiday) {
  return MARK_ACCENTS[holiday] ?? [];
}

// Each holiday's decoration. Functions take elapsed ms and { baseMs, totalMs,
// bounds }: `baseMs` is the faceoff's own length, `totalMs` the whole intro
// including the tail where the decoration finishes, `bounds` the screen
// (screenBounds()).
//   particles: full-screen effects, drawn by HolidayParticles.jsx
//   dot:       an overlay on the faceoff dot, `s` = its scale as it blooms
//   puck:      a shape drawn over the puck while it's in play
//   ref:       the ref's costume, 'santa' (hat) or 'ghost' (no stripes, eyes)
// dot, puck and ref belong to the mark, so FaceoffRink.jsx draws them.
const leaves = count => (ms, { totalMs, bounds }) => falling(ms, totalMs, bounds, {
  kind: 'leaf', count, colors: AUTUMN, speed: [40, 70], size: [2.8, 4], sway: 7, spin: 90,
});
const snow = count => (ms, { totalMs, bounds }) => falling(ms, totalMs, bounds, {
  kind: 'snow', count, colors: [SNOW], speed: [30, 55], size: [0.8, 1.7], sway: 4, spin: 0,
});

export const DECOR = {
  'new-year': {
    particles: (ms, { baseMs }) => [
      ...burst(ms, { kind: 'confetti', count: 18, at: baseMs * 0.78, colors: [GOLD, RED, INK, BLUE],
        speed: [110, 210], gravity: 150, angles: [-Math.PI * 0.97, -Math.PI * 0.03], size: [1.5, 2.3], life: 1.4, spin: 400 }),
      ...burst(ms, { kind: 'confetti', count: 18, at: baseMs * 0.9, colors: [GOLD, RED, INK, BLUE], seed: 50,
        speed: [110, 210], gravity: 150, angles: [-Math.PI * 0.97, -Math.PI * 0.03], size: [1.5, 2.3], life: 1.2, spin: 400 }),
    ],
  },
  valentines: {
    particles: (ms, { baseMs }) => burst(ms, { kind: 'heart', count: 16, at: baseMs * 0.8, colors: [RED, PINK],
      speed: [35, 85], gravity: -25, angles: [-Math.PI * 1.05, Math.PI * 0.05], size: [2.8, 4.4], life: 1.5, spin: 25 }),
  },
  'st-patricks': {
    particles: (ms, { totalMs, bounds }) => falling(ms, totalMs, bounds, { kind: 'shamrock', count: 24, colors: GREENS,
      speed: [35, 60], size: [2.8, 4.2], sway: 5, spin: 60 }),
  },
  'memorial-day': {
    dot: (ms, { baseMs }) => ({ kind: 'poppy', s: 9 * bloom(ms, baseMs) }),
  },
  'canada-day': {
    particles: (ms, { totalMs, bounds }) => falling(ms, totalMs, bounds, { kind: 'maple', count: 14, colors: [RED],
      speed: [35, 55], size: [3.6, 5], sway: 6, spin: 50 }),
    dot: (ms, { baseMs }) => ({ kind: 'maple', s: 10 * bloom(ms, baseMs) }),
  },
  'independence-day': {
    particles: (ms, { bounds }) => fireworks(ms, bounds),
  },
  thanksgiving: { particles: leaves(26) },
  'thanksgiving-us': {
    particles: leaves(20),
    dot: (ms, { baseMs }) => ({ kind: 'turkey', s: 13 * bloom(ms, baseMs) }),
  },
  halloween: {
    puck: 'pumpkin',
    ref: 'ghost',
    dot: (ms, { baseMs }) => ({ kind: 'jackOLantern', s: 9 * bloom(ms, baseMs) }),
  },
  christmas: { particles: snow(40), ref: 'santa' },
  // Seasons: quieter than the holidays -- fewer particles, no greeting.
  fall: { particles: leaves(12) },
  spooky: {
    puck: 'pumpkin',
    ref: 'ghost',
    dot: (ms, { baseMs }) => ({ kind: 'jackOLantern', s: 9 * bloom(ms, baseMs) }),
  },
  winter: { particles: snow(20) },
  'christmas-season': { particles: snow(28), ref: 'santa' },
  // The Zamboni itself is part of the off-season timeline (offseasonFrame).
  'off-season': {},
};
DECOR['boxing-day'] = DECOR.christmas;
