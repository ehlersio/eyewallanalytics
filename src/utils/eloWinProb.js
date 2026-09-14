// Elo win probability -- the exact formula the Worker's /prediction/analyze
// (eloWinProb() in eyewall-poller's nhl.js) and eyewall-pipeline's
// win_probs.py use, fed by the Worker's /elo/ratings. What the game preview's
// win bar and the schedule's chips show is what the public prediction
// scorecard grades (win_probs.py logs this same number the morning of every
// game). Plain probabilities -- no betting framing.

// Rating for a team with no row yet -- the same default the Worker's
// fetchEloRatings() and the pipeline's elo_ratings.py use.
const DEFAULT_RATING = 1500;
const DEFAULT_HOME_ADVANTAGE = 35;

// The home team's win probability (0-1). No home advantage at a neutral site.
export function homeWinProb(homeRating, awayRating, homeAdvantage, neutral = false) {
  const advantage = neutral ? 0 : homeAdvantage;
  return 1 / (1 + Math.pow(10, (awayRating - (homeRating + advantage)) / 400));
}

// { ratings, homeAdvantage } from /elo/ratings + an NHL schedule game + a
// team abbreviation -> that team's win % (integer 0-100). null when the
// ratings aren't available, or the team isn't playing in this game.
export function teamWinPct(elo, game, teamAbbr) {
  if (!elo || elo.unavailable || !elo.ratings || !Object.keys(elo.ratings).length) return null;
  const home = game?.homeTeam?.abbrev;
  const away = game?.awayTeam?.abbrev;
  if (!home || !away || (teamAbbr !== home && teamAbbr !== away)) return null;
  const p = homeWinProb(
    elo.ratings[home] ?? DEFAULT_RATING,
    elo.ratings[away] ?? DEFAULT_RATING,
    elo.homeAdvantage ?? DEFAULT_HOME_ADVANTAGE,
    !!game.neutralSite,
  );
  return Math.round((teamAbbr === home ? p : 1 - p) * 100);
}
