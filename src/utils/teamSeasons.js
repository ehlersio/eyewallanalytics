// utils/teamSeasons.js
// Which seasons the selected team actually has games in, so a PWHL/AHL/ECHL
// season picker never offers a season that shows nothing. The league season
// lists (pwhlConfig/ahlConfig/echlConfig) are league-wide: PWHL's 2026-27
// expansion teams (DET/HAM/LV/SJS) have no 2025-26 or earlier games, SEA
// and VAN none before 2025-26, AHL Hamilton none before 2026-27, and
// ECHL's 2026-27 schedule isn't ingested until that season is current.
//
// Read from the team's own schedule (game_log rows): one small, cached
// request per season (see useTeamSeasonGames).

// { games, finals } for one season's schedule rows, or null when the
// request failed -- unknown, not empty.
export function summarizeSeasonGames(rows) {
  if (!Array.isArray(rows)) return null;
  return {
    games: rows.length,
    finals: rows.filter(g => g.game_state === 'Final').length,
  };
}

// Whether the team has games in `seasonId`: true/false, or null when not
// known (still loading, never asked, or the request failed). `played`
// counts finished games only -- what stats views (players, shot map) need;
// a schedule needs any game, played or not.
export function teamHasGames(counts, seasonId, { played = false } = {}) {
  const c = counts?.[seasonId];
  if (c == null) return null;
  return played ? c.finals > 0 : c.games > 0;
}

// The seasons in `seasons` (order kept) the team has games in. Nothing
// while `counts` is still loading, so an empty season is never shown even
// for a moment; a season whose schedule couldn't be read stays offered.
export function seasonsWithGames(seasons, counts, opts) {
  if (!counts) return [];
  return seasons.filter(s => teamHasGames(counts, s.id, opts) !== false);
}

// The season to show: `current` unless the team is known to have no games
// in it, else the first offered regular season (the lists are newest
// first), else the first offered season of any type. Nothing offered
// keeps `current`, whose own empty state then says so.
export function fallbackSeason(current, offered, counts, opts) {
  if (teamHasGames(counts, current, opts) !== false) return current;
  const target = offered.find(s => s.type === 'regular') ?? offered[0];
  return target ? target.id : current;
}
