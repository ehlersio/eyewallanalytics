// components/AHLGameStatsPopup.jsx
// AHL box-score popup: the shared HockeyTechGameStatsPopup with the AHL
// league object (utils/hockeyTechLeagues.js).
import HockeyTechGameStatsPopup from './hockeytech/HockeyTechGameStatsPopup';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLGameStatsPopup(props) {
  return <HockeyTechGameStatsPopup league={AHL} {...props} />;
}
