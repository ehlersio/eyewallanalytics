// utils/pwhlApi.js
// PWHL API utility — parallel to nhlApi.js.
// All requests go through the Cloudflare Worker (/pwhl/* endpoints).
// Tables use team_id (integer), so we pass ?teamId= alongside ?season=.

import { getPWHLStoredTeam, PWHL_CURRENT_SEASON } from './pwhlConfig';

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
export async function fetchPWHLSalaries(teamId, season = '2025-26') {
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
