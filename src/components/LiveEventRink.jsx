// components/LiveEventRink.jsx
//
// Live, in-game "watch the action as data" rink for NHL live games — plots
// recent play-by-play events (shots, hits, faceoffs, giveaways, takeaways)
// as fading dots on a compact rink, paired with the relocated EventLog
// ticker in ShotMapView.jsx. Session 100.
//
// Data: consumes the same `pbp.plays` ShotMapView.jsx already polls every
// 10s during a live game (LIVE_POLL_MS) — no new fetch, no new poller
// route. Confirmed live (2026-08) against a real NHL play-by-play response:
// every event type in DOT_TYPES below carries real details.xCoord/yCoord,
// details.eventOwnerTeamId, and a per-play homeTeamDefendingSide field;
// period-start/end/stoppage/delayed-penalty/game-end do not (and are never
// plotted). Penalties are excluded from the dot layer on purpose — no
// single natural "spot" the way a shot/hit/faceoff has one, better suited
// to text-only detail in the paired EventLog ticker instead.
//
// Rink markings: reuses IceRink.jsx's own `RinkMarkings` component (and
// its W/H/CX/CY constants) directly rather than an independent copy — the
// user asked this rink look pixel-identical to the season shot map's, and
// a shared component is the only way to actually guarantee that (a
// hand-copied approximation would drift the next time IceRink.jsx's
// geometry changes). The coordinate transform (toSvg) stays a tiny local
// function since it's not exported, but it's driven by the same imported
// W/H/CX/CY so the math is identical either way.
//
// Orientation: normalized via each play's own homeTeamDefendingSide field
// so the home team's own net is always drawn on the left, away on the
// right — stable for the whole game regardless of period parity, and
// simpler than the season shot map's "my team always attacks right"
// convention (IceRink.jsx's normalizeCoords), which isn't needed here
// since dots never persist across a period boundary anyway (see below).
//
// Decay: each dot's age is tracked from when THIS CLIENT first observed
// it (Date.now(), not NHL game-clock time — the game clock pauses during
// stoppages/intermission, wall-clock elapsed time is what should drive
// "does this look stale"). Held at full opacity briefly, then eased out
// over several minutes and dropped — no hard count/window cutoff, so a
// quiet stretch reads as calm and a flurry reads as an overlapping
// cluster rather than evicting arbitrarily. Goals are exempt (pinned)
// since they're durable context, not ambient churn. NOTE: this timing is
// deliberately real-wall-clock-based, so it reads as "slow to fade" when
// watched through the accelerated dev replay tool (a 5min/s replay speed
// makes 45s of real hold-time cover 3+ hours of game time) — that's a
// replay-tool artifact, not the real-game behavior; not re-tuned off a
// replay-speed observation, see Session 100 conversation.
//
// Encoding: dot FILL is team color (mine vs. opponent) so the primary,
// large-area signal is "who controls play"; dot STROKE is an event-type
// ring color matching ShotMapView.jsx's EventLog ticker badge colors
// (LOG_BADGE_VARIANTS) exactly, so "what happened" is readable as a
// secondary signal without fighting the team-color grouping for
// attention. Every dot gets a ring now, not just goals.
//
// Intermission: the tracked-event map is cleared and the rink switches to
// a continuous Zamboni resurfacing animation (pure CSS transform, GPU-
// composited, cheap to leave running for a full ~15-18min break) with the
// same ordinal + live countdown treatment the score bar already shows
// (ShotMapView.jsx:1799-1813) overlaid, rather than inventing a third
// distinct "intermission" message.

import { useEffect, useMemo, useRef, useState } from 'react';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { RinkMarkings, W, H, CX, CY } from './IceRink';

function toSvg(x, y) {
  return { px: CX + (x / 100) * (W / 2), py: CY - (y / 42.5) * (H / 2) };
}

// Every event type here is confirmed (live, 2026-08) to carry real
// details.xCoord/yCoord in NHL's live play-by-play feed.
const DOT_TYPES = new Set([
  'goal', 'shot-on-goal', 'missed-shot', 'blocked-shot',
  'hit', 'giveaway', 'takeaway', 'faceoff',
]);

