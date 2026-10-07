// components/ECHLCalendarView.jsx
// ECHL schedule calendar: the shared HockeyTechCalendarView with the ECHL
// league object (utils/hockeyTechLeagues.js).
import HockeyTechCalendarView from './hockeytech/HockeyTechCalendarView';
import { ECHL } from '../utils/hockeyTechLeagues';

export function ECHLCalendarView(props) {
  return <HockeyTechCalendarView league={ECHL} {...props} />;
}
