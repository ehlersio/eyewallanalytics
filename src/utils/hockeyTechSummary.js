// utils/hockeyTechSummary.js
// AHL/ECHL period and final summaries, built from the game's /{league}/live
// play-by-play (live, or complete once the game is over) and
// /{league}/summary (HockeyTech's gameSummary: goals with assists and
// headshots, per-period goals, the three stars, power plays). The port of
// usePWHLPeriodSummary.js's builders, without what these feeds don't have:
// no blocked shots (so no Corsi/Fenwick), no hits or faceoffs (the box
// scores carry 0 for both), no goalie log (goalies come from the shot
// events, each of which names the goalie it was on).
//
// Event shape (/live, normalized by the Worker):
//   shot    { teamId (the shooter's), shooter, goalie, isGoal, x, y (600x300) }
//   goal    { teamId, scoredBy, assists, isPowerPlay, isShortHanded, isEmptyNet }
//   penalty { teamId, takenBy, servedBy, minutes, description, isBench }
//   shootout attempts carry period 7 and never make a period of their own.
// Every shot event is a shot on goal, and a goal arrives twice: a shot
// with isGoal, then a goal.

import { finalSuffix } from './scoreboard';
import { SHOOTOUT_PERIOD, isShootoutEvent } from './shootout';
import { isHighDanger, pwhlSummaryPenalty } from '../hooks/usePWHLPeriodSummary';

export { SHOOTOUT_PERIOD };

// 'Period 2' / 'P2', 'OT', '2OT' (a playoff second overtime is period 5:
// the shootout is 7, never 5).
export function htPeriodLabel(p) {
  if (p <= 3) return `Period ${p}`;
  return p === 4 ? 'OT' : `${p - 3}OT`;
}

export function htPeriodShort(p) {
  if (p <= 3) return `P${p}`;
  return p === 4 ? 'OT' : `${p - 3}OT`;
}

const isShootout = isShootoutEvent;

// The periods played, in order, the shootout left out.
export function summaryPeriods(events) {
  return [...new Set((events || []).filter(e => !isShootout(e)).map(e => e.period).filter(p => Number.isInteger(p) && p > 0))]
    .sort((a, b) => a - b);
}

// How the game was decided, for "Final/OT", "Final/SO": a shootout when
// there were shootout attempts, overtime when play went past period 3.
export function htEndedIn(events) {
  if ((events || []).some(isShootout)) return 'SO';
  return summaryPeriods(events).some(p => p > 3) ? 'OT' : null;
}

// Shots on goal and high-danger shots (within 15 ft of the net) for one
// period, or the game when period is null.
export function htShotStats(events, teamId, period = null) {
  let carSOG = 0, oppSOG = 0, carHDCF = 0, oppHDCF = 0;
  for (const e of events || []) {
    if (e.eventType !== 'shot' || isShootout(e)) continue;
    if (period != null && e.period !== period) continue;
    const isCar = e.teamId === teamId;
    if (isCar) carSOG++; else oppSOG++;
    if (isHighDanger(e)) { if (isCar) carHDCF++; else oppHDCF++; }
  }
  return { carSOG, oppSOG, carHDCF, oppHDCF };
}

const fullName = p => (p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || null : null);

// Each goalie's shots faced, goals against and saves -- in one period, or
// the game when period is null -- from the goalie named on each shot. The
// followed team's goalies first, each team's in the order they appeared.
// An empty-net goal's shot still names the goalie who'd been pulled
// (AHL 1029081: Petersen's 29th shot, his box score says 28), so it counts
// for no one: matched to its goal event by period, time and team.
export function htGoalieLines(events, teamId, period = null) {
  const lines = new Map();
  const goalKey = e => `${e.period}|${e.time}|${e.teamId}`;
  const emptyNet = new Set((events || []).filter(e => e.eventType === 'goal' && e.isEmptyNet).map(goalKey));
  for (const e of events || []) {
    if (e.eventType !== 'shot' || isShootout(e) || !e.goalie) continue;
    if (e.isGoal && emptyNet.has(goalKey(e))) continue;
    if (period != null && e.period !== period) continue;
    const id = e.goalie.id ?? fullName(e.goalie);
    if (id == null) continue;
    if (!lines.has(id)) lines.set(id, { name: fullName(e.goalie), isCar: e.teamId !== teamId, shots: 0, goalsAgainst: 0 });
    const line = lines.get(id);
    line.shots++;
    if (e.isGoal) line.goalsAgainst++;
  }
  const all = [...lines.values()].map(l => ({ ...l, saves: l.shots - l.goalsAgainst }));
  return [...all.filter(l => l.isCar), ...all.filter(l => !l.isCar)];
}

