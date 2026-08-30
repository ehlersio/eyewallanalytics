// utils/ahlApi.js
// AHL API utility — parallel to pwhlApi.js. All requests go through the
// Cloudflare Worker (/ahl/* endpoints). Only covers the routes that exist
// (see eyewall-poller's src/ahl.js) — no transactions/salaries/scouting/
// narrative/live-tracking endpoints exist for AHL yet, unlike PWHL.

import { getAHLStoredTeam, AHL_CURRENT_SEASON } from './ahlConfig';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;

// ── Active team ───────────────────────────────────────────────────────────────
export const AHL_TEAM_CONFIG = getAHLStoredTeam();
export const AHL_TEAM_ABBR = AHL_TEAM_CONFIG?.abbr || null;
export const AHL_TEAM_ID = AHL_TEAM_CONFIG?.teamId || null;

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function workerFetch(path) {
  if (!WORKER_URL) {
    console.warn('ahlApi: VITE_WORKER_URL not set');
    return null;
  }
  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`ahlApi ${res.status}: ${path}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('ahlApi fetch error:', path, err.message);
    return null;
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function fetchAHLStandings(season = AHL_CURRENT_SEASON) {
  return workerFetch(`/ahl/standings?season=${season}`);
}

/** Fetch all teams' skaters + goalies for the Leaders tab. */
export async function fetchAHLLeaguePlayers(season = AHL_CURRENT_SEASON) {
  return workerFetch(`/ahl/league-players?season=${season}`);
}

export async function fetchAHLPlayers(teamId = AHL_TEAM_ID, season = AHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/ahl/players?teamId=${teamId}&season=${season}`);
}

/** Shot-map data — shot/goal events with coordinates. No blocked_shot event
 * type exists in this data source (see eyewall-poller's ahl.js) — this is
 * a strict subset of what /pwhl/shots returns. */
export async function fetchAHLShots(teamId = AHL_TEAM_ID, season = AHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/ahl/shots?teamId=${teamId}&season=${season}`);
}

export async function fetchAHLLastGame(teamId = AHL_TEAM_ID, season = AHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/ahl/lastgame?teamId=${teamId}&season=${season}`);
}

/**
 * Season-over-season team comparison, for TeamComparisonPopup's shared
 * "vs Season" mode -- mirrors fetchPWHLTeamSeasonsCompare's normalized
 * camelCase shape exactly so the same UI component renders any league's
 * response with no per-league branch beyond the fetch call itself.
 * otLosses combines ot_losses + shootout_losses (AHL splits these into
 * two columns; PWHL/NHL don't) -- kept as one combined number here so the
 * shared METRICS list's single "OTL" row means the same thing (any
 * non-regulation loss) regardless of league.
 */
export async function fetchAHLTeamSeasonsCompare(teamId, seasons) {
  if (!teamId || !seasons?.length) return [];
  const rows = await workerFetch(`/ahl/team-seasons/compare?teamId=${teamId}&seasons=${seasons.join(',')}`);
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    season:        r.season_id,
    gamesPlayed:   r.gp,
    wins:          r.wins,
    losses:        r.losses,
    otLosses:      (r.ot_losses ?? 0) + (r.shootout_losses ?? 0),
    points:        r.points,
    goalsFor:      r.goals_for,
    goalsAgainst:  r.goals_against,
    ppPct:         r.pp_pct,
    pkPct:         r.pk_pct,
  }));
}

/** Team vs team comparison -- two teams, one season. Mirrors
 * fetchPWHLTeamSeasonsCompareTeams. */
export async function fetchAHLTeamSeasonsCompareTeams(teamIdA, teamIdB, season) {
  if (!teamIdA || !teamIdB || !season) return [];
  const rows = await workerFetch(`/ahl/team-seasons/compare-teams?teamIds=${teamIdA},${teamIdB}&season=${season}`);
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    team:          r.team_id,
    season:        r.season_id,
    gamesPlayed:   r.gp,
    wins:          r.wins,
    losses:        r.losses,
    otLosses:      (r.ot_losses ?? 0) + (r.shootout_losses ?? 0),
    points:        r.points,
    goalsFor:      r.goals_for,
    goalsAgainst:  r.goals_against,
    ppPct:         r.pp_pct,
    pkPct:         r.pk_pct,
  }));
}

/** Head-to-head -- mirrors fetchPWHLTeamHeadToHead, already a clean
 * camelCase shape from /ahl/team-seasons/head-to-head. */
export async function fetchAHLTeamHeadToHead(teamIdA, teamIdB) {
  if (!teamIdA || !teamIdB) return null;
  return workerFetch(`/ahl/team-seasons/head-to-head?teamIds=${teamIdA},${teamIdB}`);
}

/** Per-player box score (skaters + goalies) for a completed game.
 * Shape: { skaters: [...], goalies: [...] } — no hits/faceoff/blocked-
 * shots/skater-TOI fields, unlike fetchPWHLGameBox (see eyewall-pipeline's
 * ahl_game_boxscore.py for why). */
