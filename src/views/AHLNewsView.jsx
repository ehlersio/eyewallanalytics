// views/AHLNewsView.jsx
// AHL News tab: the shared HockeyTechNewsView with the AHL league object
// (utils/hockeyTechLeagues.js, which holds the league's news sources).
import HockeyTechNewsView from './hockeytech/HockeyTechNewsView';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLNewsView() {
  return <HockeyTechNewsView league={AHL} />;
}