const withScheme = url => (url && !/^https?:\/\//.test(url) ? `https://${url}` : url || null);

// /{league}/summary's goal for a /live goal event: the same team at the
// same time on the clock, in the same period.
function htGoalFor(e, htSummary) {
  const period = (htSummary?.periods || []).find(p => Number(p.info?.id) === e.period);
  return (period?.goals || []).find(g => Number(g.team?.id) === e.teamId && g.time === e.time) || null;
}

function goalStrength(ht, e) {
  if (ht?.properties) {
    const p = ht.properties;
    return p.isPowerPlay === '1' ? 'pp' : p.isShortHanded === '1' ? 'sh' : p.isEmptyNet === '1' ? 'en' : 'ev';
  }
  if (e?.isPowerPlay == null && e?.isShortHanded == null && e?.isEmptyNet == null) return null;
  return e.isPowerPlay ? 'pp' : e.isShortHanded ? 'sh' : e.isEmptyNet ? 'en' : 'ev';
}

// One goal as the summaries list it. `headshotSize` is the league's
// LeagueStat headshot size (hockeyTechLeagues.js), in place of the feed's
// small 120x160.
export function htSummaryGoal(e, htSummary, teamId, headshotSize = '120x160') {
  const ht = htGoalFor(e, htSummary);
  const scorer = ht?.scoredBy || e.scoredBy;
  const assists = ht ? ht.assists : e.assists;
  const headshot = withScheme(ht?.scoredBy?.playerImageURL);
  return {
    isCar:      e.teamId === teamId,
    period:     e.period,
    time:       e.time || '—',
    scorerId:   scorer?.id ?? null,
    scorerName: fullName(scorer),
    scorerHeadshot: headshot ? headshot.replace('/120x160/', `/${headshotSize}/`) : null,
    assists: (assists || []).map(a => ({ name: { default: fullName(a) || '' } })),
    strength: goalStrength(ht, e),
  };
}

function threeStarsOf(htSummary) {
  return (htSummary?.mvps || []).map(mvp => ({
    name:       { default: fullName(mvp.player?.info) || '' },
    headshot:   withScheme(mvp.playerImage || mvp.player?.info?.playerImageURL),
    teamAbbrev: { default: mvp.team?.abbreviation || '' },
    stats:      mvp.player?.stats || {},
    isGoalie:   !!mvp.isGoalie,
  }));
}

// Home and away goals through `period` (the whole game when null): the
// summary's per-period goals when it has every period, else the goal events.
function scoreThrough(events, htSummary, homeTeamId, period = null) {
  const htPeriods = (htSummary?.periods || []).filter(p => period == null || Number(p.info?.id) <= period);
  const played = summaryPeriods(events).filter(p => period == null || p <= period);
  if (htPeriods.length && htPeriods.length >= played.length) {
    return {
      homeScore: htPeriods.reduce((s, p) => s + (p.stats?.homeGoals || 0), 0),
      awayScore: htPeriods.reduce((s, p) => s + (p.stats?.visitingGoals || 0), 0),
    };
  }
  const goals = (events || []).filter(e => e.eventType === 'goal' && !isShootout(e) && (period == null || e.period <= period));
  return {
    homeScore: goals.filter(e => e.teamId === homeTeamId).length,
    awayScore: goals.filter(e => e.teamId !== homeTeamId).length,
  };
}

function scoreFields(score, isHome) {
  return {
    homeScore: score.homeScore,
    awayScore: score.awayScore,
    isHome,
    carScore: isHome ? score.homeScore : score.awayScore,
    oppScore: isHome ? score.awayScore : score.homeScore,
  };
}

function common(events, teamId, period, gameId) {
  const shots = htShotStats(events, teamId, period);
  const inScope = e => !isShootout(e) && (period == null || e.period === period);
  const goalEvts = (events || []).filter(e => e.eventType === 'goal' && inScope(e));
  const penalties = (events || []).filter(e => e.eventType === 'penalty' && inScope(e)).map(e => pwhlSummaryPenalty(e, teamId));
  const goalies = htGoalieLines(events, teamId, period);
  return {
    ...shots,
    goalEvts,
    penalties,
    goalieLines: goalies,
    // The team's own goalies, for the AI summary.
    goalieNames: goalies.filter(g => g.isCar && g.name).map(g => g.name),
    gameId,
    teamId,
    generatedAt: Date.now(),
    aiNarrative: null,
    aiLoading:   true,
  };
}

// One period's summary.
export function buildHockeyTechSummary(period, { events, teamId, htSummary, gameId, homeTeamId, headshotSize }) {
  const { goalEvts, ...base } = common(events, teamId, period, gameId);
  const goals = goalEvts.map(e => htSummaryGoal(e, htSummary, teamId, headshotSize));
  const lastPeriod = summaryPeriods(events).at(-1);
  return {
    ...base,
    period,
    periodLabel:   htPeriodLabel(period),
    periodShort:   htPeriodShort(period),
    isGameSummary: false,
    carGoals: goals.filter(g => g.isCar).length,
    oppGoals: goals.filter(g => !g.isCar).length,
    carPPGoals: goals.filter(g => g.isCar && g.strength === 'pp').length,
    oppPPGoals: goals.filter(g => !g.isCar && g.strength === 'pp').length,
    goals,
    threeStars: period === lastPeriod ? threeStarsOf(htSummary) : [],
    ...scoreFields(scoreThrough(events, htSummary, homeTeamId, period), homeTeamId === teamId),
  };
}

// The power play from HockeyTech's own team stats: { carGoals, carOpps,
// oppGoals, oppOpps }, or null when the summary has none.
export function htPowerPlay(htSummary, isHome) {
  const home = htSummary?.homeTeamStats, away = htSummary?.visitingTeamStats;
  const car = isHome ? home : away, opp = isHome ? away : home;
  const n = v => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);
  if (n(car?.powerPlayOpportunities) == null || n(opp?.powerPlayOpportunities) == null) return null;
  return {
    carGoals: n(car.powerPlayGoals) ?? 0, carOpps: n(car.powerPlayOpportunities),
    oppGoals: n(opp.powerPlayGoals) ?? 0, oppOpps: n(opp.powerPlayOpportunities),
  };
}

