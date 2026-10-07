// views/AHLPlayersView.jsx
// AHL Players tab: the shared HockeyTechPlayersView with the AHL league
// object (utils/hockeyTechLeagues.js).
import HockeyTechPlayersView from './hockeytech/HockeyTechPlayersView';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLPlayersView() {
  return <HockeyTechPlayersView league={AHL} />;
}
