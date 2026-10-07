// utils/hockeyTechApi.js
// Worker API client for a HockeyTech league (AHL, ECHL): every request goes
// through the Cloudflare Worker's /{key}/* routes (eyewall-poller's
// src/ahl.js / src/echl.js, which share hockeytech.js). The two leagues'
// clients used to be copies; ahlApi.js and echlApi.js now re-export
// createHockeyTechApi('ahl') / ('echl') under their old names.
//
// Requests use fetchWithRetry's 8s budget with one retry, and
// `cache: 'no-store'`, as before. A failed request resolves to null.
//
// Season defaults read the league's live-resolved current season at call
// time (see ahlConfig.js's AHL_CURRENT_SEASON), and team defaults the
// followed team stored when the app loaded -- both as before.

import i18n from '../i18n';
import * as ahlConfig from './ahlConfig';
import * as echlConfig from './echlConfig';
import { fetchWithRetry } from './retryFetch';

const LEAGUE_CONFIG = {
  ahl:  { currentSeason: () => ahlConfig.AHL_CURRENT_SEASON,   getStoredTeam: ahlConfig.getAHLStoredTeam },
  echl: { currentSeason: () => echlConfig.ECHL_CURRENT_SEASON, getStoredTeam: echlConfig.getECHLStoredTeam },
};

// Same normalized camelCase shape as fetchPWHLTeamSeasonsCompare, so
// TeamComparisonPopup renders any league with no per-league branch beyond
// the fetch. otLosses combines ot_losses + shootout_losses (these leagues
// split them; PWHL/NHL don't), so the shared "OTL" row means any
// non-regulation loss in every league.
function compareRow(r) {
  return {
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
  };
}

function skatersAndGoalies(data) {
  if (!data) return null;
  return {
    skaters: Array.isArray(data.skaters) ? data.skaters : [],
    goalies: Array.isArray(data.goalies) ? data.goalies : [],
  };
}

