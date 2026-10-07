// utils/hockeyTechLeagues.js
// One config object per HockeyTech league (AHL, ECHL), so a shared
// HockeyTech* component takes `league` instead of being copied per league.
// AHL*/ECHL* components stay as thin wrappers that pass their league.
// Where the two leagues differ, the difference lives here and nowhere else.
//
// Shape (both objects carry exactly the same keys; the shape test in
// __tests__/hockeyTechLeagues.test.js enforces it):
//   key            'ahl' | 'echl': route base (`/${key}`), Worker path
//                  prefix, and the league's name in i18n
//                  (hockeyTechLeagues.<key>; the shared hockeyTech*
//                  namespaces take it through utils/hockeyTechI18n.js)
//   label          'AHL' | 'ECHL', for display
//   team / teamAbbr / teamId
//                  the followed team, read from localStorage once at load
//                  (the *Api.js module's *_TEAM_CONFIG/_ABBR/_ID)
//   api            every fetch the league's *Api.js exports, under
//                  league-neutral names (fetchSchedule, fetchPlayerLanding...)
//   config         teams and seasons from the league's *Config.js:
//                    teams, historicalTeams, teamMap (abbr ->), teamById
//                    (id ->, historical included), getTeamById,
//                    getTeamByAbbr (current teams only), getTeamForDisplay
//                    (historical too, display only), logoUrl(teamId),
//                    hasStoredTeam(), getStoredTeam(),
//                    currentSeason (getter: live-resolved, see *Config.js),
//                    seasonUpdatedEvent (window event fired when it resolves),
//                    seasons / regularSeasons / playoffSeasons,
//                    playoffSeasonMap (regular -> playoffs id),
//                    regularSeasonMap (playoffs -> regular id) -- getters:
//                    built from the Worker after load (C7, *Config.js);
//                    seasonsUpdatedEvent fires when they change
//                    (hooks/useLeagueSeasons.js re-renders on it),
//                    isPlayoffSeason(id), seasonLabel(id),
//                    divisionOrder (standings division order),
//                    storageKeys { team, predictions }
//   stats          utils/hockeyTechPlayerStats.js (shared: both feeds carry
//                  the same fields) { SKATER_STATS, GOALIE_STATS, posLabel,
//                  groupStats }
//   predictionStore { load, save, recordOutcome, getStats } from
//                  createPredictionStore(key) (utils/hockeyTechPredictionStore.js),
//                  stored under config.storageKeys.predictions
//   headshotSize   LeagueStat headshot path segment, fallback when a row has none
//   newsSources    source id -> { label, color, bg } for the News badges;
//                  matches the poller's *_NEWS_SOURCES
//   playerPopup    HockeyTechPlayerPopup options (see its header):
//                  { comparisonEntry: true } -- the "vs Player" entry
//   debugSamples   sample players/teams for the Shot Map's dev-only event
//                  debug panel; null in a production build, which has no
//                  panel (the names don't ship)
//
// No component lives here: views render HockeyTechPlayerPopup with
// `league` directly. (A PlayerPopup field here used to close an import
// cycle with AHLPlayerPopup.jsx/ECHLPlayerPopup.jsx, which import this.)
import * as ahlApi from './ahlApi';
import * as echlApi from './echlApi';
import * as ahlConfig from './ahlConfig';
import * as echlConfig from './echlConfig';
import * as stats from './hockeyTechPlayerStats';
import { createPredictionStore, predictionStorageKey } from './hockeyTechPredictionStore';

function seasonLabelFrom(seasons) {
  return id => seasons.find(s => s.id === id)?.label || String(id);
}

