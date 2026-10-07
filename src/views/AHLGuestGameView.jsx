// views/AHLGuestGameView.jsx
// /ahl/game/:gameId?as= -- the shared HockeyTechGuestGameView with the
// AHL league object (utils/hockeyTechLeagues.js).
import HockeyTechGuestGameView from './hockeytech/HockeyTechGuestGameView';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLGuestGameView() {
  return <HockeyTechGuestGameView league={AHL} />;
}
