// components/AHLPlayerPopup.jsx
// AHL player popup: the shared HockeyTechPlayerPopup with the AHL league
// object (utils/hockeyTechLeagues.js, which documents its shape).
import HockeyTechPlayerPopup from './HockeyTechPlayerPopup';
import { AHL } from '../utils/hockeyTechLeagues';

// `season` defaults at render time, so it picks up the live-resolved
// current season (ahlConfig.js updates it after load).
export default function AHLPlayerPopup({ season = AHL.config.currentSeason, ...props }) {
  return <HockeyTechPlayerPopup league={AHL} season={season} {...props} />;
}
