// views/ECHLPlayersView.jsx
// ECHL Players tab: the shared HockeyTechPlayersView with the ECHL league
// object (utils/hockeyTechLeagues.js).
import HockeyTechPlayersView from './hockeytech/HockeyTechPlayersView';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLPlayersView() {
  return <HockeyTechPlayersView league={ECHL} />;
}
