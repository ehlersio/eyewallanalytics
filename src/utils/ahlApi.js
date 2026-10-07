// utils/ahlApi.js
// AHL Worker API: createHockeyTechApi('ahl') (utils/hockeyTechApi.js), shared
// with the other HockeyTech league, re-exported under the names the app
// already imports.
import { createHockeyTechApi } from './hockeyTechApi';

const api = createHockeyTechApi('ahl');

// ── Active team (read once at load) ──────────────────────────────────────────
export const AHL_TEAM_CONFIG = api.teamConfig;
export const AHL_TEAM_ABBR   = api.teamAbbr;
export const AHL_TEAM_ID     = api.teamId;

// ── API functions ─────────────────────────────────────────────────────────────
export const fetchAHLStandings               = api.fetchStandings;
export const fetchAHLLeaguePlayers           = api.fetchLeaguePlayers;
export const fetchAHLPlayers                 = api.fetchPlayers;
export const fetchAHLShots                   = api.fetchShots;
export const fetchAHLLastGame                = api.fetchLastGame;
export const fetchAHLTeamSeasonsCompare      = api.fetchTeamSeasonsCompare;
export const fetchAHLTeamSeasonsCompareTeams = api.fetchTeamSeasonsCompareTeams;
export const fetchAHLTeamHeadToHead          = api.fetchTeamHeadToHead;
export const fetchAHLGameBox                 = api.fetchGameBox;
export const fetchAHLGameSummary             = api.fetchGameSummary;
export const fetchAHLPreview                 = api.fetchPreview;
export const fetchAHLPrediction              = api.fetchPrediction;
export const fetchAHLTeamSeasonSummary       = api.fetchTeamSeasonSummary;
export const fetchAHLGameShots               = api.fetchGameShots;
export const fetchAHLSchedule                = api.fetchSchedule;
export const fetchAHLRoster                  = api.fetchRoster;
export const fetchAHLPlayerLanding           = api.fetchPlayerLanding;
export const fetchAHLPlayerGameLog           = api.fetchPlayerGameLog;
export const fetchAHLPlayerCareer            = api.fetchPlayerCareer;
export const fetchAHLPlayerShots             = api.fetchPlayerShots;
export const fetchAHLToday                   = api.fetchToday;
export const fetchAHLNews                   = api.fetchNews;
export const fetchAHLLive                    = api.fetchLive;
