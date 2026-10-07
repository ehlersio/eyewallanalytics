// views/AHLLeagueView.jsx
// AHL League tab: the shared HockeyTechLeagueView with the AHL league
// object (utils/hockeyTechLeagues.js, which holds its division order).
import HockeyTechLeagueView from './hockeytech/HockeyTechLeagueView';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLLeagueView() {
  return <HockeyTechLeagueView league={AHL} />;
}
