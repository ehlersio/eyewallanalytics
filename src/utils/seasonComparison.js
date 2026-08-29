// utils/seasonComparison.js
//
// Pure helpers for the season-over-season comparison feature (Session 64).
// /config/seasons/comparison returns two different season shapes — NHL:
// {season, teamCount, comparable}; PWHL: {seasonId, seasonType, startYear,
// teamCount, comparable} — this file normalizes both into one common shape
// (SeasonComparisonPicker and its consumers don't need to care which league
// they're looking at) and derives display labels.
//
// Deliberately has zero React/fetch dependencies so it's covered by plain
// vitest unit tests, same convention as statFormatting.js / rolling.js.

// "20252026" -> "2025-26". NHL's season identifier already encodes both
// years back-to-back, so no separate startYear field is needed the way
// PWHL has one.
export function nhlSeasonLabel(season) {
  const s = String(season);
  return `${s.slice(0, 4)}-${s.slice(6, 8)}`;
}

// Mirrors the label format eyewall-poller/pwhlConfig.js's PWHL_SEASON_LABEL
// / PWHL_SEASONS already use elsewhere in this app ("2025-26 Playoffs" etc)
// — same string shape, so a comparison label reads identically to every
// other season label in the UI. startYear/seasonType can be null (a season
// with team_seasons rows that HockeyTech's live bootstrap doesn't currently
// describe, e.g. PWHL season_id 3 as of Session 64) — falls back to a bare
// "Season N" rather than showing "undefined-NaN".
export function pwhlSeasonLabel({ seasonId, seasonType, startYear }) {
  if (!startYear) return `Season ${seasonId}`;
  const base = `${startYear}-${String(startYear + 1).slice(2)}`;
  if (seasonType === 'playoffs')  return `${base} Playoffs`;
  if (seasonType === 'preseason') return `${base} Preseason`;
  return base;
}

// Same {startYear, seasonType} shape as pwhlSeasonLabel, but a real
// AHL-specific format difference for playoffs: AHL's own convention names
// a playoffs season by the single calendar year it's played in ("2026
// Playoffs", per ahlConfig.js's hand-verified AHL_SEASONS list and
// eyewall-pipeline's docs -- "2026 Calder Cup Playoffs"), not PWHL's
// season-range format ("2025-26 Playoffs"). startYear for a playoffs
// season_id is already that single year (derived server-side from that
// entry's own start_date, which for playoffs falls in the spring
// following the regular season's own start_date year) -- no adjustment
// needed, just a different template than the regular-season branch below.
export function ahlSeasonLabel({ seasonId, seasonType, startYear }) {
  if (!startYear) return `Season ${seasonId}`;
  if (seasonType === 'playoffs') return `${startYear} Playoffs`;
  const base = `${startYear}-${String(startYear + 1).slice(2)}`;
  if (seasonType === 'preseason') return `${base} Preseason`;
  return base;
}

// Normalizes one league's /config/seasons/comparison `seasons` array into
// { value, label, comparable, teamCount, seasonType }. `value` is the
// identifier a consumer passes back to whatever route it calls for that
// season's stats — NHL: the season number (e.g. 20252026); PWHL/AHL: the
// season_id (e.g. 8, 90).
export function normalizeComparisonSeasons(league, seasons = []) {
  if (league === 'ahl') {
    return seasons.map(s => ({
      value: s.seasonId,
      label: ahlSeasonLabel(s),
      comparable: s.comparable,
      teamCount: s.teamCount,
      seasonType: s.seasonType,
    }));
  }
  if (league === 'pwhl') {
    return seasons.map(s => ({
      value: s.seasonId,
      label: pwhlSeasonLabel(s),
      comparable: s.comparable,
      teamCount: s.teamCount,
      seasonType: s.seasonType,
    }));
  }
  return seasons.map(s => ({
    value: s.season,
    label: nhlSeasonLabel(s.season),
    comparable: s.comparable,
    teamCount: s.teamCount,
    seasonType: 'regular', // NHL has no type dimension in this response -- every row here is a regular-season row (game_type=2, set by the poller endpoint)
  }));
}
