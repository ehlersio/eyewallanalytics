// views/AHLShotMapView.jsx
// AHL Shot Map tab: the shared HockeyTechShotMapView with the AHL league
// object (utils/hockeyTechLeagues.js).
import HockeyTechShotMapView from './hockeytech/HockeyTechShotMapView';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLShotMapView() {
  return <HockeyTechShotMapView league={AHL} />;
}
