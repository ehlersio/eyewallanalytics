// views/ECHLTeamView.jsx
// ECHL Team tab: the shared HockeyTechTeamView with the ECHL league object
// (utils/hockeyTechLeagues.js).
import HockeyTechTeamView, { TrendsTab as HockeyTechTrendsTab } from './hockeytech/HockeyTechTeamView';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLTeamView() {
  return <HockeyTechTeamView league={ECHL} />;
}

export function TrendsTab(props) {
  return <HockeyTechTrendsTab league={ECHL} {...props} />;
}
