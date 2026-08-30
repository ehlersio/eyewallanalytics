// utils/echlApi.js
// ECHL API utility — parallel to ahlApi.js/pwhlApi.js. All requests go
// through the Cloudflare Worker (/echl/* endpoints). Foundation + basic
// display pass only (user's explicit scope choice) -- only covers the
// routes that exist (see eyewall-poller's src/echl.js). No player
// popup/game preview/box popup/prediction/comparison/news/live-tracking
// endpoints exist for ECHL yet, unlike AHL's now-full parity set --
// those are a deferred follow-up pass, matching AHL's own two-pass
// history.

import { getECHLStoredTeam, ECHL_CURRENT_SEASON } from './echlConfig';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;

// ── Active team ───────────────────────────────────────────────────────────────
export const ECHL_TEAM_CONFIG = getECHLStoredTeam();
export const ECHL_TEAM_ABBR = ECHL_TEAM_CONFIG?.abbr || null;
export const ECHL_TEAM_ID = ECHL_TEAM_CONFIG?.teamId || null;

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function workerFetch(path) {
  if (!WORKER_URL) {
    console.warn('echlApi: VITE_WORKER_URL not set');
    return null;
  }
  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`echlApi ${res.status}: ${path}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('echlApi fetch error:', path, err.message);
    return null;
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function fetchECHLStandings(season = ECHL_CURRENT_SEASON) {
  return workerFetch(`/echl/standings?season=${season}`);
}

/** Fetch all teams' skaters + goalies for the Leaders tab. */
export async function fetchECHLLeaguePlayers(season = ECHL_CURRENT_SEASON) {
  return workerFetch(`/echl/league-players?season=${season}`);
}

export async function fetchECHLPlayers(teamId = ECHL_TEAM_ID, season = ECHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/echl/players?teamId=${teamId}&season=${season}`);
}

/** Shot-map data — shot/goal events with coordinates. No blocked_shot
 * event type exists in this data source (see eyewall-poller's echl.js) --
 * a strict subset of what /pwhl/shots returns, same as AHL's. */
export async function fetchECHLShots(teamId = ECHL_TEAM_ID, season = ECHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/echl/shots?teamId=${teamId}&season=${season}`);
}

export async function fetchECHLSchedule(teamId = ECHL_TEAM_ID, season = ECHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/echl/schedule?teamId=${teamId}&season=${season}`);
}

export async function fetchECHLRoster(teamId = ECHL_TEAM_ID) {
  if (!teamId) return null;
  return workerFetch(`/echl/roster?teamId=${teamId}`);
}

/** Season-aggregate SOG (car vs. opp) + PP%/PK% for the Shot Map's "All N"
 * summary card. No hits/blocked/faceoff/penalties sections, unlike
 * PWHL's equivalent — no data source for those in ECHL's feed. */
export async function fetchECHLTeamSeasonSummary(teamId = ECHL_TEAM_ID, season = ECHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/echl/team-season-summary?teamId=${teamId}&season=${season}`);
}

/** Player identity + one season's stat line, for ECHLPlayerPopup's self-fetch. */
export async function fetchECHLPlayerLanding(playerId, season = ECHL_CURRENT_SEASON) {
  if (!playerId) return null;
  return workerFetch(`/echl/player/landing?id=${playerId}&season=${season}`);
}

/** Career totals (regular season + playoffs), recent-form games, bio
 * bullets, and draft info — live HockeyTech proxy, season-independent. */
export async function fetchECHLPlayerCareer(playerId) {
  if (!playerId) return null;
  return workerFetch(`/echl/player/career?id=${playerId}`);
}

/** Shot-map heat map data for a single skater. No goalie equivalent --
 * ECHL's PBP doesn't carry goalie_id on goal events either (see
 * eyewall-poller's echl.js /echl/player-shots docstring), same structural
 * gap as AHL's feed. */
export async function fetchECHLPlayerShots(playerId, season = ECHL_CURRENT_SEASON) {
  if (!playerId) return null;
  return workerFetch(`/echl/player-shots?playerId=${playerId}&season=${season}`);
}

/** Most recent completed game with opponent abbr resolved. */
export async function fetchECHLLastGame(teamId = ECHL_TEAM_ID, season = ECHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/echl/lastgame?teamId=${teamId}&season=${season}`);
}

