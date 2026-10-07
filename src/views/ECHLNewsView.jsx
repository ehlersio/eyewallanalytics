// views/ECHLNewsView.jsx
// ECHL News tab: the shared HockeyTechNewsView with the ECHL league object
// (utils/hockeyTechLeagues.js, which holds the league's news sources).
import HockeyTechNewsView from './hockeytech/HockeyTechNewsView';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLNewsView() {
  return <HockeyTechNewsView league={ECHL} />;
}
