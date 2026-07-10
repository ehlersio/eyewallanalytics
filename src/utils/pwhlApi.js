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

/** Fetch a single team's season record from pwhl_team_seasons (includes reg_wins, non_reg_wins). */
export async function fetchPWHLTeamRecord(teamId, season) {
  if (!teamId || !season) return null;
  const data = await workerFetch(`/pwhl/standings?season=${season}`);
  if (!Array.isArray(data)) return null;
  // Coerce to int for comparison — Supabase returns team_id as integer
  const id = parseInt(teamId, 10);
  return data.find(r => parseInt(r.team_id, 10) === id) ?? null;
}


export async function fetchPWHLPlayers(teamId = PWHL_TEAM_ID, season = PWHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/pwhl/players?teamId=${teamId}&season=${season}`);
}

export async function fetchPWHLShots(teamId = PWHL_TEAM_ID, season = PWHL_CURRENT_SEASON) {
  if (!teamId) return null;
  return workerFetch(`/pwhl/shots?teamId=${teamId}&season=${season}`);
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
