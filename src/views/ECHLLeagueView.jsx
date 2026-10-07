// views/ECHLLeagueView.jsx
// ECHL League tab: the shared HockeyTechLeagueView with the ECHL league
// object (utils/hockeyTechLeagues.js, which holds its division order).
import HockeyTechLeagueView from './hockeytech/HockeyTechLeagueView';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLLeagueView() {
  return <HockeyTechLeagueView league={ECHL} />;
}
