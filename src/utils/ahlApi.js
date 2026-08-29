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
