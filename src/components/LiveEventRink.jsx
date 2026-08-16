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
const RINK_WRAP_CLASSES = 'relative w-full rounded-[8px] overflow-hidden bg-[#d6eaf5]';
const INTERMISSION_LABEL_CLASSES = 'text-[13px] font-bold text-[#0f1b2e] [text-shadow:0_1px_2px_rgba(255,255,255,0.5)]';
const INTERMISSION_CLOCK_CLASSES = 'font-[family-name:var(--font-mono)] text-[20px] font-extrabold text-[#0f1b2e] [text-shadow:0_1px_2px_rgba(255,255,255,0.5)]';

// ── Zamboni (Session 100) — hand-built flat-icon SVG, not a raster asset.
// No image-generation tool (Pixellab or otherwise) is available to build
// this from; a crafted vector icon scales cleanly at any size/theme and
// fits this rink's all-SVG rendering, unlike a hosted raster image would.
// Side-profile resurfacer: body, cab + windshield, brush housing, wheels.
function Zamboni() {
  return (
    <g
      className="animate-[zamboni-drive_75s_linear_infinite]"
      style={{ transformOrigin: '26px 12px' }} // vehicle's own visual center, so 180deg turns pivot in place
    >
      <ellipse cx="28" cy="24.5" rx="27" ry="2.5" fill="#000" opacity="0.22" />
      {/* body */}
      <rect x="4" y="9" width="48" height="14" rx="3" fill="#eef2f6" stroke="#26405f" strokeWidth="1.2" />
      {/* accent stripe */}
      <rect x="4" y="15" width="48" height="3.2" fill="#c0394b" opacity="0.9" />
      {/* cab */}
      <path d="M 33 9 L 33 1.5 Q 33 -1 35.5 -1 L 46 -1 Q 48.5 -1 48.5 1.5 L 48.5 9 Z"
        fill="#dbe4ee" stroke="#26405f" strokeWidth="1.2" />
      {/* windshield */}
      <path d="M 35.5 1 L 46 1 L 45.3 6.5 L 36.2 6.5 Z" fill="#8fb8e0" opacity="0.9" />
      {/* brush/auger housing at the front */}
      <rect x="0" y="12" width="5" height="9" rx="1.5" fill="#3d4b5e" />
      {/* exhaust */}
      <rect x="30" y="4" width="2" height="6" rx="1" fill="#6b7a8c" />
      {/* wheels */}
      <circle cx="15" cy="24" r="4.2" fill="#1a2230" stroke="#0c1119" strokeWidth="0.8" />
      <circle cx="15" cy="24" r="1.6" fill="#5a6b80" />
      <circle cx="41" cy="24" r="4.2" fill="#1a2230" stroke="#0c1119" strokeWidth="0.8" />
      <circle cx="41" cy="24" r="1.6" fill="#5a6b80" />
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
