// components/ECHLPlayerPopup.jsx
// ECHL player popup: the shared HockeyTechPlayerPopup with the ECHL league
// object (utils/hockeyTechLeagues.js, which documents its shape).
import HockeyTechPlayerPopup from './HockeyTechPlayerPopup';
import { ECHL } from '../utils/hockeyTechLeagues';

// `season` defaults at render time, so it picks up the live-resolved
// current season (echlConfig.js updates it after load).
export default function ECHLPlayerPopup({ season = ECHL.config.currentSeason, ...props }) {
  return <HockeyTechPlayerPopup league={ECHL} season={season} {...props} />;
}
