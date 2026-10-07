// views/AHLScheduleView.jsx
// AHL Schedule tab: the shared HockeyTechScheduleView with the AHL league
// object (utils/hockeyTechLeagues.js).
import HockeyTechScheduleView, { GameCard as HockeyTechGameCard } from './hockeytech/HockeyTechScheduleView';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLScheduleView() {
  return <HockeyTechScheduleView league={AHL} />;
}

export function GameCard(props) {
  return <HockeyTechGameCard league={AHL} {...props} />;
}
