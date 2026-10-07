// views/ECHLScheduleView.jsx
// ECHL Schedule tab: the shared HockeyTechScheduleView with the ECHL league
// object (utils/hockeyTechLeagues.js).
import HockeyTechScheduleView, { GameCard as HockeyTechGameCard } from './hockeytech/HockeyTechScheduleView';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLScheduleView() {
  return <HockeyTechScheduleView league={ECHL} />;
}

export function GameCard(props) {
  return <HockeyTechGameCard league={ECHL} {...props} />;
}
