// components/AHLGameEvents.jsx
// AHL live game event popups and their hook: the shared
// hockeytech/HockeyTechGameEvents.jsx with the AHL league object
// (utils/hockeyTechLeagues.js). sessionStorage keys stay ahl_goals_<gameId> etc.
import {
  PuckDropPopup, GoalPopup, PenaltyPopup, WinPopup, useHockeyTechGameEvents,
} from './hockeytech/HockeyTechGameEvents';
import { AHL } from '../utils/hockeyTechLeagues';

export function AHLPuckDropPopup(props) {
  return <PuckDropPopup league={AHL} {...props} />;
}

export function AHLGoalPopup(props) {
  return <GoalPopup league={AHL} {...props} />;
}

export function AHLPenaltyPopup(props) {
  return <PenaltyPopup league={AHL} {...props} />;
}

export { WinPopup as AHLWinPopup };

export function useAHLGameEvents(liveData, isLive, teamId, teamAbbr, isPlayoff = false) {
  return useHockeyTechGameEvents(AHL, liveData, isLive, teamId, teamAbbr, isPlayoff);
}
