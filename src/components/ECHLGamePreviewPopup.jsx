// components/ECHLGamePreviewPopup.jsx
// ECHL pre-game preview popup: the shared HockeyTechGamePreviewPopup with
// the ECHL league object (utils/hockeyTechLeagues.js).
import HockeyTechGamePreviewPopup from './hockeytech/HockeyTechGamePreviewPopup';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLGamePreviewPopup(props) {
  return <HockeyTechGamePreviewPopup league={ECHL} {...props} />;
}
