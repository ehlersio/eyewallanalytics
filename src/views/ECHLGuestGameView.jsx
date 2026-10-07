// views/ECHLGuestGameView.jsx
// /echl/game/:gameId?as= -- the shared HockeyTechGuestGameView with the
// ECHL league object (utils/hockeyTechLeagues.js).
import HockeyTechGuestGameView from './hockeytech/HockeyTechGuestGameView';
import { ECHL } from '../utils/hockeyTechLeagues';

export default function ECHLGuestGameView() {
  return <HockeyTechGuestGameView league={ECHL} />;
}
