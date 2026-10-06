// utils/boxScoreNames.js
//
// player_id -> name for the PWHL/AHL/ECHL game-stats popups' box scores.
// The Worker's /{league}/game-box rows carry player_name, taken from that
// game's own HockeyTech lineup, so a player who has since changed teams is
// still named. The two teams' current rosters (/{league}/roster) are only
// a fallback for a row without one -- an older Worker response (the PWHL
// route carried no names at all) or a player HockeyTech didn't list. A
// player neither knows stays out of the map; the box score table shows
// its own jersey-number placeholder for those.

function rosterName(p) {
  const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
  return name || null;
}

// Every box row (skaters + goalies) of a /game-box response.
function boxRows(box) {
  return [...(box?.skaters || []), ...(box?.goalies || [])];
}

// True once the box score has loaded and some row has no player_name, i.e.
// the rosters are worth fetching.
export function boxNeedsRosters(box) {
  return !!box && boxRows(box).some(r => !r.player_name);
}

// { [player_id]: name }: the row's own player_name first, then the
// rosters (an array of /roster responses, any of them null) for the rest.
export function boxScoreNames(box, rosters) {
  const map = {};
  (rosters || []).forEach(roster => {
    (roster || []).forEach(p => {
      const name = rosterName(p);
      if (name) map[p.player_id] = name;
    });
  });
  boxRows(box).forEach(r => {
    if (r.player_name) map[r.player_id] = r.player_name;
  });
  return map;
}