// r/opacity scaled up from the old compact-viewBox version to match
// IceRink.jsx's real 600x255 coordinate space (IceRink's own SHOT_STYLE
// uses r:4-7 at this same scale).
const DOT_STYLE = {
  'goal':         { r: 8,   opacity: 1    },
  'shot-on-goal': { r: 5.5, opacity: 0.85 },
  'missed-shot':  { r: 4.5, opacity: 0.5  },
  'blocked-shot': { r: 4.5, opacity: 0.5  },
  'hit':          { r: 5,   opacity: 0.7  },
  'giveaway':     { r: 4,   opacity: 0.55 },
  'takeaway':     { r: 4,   opacity: 0.55 },
  'faceoff':      { r: 3.5, opacity: 0.4  },
};

// Ring color per type -- deliberately matches ShotMapView.jsx's
// LOG_BADGE_VARIANTS (EventLog ticker badges) value-for-value, so a dot on
// the rink and its line in the ticker read as the same event at a glance.
// missed-shot has no ticker badge of its own (EventLog doesn't list it);
// grouped visually with shot-on-goal's green rather than inventing a new
// color for a type nothing else on screen shows.
const TYPE_RING_COLOR = {
  'goal':         'var(--red-bright)',
  'shot-on-goal': 'var(--green)',
  'missed-shot':  'var(--green)',
  'blocked-shot': 'var(--purple)',
  'hit':          'var(--blue-bright)',
  'faceoff':      'var(--text-muted)',
  'giveaway':     'var(--text-dim)',
  'takeaway':     'var(--text-dim)',
};

const HOLD_MS = 45_000;        // full opacity for this long after first observed
const FADE_MS = 6 * 60_000;    // then eased fade to 0 over this long
const TICK_MS = 2_500;         // repaint interval for the decay (opacity doesn't need per-second precision)

function eventPlayerId(type, d) {
  if (type === 'goal') return d.scoringPlayerId;
  if (type === 'shot-on-goal' || type === 'missed-shot') return d.shootingPlayerId;
  if (type === 'blocked-shot') return d.blockingPlayerId;
  if (type === 'hit') return d.hittingPlayerId;
  if (type === 'giveaway' || type === 'takeaway') return d.playerId;
  if (type === 'faceoff') return d.winningPlayerId;
  return null;
}

function periodOrdinal(n) {
  if (!n) return '—';
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `OT${n - 3}`; // OT intermissions: period 4 -> OT1, period 5 -> OT2, ...
}

const CARD_LABEL_CLASSES = 'sec-label flex items-center justify-between';
// Mirrors IceRink.jsx's own rink-svg-container exactly (IceRink.jsx:440) --
// no independent background/corner-radius of its own. The previous version
// gave this wrapper its own bg + a small rounded-[8px] corner sitting behind
// the SVG's much-more-rounded ice shape (rx=84), leaving a visible ring of
// flat background outside the ice's curve at each corner. The SVG's own
// rect IS the entire visible surface; the wrapper just needs to clip it.
const RINK_WRAP_CLASSES = 'relative w-full overflow-hidden rounded-[var(--radius-sm)] leading-none select-none';
const INTERMISSION_LABEL_CLASSES = 'text-[13px] font-bold text-[#0f1b2e] [text-shadow:0_1px_2px_rgba(255,255,255,0.5)]';
const INTERMISSION_CLOCK_CLASSES = 'font-[family-name:var(--font-mono)] text-[20px] font-extrabold text-[#0f1b2e] [text-shadow:0_1px_2px_rgba(255,255,255,0.5)]';

