// utils/pwhlStoredPbp.js
// A finished PWHL game's stored play-by-play (/pwhl/pbp, via
// fetchPWHLPBP) in the live event shape (/pwhl/live/:gameId) that
// usePWHLPeriodSummary.js reads, so a finished game's period and game
// summaries build the same way a live game's do.
//
// The stored payload splits the game in two:
//   events   -- hits, faceoffs, penalties, goalie changes, snake_case:
//               { event_type, period_id, time_seconds, team_id, player_id,
//                 player_name, secondary_player_*, description,
//                 is_bench_penalty, penalty_minutes, _home_team_id }
//               A faceoff's team_id is the winner's; a hit's the hitter's.
//   oppShots -- every shot attempt, both teams despite the name:
//               { event_type: shot | blocked_shot | goal, period_id,
//                 time_seconds, team_id, shooter_id, shooter_name,
//                 x_norm, y_norm (feet, NHL rink coords) }
//               A goal is its own row; the live feed sends it twice, as a
//               shot with isGoal and as a goal event.
// Neither is in time order (the shot rows aren't ordered at all), so the
// result is sorted by period and clock.
//
// Period numbering is the live feed's: 4 is OT, playoff OTs keep counting.
// Neither feed has shootout attempts (PWHL game 237, 2025-12-27, ended in
// a shootout: both stop at period 4).
//
// Nothing here fills a gap with a guess. The Worker names players from
// today's rosters, so anyone who has since changed teams comes back with
// player_name null (game 212: Maddi Wheeler's P2 holding minor). A name is
// only taken for that same player id from elsewhere in the same game --
// another row, the faceoff and goalie lines that come with the rows, or
// /pwhl/summary -- and otherwise stays null. The stored rows have no
// assists or goal strength; the summaries take those from /pwhl/summary,
// as they do for a live game.

import { hockeyTechRowPenaltyParties } from './hockeyTechPenalty';

// "M:SS", as the live feed writes a clock (0:11, 19:56).
export function hockeyTechClock(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null;
  const s = Math.max(0, Math.round(Number(seconds)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const fullName = p => `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || null;

// { playerId: name } for everyone /pwhl/summary names with an id: goal
// scorers and assists, the three stars, the goalies in net.
export function pwhlSummaryPlayerNames(htSummary) {
  const names = {};
  const add = (id, name) => {
    const n = Number(id);
    if (n > 0 && name && names[n] == null) names[n] = name;
  };
  for (const period of htSummary?.periods || []) {
    for (const goal of period.goals || []) {
      add(goal.scoredBy?.id, fullName(goal.scoredBy));
      for (const a of goal.assists || []) add(a.id, fullName(a));
    }
  }
  for (const mvp of htSummary?.mvps || []) add(mvp.player?.info?.id, fullName(mvp.player?.info));
  for (const g of htSummary?.goalieLog || []) add(g.id, fullName(g));
  return names;
}

// Every name the payload itself gives a player id: the rows, the shot
// rows, the faceoff and goalie lines (named from HockeyTech's own box
// score, so they cover players the rows miss), then extraNames.
function payloadNames(pbp, rows, shots, extraNames) {
  const names = {};
  const add = (id, name) => {
    const n = Number(id);
    const trimmed = typeof name === 'string' ? name.trim() : '';
    // The Worker's faceoff line falls back to `${firstName} ${lastName}`
    // even when HockeyTech sent neither.
    if (n > 0 && trimmed && !/\bundefined\b/.test(trimmed) && names[n] == null) names[n] = trimmed;
  };
  for (const r of rows) {
    add(r.player_id, r.player_name);
    add(r.secondary_player_id, r.secondary_player_name);
  }
  for (const s of shots) add(s.shooter_id, s.shooter_name);
  for (const [id, line] of Object.entries(pbp.faceoffStats ?? pbp.faceoff_stats ?? {})) add(id, line?.name);
  for (const g of pbp.goalieStats ?? pbp.goalie_stats ?? []) add(g?.player_id, g?.name);
  for (const [id, name] of Object.entries(extraNames || {})) add(id, name);
  return names;
}

const nameOf = (names, id) => (Number(id) > 0 ? names[Number(id)] ?? null : null);

// pbp: fetchPWHLPBP's { events, oppShots, homeTeamId } (or the raw
// /pwhl/pbp body). extraNames: { playerId: name } from the same game, e.g.
// pwhlSummaryPlayerNames(htSummary).
export function pwhlEventsFromStoredPBP(pbp, extraNames = {}) {
  if (!pbp) return [];
  const rows  = Array.isArray(pbp.events) ? pbp.events : [];
  const shots = Array.isArray(pbp.oppShots) ? pbp.oppShots
    : Array.isArray(pbp.opp_shots) ? pbp.opp_shots : [];
  const homeTeamId = pbp.homeTeamId ?? pbp.home_team_id
    ?? rows.find(r => r._home_team_id != null)?._home_team_id ?? null;
  const names = payloadNames(pbp, rows, shots, extraNames);

  const out = [];
  const base = (type, r) => ({
    eventType:   type,
    period:      r.period_id ?? null,
    time:        hockeyTechClock(r.time_seconds),
    timeSeconds: r.time_seconds ?? null,
    teamId:      r.team_id ?? null,
  });

  for (const r of rows) {
    const type = r.event_type;
    if (type === 'faceoff') {
      out.push({
        ...base(type, r),
        homeWin: homeTeamId != null && r.team_id != null ? r.team_id === homeTeamId : null,
      });
    } else if (type === 'penalty') {
      const named = {
        ...r,
        player_name:           r.player_name?.trim() || nameOf(names, r.player_id),
        secondary_player_name: r.secondary_player_name?.trim() || nameOf(names, r.secondary_player_id),
      };
      out.push({
        ...base(type, r),
        description: r.description ?? null,
        minutes:     r.penalty_minutes ?? null,
        isPowerPlay: r.is_power_play ?? null,
        isBench:     r.is_bench_penalty ?? null,
        parties:     hockeyTechRowPenaltyParties(named),
      });
    } else if (type) {
      out.push(base(type, r));
    }
  }

  for (const s of shots) {
    const type = s.event_type;
    if (type !== 'shot' && type !== 'blocked_shot' && type !== 'goal') continue;
    const shot = {
      ...base(type === 'goal' ? 'shot' : type, s),
      isGoal:      type === 'goal',
      shooterId:   Number(s.shooter_id) > 0 ? Number(s.shooter_id) : null,
      shooterName: s.shooter_name?.trim() || nameOf(names, s.shooter_id),
      xFeet:       s.x_norm ?? null,
      yFeet:       s.y_norm ?? null,
    };
    out.push(shot);
    if (type === 'goal') {
      out.push({
        ...base('goal', s),
        scorerId:   shot.shooterId,
        scorerName: shot.shooterName,
        xFeet:      shot.xFeet,
        yFeet:      shot.yFeet,
      });
    }
  }

  // Chronological, as the live feed sends them. Within the same second a
  // goal's shot comes before the goal, as live.
  const order = { shot: 0, blocked_shot: 0, goal: 1 };
  return out
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.period ?? 0) - (b.e.period ?? 0)
      || (a.e.timeSeconds ?? 0) - (b.e.timeSeconds ?? 0)
      || (order[a.e.eventType] ?? 0) - (order[b.e.eventType] ?? 0)
      || a.i - b.i)
    .map(({ e }) => e);
}
