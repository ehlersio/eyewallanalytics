// src/utils/pwhlPlayoffs.js
// PWHL playoff formats and brackets, kept out of PWHLLeagueView.jsx so
// they can be unit-tested.
//
// Two formats so far:
//   - Through 2025-26 (8 teams): the top 4 overall, semifinals and the
//     Walter Cup Final, every series best-of-5.
//   - From 2026-27 (12 teams, season_id 11 on): the top 4 in each
//     conference (East/West, see pwhlConfig.js). Quarterfinals best-of-3,
//     conference finals and the Final best-of-5; the 1st seed in each
//     conference picks its quarterfinal opponent from the 3rd and 4th
//     (thepwhl.com, 2026-10-02 -- AP reported best-of-5 quarterfinals; the
//     league's own release says best-of-3).

// The first season_id played in conferences. HockeyTech's ids only grow,
// so every later regular season and playoffs id is past it too.
export const PWHL_CONFERENCE_FIRST_SEASON = 11;
export const PWHL_CONFERENCES = ['East', 'West'];

export function pwhlUsesConferences(seasonId) {
  return Number(seasonId) >= PWHL_CONFERENCE_FIRST_SEASON;
}

// Each round's key (for its heading) and the wins that take a series.
export function pwhlPlayoffFormat(seasonId) {
  return pwhlUsesConferences(seasonId)
    ? { byConference: true, perConference: 4, rounds: [
      { key: 'quarterfinals', winsNeeded: 2 },
      { key: 'conferenceFinals', winsNeeded: 3 },
      { key: 'final', winsNeeded: 3 },
    ] }
    : { byConference: false, qualifiers: 4, rounds: [
      { key: 'semifinals', winsNeeded: 3 },
      { key: 'final', winsNeeded: 3 },
    ] };
}

// Points percentage, then the PWHL's playoff tiebreakers that the
// standings rows carry: regulation wins, then regulation + OT wins, then
// total wins (www.thepwhl.com/en/playoff-tiebreaker-procedure; head-to-head
// comes next, and needs game data these rows don't have).
function seedOrder(a, b) {
  const pct = r => (r.gp ? (r.points ?? 0) / (r.gp * 3) : 0);
  return pct(b) - pct(a)
    || (b.reg_wins ?? 0) - (a.reg_wins ?? 0)
    || (b.reg_wins ?? 0) + (b.non_reg_wins ?? 0) - (a.reg_wins ?? 0) - (a.non_reg_wins ?? 0)
    || (b.points ?? 0) - (a.points ?? 0);
}

// A conference's standings rows, best first.
export function rankPWHLConference(standings, conference, conferenceOf) {
  return (standings || []).filter(r => conferenceOf(r.team_id) === conference).sort(seedOrder);
}

// "If the playoffs started today" for a conference season: per conference
// 1 v 4 and 2 v 3 (the 1st seed really chooses between 3 and 4, which no
// projection can know), then the conference final and the Walter Cup Final
// left open. null before any game is played, or without four teams a side.
export function projectPWHLBracket(standings, conferenceOf) {
  if (!(standings || []).some(r => r.gp > 0)) return null;
  const sides = {};
  for (const conf of PWHL_CONFERENCES) {
    const top = rankPWHLConference(standings, conf, conferenceOf).slice(0, 4);
    if (top.length < 4) return null;
    const pair = (a, b, seedA, seedB) => ({
      teamA: a.team_id, teamB: b.team_id, seedA, seedB, games: [], winsA: 0, winsB: 0,
    });
    sides[conf] = [
      [pair(top[0], top[3], 1, 4), pair(top[1], top[2], 2, 3)],
      [null],
    ];
  }
  return { sides, final: null, projected: true };
}

// Series from finished playoff games: one per pair of teams, wins counted,
// ordered by when each series started.
export function buildPWHLSeries(games) {
  const byPair = {};
  for (const g of games || []) {
    if (g.game_state !== 'Final') continue;
    const ids = [g.home_team_id, g.away_team_id].sort((a, b) => a - b);
    const key = ids.join('-');
    if (!byPair[key]) byPair[key] = { key, teamA: ids[0], teamB: ids[1], games: [], winsA: 0, winsB: 0 };
    byPair[key].games.push(g);
    const homeWon = g.home_score > g.away_score;
    if (homeWon === (g.home_team_id === ids[0])) byPair[key].winsA++;
    else byPair[key].winsB++;
  }
  const firstGame = s => Math.min(...s.games.map(g => g.game_id));
  return Object.values(byPair).sort((a, b) => firstGame(a) - firstGame(b));
}

// A conference season's real bracket: within each conference its first two
// series are the quarterfinals and the next is the conference final; the
// one series between conferences is the Walter Cup Final. Slots not reached
// yet stay null.
export function arrangePWHLConferenceBracket(series, conferenceOf) {
  const sides = {};
  for (const conf of PWHL_CONFERENCES) {
    const own = series.filter(s => conferenceOf(s.teamA) === conf && conferenceOf(s.teamB) === conf);
    sides[conf] = [
      [own[0] ?? null, own[1] ?? null],
      [own[2] ?? null],
    ];
  }
  const final = series.find(s => conferenceOf(s.teamA) !== conferenceOf(s.teamB)) ?? null;
  return { sides, final, projected: false };
}