export async function fetchAHLGameBox(gameId) {
  if (!gameId) return null;
  const data = await workerFetch(`/ahl/game-box?gameId=${gameId}`);
  if (!data) return null;
  return {
    skaters: Array.isArray(data.skaters) ? data.skaters : [],
    goalies: Array.isArray(data.goalies) ? data.goalies : [],
  };
}

/** HockeyTech gameSummary enrichment (period scoring + MVPs/three stars)
 * for a completed game. Shape: { periods, mvps, venue, officials, coaches,
 * homeTeamStats, visitingTeamStats } — team stats already have hits/
 * faceoff fields stripped server-side (see eyewall-poller's ahl.js). */
export async function fetchAHLGameSummary(gameId) {
  if (!gameId) return null;
  return workerFetch(`/ahl/summary?gameId=${gameId}`);
}

/** Pre-game preview for an upcoming AHL game — raw HockeyTech
 * gameCenterPreview passthrough, same as fetchPWHLPreview. Real field-name
 * differences from PWHL's shape (see AHLGamePreviewPopup.jsx's comments):
 * teamRecord.overall/past_10_games instead of overallRecord/last10Record,
 * longestStreaks/leadingScorers nested per-team instead of top-level,
 * powerPlayStats/penaltyKillStats instead of powerPlay/penaltyKill,
 * previousMeetings instead of seasonSeries. */
export async function fetchAHLPreview(gameId) {
  if (!gameId) return null;
  return workerFetch(`/ahl/preview?gameId=${gameId}`);
}

/** Team-level win prediction (heuristic + AI narrative) for an upcoming
 * AHL game. No corsiForPct field at all -- ahl_team_seasons has no shot-
 * attempts data source (see eyewall-poller's ahl.js route comment).
 * Shape: { gameId, homeAbbr, awayAbbr, isPlayoff, homeWinPct, awayWinPct,
 *          expHome, expAway, narrative, h2hRecord, homeStreak, awayStreak } */
export async function fetchAHLPrediction(gameId) {
  if (!gameId) return null;
  return workerFetch(`/ahl/prediction?gameId=${gameId}`);
}

/** Season-aggregate SOG (car vs. opp) + PP%/PK% for the Shot Map's "All N"
 * summary card. No hits/blocked/faceoff/penalties sections, unlike PWHL's
 * equivalent — there's no data source for those in AHL's feed. */
export async function fetchAHLTeamSeasonSummary(teamId = AHL_TEAM_ID, season = AHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/ahl/team-season-summary?teamId=${teamId}&season=${season}`);
}

export async function fetchAHLSchedule(teamId = AHL_TEAM_ID, season = AHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/ahl/schedule?teamId=${teamId}&season=${season}`);
}

export async function fetchAHLRoster(teamId = AHL_TEAM_ID) {
  if (!teamId) return null;
  return workerFetch(`/ahl/roster?teamId=${teamId}`);
}

/** Player detail lookup for AHLPlayerPopup — identity + one season's stat
 * line. Mirrors fetchPWHLPlayerLanding. */
export async function fetchAHLPlayerLanding(playerId, season = AHL_CURRENT_SEASON) {
  if (!playerId) return null;
  return workerFetch(`/ahl/player/landing?id=${playerId}&season=${season}`);
}

/** Career totals (regular season + playoffs), recent-form games, bio
 * bullets, and draft info — live HockeyTech proxy, season-independent.
 * Mirrors fetchPWHLPlayerCareer. */
export async function fetchAHLPlayerCareer(playerId) {
  if (!playerId) return null;
  return workerFetch(`/ahl/player/career?id=${playerId}`);
}

/** Shot-map heat map data for a single skater. No goalie equivalent --
 * AHL's PBP doesn't carry goalie_id on goal events (see eyewall-poller's
 * ahl.js docstring for /ahl/player-shots), so a goalie heat map would
 * silently under-count goals allowed. Mirrors fetchPWHLPlayerShots. */
export async function fetchAHLPlayerShots(playerId, season = AHL_CURRENT_SEASON) {
  if (!playerId) return null;
  return workerFetch(`/ahl/player-shots?playerId=${playerId}&season=${season}`);
}

/**
 * Today's AHL games (Eastern time), with a derived pre/live/final status.
 * Mirrors fetchPWHLToday. Returns [{ gameId, homeTeamId, awayTeamId,
 * homeTeamCode, awayTeamCode, homeScore, awayScore, status }].
 */
export async function fetchAHLToday(season = AHL_CURRENT_SEASON) {
  return workerFetch(`/ahl/today?season=${season}`);
}

/**
 * Live (or completed) normalized PBP for a single AHL game. Mirrors
 * fetchPWHLLive. No goalieStats/faceoffStats fields, unlike PWHL's --
 * AHL has no faceoff data at all, and /ahl/summary already covers
 * goalie box-score stats for a consumer that needs them. Returns
 * { gameId, homeTeamId, awayTeamId, homeScore, awayScore,
 *   gameStatus: 'pre'|'live'|'final', events: [...normalized events] }
 */
export async function fetchAHLLive(gameId) {
  if (!gameId) return null;
  return workerFetch(`/ahl/live/${gameId}`);
}
