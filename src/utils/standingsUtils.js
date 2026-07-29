// src/utils/standingsUtils.js
// Shared staleness check for the live standings feed, used by ScheduleView,
// TeamView, LeagueView, and PlayersView.
//
// The NHL's /standings/now stays pinned to last season's final standings for
// months after our season config flips (confirmed live). Every row carries
// its own seasonId, so compare that against the resolved current season
// rather than trusting the feed to mean "this season" -- otherwise a full
// prior season's record (real GF/GA, PP%/PK%, streak, division/conference)
// silently gets surfaced as if it were this season's.
//
// Only reject on an EXPLICIT mismatch: an absent seasonId (e.g. a test
// stub) isn't evidence of staleness -- the real NHL API always includes it.
export function isStandingsStale(standings, season) {
  const seasonId = standings?.[0]?.seasonId;
  return seasonId != null && String(seasonId) !== String(season);
}
