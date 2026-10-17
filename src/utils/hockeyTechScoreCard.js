// utils/hockeyTechScoreCard.js
// The AHL/ECHL Shot Map score card's numbers (HockeyTechShotMapView.jsx),
// from the followed (or guest) team's side, out of whichever source the
// view has for the game on screen:
//   - scoreCardFromToday(): a live game's /{league}/today row (its score
//     already freshened from /live by hockeyTechLiveStore.js).
//   - scoreCardFromScheduleRow(): a final from /{league}/schedule
//     (game_log), which carries ended_in.
//   - scoreCardFromLive(): a final known only from its /{league}/live
//     payload (a game that just ended, or a guest view's game before
//     game_log has it). /live has no ended_in, so OT/SO is read from its
//     events, as PWHLShotMapView's finalFromLive() does: a shootout attempt
//     means SO, any other event past the 3rd period means OT.
// Each returns null when the team isn't in the game or the source doesn't
// say enough -- the card then shows no score rather than a guess.
//
// Shape: { state: 'live' | 'final', isHome, myScore, oppScore, oppId,
//          oppCode, endedIn, won }
// oppCode is the feed's own team code (/today only; null otherwise -- the
// view looks the opponent up by id). endedIn is 'OT' | 'SO' | null, and
// null while live. won is null while live.

// A score as a number, or NaN when the source has none (never a 0 it
// didn't send).
function score(v) {
  return v === null || v === undefined || v === '' ? NaN : Number(v);
}

function side(homeId, awayId, teamId) {
  if (teamId == null) return null;
  const id = String(teamId);
  if (String(homeId) === id) return true;
  if (String(awayId) === id) return false;
  return null;
}

export function scoreCardFromToday(game, teamId) {
  if (!game || game.status !== 'live') return null;
  const isHome = side(game.homeTeamId, game.awayTeamId, teamId);
  if (isHome == null) return null;
  return {
    state: 'live',
    isHome,
    myScore:  isHome ? game.homeScore : game.awayScore,
    oppScore: isHome ? game.awayScore : game.homeScore,
    oppId:    isHome ? game.awayTeamId : game.homeTeamId,
    oppCode:  (isHome ? game.awayTeamCode : game.homeTeamCode) || null,
    endedIn:  null,
    won:      null,
  };
}

export function scoreCardFromScheduleRow(row, teamId) {
  if (!row || row.game_state !== 'Final') return null;
  const isHome = side(row.home_team_id, row.away_team_id, teamId);
  if (isHome == null) return null;
  const myScore  = score(isHome ? row.home_score : row.away_score);
  const oppScore = score(isHome ? row.away_score : row.home_score);
  if (!Number.isFinite(myScore) || !Number.isFinite(oppScore)) return null;
  return {
    state: 'final',
    isHome,
    myScore,
    oppScore,
    oppId:   isHome ? row.away_team_id : row.home_team_id,
    oppCode: null,
    endedIn: row.ended_in === 'OT' || row.ended_in === 'SO' ? row.ended_in : null,
    won:     myScore > oppScore,
  };
}

// 'OT' | 'SO' | null from a /live payload's events.
export function endedInFromLiveEvents(events) {
  if (!Array.isArray(events)) return null;
  if (events.some(e => e?.eventType === 'shootout')) return 'SO';
  if (events.some(e => Number(e?.period) > 3)) return 'OT';
  return null;
}

export function scoreCardFromLive(live, teamId) {
  if (!live || live.gameStatus !== 'final') return null;
  const isHome = side(live.homeTeamId, live.awayTeamId, teamId);
  if (isHome == null) return null;
  const myScore  = score(isHome ? live.homeScore : live.awayScore);
  const oppScore = score(isHome ? live.awayScore : live.homeScore);
  if (!Number.isFinite(myScore) || !Number.isFinite(oppScore)) return null;
  return {
    state: 'final',
    isHome,
    myScore,
    oppScore,
    oppId:   isHome ? live.awayTeamId : live.homeTeamId,
    oppCode: null,
    endedIn: endedInFromLiveEvents(live.events),
    won:     myScore > oppScore,
  };
}
