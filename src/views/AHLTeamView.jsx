// views/AHLTeamView.jsx
// AHL Team tab: the shared HockeyTechTeamView with the AHL league object
// (utils/hockeyTechLeagues.js).
import HockeyTechTeamView, { TrendsTab as HockeyTechTrendsTab } from './hockeytech/HockeyTechTeamView';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLTeamView() {
  return <HockeyTechTeamView league={AHL} />;
}

export function TrendsTab(props) {
  return <HockeyTechTrendsTab league={AHL} {...props} />;
}
