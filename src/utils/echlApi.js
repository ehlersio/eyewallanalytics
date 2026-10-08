// utils/echlApi.js
// ECHL Worker API: createHockeyTechApi('echl') (utils/hockeyTechApi.js), shared
// with the other HockeyTech league, re-exported under the names the app
// already imports.
import { createHockeyTechApi } from './hockeyTechApi';

const api = createHockeyTechApi('echl');

// ── Active team (read once at load) ──────────────────────────────────────────
export const ECHL_TEAM_CONFIG = api.teamConfig;
export const ECHL_TEAM_ABBR   = api.teamAbbr;
export const ECHL_TEAM_ID     = api.teamId;

// ── API functions ─────────────────────────────────────────────────────────────
export const fetchECHLStandings               = api.fetchStandings;
export const fetchECHLLeaguePlayers           = api.fetchLeaguePlayers;
export const fetchECHLPlayers                 = api.fetchPlayers;
export const fetchECHLShots                   = api.fetchShots;
export const fetchECHLLastGame                = api.fetchLastGame;
export const fetchECHLTeamSeasonsCompare      = api.fetchTeamSeasonsCompare;
export const fetchECHLTeamSeasonsCompareTeams = api.fetchTeamSeasonsCompareTeams;
export const fetchECHLTeamHeadToHead          = api.fetchTeamHeadToHead;
export const fetchECHLGameBox                 = api.fetchGameBox;
export const fetchECHLGameSummary             = api.fetchGameSummary;
export const fetchECHLPreview                 = api.fetchPreview;
export const fetchECHLPrediction              = api.fetchPrediction;
export const fetchECHLTeamSeasonSummary       = api.fetchTeamSeasonSummary;
export const fetchECHLGameShots               = api.fetchGameShots;
export const fetchECHLSchedule                = api.fetchSchedule;
export const fetchECHLRoster                  = api.fetchRoster;
export const fetchECHLPlayerLanding           = api.fetchPlayerLanding;
export const fetchECHLPlayerGameLog           = api.fetchPlayerGameLog;
export const fetchECHLPlayerCareer            = api.fetchPlayerCareer;
export const fetchECHLPlayerShots             = api.fetchPlayerShots;
export const fetchECHLToday                   = api.fetchToday;
export const fetchECHLPlayerPercentiles       = api.fetchPlayerPercentiles;
export const fetchECHLGoaliePercentiles       = api.fetchGoaliePercentiles;
export const fetchECHLPowerRankings           = api.fetchPowerRankings;
export const fetchECHLPlayoffOdds            = api.fetchPlayoffOdds;
export const fetchECHLNews                   = api.fetchNews;
export const fetchECHLLive                    = api.fetchLive;
