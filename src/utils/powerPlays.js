// utils/powerPlays.js
// A team's power-play opportunities in an NHL game, from the play-by-play.
//
// The PP% and PK% cards, their drill-downs and the "perfect penalty kill"
// insight all count from powerPlayOpportunities(), so they always agree.
// The PP% card used to count every opponent penalty play as an
// opportunity: fighting majors, coincidental minors and misconducts each
// added one (NYR read 0/7 on 2026-10-04, 2026020036, against 0/4 official),
// while its drill-down counted stretches of power-play situationCodes
// instead, which miss a power play the feed logs no play during and merge
// a 5-on-3 into one.
//
// Counted the way the NHL scores it, checked against the official
// right-rail powerPlay of 201 games (2025-26 and 2026-27, regular season
// and playoffs; 396 of 402 team-games match exactly, the rest are off by
// one where a penalty was wiped out by another before any power play):
//  - each opponent minor or bench minor is one opportunity, a double
//    minor two;
//  - a major is one, plus one more for each power-play goal scored on it
//    (a goal doesn't end a major);
//  - penalties called at the same moment cancel each other out, minor for
//    minor and major for major (fighting majors, coincidental minors);
//  - misconducts, game misconducts and penalty shots are none;
//  - a penalty with nothing played after it (the final horn) is none.
import { isValidSituationCode } from './situationCode.js';
import { isShootoutPlay } from './gamePlays.js';

// True when the home (teamIsHome) or away team has the man advantage.
// situationCode: [awayGoalie][awaySkaters][homeSkaters][homeGoalie]. A
// side with its goalie pulled counts one skater fewer, so a delayed-penalty
// 6-on-5 is even strength while a power play that pulls its goalie for a
// 6-on-4 is still a power play (the NHL credits a goal there as a
// power-play goal: CAR at 18:18 of P3, 2025030413).
export function teamOnPowerPlay(sc, teamIsHome) {
  if (!isValidSituationCode(sc)) return false;
  const away = Number(sc[1]) - (sc[0] === '1' ? 0 : 1);
  const home = Number(sc[2]) - (sc[3] === '1' ? 0 : 1);
  return teamIsHome ? home > away : away > home;
}

function clockSecs(timeInPeriod) {
  const [m, s] = (timeInPeriod || '0:00').split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}

// Seconds since puck drop. Every period before an overtime is 20 minutes.
function gameSecs(play) {
  const n = play.periodDescriptor?.number || 1;
  return (n - 1) * 1200 + clockSecs(play.timeInPeriod);
}

const NOT_PLAY = new Set(['penalty', 'stoppage', 'period-end', 'game-end', 'delayed-penalty']);

// A penalty's weight in the cancel-out: minors (a double minor is two)
// or majors. null for the ones that never give a power play.
function penaltyKind(d) {
  if (d?.typeCode === 'MAJ') return { kind: 'maj', n: 1 };
  if (d?.typeCode === 'MIN' || d?.typeCode === 'BEN') return { kind: 'min', n: d.duration === 4 ? 2 : 1 };
  return null;
}

