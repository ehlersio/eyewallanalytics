// src/components/GoalTrackingReplay.jsx
// EyeWall's rendering of one NHL goal from the NHL's player and puck
// tracking (EDGE): every skater as a team-coloured dot with their number, the
// scorer ringed, the puck with a short trail, "GOAL" the moment it's in the
// net. Shown under GoalReplay's Tracking tab.
//
// Same rink as LiveEventRink and the Shot Map (react-hockey-rink's own
// RinkMarkings, 600 x 255 units = 3 per foot). A whole rink across a phone
// is ~1.75 px per foot -- too small for sweater numbers -- so the view is a
// VIEW_FT window that pans with the puck. The camera is a pure function of
// the frame (the puck's average position over the last CAMERA_FRAMES), so
// scrubbing back and forth never jumps. Every replay is turned so the goal
// is in the right-hand net (goalReplayFrames.orient).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RinkMarkings, W, H } from 'react-hockey-rink';
import { teamTextColor } from '../utils/teamConfig';
import { replayWindow, sampleAt, puckTrail, dotColours, inkFor, orient } from '../utils/goalReplayFrames';

const FT = W / 200; // svg units per foot
// The rink's ice is light in both themes, so the puck, its trail and the
// scorer's ring are drawn dark (a theme text colour would vanish on it).
const INK = '#0c1120';
const VIEW_FT = 120;
const CAMERA_FRAMES = 15;
const toX = (x) => (x + 100) * FT;
const toY = (y) => (42.5 - y) * FT;

const WRAP_CLASSES = 'goal-tracking-replay relative w-full';
const RINK_CLASSES = 'relative w-full overflow-hidden rounded-[var(--radius-sm)] leading-none select-none';
const GOAL_FLASH_CLASSES = 'goal-tracking-goal pointer-events-none absolute left-[26%] top-1/2 -translate-x-1/2 -translate-y-1/2 font-[family-name:var(--font-display)] text-[40px] font-extrabold tracking-[2px] text-[color:var(--red-bright)] [text-shadow:0_2px_8px_rgba(0,0,0,0.6)] animate-[pop-in_0.3s_ease]';
const CONTROLS_CLASSES = 'flex items-center gap-2 pt-2';
const CONTROL_BTN_CLASSES = 'goal-tracking-btn min-h-0 min-w-0 rounded-[20px] bg-[var(--btn-fill)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text)]';
const SCRUBBER_CLASSES = 'goal-tracking-scrubber flex-1 accent-[var(--red-bright)]';
const CREDIT_CLASSES = 'pt-1 pr-2 text-right text-[9px] text-[color:var(--text-dim)]';

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// Left edge of the view in feet, following the puck.
function cameraLeft(replay, frame) {
  let sum = 0, n = 0;
  for (let i = Math.max(0, Math.floor(frame) - CAMERA_FRAMES); i <= Math.floor(frame); i++) {
    const p = replay.frames[i]?.puck;
    if (p) { sum += orient(p, replay.attacksRight)[0]; n += 1; }
  }
  const focus = n ? sum / n : 60;
  return Math.min(100 - VIEW_FT, Math.max(-100, focus - VIEW_FT * 0.55));
}