// The best and worst period by shots on goal: the widest margin each way.
// Only periods with a shot; ties go to the earlier period.
export function htBestWorstPeriods(periodStats) {
  const ranked = (periodStats || []).filter(p => p.carSOG + p.oppSOG > 0);
  if (!ranked.length) return { bestPeriod: null, worstPeriod: null };
  const margin = p => p.carSOG - p.oppSOG;
  const pick = p => ({ period: p.period, carSOG: p.carSOG, oppSOG: p.oppSOG });
  const best = ranked.reduce((a, b) => (margin(b) > margin(a) ? b : a));
  const worst = ranked.reduce((a, b) => (margin(b) < margin(a) ? b : a));
  return { bestPeriod: pick(best), worstPeriod: pick(worst) };
}

// The final's summary. homeScore/awayScore: the final score (/live's,
// which counts the shootout winner's goal no goal event carries).
export function buildHockeyTechGameSummary({ events, teamId, htSummary, gameId, homeTeamId, homeScore, awayScore, headshotSize }) {
  const { goalEvts, ...base } = common(events, teamId, null, gameId);
  const goals = goalEvts.map(e => htSummaryGoal(e, htSummary, teamId, headshotSize));
  const isHome = homeTeamId === teamId;
  const periodStats = summaryPeriods(events).map(p => {
    const s = htShotStats(events, teamId, p);
    const g = goals.filter(x => x.period === p);
    return {
      period: p, periodShort: htPeriodShort(p),
      carSOG: s.carSOG, oppSOG: s.oppSOG,
      carGoals: g.filter(x => x.isCar).length, oppGoals: g.filter(x => !x.isCar).length,
    };
  });
  const endedIn = htEndedIn(events);
  const score = Number.isFinite(homeScore) && Number.isFinite(awayScore)
    ? { homeScore, awayScore }
    : scoreThrough(events, htSummary, homeTeamId);
  return {
    ...base,
    period:        'game',
    periodLabel:   `Final${finalSuffix(endedIn)}`,
    periodShort:   `FINAL${finalSuffix(endedIn)}`,
    isGameSummary: true,
    endedIn,
    carGoals: goals.filter(g => g.isCar).length,
    oppGoals: goals.filter(g => !g.isCar).length,
    goals,
    periodStats,
    ...htBestWorstPeriods(periodStats),
    powerPlay: htPowerPlay(htSummary, isHome),
    threeStars: threeStarsOf(htSummary),
    ...scoreFields(score, isHome),
  };
}

// What /{league}/summary/narrative is sent (contract C8): the PWHL keys
// minus Corsi, and no hits or faceoffs (the box scores carry 0 for both).
// A stat with no value is left out (undefined drops from the JSON), never
// sent as 0.
export function hockeyTechNarrativePayload(summary, { carAbbr, oppAbbr, carName, oppName }) {
  return {
    carAbbr,
    oppAbbr,
    carName:         carName || carAbbr,
    oppName:         oppName || oppAbbr,
    periodLabel:     summary.periodLabel,
    carSOG:          summary.carSOG,
    oppSOG:          summary.oppSOG,
    carGoals:        summary.carGoals,
    oppGoals:        summary.oppGoals,
    carHDCF:         summary.carHDCF,
    oppHDCF:         summary.oppHDCF,
    penaltyCount:    summary.penalties?.length ?? 0,
    carPenaltyCount: summary.penalties?.filter(p => p.isCar).length ?? 0,
    bestPeriod:      summary.bestPeriod ?? undefined,
    worstPeriod:     summary.worstPeriod ?? undefined,
    goalieNames:     summary.goalieNames || [],
    goals: (summary.goals || []).map(g => ({
      isCar: g.isCar, scorerName: g.scorerName, time: g.time, period: g.period, strength: g.strength,
    })),
  };
}
