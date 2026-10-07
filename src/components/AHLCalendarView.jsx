// components/AHLCalendarView.jsx
// AHL schedule calendar: the shared HockeyTechCalendarView with the AHL
// league object (utils/hockeyTechLeagues.js).
import HockeyTechCalendarView from './hockeytech/HockeyTechCalendarView';
import { AHL } from '../utils/hockeyTechLeagues';

export function AHLCalendarView(props) {
  return <HockeyTechCalendarView league={AHL} {...props} />;
}
