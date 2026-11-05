// src/brand/introThemes.js
//
// Every version of the faceoff intro: the regular one and one per holiday
// (src/brand/introHolidays.js says which plays when). A theme pairs a
// faceoff timeline from faceoffTimeline.js with its decoration from
// holidayDecor.js, color overrides and the line shown under the
// "EyeWall Analytics" wordmark.
//
// Playful holidays keep the regular faceoff and add a tail after it for the
// decoration to finish; Memorial Day and Veterans Day have choreography of
// their own and hold still on the finished mark instead.

import {
  INTRO_DURATION_MS, introFrame,
  VETERANS_DURATION_MS, veteransFrame,
  MEMORIAL_DURATION_MS, memorialFrame,
} from './faceoffTimeline.js';
import { DECOR, PHONE_BOUNDS } from './holidayDecor.js';

// Where the E starts rebuilding on the 3300-unit timeline; the wordmark
// comes in with it.
const LETTER_BUILD_FRACTION = 2550 / 3300;

export const DEFAULT_THEME = {
  name: 'default', frameAt: introFrame, durationMs: INTRO_DURATION_MS, holdMs: 250,
};

const camel = name => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());

function holiday(name, { base = introFrame, baseMs = INTRO_DURATION_MS, tailMs = 1000, holdMs = 300, vars } = {}) {
  const decor = DECOR[name] ?? {};
  const totalMs = baseMs + tailMs;
  const ctx = { baseMs, totalMs };
  return {
    name,
    // The mark's frame, plus what's drawn on the mark itself.
    frameAt: ms => ({
      ...base(ms),
      decor: { dot: decor.dot?.(ms, ctx) ?? null, puck: decor.puck ?? null, ref: decor.ref ?? null },
    }),
    // Full-screen effects for a screen of `bounds` (holidayDecor.screenBounds).
    particlesAt: decor.particles ? (ms, bounds = PHONE_BOUNDS) => decor.particles(ms, { ...ctx, bounds }) : null,
    durationMs: totalMs,
    holdMs,
    letterAtMs: Math.round(baseMs * LETTER_BUILD_FRACTION),
    vars,
    tagline: `app.introTagline.${camel(name)}`,
  };
}

const solemn = { tailMs: 0, holdMs: 1200 };

export const THEMES = {
  'new-year': holiday('new-year'),
  valentines: holiday('valentines'),
  'st-patricks': holiday('st-patricks', { vars: { '--brand-away': '#2E9E5B' } }),
  'memorial-day': holiday('memorial-day', { ...solemn, base: memorialFrame, baseMs: MEMORIAL_DURATION_MS }),
  'canada-day': holiday('canada-day'),
  // Longer tail so the last fireworks finish around the wordmark.
  'independence-day': holiday('independence-day', { tailMs: 1500 }),
  thanksgiving: holiday('thanksgiving'),
  'thanksgiving-us': holiday('thanksgiving-us'),
  halloween: holiday('halloween', { tailMs: 0, holdMs: 1000, vars: { '--brand-away': '#E8772E' } }),
  'veterans-day': holiday('veterans-day', { ...solemn, base: veteransFrame, baseMs: VETERANS_DURATION_MS }),
  christmas: holiday('christmas'),
  'boxing-day': holiday('boxing-day'),
};
