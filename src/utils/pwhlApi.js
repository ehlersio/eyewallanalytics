// utils/pwhlApi.js
// PWHL API utility — parallel to nhlApi.js.
// All requests go through the Cloudflare Worker (/pwhl/* endpoints).
// Tables use team_id (integer), so we pass ?teamId= alongside ?season=.

import { getPWHLStoredTeam, PWHL_CURRENT_SEASON, PWHL_SEASON_LABEL } from './pwhlConfig';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;

// ── Active team ───────────────────────────────────────────────────────────────
export const PWHL_TEAM_CONFIG = getPWHLStoredTeam();
export const PWHL_TEAM_ABBR   = PWHL_TEAM_CONFIG?.abbr   || null;
export const PWHL_TEAM_ID     = PWHL_TEAM_CONFIG?.teamId || null;

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function workerFetch(path) {
  if (!WORKER_URL) {
    console.warn('pwhlApi: VITE_WORKER_URL not set');
    return null;
  }
  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`pwhlApi ${res.status}: ${path}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('pwhlApi fetch error:', path, err.message);
    return null;
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function fetchPWHLStandings(season = PWHL_CURRENT_SEASON) {
  return workerFetch(`/pwhl/standings?season=${season}`);
}

/** Fetch all teams' skaters + goalies for the Leaders tab. */
export async function fetchPWHLLeaguePlayers(season = PWHL_CURRENT_SEASON) {
  return workerFetch(`/pwhl/league-players?season=${season}`);
}

/** Fetch salary data for a team. */
export async function fetchPWHLSalaries(teamId, season = PWHL_SEASON_LABEL) {
  if (!teamId) return null;
  return workerFetch(`/pwhl/salaries?teamId=${teamId}&season=${encodeURIComponent(season)}`);
}

/** Fetch shot events for a specific player (for heat map). */
export async function fetchPWHLPlayerShots(playerId, season = PWHL_CURRENT_SEASON) {
  if (!playerId) return null;
  return workerFetch(`/pwhl/player-shots?playerId=${playerId}&season=${season}`);
}

/**
 * Fetch a single player's identity + one season's stat line, merged.
 * Powers PWHLPlayerPopup's self-fetch-by-id — pass the popup's own
 * `season` prop so the stat line matches whatever season the caller is
 * showing; omit season to get the most recent regular-season row.
 */
export async function fetchPWHLPlayerLanding(playerId, season) {
  if (!playerId) return null;
  const qs = season ? `&season=${season}` : '';
  return workerFetch(`/pwhl/player/landing?id=${playerId}${qs}`);
}

/**
 * Fetch a player's precomputed league percentiles for one season (goals,
 * 1st assists, penalty discipline, finishing -- see eyewall-pipeline's
 * pwhl_percentiles.py for what's actually computed; this is a straight
 * read of eyewall-poller's /pwhl/player/percentiles, same "null = not
 * enough data yet, not an error" convention as the rest of this file).
 * Omit season to get the most recent regular-season row.
 */
export async function fetchPWHLPlayerPercentiles(playerId, season) {
  if (!playerId) return null;
  const qs = season ? `&season=${season}` : '';
  return workerFetch(`/pwhl/player/percentiles?id=${playerId}${qs}`);
}

/**
 * Fetch one player's career Regular Season / Playoffs totals (Session 75).
 * Returns { player_id, regularSeason, playoffs }, either season object
 * `null` if the player has no rows in that section yet (e.g. hasn't made
 * the playoffs). No `season` param -- career totals aren't season-scoped.
 */
export async function fetchPWHLPlayerCareer(playerId) {
  if (!playerId) return null;
  return workerFetch(`/pwhl/player/career?id=${playerId}`);
}

/**
 * Fetch one player's game-by-game box score rows for a season (Session 70 —
 * player Compare tab trend charts). Same flat skaters/goalies shape as
 * fetchPWHLGameBox above, just filtered by player+season instead of by
 * game — caller already knows the player's position and reads whichever
 * array is non-empty, same convention as that function.
 */
export async function fetchPWHLPlayerGameLog(playerId, seasonId) {
  if (!playerId || !seasonId) return null;
  const data = await workerFetch(`/pwhl/player-game-log?playerId=${playerId}&seasonId=${seasonId}`);
  if (!data) return null;
  return {
    skaters: Array.isArray(data.skaters) ? data.skaters : [],
    goalies: Array.isArray(data.goalies) ? data.goalies : [],
  };
}

/** Fetch a single team's season record from pwhl_team_seasons (includes reg_wins, non_reg_wins). */
export async function fetchPWHLTeamRecord(teamId, season) {
  if (!teamId || !season) return null;
  const data = await workerFetch(`/pwhl/standings?season=${season}`);
  if (!Array.isArray(data)) return null;
  // Coerce to int for comparison — Supabase returns team_id as integer
  const id = parseInt(teamId, 10);
  return data.find(r => parseInt(r.team_id, 10) === id) ?? null;
}


/**
 * Season-over-season team comparison (Session 64) -- box-score fields
 * only, mirroring NHL's fetchTeamSeasonsCompare. Normalized to the same
 * camelCase shape that function returns so the same UI component can
 * render either league's response without a league-specific branch.
 */
export async function fetchPWHLTeamSeasonsCompare(teamId, seasons) {
  if (!teamId || !seasons?.length) return [];
  const rows = await workerFetch(`/pwhl/team-seasons/compare?teamId=${teamId}&seasons=${seasons.join(',')}`);
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    season:        r.season_id,
    gamesPlayed:   r.gp,
    wins:          r.wins,
    losses:        r.losses,
    otLosses:      r.ot_losses,
    points:        r.points,
    goalsFor:      r.goals_for,
    goalsAgainst:  r.goals_against,
    ppPct:         r.pp_pct,
    pkPct:         r.pk_pct,
  }));
}

/**
 * Team vs team comparison (Session 86) -- two teams, one season, mirroring
 * NHL's fetchTeamSeasonsCompareTeams. Backed by /pwhl/team-seasons/compare-teams.
 */
export async function fetchPWHLTeamSeasonsCompareTeams(teamIdA, teamIdB, season) {
  if (!teamIdA || !teamIdB || !season) return [];
  const rows = await workerFetch(`/pwhl/team-seasons/compare-teams?teamIds=${teamIdA},${teamIdB}&season=${season}`);
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    team:          r.team_id,
    season:        r.season_id,
    gamesPlayed:   r.gp,
    wins:          r.wins,
    losses:        r.losses,
    otLosses:      r.ot_losses,
    points:        r.points,
    goalsFor:      r.goals_for,
    goalsAgainst:  r.goals_against,
    ppPct:         r.pp_pct,
    pkPct:         r.pk_pct,
  }));
}

export async function fetchPWHLPlayers(teamId = PWHL_TEAM_ID, season = PWHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/pwhl/players?teamId=${teamId}&season=${season}`);
}

