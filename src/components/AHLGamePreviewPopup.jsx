// components/AHLGamePreviewPopup.jsx
// AHL pre-game preview popup: the shared HockeyTechGamePreviewPopup with
// the AHL league object (utils/hockeyTechLeagues.js).
import HockeyTechGamePreviewPopup from './hockeytech/HockeyTechGamePreviewPopup';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLGamePreviewPopup(props) {
  return <HockeyTechGamePreviewPopup league={AHL} {...props} />;
}
