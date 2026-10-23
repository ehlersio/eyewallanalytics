// utils/nhlShootout.js
// An NHL shootout, attempt by attempt, from the game's play-by-play.
//
// The feed logs the shootout as its own period (periodType 'SO', see
// gamePlays.js), every attempt at 0:00: a 'goal', a 'shot-on-goal' (the
// goalie stopped it), a 'missed-shot' (with a reason: wide-left,
// hit-crossbar...) or a 'failed-shot-attempt' (the shooter lost the puck
// and never got a shot away). The game score on those plays never moves,
// so the shootout's own tally is counted here from the goals.
//
// Not the landing endpoint's summary.shootout: it calls every attempt
// that isn't a goal a "save", misses and lost pucks included.

import { isShootoutPlay } from './gamePlays';

const RESULTS = {
  'goal':                'goal',
  'shot-on-goal':        'save',
  'missed-shot':         'miss',
  'failed-shot-attempt': 'noShot',
};

const DONE_STATES = new Set(['OFF', 'FINAL']);

// Each player's name and headshot, from the roster the play-by-play
// carries (goalies included). A player missing from it gets no name
// rather than a made-up one.
function rosterIndex(pbp) {
  const byId = {};
  for (const r of pbp?.rosterSpots || []) {
    const name = [r.firstName?.default, r.lastName?.default].filter(Boolean).join(' ').trim();
    byId[String(r.playerId)] = { name: name || null, headshot: r.headshot || null };
  }
  return byId;
}

function shootoutPlays(pbp) {
  return (pbp?.plays || []).filter(isShootoutPlay);
}

// Decided: the feed posts 'shootout-complete' once it is, and a game that
// is over can't have a shootout still going.
function shootoutDecided(pbp, soPlays) {
  if (!soPlays.length) return false;
  return soPlays.some(p => p.typeDescKey === 'shootout-complete') || DONE_STATES.has(pbp?.gameState);
}

export function shootoutAttempts(pbp) {
  const soPlays = shootoutPlays(pbp);
  if (!soPlays.length) return [];
  const roster = rosterIndex(pbp);
  const homeId = pbp?.homeTeam?.id ?? null;
  const awayId = pbp?.awayTeam?.id ?? null;
  const person = id => (id != null ? roster[String(id)] : null) || null;

  const perTeam = {};
  let homeGoals = 0;
  let awayGoals = 0;
  const attempts = [];
  for (const p of soPlays) {
    const result = RESULTS[p.typeDescKey];
    if (!result) continue;
    const d = p.details || {};
    const teamId = d.eventOwnerTeamId ?? null;
    const shooterId = (result === 'goal' ? d.scoringPlayerId : d.shootingPlayerId) ?? null;
    const goalieId = d.goalieInNetId ?? null;
    perTeam[teamId] = (perTeam[teamId] || 0) + 1;
    if (result === 'goal') {
      if (teamId === homeId) homeGoals++;
      else if (teamId === awayId) awayGoals++;
    }
    attempts.push({
      eventId: p.eventId,
      sequence: attempts.length + 1,
      round: perTeam[teamId],
      teamId,
      shooterId,
      shooterName: person(shooterId)?.name ?? null,
      shooterHeadshot: person(shooterId)?.headshot ?? null,
      goalieId,
      goalieName: person(goalieId)?.name ?? null,
      shotType: result === 'noShot' ? null : (d.shotType || null),
      result,
      reason: result === 'miss' ? (d.reason || null) : null,
      homeGoals,
      awayGoals,
      gameWinner: false,
    });
  }

  // The winner's last goal decided it -- only once the shootout is over.
  // While it's going, no goal is the winner yet.
  if (shootoutDecided(pbp, soPlays) && homeGoals !== awayGoals) {
    const winnerId = homeGoals > awayGoals ? homeId : awayId;
    for (let i = attempts.length - 1; i >= 0; i--) {
      if (attempts[i].result === 'goal' && attempts[i].teamId === winnerId) {
        attempts[i].gameWinner = true;
        break;
      }
    }
  }
  return attempts;
}

export function shootoutSummary(pbp) {
  const soPlays = shootoutPlays(pbp);
  const isShootout = soPlays.length > 0;
  const complete = shootoutDecided(pbp, soPlays);
  const attempts = shootoutAttempts(pbp);
  const homeId = pbp?.homeTeam?.id ?? null;
  const awayId = pbp?.awayTeam?.id ?? null;

  const byTeam = {};
  if (homeId != null) byTeam[homeId] = [];
  if (awayId != null) byTeam[awayId] = [];
  const goalieFor = {};
  for (const a of attempts) {
    (byTeam[a.teamId] ||= []).push(a);
    // The goalie this team shoots against: the latest one it faced, in
    // case the other side changed goalies mid-shootout.
    if (a.goalieId != null) goalieFor[a.teamId] = { id: a.goalieId, name: a.goalieName };
  }

  const last = attempts.at(-1);
  const tally = { home: last?.homeGoals ?? 0, away: last?.awayGoals ?? 0 };
  const homeCount = byTeam[homeId]?.length ?? 0;
  const awayCount = byTeam[awayId]?.length ?? 0;
  const round = Math.max(0, ...Object.values(byTeam).map(list => list.length));

  let winnerTeamId = null;
  if (complete && tally.home !== tally.away) winnerTeamId = tally.home > tally.away ? homeId : awayId;

  // Who shoots next while it's going: the team a shot behind, or with the
  // shots even, the team that didn't just shoot. Unknown before the first.
  let nextTeamId = null;
  if (!complete && last) {
    if (homeCount !== awayCount) nextTeamId = homeCount < awayCount ? homeId : awayId;
    else nextTeamId = last.teamId === homeId ? awayId : last.teamId === awayId ? homeId : null;
  }

  return { isShootout, complete, attempts, byTeam, tally, round, goalieFor, winnerTeamId, nextTeamId };
}

// One team's shootout goals against the other's.
export function shootoutScoreFor(summary, teamId) {
  const total = (summary?.tally?.home ?? 0) + (summary?.tally?.away ?? 0);
  const own = (summary?.byTeam?.[teamId] || []).filter(a => a.result === 'goal').length;
  return { team: own, opp: total - own };
}

// The miss reasons seen in the feed (and a few more it's documented to
// send), each with a label. The feed can send others.
const REASON_KEYS = {
  'wide-left':           'wideLeft',
  'wide-right':          'wideRight',
  'high-and-wide-left':  'highAndWideLeft',
  'high-and-wide-right': 'highAndWideRight',
  'over-net':            'overNet',
  'hit-left-post':       'hitLeftPost',
  'hit-right-post':      'hitRightPost',
  'hit-crossbar':        'hitCrossbar',
  'short':               'short',
  'blocked':             'blocked',
};

// The i18n key for a known reason (the short form fits under a shooter's
// headshot), or null for one the app has no label for.
export function missReasonKey(reason, { short = false } = {}) {
  const k = REASON_KEYS[reason];
  if (!k) return null;
  return `shotMapView.shootout.${short ? 'reasonsShort' : 'reasons'}.${k}`;
}

// What the UI shows: the label, or for a reason the app doesn't know the
// feed's own words ("hit-glass" -> "hit glass") rather than nothing.
export function missReasonLabel(reason, t, opts) {
  if (!reason) return null;
  const key = missReasonKey(reason, opts);
  return key ? t(key) : String(reason).replace(/-/g, ' ');
}