export async function fetchPWHLShots(teamId = PWHL_TEAM_ID, season = PWHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/pwhl/shots?teamId=${teamId}&season=${season}`);
}

// Season-aggregate SOG/blocks/hits/penalties/faceoffs (car vs. opp) + PP%/
// PK% for the Shot Map's "All N" summary cards (Session 80) — counts only,
// not raw rows the way fetchPWHLShots is. See eyewall-poller's pwhl.js for
// the aggregation itself.
export async function fetchPWHLTeamSeasonSummary(teamId = PWHL_TEAM_ID, season = PWHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/pwhl/team-season-summary?teamId=${teamId}&season=${season}`);
}

export async function fetchPWHLSchedule(teamId = PWHL_TEAM_ID, season = PWHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/pwhl/schedule?teamId=${teamId}&season=${season}`);
}

export async function fetchPWHLRoster(teamId = PWHL_TEAM_ID) {
  if (!teamId) return null;
  return workerFetch(`/pwhl/roster?teamId=${teamId}`);
}

export async function fetchPWHLLastGame(teamId = PWHL_TEAM_ID, season = PWHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/pwhl/lastgame?teamId=${teamId}&season=${season}`);
}

// ── PBP (hits, penalties, faceoffs, goalie changes) ───────────────────────────

/**
 * Returns { events, oppShots, homeTeamId, awayTeamId } or null.
 * events    — PBP events with player_name and team_id resolved by Worker
 * oppShots  — raw shot rows for both teams (for OPP SOG drill-down)
 * homeTeamId / awayTeamId — game team IDs
 */
