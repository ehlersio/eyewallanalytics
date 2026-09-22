// src/utils/goalReplayFrames.js
// Pure frame math for the goal Tracking replay (GoalTrackingReplay.jsx).
//
// A replay comes from the Worker's /nhl/goal-replay (eyewall-poller's
// goalReplay.js): NHL EDGE player and puck tracking at 10 Hz, already in
// play-by-play feet (x -100..100, y -42.5..42.5) -- the coordinate system
// react-hockey-rink / LiveEventRink draw in -- with the frame the puck is in
// the net (goalFrame) and which net that is (attacksRight).

// Shown before and after the goal. The feed covers ~14 s; the last couple of
// seconds after the goal are players celebrating.
export const LEAD_FRAMES = 90;
export const TAIL_FRAMES = 15;
export const TRAIL_FRAMES = 12;

export function replayWindow(replay) {
  const last = replay.frames.length - 1;
  return {
    start: Math.max(0, replay.goalFrame - LEAD_FRAMES),
    end: Math.min(last, replay.goalFrame + TAIL_FRAMES),
  };
}

// Every replay is drawn with the goal in the right-hand net, whichever end
// it was really scored at: turn the rink 180 degrees for a left-hand goal.
export function orient([x, y], attacksRight) {
  return attacksRight ? [x, y] : [-x, -y];
}

const lerp = (a, b, k) => a + (b - a) * k;

function between(p, q, k) {
  if (!p) return null;
  if (!q) return p;
  return [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
}

// Positions at fractional frame t (linear between the 10 Hz samples),
// oriented goal-right. A player present at the earlier sample but not the
// later one holds position; one only in the later sample isn't drawn yet.
// The puck is null where tracking lost it.
export function sampleAt(replay, t) {
  const { frames, attacksRight } = replay;
  const i = Math.max(0, Math.min(frames.length - 1, Math.floor(t)));
  const j = Math.min(frames.length - 1, i + 1);
  const k = Math.min(1, Math.max(0, t - i));
  const a = frames[i], b = frames[j];
  const players = Object.entries(a.at).map(([id, p]) => ({
    id,
    pos: orient(between(p, b.at[id], k), attacksRight),
  }));
  const puckRaw = a.puck && b.puck ? between(a.puck, b.puck, k) : a.puck;
  return { players, puck: puckRaw ? orient(puckRaw, attacksRight) : null };
}

// The puck's recent path up to t, oldest first, oriented goal-right.
export function puckTrail(replay, t, frames = TRAIL_FRAMES) {
  const out = [];
  const end = Math.min(replay.frames.length - 1, Math.floor(t));
  for (let i = Math.max(0, end - frames); i <= end; i++) {
    const p = replay.frames[i].puck;
    if (p) out.push(orient(p, replay.attacksRight));
  }
  return out;
}

function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const NEUTRAL_DOT = '#c9d1dc';

// Dot colours for the two teams. The scoring team keeps its colour; the
// other team turns neutral grey when the two are too close to tell apart
// on a small screen (CAR v DET, both red) -- same rule as the pipeline's
// Goal of the Week clip. Unknown colours fall back to the app's text tones.
export function dotColours(scoringTeam, otherTeam, colourOf) {
  const mine = colourOf(scoringTeam) || 'var(--text)';
  let theirs = colourOf(otherTeam) || 'var(--text-dim)';
  const a = rgb(mine), b = rgb(theirs);
  if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 120) theirs = NEUTRAL_DOT;
  return { [scoringTeam]: mine, [otherTeam]: theirs };
}

// Black or white text on a coloured dot.
export function inkFor(hex) {
  const c = rgb(hex);
  if (!c) return '#0c1120';
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 140 ? '#0c1120' : '#ffffff';
}