export default function GoalTrackingReplay({ replay, scorerName, autoPlay = true }) {
  const { t } = useTranslation();
  const { start, end } = useMemo(() => replayWindow(replay), [replay]);
  const [frame, setFrameState] = useState(start);
  const [playing, setPlaying] = useState(() => autoPlay && !prefersReducedMotion());
  const [slow, setSlow] = useState(false);
  // The animation loop reads the current frame without re-subscribing.
  const frameRef = useRef(start);
  const setFrame = (v) => { frameRef.current = v; setFrameState(v); };

  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = Math.min(end, frameRef.current + dt * replay.hz * (slow ? 0.5 : 1));
      frameRef.current = next;
      setFrameState(next);
      if (next >= end) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, slow, end, replay.hz]);

  const scorerTrack = Object.values(replay.players).find(p => p.playerId === replay.scorerId);
  const scoringTeam = scorerTrack?.team || replay.teams.home;
  const otherTeam = scoringTeam === replay.teams.home ? replay.teams.away : replay.teams.home;
  const colours = useMemo(
    () => dotColours(scoringTeam, otherTeam, teamTextColor),
    [scoringTeam, otherTeam],
  );

  const { players, puck } = sampleAt(replay, frame);
  const trail = puckTrail(replay, frame);
  const left = cameraLeft(replay, frame);
  const isGoal = frame >= replay.goalFrame;
  const r = 2 * FT;

  const togglePlay = () => {
    if (!playing && frameRef.current >= end) setFrame(start);
    setPlaying(p => !p);
  };
  const restart = () => { setFrame(start); setPlaying(true); };
  // The goal carousel around this changes goal on a horizontal swipe; a
  // drag on the scrubber mustn't reach it.
  const stop = (e) => e.stopPropagation();

  return (
    <div className={WRAP_CLASSES} onTouchStart={stop} onTouchEnd={stop}>
      <div className={RINK_CLASSES}>
        <svg
          viewBox={`${toX(left)} 0 ${VIEW_FT * FT} ${H}`}
          width="100%"
          style={{ display: 'block' }}
          role="img"
          aria-label={t('goalReplay.trackingAria', { scorer: scorerName || scoringTeam })}
        >
          {/* Zone labels from the scorer's side: every replay attacks right. */}
          <RinkMarkings showHalf={false} teamAbbr={scoringTeam} />
          {trail.map(([x, y], i) => (
            <circle
              key={`t${i}`}
              cx={toX(x)} cy={toY(y)}
              r={0.4 * FT + (0.6 * FT * i) / trail.length}
              fill={INK}
              opacity={0.1 + (0.45 * i) / trail.length}
            />
          ))}
          {players.map(({ id, pos }) => {
            const info = replay.players[id];
            if (!pos || !info) return null;
            const fill = colours[info.team] || 'var(--text-dim)';
            const [x, y] = pos;
            return (
              <g key={id} className="goal-tracking-player" transform={`translate(${toX(x)} ${toY(y)})`}>
                {info.playerId === replay.scorerId && (
                  <circle r={r + 0.9 * FT} fill="none" stroke={INK} strokeWidth={0.5 * FT} />
                )}
                <circle r={r} fill={fill} />
                <text
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={2.2 * FT} fontWeight={800}
                  fill={inkFor(fill)}
                >
                  {info.number ?? ''}
                </text>
              </g>
            );
          })}
          {puck && (
            <circle
              className="goal-tracking-puck"
              cx={toX(puck[0])} cy={toY(puck[1])}
              r={0.9 * FT} fill={INK} stroke="#ffffff" strokeWidth={0.3 * FT}
            />
          )}
        </svg>
        {isGoal && <div className={GOAL_FLASH_CLASSES}>{t('goalReplay.goal')}</div>}
      </div>

      <div className={CONTROLS_CLASSES}>
        <button type="button" className={CONTROL_BTN_CLASSES} onClick={togglePlay} aria-label={playing ? t('goalReplay.pause') : t('goalReplay.play')}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button type="button" className={CONTROL_BTN_CLASSES} onClick={restart} aria-label={t('goalReplay.restart')}>↺</button>
        <input
          type="range"
          className={SCRUBBER_CLASSES}
          min={start} max={end} step={0.1}
          value={frame}
          onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
          aria-label={t('goalReplay.scrubber')}
        />
        <button type="button" className={CONTROL_BTN_CLASSES} onClick={() => setSlow(s => !s)} aria-pressed={slow} aria-label={t('goalReplay.speed')}>
          {slow ? '½×' : '1×'}
        </button>
      </div>
      <div className={CREDIT_CLASSES}>{t('goalReplay.credit')}</div>
    </div>
  );
}
