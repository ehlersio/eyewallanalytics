// utils/hockeyTechPenalty.js
// Who a PWHL/AHL/ECHL (HockeyTech) penalty is against, in penaltyText.js's
// parties shape, so penaltyHeadline / penaltyServedBy read it the same way
// they read an NHL play.
//
// HockeyTech marks a bench penalty (too many players, a bench delay of
// game) with isBench and a takenBy that names no one -- id null, first and
// last name '' -- plus a servedBy naming the skater in the box (PWHL game
// 212, 2025-11-22, P1 10:45: OTT "Too Many Players", served by Fanuza
// Kadirova). Lists joined takenBy's empty names into '' and showed
// "Unknown". servedBy also differs from takenBy on a player's own major or
// a goalie's minor (game 226, P3 6:12: Gwyneth Philips, served by Anna
// Shokhina).
//
// The description is HockeyTech's own text ("Too Many Players", "Major -
// Check to the Head"), already readable, so it isn't run through
// penaltyDescription's NHL descKey map.

function fullName(p) {
  if (!p) return null;
  return `${p.firstName || ''} ${p.lastName || ''}`.trim() || null;
}

function parties({ committedId, committedName, servedId, servedName, isBench, minutes }) {
  const sameAsCommitted = committedId != null && servedId != null
    ? servedId === committedId
    : servedName === committedName;
  // A bench penalty, or one whose takenBy has neither an id nor a name.
  const teamPenalty = !committedName && (isBench === true || committedId == null);
  return {
    committedName,
    servedByName: servedName && !sameAsCommitted ? servedName : null,
    teamPenalty,
    benchMinor:   teamPenalty && isBench === true && (minutes == null || minutes === 2),
  };
}

// A live penalty event (/pwhl|ahl|echl/live/:gameId):
//   { takenBy: { id, firstName, lastName }, servedBy: {...}, isBench, minutes }
export function hockeyTechPenaltyParties(ev) {
  const takenId = ev?.takenBy?.id ?? null;
  return parties({
    committedId:   takenId,
    committedName: fullName(ev?.takenBy),
    servedId:      ev?.servedBy?.id ?? null,
    servedName:    fullName(ev?.servedBy),
    isBench:       ev?.isBench,
    minutes:       ev?.minutes,
  });
}

// A stored PBP row (/pwhl/pbp): player_* is who took it (player_id 0 on a
// bench penalty), secondary_player_* who serves it.
export function hockeyTechRowPenaltyParties(row) {
  const committedId = row?.player_id ? row.player_id : null;
  return parties({
    committedId,
    committedName: row?.player_name?.trim() || null,
    servedId:      row?.secondary_player_id || null,
    servedName:    row?.secondary_player_name?.trim() || null,
    isBench:       row?.is_bench_penalty,
    minutes:       row?.penalty_minutes,
  });
}
