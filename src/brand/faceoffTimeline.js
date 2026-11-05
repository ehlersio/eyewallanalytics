// src/brand/faceoffTimeline.js
//
// Frame math for the faceoff animation drawn on the EyeWall mark
// (src/brand/rinkMark.js). Pure functions of elapsed time, with no DOM or
// React, so FaceoffRink.jsx can apply a frame to SVG attributes each
// requestAnimationFrame tick and the sequence can be unit-tested.
//
// Intro, about 2.5s: the E and dot clear off the finished mark (so it hands
// off cleanly from the static launch splash), the ref skates in and drops the
// puck, the two centers battle for it, the home player draws it back, both
// clear out, and the puck slides to center, grows into the faceoff dot, and
// the E builds back around it -- ending on exactly the static mark.
//
// Loader: just the stick battle, looping, for loading states.
//
// Veterans Day (US, Nov 11): the same open and close, but nobody battles for
// the puck. The ref skates in and salutes, then drops the puck, and the two
// centers answer with a stick tap before clearing out.

import { MARK } from './rinkMark.js';

export const INTRO_DURATION_MS = 2500;

// The choreography below is written on a 3300-unit timeline (the length of
// the design prototype) and compressed into INTRO_DURATION_MS.
const TIMELINE_UNITS = 3300;

const HOME_FACEOFF_X = 36;
const AWAY_FACEOFF_X = 64;
const OFFSTAGE = 16;
const PUCK_R = 3.2;
const STICK_LENGTH = 11;
const BLADE_LENGTH = 3;

const clamp01 = x => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeIn = x => x * x * x;
const lerp = (a, b, k) => a + (b - a) * k;

// Polyline points for a stick held by a player at (x, y), pointing at
// `angle` degrees (0 = toward +x), with the blade hooked 90° off the shaft.
// `lift` (0-1) raises the stick off the ice; seen from above that shows as
// the stick getting shorter.
const LIFT_SHORTENING = 0.18;
export function stickPoints(x, y, angle, lift = 0) {
  const r = (angle * Math.PI) / 180;
  const k = 1 - LIFT_SHORTENING * lift;
  const tipX = x + Math.cos(r) * STICK_LENGTH * k;
  const tipY = y + Math.sin(r) * STICK_LENGTH * k;
  const bladeX = tipX + Math.cos(r + Math.PI / 2) * BLADE_LENGTH * k;
  const bladeY = tipY + Math.sin(r + Math.PI / 2) * BLADE_LENGTH * k;
  return [[x, y], [tipX, tipY], [bladeX, bladeY]];
}

// Fraction (0-1) of each E bar that's drawn. Full size = the static mark.
function letterFrame(t) {
  const clearing = 1 - easeIn(seg(t, 0, 300));
  if (t < 2550) return { spine: clearing, top: clearing, bottom: clearing, middle: clearing };
  return {
    spine: easeOut(seg(t, 2550, 2850)),
    top: easeOut(seg(t, 2750, 3100)),
    bottom: easeOut(seg(t, 2750, 3100)),
    middle: easeOut(seg(t, 2850, 3150)),
  };
}

export function introFrame(ms) {
  const t = clamp01(ms / INTRO_DURATION_MS) * TIMELINE_UNITS;
  const c = MARK.center;

  const homeX = t < 2200
    ? lerp(-OFFSTAGE, HOME_FACEOFF_X, easeOut(seg(t, 0, 500)))
    : lerp(HOME_FACEOFF_X, -OFFSTAGE, easeIn(seg(t, 2200, 2650)));
  const awayX = t < 2200
    ? lerp(100 + OFFSTAGE, AWAY_FACEOFF_X, easeOut(seg(t, 100, 600)))
    : lerp(AWAY_FACEOFF_X, 100 + OFFSTAGE, easeIn(seg(t, 2200, 2650)));

  let homeAngle = 0;
  let awayAngle = 180;
  let puckX = c;
  let puckY = c;
  if (t >= 1400 && t < 1900) {
    // The battle: sticks chop at the puck, which rattles between them.
    const s = t - 1400;
    const fade = 1 - seg(t, 1400, 1900) * 0.6;
    homeAngle = 16 * Math.sin(s / 45) * fade;
    awayAngle = 180 - 16 * Math.sin(s / 45 + 1.3) * fade;
    puckX = c + 2 * Math.sin(s / 38) * fade;
  } else if (t >= 1900 && t < 2200) {
    // Home center wins the draw and pulls it back.
    const k = easeOut(seg(t, 1900, 2150));
    homeAngle = lerp(0, 35, k);
    awayAngle = lerp(180, 200, k);
    puckX = lerp(c, 46, k);
    puckY = lerp(c, 55, k);
  } else if (t >= 2200) {
    homeAngle = 35;
    awayAngle = 200;
    const k = easeOut(seg(t, 2300, 2650));
    puckX = lerp(46, c, k);
    puckY = lerp(55, c, k);
  }
  if (t >= 900 && t < 1120) puckY = lerp(40, c, easeIn(seg(t, 900, 1120)));

  let puckR;
  let puckIsDot;
  if (t < 300) {
    puckR = lerp(MARK.dot.r, 0, easeIn(seg(t, 0, 300)));
    puckIsDot = true;
  } else if (t < 900) {
    puckR = 0;
    puckIsDot = false;
  } else {
    puckR = lerp(PUCK_R, MARK.dot.r, easeOut(seg(t, 2650, 3000)));
    puckIsDot = t >= 2650;
  }

  const refY = t < 1200
    ? lerp(-12, 33, easeOut(seg(t, 300, 850)))
    : lerp(33, -12, easeIn(seg(t, 1200, 1550)));

  return {
    home: { x: homeX, y: c, stick: stickPoints(homeX, c, homeAngle) },
    away: { x: awayX, y: c, stick: stickPoints(awayX, c, awayAngle) },
    ref: { x: c, y: refY },
    puck: { x: puckX, y: puckY, r: puckR, isDot: puckIsDot },
    letter: letterFrame(t),
  };
}