export const AHL = {
  key: 'ahl',
  label: 'AHL',
  team: ahlApi.AHL_TEAM_CONFIG,
  teamAbbr: ahlApi.AHL_TEAM_ABBR,
  teamId: ahlApi.AHL_TEAM_ID,
  api: {
    fetchStandings:               ahlApi.fetchAHLStandings,
    fetchLeaguePlayers:           ahlApi.fetchAHLLeaguePlayers,
    fetchPlayers:                 ahlApi.fetchAHLPlayers,
    fetchShots:                   ahlApi.fetchAHLShots,
    fetchLastGame:                ahlApi.fetchAHLLastGame,
    fetchTeamSeasonsCompare:      ahlApi.fetchAHLTeamSeasonsCompare,
    fetchTeamSeasonsCompareTeams: ahlApi.fetchAHLTeamSeasonsCompareTeams,
    fetchTeamHeadToHead:          ahlApi.fetchAHLTeamHeadToHead,
    fetchGameBox:                 ahlApi.fetchAHLGameBox,
    fetchGameSummary:             ahlApi.fetchAHLGameSummary,
    fetchPreview:                 ahlApi.fetchAHLPreview,
    fetchPrediction:              ahlApi.fetchAHLPrediction,
    fetchTeamSeasonSummary:       ahlApi.fetchAHLTeamSeasonSummary,
    fetchGameShots:               ahlApi.fetchAHLGameShots,
    fetchSchedule:                ahlApi.fetchAHLSchedule,
    fetchRoster:                  ahlApi.fetchAHLRoster,
    fetchPlayerLanding:           ahlApi.fetchAHLPlayerLanding,
    fetchPlayerGameLog:           ahlApi.fetchAHLPlayerGameLog,
    fetchPlayerCareer:            ahlApi.fetchAHLPlayerCareer,
    fetchPlayerShots:             ahlApi.fetchAHLPlayerShots,
    fetchToday:                   ahlApi.fetchAHLToday,
    fetchLive:                    ahlApi.fetchAHLLive,
    fetchNews:                    ahlApi.fetchAHLNews,
  },
  config: {
    teams:              ahlConfig.AHL_TEAMS,
    historicalTeams:    ahlConfig.AHL_HISTORICAL_TEAMS,
    teamMap:            ahlConfig.AHL_TEAM_MAP,
    teamById:           ahlConfig.AHL_TEAM_BY_ID,
    getTeamById:        ahlConfig.getAHLTeamById,
    getTeamByAbbr:      ahlConfig.getAHLTeamConfig,
    getTeamForDisplay:  ahlConfig.getAHLTeamForDisplay,
    logoUrl:            ahlConfig.ahlLogoUrl,
    hasStoredTeam:      ahlConfig.hasAHLTeamConfig,
    getStoredTeam:      ahlConfig.getAHLStoredTeam,
    get currentSeason() { return ahlConfig.AHL_CURRENT_SEASON; },
    seasonUpdatedEvent: 'eyewall:ahl-season-updated',
    // Getters: the lists are rebuilt from the Worker after load (C7).
    get seasons()          { return ahlConfig.AHL_SEASONS; },
    get regularSeasons()   { return ahlConfig.AHL_REGULAR_SEASONS; },
    get playoffSeasons()   { return ahlConfig.AHL_PLAYOFF_SEASONS; },
    get playoffSeasonMap() { return ahlConfig.AHL_PLAYOFF_SEASON_MAP; },
    get regularSeasonMap() { return ahlConfig.AHL_REGULAR_SEASON_MAP; },
    seasonsUpdatedEvent: 'eyewall:ahl-seasons-updated',
    isPlayoffSeason:    ahlConfig.isAHLPlayoffSeason,
    seasonLabel:        id => seasonLabelFrom(ahlConfig.AHL_SEASONS)(id),
    divisionOrder:      ['Atlantic', 'North', 'Central', 'Pacific'],
    storageKeys: {
      team:        'eyewall:ahl_team',
      predictions: predictionStorageKey('ahl'),
    },
  },
  stats,
  predictionStore: createPredictionStore('ahl'),
  headshotSize: '240x240',
  newsSources: {
    'official-ahl':      { label: 'TheAHL.com',         color: '#FFFFFF', bg: '#003876' },
    'hockeywriters-ahl': { label: 'The Hockey Writers', color: '#FFFFFF', bg: '#1a1a1a' },
    'osc-ahl':           { label: 'OurSports Central',  color: '#FFFFFF', bg: '#8b0000' },
  },
  // HockeyTechPlayerPopup options (see its header): the "vs Player"
  // comparison entry.
  playerPopup: { comparisonEntry: true },
  debugSamples: import.meta.env.DEV ? {
    goalScorer: 'Easton Cowan', goalAssists: ['Luke Haymes', 'Alex Nylander'],
    ppGoalScorer: 'Dakota Mermis', ppAlertPlayer: 'Luke Tuch', majorPlayer: 'Marc Del Gaizo',
    winTeamAbbr: 'TOR', winOppAbbr: 'GR',
  } : null,
};

