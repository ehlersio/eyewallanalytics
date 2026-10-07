// utils/hockeyTechLeagues.js
// One config object per HockeyTech league (AHL, ECHL), so a shared
// HockeyTech* component takes `league` instead of being copied per league.
// AHL*/ECHL* components stay as thin wrappers that pass their league.
// Where the two leagues differ, the difference lives here and nowhere else.
//
// Shape (both objects carry exactly the same keys; the shape test in
// __tests__/hockeyTechLeagues.test.js enforces it):
//   key            'ahl' | 'echl': route base (`/${key}`), i18n namespace
//                  prefix (`${key}PlayersView.*`), Worker path prefix
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
//                    regularSeasonMap (playoffs -> regular id),
//                    isPlayoffSeason(id), seasonLabel(id),
//                    divisionOrder (standings division order),
//                    storageKeys { team, predictions }
//   stats          the league's *PlayerStats.js module
//                  { SKATER_STATS, GOALIE_STATS, posLabel, groupStats }
//   predictionStore { load, save, recordOutcome, getStats }
//   headshotSize   LeagueStat headshot path segment, fallback when a row has none
//   newsSources    source id -> { label, color, bg } for the News badges;
//                  matches the poller's *_NEWS_SOURCES
//   PlayerPopup    the league's player popup component
//
// PlayerPopup closes an import cycle (AHLPlayerPopup.jsx imports AHL from
// here). It is safe in either load order: the popups are function
// declarations, hoisted at module instantiation, and they only read their
// league object at render time.
import * as ahlApi from './ahlApi';
import * as echlApi from './echlApi';
import * as ahlConfig from './ahlConfig';
import * as echlConfig from './echlConfig';
import * as ahlStats from './ahlPlayerStats';
import * as echlStats from './echlPlayerStats';
import * as ahlPredictions from './ahlPredictionStore';
import * as echlPredictions from './echlPredictionStore';
import AHLPlayerPopup from '../components/AHLPlayerPopup';
import ECHLPlayerPopup from '../components/ECHLPlayerPopup';

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
    seasons:            ahlConfig.AHL_SEASONS,
    regularSeasons:     ahlConfig.AHL_REGULAR_SEASONS,
    playoffSeasons:     ahlConfig.AHL_PLAYOFF_SEASONS,
    playoffSeasonMap:   ahlConfig.AHL_PLAYOFF_SEASON_MAP,
    regularSeasonMap:   ahlConfig.AHL_REGULAR_SEASON_MAP,
    isPlayoffSeason:    ahlConfig.isAHLPlayoffSeason,
    seasonLabel:        seasonLabelFrom(ahlConfig.AHL_SEASONS),
    divisionOrder:      ['Atlantic', 'North', 'Central', 'Pacific'],
    storageKeys: {
      team:        'eyewall:ahl_team',
      predictions: ahlPredictions.AHL_PREDICTIONS_KEY,
    },
  },
  stats: ahlStats,
  predictionStore: {
    load:          ahlPredictions.loadAHLPredictions,
    save:          ahlPredictions.saveAHLPrediction,
    recordOutcome: ahlPredictions.recordAHLOutcome,
    getStats:      ahlPredictions.getAHLPredictionStats,
  },
  headshotSize: '240x240',
  newsSources: {
    'official-ahl':      { label: 'TheAHL.com',         color: '#FFFFFF', bg: '#003876' },
    'hockeywriters-ahl': { label: 'The Hockey Writers', color: '#FFFFFF', bg: '#1a1a1a' },
    'osc-ahl':           { label: 'OurSports Central',  color: '#FFFFFF', bg: '#8b0000' },
  },
  PlayerPopup: AHLPlayerPopup,
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
    seasons:            echlConfig.ECHL_SEASONS,
    regularSeasons:     echlConfig.ECHL_REGULAR_SEASONS,
    playoffSeasons:     echlConfig.ECHL_PLAYOFF_SEASONS,
    playoffSeasonMap:   echlConfig.ECHL_PLAYOFF_SEASON_MAP,
    regularSeasonMap:   echlConfig.ECHL_REGULAR_SEASON_MAP,
    isPlayoffSeason:    echlConfig.isECHLPlayoffSeason,
    seasonLabel:        seasonLabelFrom(echlConfig.ECHL_SEASONS),
    divisionOrder:      ['North', 'South', 'Central', 'Mountain'],
    storageKeys: {
      team:        'eyewall:echl_team',
      predictions: echlPredictions.ECHL_PREDICTIONS_KEY,
    },
  },
  stats: echlStats,
  predictionStore: {
    load:          echlPredictions.loadECHLPredictions,
    save:          echlPredictions.saveECHLPrediction,
    recordOutcome: echlPredictions.recordECHLOutcome,
    getStats:      echlPredictions.getECHLPredictionStats,
  },
  headshotSize: '120x160',
  newsSources: {
    'hockeywriters-echl': { label: 'The Hockey Writers', color: '#FFFFFF', bg: '#1a1a1a' },
    'osc-echl':           { label: 'OurSports Central',  color: '#FFFFFF', bg: '#8b0000' },
  },
  PlayerPopup: ECHLPlayerPopup,
};

export const HOCKEYTECH_LEAGUES = { ahl: AHL, echl: ECHL };