export async function fetchPWHLPBP(gameId) {
  if (!gameId) return null;
  const data = await workerFetch(`/pwhl/pbp?gameId=${gameId}`);
  if (!data) return null;
  // Shape: { events, opp_shots, home_team_id, away_team_id }
  if (data.events) {
    return {
      events:       Array.isArray(data.events)    ? data.events    : [],
      oppShots:     Array.isArray(data.opp_shots) ? data.opp_shots : [],
      homeTeamId:   data.home_team_id   ?? null,
      awayTeamId:   data.away_team_id   ?? null,
      faceoffStats: data.faceoff_stats  ?? {},
      goalieStats:  data.goalie_stats   ?? [],
    };
  }
  // Legacy: flat array (pre-deploy cache hits)
  if (Array.isArray(data)) {
    return { events: data, oppShots: [], homeTeamId: null, awayTeamId: null, faceoffStats: {}, goalieStats: [] };
  }
  return null;
}

/**
 * Fetch per-player box score (skaters + goalies) for a completed game.
 * Shape: { skaters: [...], goalies: [...] } — flat arrays with team_id on
 * each row; caller groups by home/away using the game's own home_team_id/
 * away_team_id (already available from the schedule fetch).
 */
export async function fetchPWHLGameBox(gameId) {
  if (!gameId) return null;
  const data = await workerFetch(`/pwhl/game-box?gameId=${gameId}`);
  if (!data) return null;
  return {
    skaters: Array.isArray(data.skaters) ? data.skaters : [],
    goalies: Array.isArray(data.goalies) ? data.goalies : [],
  };
}

/**
 * Fetch HockeyTech gameSummary enrichment (period scoring + MVPs/three
 * stars) for a completed game — same endpoint PWHLPeriodSummary already
 * uses for the shot-map's game summary.
 * Shape: { periods, mvps, homeTeamStats, visitingTeamStats }
 */
export async function fetchPWHLGameSummary(gameId) {
  if (!gameId) return null;
  return workerFetch(`/pwhl/summary?gameId=${gameId}`);
}

/**
 * Pre-game preview for an upcoming PWHL game (Session 51) — season series,
 * all-time head-to-head, streaks, team-scoped leading scorers, special
 * teams. Live-fetched from HockeyTech's gameCenterPreview by the Worker.
 * Shape: { gameId, homeTeam, visitingTeam, seasonSeries, headToHeadRecords, longestStreaks }
 */
export async function fetchPWHLPreview(gameId) {
  if (!gameId) return null;
  return workerFetch(`/pwhl/preview?gameId=${gameId}`);
}

/**
 * Team-level win prediction (heuristic + AI narrative) for an upcoming PWHL
 * game — PWHL analog of NHL's /prediction/analyze fallback tier, NOT its
 * DB-first RAPM/WAR system (see eyewall-poller/src/pwhl.js's route comment).
 * corsiForPct is all-situations shot-attempt share, not 5v5-filtered —
 * always pair it with the response's own corsiCaveat when displaying it.
 * Shape: { gameId, homeAbbr, awayAbbr, isPlayoff, homeWinPct, awayWinPct,
 *          expHome, expAway, narrative, homeStreak, awayStreak,
 *          corsiForPct: {home, away}, corsiCaveat }
 */
export async function fetchPWHLPrediction(gameId) {
  if (!gameId) return null;
  return workerFetch(`/pwhl/prediction?gameId=${gameId}`);
}

// ── PBP helpers ───────────────────────────────────────────────────────────────

/** Filter events to a single type */
export function pbpByType(events, type) {
  if (!Array.isArray(events)) return [];
  return events.filter(e => e.event_type === type);
}

/** Power-play events only */
export function pbpPowerPlay(events) {
  if (!Array.isArray(events)) return [];
  return events.filter(e => e.is_power_play);
}

// ── Live game API ─────────────────────────────────────────────────────────────

/**
 * Fetch today's PWHL games with live status.
 * Returns [{ gameId, homeTeamId, awayTeamId, homeTeamCode, awayTeamCode,
 *            homeScore, awayScore, status: 'pre'|'live'|'final' }]
 */
export async function fetchPWHLToday(season = PWHL_CURRENT_SEASON) {
  return workerFetch(`/pwhl/today?season=${season}`);
}

/**
 * Fetch live (or completed) normalized PBP for a single PWHL game.
 * Returns {
 *   gameId, homeTeamId, awayTeamId,
 *   homeScore, awayScore,
 *   gameStatus: 'pre'|'live'|'final',
 *   events: [...normalized events],
 *   goalieStats: [...],
 *   faceoffStats: { playerId: { wins, attempts, losses } }
 * }
 */
export async function fetchPWHLLive(gameId) {
  if (!gameId) return null;
  return workerFetch(`/pwhl/live/${gameId}`);
}
