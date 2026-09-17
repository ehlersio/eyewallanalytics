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
export function stickPoints(x, y, angle) {
  const r = (angle * Math.PI) / 180;
  const tipX = x + Math.cos(r) * STICK_LENGTH;
  const tipY = y + Math.sin(r) * STICK_LENGTH;
  const bladeX = tipX + Math.cos(r + Math.PI / 2) * BLADE_LENGTH;
  const bladeY = tipY + Math.sin(r + Math.PI / 2) * BLADE_LENGTH;
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
