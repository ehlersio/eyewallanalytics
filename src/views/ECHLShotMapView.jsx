// views/ECHLShotMapView.jsx
// ECHL Shot Map tab: the shared HockeyTechShotMapView with the ECHL league
// object (utils/hockeyTechLeagues.js).
import HockeyTechShotMapView from './hockeytech/HockeyTechShotMapView';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLShotMapView() {
  return <HockeyTechShotMapView league={ECHL} />;
}
