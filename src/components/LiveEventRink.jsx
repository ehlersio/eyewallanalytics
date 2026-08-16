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
// Coordinate transform is an independent copy of IceRink.jsx's own
// (IceRink.jsx:34-49), scaled down for a compact card — this codebase's
// established convention for small shared math between independent
// rendering surfaces is a local copy, not a cross-import (IceRink.jsx
// exports nothing but its default and is a large monolith not meant to be
// pulled apart for this).
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
// since they're durable context, not ambient churn.
//
// Intermission: the tracked-event map is cleared and the rink switches to
// a continuous Zamboni resurfacing animation (pure CSS transform, GPU-
// composited, cheap to leave running for a full ~15-18min break) with the
// same ordinal + live countdown treatment the score bar already shows
// (ShotMapView.jsx:1799-1813) overlaid, rather than inventing a third
// distinct "intermission" message.

import { useEffect, useMemo, useRef, useState } from 'react';
import { TEAM_CONFIG } from '../utils/teamConfig';

// Compact rink viewBox — smaller than IceRink.jsx's 600x255, same NHL ice
// convention (200ft x 85ft, origin = center ice, x -100..+100, y -42.5..+42.5).
const W = 300, H = 128, CX = W / 2, CY = H / 2;
function toSvg(x, y) {
  return { px: CX + (x / 100) * (W / 2), py: CY - (y / 42.5) * (H / 2) };
}

// Every event type here is confirmed (live, 2026-08) to carry real
// details.xCoord/yCoord in NHL's live play-by-play feed.
const DOT_TYPES = new Set([
  'goal', 'shot-on-goal', 'missed-shot', 'blocked-shot',
  'hit', 'giveaway', 'takeaway', 'faceoff',
]);

const DOT_STYLE = {
  'goal':         { r: 7,   opacity: 1    },
  'shot-on-goal': { r: 5,   opacity: 0.85 },
  'missed-shot':  { r: 4,   opacity: 0.5  },
  'blocked-shot': { r: 4,   opacity: 0.5  },
  'hit':          { r: 4.5, opacity: 0.7  },
  'giveaway':     { r: 3.5, opacity: 0.55 },
  'takeaway':     { r: 3.5, opacity: 0.55 },
  'faceoff':      { r: 3,   opacity: 0.4  },
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
const RINK_WRAP_CLASSES = 'relative w-full rounded-[8px] overflow-hidden bg-[#0f1b2e]';
const INTERMISSION_LABEL_CLASSES = 'text-[13px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]';
const INTERMISSION_CLOCK_CLASSES = 'font-[family-name:var(--font-mono)] text-[20px] font-extrabold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]';

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
        color: isMine ? 'var(--team-primary)' : (oppColor || 'var(--text-dim)'),
        isGoal: type === 'goal',
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
          <rect x="4" y="4" width={W - 8} height={H - 8} rx="10" fill="#12233d" stroke="#26405f" strokeWidth="1" />
          {/* Blue lines */}
          <line x1={toSvg(-25, 0).px} y1="4" x2={toSvg(-25, 0).px} y2={H - 4} stroke="#3d6fb0" strokeWidth="2" opacity="0.6" />
          <line x1={toSvg(25, 0).px} y1="4" x2={toSvg(25, 0).px} y2={H - 4} stroke="#3d6fb0" strokeWidth="2" opacity="0.6" />
          {/* Center red line + faceoff dot */}
          <line x1={CX} y1="4" x2={CX} y2={H - 4} stroke="#c0394b" strokeWidth="1.5" opacity="0.55" />
          <circle cx={CX} cy={CY} r="2" fill="#c0394b" opacity="0.5" />
          {/* Goal creases */}
          <path d={`M ${toSvg(-89, -8).px} ${toSvg(-89, -8).py} A 10 8 0 0 1 ${toSvg(-89, 8).px} ${toSvg(-89, 8).py}`} fill="#3d6fb0" fillOpacity="0.15" stroke="#3d6fb0" strokeWidth="1" opacity="0.5" />
          <path d={`M ${toSvg(89, 8).px} ${toSvg(89, 8).py} A 10 8 0 0 1 ${toSvg(89, -8).px} ${toSvg(89, -8).py}`} fill="#3d6fb0" fillOpacity="0.15" stroke="#3d6fb0" strokeWidth="1" opacity="0.5" />

          {!inIntermission && dots.map(dot => (
            <circle
              key={dot.key}
              cx={dot.px} cy={dot.py} r={dot.r}
              fill={dot.color}
              opacity={dot.opacity}
              stroke={dot.isGoal ? '#111' : 'none'}
              strokeWidth={dot.isGoal ? 1.5 : 0}
              style={{ transition: 'opacity 2s ease' }}
              className="animate-[pop-in_0.3s_ease]"
            >
              <title>{dot.title}</title>
            </circle>
          ))}

          {inIntermission && (
            <g className="animate-[zamboni-drive_75s_linear_infinite]">
              <rect x="0" y="0" width="26" height="14" rx="3" fill="#dbe4ee" stroke="#26405f" strokeWidth="1" />
              <rect x="3" y="-4" width="12" height="7" rx="1.5" fill="#26405f" />
            </g>
          )}
        </svg>

        {inIntermission && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[rgba(15,27,46,0.55)]">
            <span className={INTERMISSION_LABEL_CLASSES}>{periodOrdinal(periodNumber)} Intermission — cleaning the ice</span>
            <span className={INTERMISSION_CLOCK_CLASSES}>{displayClock || '—'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
