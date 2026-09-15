// components/AHLPlayerPopup.jsx
// AHL player popup: the shared HockeyTechPlayerPopup with AHL's config.
//
// League config shape (see HockeyTechPlayerPopup.jsx):
//   key            'ahl' -- i18n namespace (ahlPlayerPopup.*) and season-picker league
//   headshotSize   LeagueStat headshot path segment, fallback when a row has none
//   getTeamById    team_id -> { abbr, displayColor, ... }
//   stats          { SKATER_STATS, GOALIE_STATS, posLabel, groupStats }
//   fetchLanding / fetchCareer / fetchShots / fetchGameLog -- ahlApi.js
import HockeyTechPlayerPopup from './HockeyTechPlayerPopup';
import { fetchAHLPlayerShots, fetchAHLPlayerLanding, fetchAHLPlayerCareer, fetchAHLPlayerGameLog } from '../utils/ahlApi';
import { AHL_CURRENT_SEASON, getAHLTeamById } from '../utils/ahlConfig';
import * as stats from '../utils/ahlPlayerStats';

const AHL = {
  key:          'ahl',
  headshotSize: '240x240',
  getTeamById:  getAHLTeamById,
  stats,
  fetchLanding: fetchAHLPlayerLanding,
  fetchCareer:  fetchAHLPlayerCareer,
  fetchShots:   fetchAHLPlayerShots,
  fetchGameLog: fetchAHLPlayerGameLog,
};

// `season` defaults at render time, so it picks up AHL_CURRENT_SEASON's
// live-resolved value (ahlConfig.js updates it after load).
export default function AHLPlayerPopup({ season = AHL_CURRENT_SEASON, ...props }) {
  return <HockeyTechPlayerPopup league={AHL} season={season} {...props} />;
}
