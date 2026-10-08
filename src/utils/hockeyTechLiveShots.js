// utils/hockeyTechLiveShots.js
// An AHL/ECHL game's shots and goals from its /{league}/live payload, as
// rows shaped like the stored /{league}/game-shots ones, so
// HockeyTechShotMapView plots a live game (or a final the nightly hasn't
// stored yet) through the same adapters, and the dots land where the stored
// ones will.
//
// The same rules as the pipeline's hockeytech_shot_events.py parse_pbp():
//   - a shot with isGoal is skipped: the feed sends every goal twice, as a
//     shot and as a goal event, and the goal event owns it;
//   - a shot without coordinates is skipped; a goal without them is kept
//     (it still counts, it just can't be plotted -- the adapters drop it);
//   - penalty shots and shootout attempts carry no coordinates and aren't
//     shot rows;
//   - transform_coords(): HockeyTech's 600x300 canvas to rink feet
//     (x -100..100, y -42.5..42.5), home attacking right in odd periods.

const CANVAS_W = 600;
const CANVAS_H = 300;

const round2 = n => Math.round(n * 100) / 100;

// hockeytech_shot_events.transform_coords().
export function transformCoords(xRaw, yRaw, isHome, period) {
  let x = (xRaw / CANVAS_W - 0.5) * 200;
  let y = (yRaw / CANVAS_H - 0.5) * 85;
  const homeAttacksRight = period % 2 === 1;
  const attackingRight = isHome ? homeAttacksRight : !homeAttacksRight;
  if (!attackingRight) { x = -x; y = -y; }
  return { x: round2(x) + 0, y: round2(y) + 0 };
}

const coord = v => (v === null || v === undefined || v === '' ? null : Number(v));
const fullName = p => (p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || null : null);

// Rows for every shot and goal in a /live payload, in feed order; [] for
// no payload. Each row: { id, game_id, event_type: 'shot'|'goal', period_id,
// time_seconds, team_id, shooter_id, shooter_name, shot_type, x_norm,
// y_norm } (x_norm/y_norm null for a goal the feed didn't place).
export function liveShotRows(live) {
  const events = live?.events;
  if (!Array.isArray(events)) return [];
  const rows = [];
  events.forEach((ev, i) => {
    const type = ev?.eventType;
    if (type !== 'shot' && type !== 'goal') return;
    if (type === 'shot' && ev.isGoal) return;
    const x = coord(ev.x);
    const y = coord(ev.y);
    const placed = Number.isFinite(x) && Number.isFinite(y);
    if (type === 'shot' && !placed) return;
    const period = ev.period ?? 1;
    const isHome = ev.teamId != null && ev.teamId === live.homeTeamId;
    const norm = placed ? transformCoords(x, y, isHome, period) : null;
    const shooter = type === 'goal' ? ev.scoredBy : ev.shooter;
    rows.push({
      id: `live-${live.gameId}-${i}`,
      game_id: live.gameId,
      event_type: type,
      period_id: period,
      time_seconds: ev.timeSeconds ?? 0,
      team_id: ev.teamId ?? null,
      shooter_id: shooter?.id ?? null,
      shooter_name: fullName(shooter),
      shot_type: type === 'goal' ? '' : (ev.shotType || ''),
      x_norm: norm ? norm.x : null,
      y_norm: norm ? norm.y : null,
    });
  });
  return rows;
}