// The team's power-play opportunities, oldest first. teamIsHome says
// which side of the situationCode is the team's. Each one is
//   { penalty, period, startTime, startLabel, endTime, endLabel,
//     startSecs, endSecs, plays, goals }
// where plays are the plays logged while the team had the man advantage
// during it (the opponent's short-handed attempts too) and goals the
// team's goals among them. One the feed logged no play during has none.
export function powerPlayOpportunities(plays, teamIsHome, teamId) {
  const list = (plays || []).filter(p => !isShootoutPlay(p));
  const onPP = p => teamOnPowerPlay(p.situationCode, teamIsHome);
  const isTeamPPGoal = p => p.typeDescKey === 'goal' && p.details?.eventOwnerTeamId === teamId && onPP(p);

  // Whether the game went on at or after `secs` (a play other than `except`
  // and the clock-stopping kind): the second half of a double minor called
  // with 12 seconds left never starts. Live, it starts once the clock gets
  // there.
  const playedFrom = (secs, except) => list.some(p =>
    p !== except && !NOT_PLAY.has(p.typeDescKey) && gameSecs(p) >= secs);

  // Opportunity start times from the penalties, grouped by the moment
  // they were called.
  const starts = [];
  for (let i = 0; i < list.length; i++) {
    const first = list[i];
    if (first.typeDescKey !== 'penalty') continue;
    const at = gameSecs(first);
    const group = [];
    let j = i;
    while (j < list.length && list[j].typeDescKey === 'penalty' && gameSecs(list[j]) === at) group.push(list[j++]);
    i = j - 1;
    if (!list.slice(j).some(p => !NOT_PLAY.has(p.typeDescKey))) continue; // nothing played after it

    const team = { min: 0, maj: 0 };
    const opp = [];
    for (const p of group) {
      const k = penaltyKind(p.details);
      if (!k) continue;
      if (p.details?.eventOwnerTeamId === teamId) team[k.kind] += k.n;
      else opp.push({ ...k, play: p });
    }
    for (const o of opp) {
      const cancelled = Math.min(team[o.kind], o.n);
      team[o.kind] -= cancelled;
      const n = o.n - cancelled;
      if (n <= 0) continue;
      if (o.kind === 'min' && n === 2) {
        // The second half of a double minor starts after two minutes, or
        // at a power-play goal in the first two.
        const goal = list.slice(j).find(p => isTeamPPGoal(p) && gameSecs(p) - at < 120);
        const second = goal ? gameSecs(goal) : at + 120;
        starts.push({ at, until: second, penalty: o.play });
        if (playedFrom(second, goal)) starts.push({ at: second, until: second + 120, penalty: o.play, afterGoal: goal });
      } else if (o.kind === 'maj') {
        starts.push({ at, until: at + 300, penalty: o.play });
        list.slice(j)
          .filter(p => isTeamPPGoal(p) && gameSecs(p) - at < 300 && playedFrom(gameSecs(p), p))
          .forEach(p => starts.push({ at: gameSecs(p), until: at + 300, penalty: o.play, afterGoal: p }));
      } else {
        starts.push({ at, until: at + 120, penalty: o.play });
      }
    }
  }
  starts.sort((a, b) => a.at - b.at);

  const opps = starts.map(s => ({
    penalty:    s.penalty,
    period:     Math.floor(s.at / 1200) + 1,
    startSecs:  s.at,
    startTime:  s.at % 1200,
    startLabel: s.afterGoal?.timeInPeriod
      ?? (s.at === gameSecs(s.penalty) ? s.penalty.timeInPeriod : null)
      ?? `${String(Math.floor((s.at % 1200) / 60)).padStart(2, '0')}:${String(s.at % 60).padStart(2, '0')}`,
    plays: [],
  }));
  if (!opps.length) return [];

  // Each man-advantage play goes to the latest opportunity still running
  // at its time (penalty time is game time, so a minor runs exactly two
  // minutes of clock). A goal that starts the next part of a double minor
  // or major belongs to the part it ended. A play none is running at (a
  // period-end coded as a power play after the last penalty expired) goes
  // nowhere.
  for (const p of list) {
    if (!onPP(p)) continue;
    const at = gameSecs(p);
    let idx = -1;
    for (let k = 0; k < opps.length; k++) {
      if (starts[k].afterGoal === p) break;
      if (starts[k].at <= at && at <= starts[k].until) idx = k;
    }
    if (idx >= 0) opps[idx].plays.push(p);
  }

  return opps.map(o => {
    const last = o.plays[o.plays.length - 1];
    const endSecs = last ? Math.max(gameSecs(last), o.startSecs) : o.startSecs;
    return {
      ...o,
      endSecs,
      endTime:  last && endSecs > o.startSecs ? clockSecs(last.timeInPeriod) : o.startTime,
      endLabel: last && endSecs > o.startSecs ? last.timeInPeriod : o.startLabel,
      goals:    o.plays.filter(p => p.typeDescKey === 'goal' && p.details?.eventOwnerTeamId === teamId).length,
    };
  });
}

// Opportunities and power-play goals, for the PP% / PK% cards.
export function powerPlayRecord(plays, teamIsHome, teamId) {
  const opps = powerPlayOpportunities(plays, teamIsHome, teamId);
  return { opps: opps.length, goals: opps.reduce((n, o) => n + o.goals, 0), opportunities: opps };
}
