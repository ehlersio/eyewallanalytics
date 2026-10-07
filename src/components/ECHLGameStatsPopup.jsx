// components/ECHLGameStatsPopup.jsx
// ECHL box-score popup: the shared HockeyTechGameStatsPopup with the ECHL
// league object (utils/hockeyTechLeagues.js).
import HockeyTechGameStatsPopup from './hockeytech/HockeyTechGameStatsPopup';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLGameStatsPopup(props) {
  return <HockeyTechGameStatsPopup league={ECHL} {...props} />;
}