export function createHockeyTechApi(key) {
  const { currentSeason, getStoredTeam } = LEAGUE_CONFIG[key];
  const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;
  const tag = `${key}Api`;

  // The followed team, read once when the app loads.
  const teamConfig = getStoredTeam();
  const teamAbbr   = teamConfig?.abbr || null;
  const teamId     = teamConfig?.teamId || null;

  async function workerFetch(path) {
    if (!WORKER_URL) {
      console.warn(`${tag}: VITE_WORKER_URL not set`);
      return null;
    }
    try {
      // One retry on a stalled connection -- see retryFetch.js.
      const res = await fetchWithRetry(`${WORKER_URL}${path}`, {
        init: { cache: 'no-store' },
      });
      if (!res.ok) {
        console.warn(`${tag} ${res.status}: ${path}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.error(`${tag} fetch error:`, path, err.message);
      return null;
    }
  }

  const base = `/${key}`;

  return {
    teamConfig, teamAbbr, teamId,

    async fetchStandings(season = currentSeason()) {
      return workerFetch(`${base}/standings?season=${season}`);
    },

    /** All teams' skaters + goalies, for the Leaders tab. */
    async fetchLeaguePlayers(season = currentSeason()) {
      return workerFetch(`${base}/league-players?season=${season}`);
    },

    async fetchPlayers(team = teamId, season = currentSeason()) {
      if (!team) return null;
      return workerFetch(`${base}/players?teamId=${team}&season=${season}`);
    },

    /** Shot-map data -- shot/goal events with coordinates. No blocked_shot
     * event type exists in this data source (see eyewall-poller's ahl.js),
     * a strict subset of what /pwhl/shots returns. */
    async fetchShots(team = teamId, season = currentSeason()) {
      if (!team) return null;
      return workerFetch(`${base}/shots?teamId=${team}&season=${season}`);
    },

    async fetchLastGame(team = teamId, season = currentSeason()) {
      if (!team) return null;
      return workerFetch(`${base}/lastgame?teamId=${team}&season=${season}`);
    },

    /** Season-over-season team comparison (TeamComparisonPopup's
     * "vs Season" mode). [] for no team/seasons, null when the request
     * failed -- unknown, not "no seasons". */
    async fetchTeamSeasonsCompare(team, seasons) {
      if (!team || !seasons?.length) return [];
      const rows = await workerFetch(`${base}/team-seasons/compare?teamId=${team}&seasons=${seasons.join(',')}`);
      if (!Array.isArray(rows)) return null;
      return rows.map(compareRow);
    },

    /** Team vs team comparison -- two teams, one season. */
    async fetchTeamSeasonsCompareTeams(teamIdA, teamIdB, season) {
      if (!teamIdA || !teamIdB || !season) return [];
      const rows = await workerFetch(`${base}/team-seasons/compare-teams?teamIds=${teamIdA},${teamIdB}&season=${season}`);
      if (!Array.isArray(rows)) return [];
      return rows.map(r => ({ team: r.team_id, ...compareRow(r) }));
    },

    /** Head-to-head, already a clean camelCase shape from the Worker. */
    async fetchTeamHeadToHead(teamIdA, teamIdB) {
      if (!teamIdA || !teamIdB) return null;
      return workerFetch(`${base}/team-seasons/head-to-head?teamIds=${teamIdA},${teamIdB}`);
    },

    /** Per-player box score { skaters, goalies } for a completed game -- no
     * hits/faceoff/blocked-shots/skater-TOI fields, unlike fetchPWHLGameBox
     * (see eyewall-pipeline's ahl_game_boxscore.py). */
    async fetchGameBox(gameId) {
      if (!gameId) return null;
      return skatersAndGoalies(await workerFetch(`${base}/game-box?gameId=${gameId}`));
    },

    /** HockeyTech gameSummary enrichment (period scoring, three stars,
     * venue, officials, coaches, team stats with hits/faceoffs stripped
     * server-side) for a completed game. */
    async fetchGameSummary(gameId) {
      if (!gameId) return null;
      return workerFetch(`${base}/summary?gameId=${gameId}`);
    },

    /** Raw HockeyTech gameCenterPreview for an upcoming game. Its field
     * names differ from PWHL's -- see HockeyTechGamePreviewPopup.jsx. */
    async fetchPreview(gameId) {
      if (!gameId) return null;
      return workerFetch(`${base}/preview?gameId=${gameId}`);
    },

    /** Team-level win prediction (heuristic + AI narrative) for an upcoming
     * game; no corsiForPct (no shot-attempts data source). ?locale= picks
     * the narrative's language (the Worker caches each separately). */
    async fetchPrediction(gameId) {
      if (!gameId) return null;
      return workerFetch(`${base}/prediction?gameId=${gameId}&locale=${i18n.language}`);
    },

    /** Season-aggregate SOG (car vs. opp) + PP%/PK% for the Shot Map's
     * summary cards. */
    async fetchTeamSeasonSummary(team = teamId, season = currentSeason()) {
      if (!team) return null;
      return workerFetch(`${base}/team-season-summary?teamId=${team}&season=${season}`);
    },

    /** Both teams' shots and goals in one game (the shot map's game view).
     * Empty until the nightly run has ingested the game. */
    async fetchGameShots(gameId) {
      if (!gameId) return null;
      return workerFetch(`${base}/game-shots?gameId=${gameId}`);
    },

    async fetchSchedule(team = teamId, season = currentSeason()) {
      if (!team) return null;
      return workerFetch(`${base}/schedule?teamId=${team}&season=${season}`);
    },

    async fetchRoster(team = teamId) {
      if (!team) return null;
      return workerFetch(`${base}/roster?teamId=${team}`);
    },

    /** Player popup: identity + one season's stat line. */
    async fetchPlayerLanding(playerId, season = currentSeason()) {
      if (!playerId) return null;
      return workerFetch(`${base}/player/landing?id=${playerId}&season=${season}`);
    },

    /** One player's box-score row for every game of a season, oldest first
     * (the popup's Compare-tab trend chart): { skaters, goalies } or null.
     * This route's param is `season`, not PWHL's `seasonId`. */
    async fetchPlayerGameLog(playerId, season) {
      if (!playerId || !season) return null;
      return skatersAndGoalies(await workerFetch(`${base}/player-game-log?playerId=${playerId}&season=${season}`));
    },

    /** Career totals, recent-form games, bio bullets and draft info --
     * live HockeyTech proxy, season-independent. */
    async fetchPlayerCareer(playerId) {
      if (!playerId) return null;
      return workerFetch(`${base}/player/career?id=${playerId}`);
    },

    /** Heat-map shots for one skater. No goalie equivalent: these leagues'
     * PBP doesn't carry goalie_id on goal events, so a goalie heat map
     * would silently under-count goals allowed. */
    async fetchPlayerShots(playerId, season = currentSeason()) {
      if (!playerId) return null;
      return workerFetch(`${base}/player-shots?playerId=${playerId}&season=${season}`);
    },

    /** Today's games (Eastern time) with a derived pre/live/final status:
     * [{ gameId, homeTeamId, awayTeamId, homeTeamCode, awayTeamCode,
     *    homeScore, awayScore, status }]. */
    async fetchToday(season = currentSeason()) {
      return workerFetch(`${base}/today?season=${season}`);
    },

    /** Live (or completed) normalized PBP for one game: { gameId,
     * homeTeamId, awayTeamId, homeScore, awayScore,
     * gameStatus: 'pre'|'live'|'final', events }. No goalieStats/
     * faceoffStats, unlike PWHL's (no faceoff data in these feeds). */
    async fetchLive(gameId) {
      if (!gameId) return null;
      return workerFetch(`${base}/live/${gameId}`);
    },
  };
}
