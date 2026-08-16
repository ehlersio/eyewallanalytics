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

// ── Zamboni (Session 100) — hand-built flat-icon SVG, not a raster asset.
// No image-generation tool (Pixellab or otherwise) is available in this
// environment to build this from; a crafted vector icon scales cleanly at
// any size/theme and fits this rink's all-SVG rendering, unlike a hosted
// raster image would. Styled after a reference illustration the user
// shared: angled white hood over a blue halftone-textured lower body, dark
// angled front nose with a light accent stripe, a lime-green front
// resurfacer blade, an OPEN driver platform (post + seat-back + cushion,
// not an enclosed cab) with an antenna, and two wheels with a lug-dot hub
// pattern. Drawn facing left by default; direction is flipped via scaleX
// in the animation below (never rotated 180deg -- see that comment for why).
function Zamboni() {
  const hubDots = (cx, cy) => [0, 60, 120, 180, 240, 300].map(a => {
    const rad = (a * Math.PI) / 180;
    return <circle key={a} cx={cx + 2.1 * Math.cos(rad)} cy={cy + 2.1 * Math.sin(rad)} r="0.5" fill="#f4f7fb" />;
  });

  return (
    <g
      className="animate-[zamboni-drive_80s_linear_infinite]"
      style={{ transformOrigin: '24px 9px' }} // vehicle's own visual center
    >
      <defs>
        <pattern id="zamboniHalftone" width="3.2" height="3.2" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.55" fill="#1b2540" opacity="0.35" />
        </pattern>
      </defs>

      <ellipse cx="30" cy="27.5" rx="29" ry="2.5" fill="#000" opacity="0.2" />

      {/* lower body -- blue, halftone-textured */}
      <rect x="8" y="14" width="44" height="10" rx="2" fill="#3355ee" stroke="#1b2540" strokeWidth="1.4" />
      <rect x="8" y="14" width="44" height="10" rx="2" fill="url(#zamboniHalftone)" />

      {/* angled white hood/tank top */}
      <path d="M 10 14 L 14 3 L 46 3 L 52 14 Z" fill="#f4f7fb" stroke="#1b2540" strokeWidth="1.4" />
      <path d="M 10 14 L 52 14" stroke="#b8e62e" strokeWidth="1.6" />

      {/* dark angled front nose */}
      <path d="M 2 20 L 10 14 L 10 24 L 5 24 Z" fill="#1b2540" />
      <path d="M 4 19 L 9.4 15.3" stroke="#8fd8ff" strokeWidth="1.2" opacity="0.85" />

      {/* front resurfacer blade, low near the ice */}
      <rect x="-3" y="23" width="14" height="5" rx="1.2" fill="#b8e62e" stroke="#1b2540" strokeWidth="1.1" />
      <rect x="-3" y="23" width="14" height="5" rx="1.2" fill="url(#zamboniHalftone)" />

      {/* open driver platform */}
      <rect x="43" y="1" width="2.4" height="13" fill="#1b2540" />
      <path d="M 40 -6 Q 40 -9 43 -9 L 49 -9 Q 52 -9 52 -6 L 52 1 L 40 1 Z" fill="#3355ee" stroke="#1b2540" strokeWidth="1.3" />
      <rect x="39" y="1" width="14" height="2.6" rx="1" fill="#1b2540" />
      <line x1="37" y1="3" x2="37" y2="-8" stroke="#1b2540" strokeWidth="1" />
      <circle cx="37" cy="-9" r="1.3" fill="#b8e62e" />

      {/* wheels */}
      <circle cx="18" cy="24" r="5.2" fill="#1b2540" />
      <circle cx="18" cy="24" r="3.2" fill="#3355ee" stroke="#1b2540" strokeWidth="0.8" />
      {hubDots(18, 24)}
      <circle cx="42" cy="24" r="5.2" fill="#1b2540" />
      <circle cx="42" cy="24" r="3.2" fill="#3355ee" stroke="#1b2540" strokeWidth="0.8" />
      {hubDots(42, 24)}
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