export const LOADER_CYCLE_MS = 1400;

export function loaderFrame(ms) {
  const c = MARK.center;
  const s = ms / 1.1;
  const homeAngle = 16 * Math.sin(s / 45);
  const awayAngle = 180 - 16 * Math.sin(s / 45 + 1.3);
  return {
    home: { x: HOME_FACEOFF_X, y: c, stick: stickPoints(HOME_FACEOFF_X, c, homeAngle) },
    away: { x: AWAY_FACEOFF_X, y: c, stick: stickPoints(AWAY_FACEOFF_X, c, awayAngle) },
    ref: null,
    puck: { x: c + 2 * Math.sin(s / 38), y: c, r: PUCK_R, isDot: false },
    letter: null,
  };
}

// --- Veterans Day ---------------------------------------------------------

// Longer than the regular intro to fit the salute and the stick taps.
export const VETERANS_DURATION_MS = 3600;

// On the 3300-unit timeline: the ref's arm goes up and comes down, the puck
// drops, the ref leaves, then three stick taps.
const SALUTE = { up: [900, 1000], down: [1260, 1360] };
const DROP_AT = 1420;
const REF_LEAVES_AT = 1650;
const TAPS = { start: 1680, end: 2160, count: 3 };
const RIPPLE_UNITS = 240;
const RIPPLE_MAX_R = 4;

// Stick lift (0-1) and the latest ripple, if one is still showing. Blades
// land at the end of each tap; the ripple stays where the blade landed.
function tapState(t) {
  const period = (TAPS.end - TAPS.start) / TAPS.count;
  const lift = t >= TAPS.start && t < TAPS.end
    ? Math.sin(Math.PI * (((t - TAPS.start) % period) / period))
    : 0;
  const landed = Math.min(TAPS.count, Math.floor((t - TAPS.start) / period));
  const landedAt = TAPS.start + landed * period;
  const age = landed >= 1 ? t - landedAt : Infinity;
  const ripple = age < RIPPLE_UNITS
    ? { landedAt, r: lerp(0.6, RIPPLE_MAX_R, easeOut(age / RIPPLE_UNITS)), opacity: 1 - age / RIPPLE_UNITS }
    : null;
  return { lift, ripple };
}

// How far the ref's salute is raised, 0-1.
function saluteAmount(t) {
  if (t < SALUTE.down[0]) return easeOut(seg(t, ...SALUTE.up));
  return 1 - easeIn(seg(t, ...SALUTE.down));
}

const homeXAt = t => (t < 2200
  ? lerp(-OFFSTAGE, HOME_FACEOFF_X, easeOut(seg(t, 0, 500)))
  : lerp(HOME_FACEOFF_X, -OFFSTAGE, easeIn(seg(t, 2200, 2650))));
const awayXAt = t => (t < 2200
  ? lerp(100 + OFFSTAGE, AWAY_FACEOFF_X, easeOut(seg(t, 100, 600)))
  : lerp(AWAY_FACEOFF_X, 100 + OFFSTAGE, easeIn(seg(t, 2200, 2650))));