// ── Zamboni (Session 100, raster sprite added Session 101) -- a PixelLab
// (top-down, 8-direction object + "drive" animation, 9 frames each) sprite
// replaced the earlier hand-built SVG icon once an image-generation tool
// became available. A logo decal was tried on the body panel and
// explicitly rejected on review (Session 101) -- these frames are plain.
//
// First raster pass mirrored a single "west" sprite via scaleX for the
// return trip, same trick the old hand-drawn SVG used -- but with real
// per-direction art already generated, that read as fake (always
// left/right, never actually facing the diagonal it was driving). Fixed
// by using the true directional sprite for each leg of the path instead.
//
// ZAMBONI_PATH below is the single source of truth for BOTH position and
// facing, replacing the old CSS @keyframes (still explained in
// index.css's now-superseded comment). Each waypoint's `dir` is the
// facing for the segment FROM that waypoint TO the next one, derived from
// that segment's real direction of travel -- e.g. the lane-1 sweep moves
// pure +x so it's "east"; the bulge past the edge moves +x+y (down-right
// in this y-down SVG space) so it's "south-east". Position is linearly
// interpolated between waypoints every tick; direction just switches at
// the waypoint (no in-between blending -- there's no sprite for that).
// This specific lane-sweep-and-glide path only ever travels 5 of the 8
// generated directions -- it never moves purely south, or diagonally
// upward, so north-east/north-west/south frames aren't imported here.
//
// One JS interval drives position + direction + walk-cycle frame together
// (single tick, single source of truth) rather than splitting position
// into GPU-composited CSS and direction into JS, which risked the two
// drifting out of sync with each other. Cheap either way: Zamboni only
// mounts while inIntermission is true, so the interval starts/stops with
// mount/unmount and never runs mid-game.
const ZAMBONI_FRAME_COUNT = 9;
const ZAMBONI_TICK_MS = 110;
const ZAMBONI_CYCLE_MS = 80_000;

const ZAMBONI_PATH = [
  { t: 0,    x: 60,  y: 45,  dir: 'east' },       // lane 1: sweep right
  { t: 12,   x: 470, y: 45,  dir: 'south-east' }, // bulge past the edge
  { t: 13.5, x: 490, y: 62,  dir: 'south-west' }, // curve down into lane 2
  { t: 16,   x: 470, y: 100, dir: 'west' },       // lane 2: sweep left
  { t: 28,   x: 60,  y: 100, dir: 'south-west' }, // bulge past the edge
  { t: 29.5, x: 40,  y: 117, dir: 'south-east' }, // curve down into lane 3
  { t: 32,   x: 60,  y: 155, dir: 'east' },       // lane 3: sweep right
  { t: 44,   x: 470, y: 155, dir: 'south-east' },
  { t: 45.5, x: 490, y: 172, dir: 'south-west' },
  { t: 48,   x: 470, y: 205, dir: 'west' },       // lane 4: sweep left
  { t: 60,   x: 60,  y: 205, dir: 'west' },       // small bulge, still west
  { t: 61.5, x: 40,  y: 205, dir: 'north' },      // return glide up the left edge
  { t: 66,   x: 40,  y: 45,  dir: 'east' },       // curve back to start
  { t: 68,   x: 60,  y: 45,  dir: 'east' },       // settle, pause
  { t: 100,  x: 60,  y: 45,  dir: 'east' },
];

function zamboniPose(elapsedMs) {
  const pct = ((elapsedMs % ZAMBONI_CYCLE_MS) / ZAMBONI_CYCLE_MS) * 100;
  let i = ZAMBONI_PATH.length - 2; // pct is always < 100, so this always gets overwritten below
  for (let j = 0; j < ZAMBONI_PATH.length - 1; j++) {
    if (pct < ZAMBONI_PATH[j + 1].t) { i = j; break; }
  }
  const seg = ZAMBONI_PATH[i], next = ZAMBONI_PATH[i + 1];
  const frac = (pct - seg.t) / (next.t - seg.t);
  return {
    x: seg.x + (next.x - seg.x) * frac,
    y: seg.y + (next.y - seg.y) * frac,
    dir: seg.dir,
  };
}

function Zamboni() {
  const [pose, setPose] = useState(() => zamboniPose(0));
  const [frame, setFrame] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setPose(zamboniPose(elapsed));
      setFrame(Math.floor(elapsed / ZAMBONI_TICK_MS) % ZAMBONI_FRAME_COUNT);
    }, ZAMBONI_TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <g style={{ transform: `translate(${pose.x}px, ${pose.y}px)` }}>
      <ellipse cx="0" cy="18" rx="18" ry="3" fill="#000" opacity="0.2" />
      <image
        href={`/zamboni/${pose.dir}/frame-${frame}.png`}
        x="-22" y="-22" width="44" height="44"
        style={{ imageRendering: 'pixelated' }}
      />
    </g>
  );
}