export const ECHL = {
  key: 'echl',
  label: 'ECHL',
  team: echlApi.ECHL_TEAM_CONFIG,
  teamAbbr: echlApi.ECHL_TEAM_ABBR,
  teamId: echlApi.ECHL_TEAM_ID,
  api: {
    fetchStandings:               echlApi.fetchECHLStandings,
    fetchLeaguePlayers:           echlApi.fetchECHLLeaguePlayers,
    fetchPlayers:                 echlApi.fetchECHLPlayers,
    fetchShots:                   echlApi.fetchECHLShots,
    fetchLastGame:                echlApi.fetchECHLLastGame,
    fetchTeamSeasonsCompare:      echlApi.fetchECHLTeamSeasonsCompare,
    fetchTeamSeasonsCompareTeams: echlApi.fetchECHLTeamSeasonsCompareTeams,
    fetchTeamHeadToHead:          echlApi.fetchECHLTeamHeadToHead,
    fetchGameBox:                 echlApi.fetchECHLGameBox,
    fetchGameSummary:             echlApi.fetchECHLGameSummary,
    fetchPreview:                 echlApi.fetchECHLPreview,
    fetchPrediction:              echlApi.fetchECHLPrediction,
    fetchTeamSeasonSummary:       echlApi.fetchECHLTeamSeasonSummary,
    fetchGameShots:               echlApi.fetchECHLGameShots,
    fetchSchedule:                echlApi.fetchECHLSchedule,
    fetchRoster:                  echlApi.fetchECHLRoster,
    fetchPlayerLanding:           echlApi.fetchECHLPlayerLanding,
    fetchPlayerGameLog:           echlApi.fetchECHLPlayerGameLog,
    fetchPlayerCareer:            echlApi.fetchECHLPlayerCareer,
    fetchPlayerShots:             echlApi.fetchECHLPlayerShots,
    fetchToday:                   echlApi.fetchECHLToday,
    fetchLive:                    echlApi.fetchECHLLive,
    fetchNews:                    echlApi.fetchECHLNews,
  },
  config: {
    teams:              echlConfig.ECHL_TEAMS,
    historicalTeams:    echlConfig.ECHL_HISTORICAL_TEAMS,
    teamMap:            echlConfig.ECHL_TEAM_MAP,
    teamById:           echlConfig.ECHL_TEAM_BY_ID,
    getTeamById:        echlConfig.getECHLTeamById,
    getTeamByAbbr:      echlConfig.getECHLTeamConfig,
    getTeamForDisplay:  echlConfig.getECHLTeamForDisplay,
    logoUrl:            echlConfig.echlLogoUrl,
    hasStoredTeam:      echlConfig.hasECHLTeamConfig,
    getStoredTeam:      echlConfig.getECHLStoredTeam,
    get currentSeason() { return echlConfig.ECHL_CURRENT_SEASON; },
    seasonUpdatedEvent: 'eyewall:echl-season-updated',
    // Getters: the lists are rebuilt from the Worker after load (C7).
    get seasons()          { return echlConfig.ECHL_SEASONS; },
    get regularSeasons()   { return echlConfig.ECHL_REGULAR_SEASONS; },
    get playoffSeasons()   { return echlConfig.ECHL_PLAYOFF_SEASONS; },
    get playoffSeasonMap() { return echlConfig.ECHL_PLAYOFF_SEASON_MAP; },
    get regularSeasonMap() { return echlConfig.ECHL_REGULAR_SEASON_MAP; },
    seasonsUpdatedEvent: 'eyewall:echl-seasons-updated',
    isPlayoffSeason:    echlConfig.isECHLPlayoffSeason,
    seasonLabel:        id => seasonLabelFrom(echlConfig.ECHL_SEASONS)(id),
    divisionOrder:      ['North', 'South', 'Central', 'Mountain'],
    storageKeys: {
      team:        'eyewall:echl_team',
      predictions: predictionStorageKey('echl'),
    },
  },
  stats,
  predictionStore: createPredictionStore('echl'),
  headshotSize: '120x160',
  newsSources: {
    'hockeywriters-echl': { label: 'The Hockey Writers', color: '#FFFFFF', bg: '#1a1a1a' },
    'osc-echl':           { label: 'OurSports Central',  color: '#FFFFFF', bg: '#8b0000' },
  },
  // HockeyTechPlayerPopup options (see its header): the "vs Player"
  // comparison entry.
  playerPopup: { comparisonEntry: true },
  debugSamples: import.meta.env.DEV ? {
    goalScorer: 'Anthony Romano', goalAssists: ['Oliver Chau', 'Jordan Sambrook'],
    ppGoalScorer: 'Craig Needham', ppAlertPlayer: 'Cam Johnson', majorPlayer: 'Reid Duke',
    winTeamAbbr: 'FLA', winOppAbbr: 'REA',
  } : null,
};

export const HOCKEYTECH_LEAGUES = { ahl: AHL, echl: ECHL };