export function veteransFrame(ms) {
  const t = clamp01(ms / VETERANS_DURATION_MS) * TIMELINE_UNITS;
  const c = MARK.center;
  const homeX = homeXAt(t);
  const awayX = awayXAt(t);
  const tap = tapState(t);

  const refY = t < REF_LEAVES_AT
    ? lerp(-12, 33, easeOut(seg(t, 300, 850)))
    : lerp(33, -12, easeIn(seg(t, REF_LEAVES_AT, REF_LEAVES_AT + 350)));

  let puckR;
  let puckIsDot;
  let puckY = c;
  if (t < 300) {
    puckR = lerp(MARK.dot.r, 0, easeIn(seg(t, 0, 300)));
    puckIsDot = true;
  } else if (t < DROP_AT) {
    puckR = 0;
    puckIsDot = false;
  } else {
    puckR = lerp(PUCK_R, MARK.dot.r, easeOut(seg(t, 2650, 3000)));
    puckIsDot = t >= 2650;
    if (t < DROP_AT + 220) puckY = lerp(40, c, easeIn(seg(t, DROP_AT, DROP_AT + 220)));
  }

  const ripple = side => {
    if (!tap.ripple) return null;
    const x = side === 'home' ? homeXAt(tap.ripple.landedAt) : awayXAt(tap.ripple.landedAt);
    const [bx, by] = stickPoints(x, c, side === 'home' ? 0 : 180)[2];
    return { x: bx, y: by, r: tap.ripple.r, opacity: tap.ripple.opacity };
  };
  return {
    home: { x: homeX, y: c, stick: stickPoints(homeX, c, 0, tap.lift) },
    away: { x: awayX, y: c, stick: stickPoints(awayX, c, 180, tap.lift) },
    ref: { x: c, y: refY, salute: saluteAmount(t) },
    ripples: [ripple('home'), ripple('away')],
    puck: { x: c, y: puckY, r: puckR, isDot: puckIsDot },
    letter: letterFrame(t),
  };
}

// --- Memorial Day ---------------------------------------------------------
//
// A moment of silence at center ice: the ref and both centers skate in and
// stand still -- no puck drop, no battle -- then clear out, and the faceoff
// dot comes back (holidayDecor.js blooms a poppy over it) as the E builds.

export const MEMORIAL_DURATION_MS = 3600;

export function memorialFrame(ms) {
  const t = clamp01(ms / MEMORIAL_DURATION_MS) * TIMELINE_UNITS;
  const c = MARK.center;
  const homeX = homeXAt(t);
  const awayX = awayXAt(t);
  const refY = t < 1900
    ? lerp(-12, 33, easeOut(seg(t, 300, 850)))
    : lerp(33, -12, easeIn(seg(t, 1900, 2250)));

  let puckR = 0;
  if (t < 300) puckR = lerp(MARK.dot.r, 0, easeIn(seg(t, 0, 300)));
  else if (t >= 2650) puckR = lerp(0, MARK.dot.r, easeOut(seg(t, 2650, 3000)));

  return {
    home: { x: homeX, y: c, stick: stickPoints(homeX, c, 0) },
    away: { x: awayX, y: c, stick: stickPoints(awayX, c, 180) },
    ref: { x: c, y: refY, salute: 0 },
    ripples: [null, null],
    puck: { x: c, y: c, r: puckR, isDot: true },
    letter: letterFrame(t),
  };
}

// --- Off-season -----------------------------------------------------------
//
// No game to face off in: the E clears, the Zamboni (the same top-down
// sprite as LiveEventRink's intermission, /zamboni/east/frame-N.png) drives
// across center ice leaving a strip of fresh, glossy ice, and the E and dot
// build back behind it.

export const OFFSEASON_DURATION_MS = 2800;
export const ZAMBONI_FRAMES = 9;
const ZAMBONI_SIZE = 30;          // drawn size in mark units
const ZAMBONI_FRAME_UNITS = 70;   // timeline units per sprite frame

export function offseasonFrame(ms) {
  const t = clamp01(ms / OFFSEASON_DURATION_MS) * TIMELINE_UNITS;
  const c = MARK.center;
  const zamboniX = lerp(-ZAMBONI_SIZE, 100 + ZAMBONI_SIZE, seg(t, 300, 2400));
  const driving = t >= 300 && t < 2400;
  let puckR = 0;
  if (t < 300) puckR = lerp(MARK.dot.r, 0, easeIn(seg(t, 0, 300)));
  else if (t >= 2650) puckR = lerp(0, MARK.dot.r, easeOut(seg(t, 2650, 3000)));
  return {
    // Nobody on the ice.
    home: { x: -OFFSTAGE, y: c, stick: stickPoints(-OFFSTAGE, c, 0) },
    away: { x: 100 + OFFSTAGE, y: c, stick: stickPoints(100 + OFFSTAGE, c, 180) },
    ref: null,
    ripples: [null, null],
    puck: { x: c, y: c, r: puckR, isDot: true },
    letter: letterFrame(t),
    zamboni: {
      x: zamboniX,
      y: c,
      size: ZAMBONI_SIZE,
      frame: Math.floor(t / ZAMBONI_FRAME_UNITS) % ZAMBONI_FRAMES,
      opacity: driving ? 1 : 0,
      // The fresh ice behind it: from the left edge to its back bumper,
      // shining while it's laid down and fading once it's gone by.
      trail: {
        x0: -ZAMBONI_SIZE,
        x1: zamboniX - ZAMBONI_SIZE * 0.35,
        height: 22,
        opacity: 0.14 * (1 - seg(t, 2400, 3100)),
      },
    },
  };
}