export default function LiveEventRink({
  plays = [], playerMap = {}, oppAbbr, oppColor,
  isLive, inIntermission, displayClock, periodNumber,
}) {
  const seenRef = useRef(new Map()); // eventId -> firstSeenAtMs
  // Bumped every TICK_MS purely to force a repaint so opacityFor() (a pure
  // function of Date.now()) gets recomputed -- the value itself is never
  // read, same "tick to force repaint of a pure elapsed-time function"
  // shape as ShotMapView.jsx's own clock ticker (liveClockStore.js).
  const [, setTick] = useState(0);

  const relevant = useMemo(
    () => plays.filter(p => DOT_TYPES.has(p.typeDescKey) && p.details?.xCoord != null),
    [plays]
  );

  // Track first-observed time per event. Cleared on intermission -- nothing
  // to show under an actively-cleaning sheet of ice, and the next period
  // starts from a blank rink (real broadcasts don't carry play data across
  // intermission either).
  useEffect(() => {
    if (inIntermission) { seenRef.current.clear(); return; }
    relevant.forEach(p => {
      if (!seenRef.current.has(p.eventId)) seenRef.current.set(p.eventId, Date.now());
    });
  }, [relevant, inIntermission]);

  // Repaint ticker so opacity keeps decaying between poll updates -- same
  // guarded setInterval + cleanup shape ShotMapView.jsx's own live clock
  // ticker uses (ShotMapView.jsx:759-770), lighter interval since a fade
  // doesn't need per-second precision.
  const tickRef = useRef(null);
  useEffect(() => {
    if (!isLive || inIntermission) return;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setTick(n => n + 1), TICK_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isLive, inIntermission]);

  function opacityFor(type, eventId) {
    const base = DOT_STYLE[type]?.opacity ?? 0.5;
    if (type === 'goal') return base; // pinned, no decay
    const first = seenRef.current.get(eventId);
    const age = first == null ? 0 : Date.now() - first;
    if (age <= HOLD_MS) return base;
    const fadeProgress = (age - HOLD_MS) / FADE_MS;
    return Math.max(0, base * (1 - fadeProgress));
  }

  const dots = relevant
    .map(p => {
      const type = p.typeDescKey;
      const d = p.details || {};
      const opacity = opacityFor(type, p.eventId);
      if (opacity <= 0.03) return null;

      // Normalize to "home team's own net always on the left" using this
      // specific play's own homeTeamDefendingSide -- stable for the whole
      // game regardless of period parity, and correct even for an older
      // (still-fading) event from earlier in the same period.
      let x = d.xCoord, y = d.yCoord ?? 0;
      if (p.homeTeamDefendingSide === 'right') { x = -x; y = -y; }
      const { px, py } = toSvg(x, y);

      const isMine = d.eventOwnerTeamId === TEAM_CONFIG.teamId;
      const style = DOT_STYLE[type] || { r: 4 };
      const playerId = eventPlayerId(type, d);
      const playerName = playerId != null ? playerMap[String(playerId)] : null;

      return {
        key: p.eventId, px, py, r: style.r, opacity,
        fill: isMine ? 'var(--team-primary)' : (oppColor || 'var(--text-dim)'),
        ring: TYPE_RING_COLOR[type] || 'var(--text-dim)',
        title: `${playerName || (isMine ? TEAM_CONFIG.abbr : oppAbbr) || ''} — ${type.replace(/-/g, ' ')}`.trim(),
      };
    })
    .filter(Boolean);

  return (
    <div className="card">
      <div className={CARD_LABEL_CLASSES}>
        <span>Live rink</span>
      </div>
      <div className={RINK_WRAP_CLASSES}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          <RinkMarkings showHalf={false} teamAbbr={TEAM_CONFIG.abbr} />

          {!inIntermission && dots.map(dot => (
            <circle
              key={dot.key}
              cx={dot.px} cy={dot.py} r={dot.r}
              fill={dot.fill}
              opacity={dot.opacity}
              stroke={dot.ring}
              strokeWidth={1.75}
              style={{ transition: 'opacity 2s ease' }}
              className="animate-[pop-in_0.3s_ease]"
            >
              <title>{dot.title}</title>
            </circle>
          ))}

          {inIntermission && <Zamboni />}
        </svg>

        {inIntermission && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[rgba(214,234,245,0.72)]">
            <span className={INTERMISSION_LABEL_CLASSES}>{periodOrdinal(periodNumber)} Intermission — cleaning the ice</span>
            <span className={INTERMISSION_CLOCK_CLASSES}>{displayClock || '—'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