/** Per-player box score (skaters + goalies) for a completed game.
 * Shape: { skaters: [...], goalies: [...] } — no hits/faceoff/blocked-
 * shots/skater-TOI fields, same as fetchAHLGameBox (see eyewall-pipeline's
 * echl_game_boxscore.py for why). */
export async function fetchECHLGameBox(gameId) {
  if (!gameId) return null;
  const data = await workerFetch(`/echl/game-box?gameId=${gameId}`);
  if (!data) return null;
  return {
    skaters: Array.isArray(data.skaters) ? data.skaters : [],
    goalies: Array.isArray(data.goalies) ? data.goalies : [],
  };
}

/** HockeyTech gameSummary enrichment (period scoring + MVPs/three stars)
 * for a completed game. Shape: { periods, mvps, venue, officials, coaches,
 * homeTeamStats, visitingTeamStats } — team stats already have hits/
 * faceoff fields stripped server-side (see eyewall-poller's echl.js). */
export async function fetchECHLGameSummary(gameId) {
  if (!gameId) return null;
  return workerFetch(`/echl/summary?gameId=${gameId}`);
}

/** Pre-game preview for an upcoming ECHL game — raw HockeyTech
 * gameCenterPreview passthrough, same as fetchAHLPreview. Confirmed live
 * 2026-08-30 that ECHL's shape is identical to AHL's (teamRecord.overall/
 * past_10_games, powerPlayStats/penaltyKillStats nested per-team,
 * previousMeetings) -- see ECHLGamePreviewPopup.jsx's comments. */
export async function fetchECHLPreview(gameId) {
  if (!gameId) return null;
  return workerFetch(`/echl/preview?gameId=${gameId}`);
}

/** Team-level win prediction (heuristic + AI narrative) for an upcoming
 * ECHL game. No corsiForPct field -- echl_team_seasons has no shot-
 * attempts data source, same as AHL.
 * Shape: { gameId, homeAbbr, awayAbbr, isPlayoff, homeWinPct, awayWinPct,
 *          expHome, expAway, narrative, h2hRecord, homeStreak, awayStreak } */
export async function fetchECHLPrediction(gameId) {
  if (!gameId) return null;
  return workerFetch(`/echl/prediction?gameId=${gameId}`);
}

/** One team across multiple seasons, for TeamComparisonPopup's "Compare
 * Seasons" mode. Mirrors fetchAHLTeamSeasonsCompare. */
export async function fetchECHLTeamSeasonsCompare(teamId, seasons) {
  if (!teamId || !seasons?.length) return [];
  const rows = await workerFetch(`/echl/team-seasons/compare?teamId=${teamId}&seasons=${seasons.join(',')}`);
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
 * fetchAHLTeamSeasonsCompareTeams. */
export async function fetchECHLTeamSeasonsCompareTeams(teamIdA, teamIdB, season) {
  if (!teamIdA || !teamIdB || !season) return [];
  const rows = await workerFetch(`/echl/team-seasons/compare-teams?teamIds=${teamIdA},${teamIdB}&season=${season}`);
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

/** Head-to-head -- mirrors fetchAHLTeamHeadToHead, already a clean
 * camelCase shape from /echl/team-seasons/head-to-head. */
export async function fetchECHLTeamHeadToHead(teamIdA, teamIdB) {
  if (!teamIdA || !teamIdB) return null;
  return workerFetch(`/echl/team-seasons/head-to-head?teamIds=${teamIdA},${teamIdB}`);
}

/** Today's ECHL games (Eastern time), with a derived pre/live/final status. */
export async function fetchECHLToday(season = ECHL_CURRENT_SEASON) {
  return workerFetch(`/echl/today?season=${season}`);
}

/**
 * Live (or completed) normalized PBP for a single ECHL game. Mirrors
 * fetchAHLLive. No goalieStats/faceoffStats fields -- same data wall as
 * AHL's own feed.
 */
export async function fetchECHLLive(gameId) {
  if (!gameId) return null;
  return workerFetch(`/echl/live/${gameId}`);
}
