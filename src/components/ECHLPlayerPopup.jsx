// components/ECHLPlayerPopup.jsx
// ECHL player popup: the shared HockeyTechPlayerPopup with ECHL's config.
// See AHLPlayerPopup.jsx for the league config shape.
import HockeyTechPlayerPopup from './HockeyTechPlayerPopup';
import { fetchECHLPlayerShots, fetchECHLPlayerLanding, fetchECHLPlayerCareer, fetchECHLPlayerGameLog } from '../utils/echlApi';
import { ECHL_CURRENT_SEASON, getECHLTeamById } from '../utils/echlConfig';
import * as stats from '../utils/echlPlayerStats';

const ECHL = {
  key:          'echl',
  headshotSize: '120x160',
  getTeamById:  getECHLTeamById,
  stats,
  fetchLanding: fetchECHLPlayerLanding,
  fetchCareer:  fetchECHLPlayerCareer,
  fetchShots:   fetchECHLPlayerShots,
  fetchGameLog: fetchECHLPlayerGameLog,
};

// `season` defaults at render time, so it picks up ECHL_CURRENT_SEASON's
// live-resolved value (echlConfig.js updates it after load).
export default function ECHLPlayerPopup({ season = ECHL_CURRENT_SEASON, ...props }) {
  return <HockeyTechPlayerPopup league={ECHL} season={season} {...props} />;
}
