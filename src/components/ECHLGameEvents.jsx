// components/ECHLGameEvents.jsx
// ECHL live game event popups and their hook: the shared
// hockeytech/HockeyTechGameEvents.jsx with the ECHL league object
// (utils/hockeyTechLeagues.js). sessionStorage keys stay echl_goals_<gameId> etc.
import {
  PuckDropPopup, GoalPopup, PenaltyPopup, WinPopup, useHockeyTechGameEvents,
} from './hockeytech/HockeyTechGameEvents';
import { ECHL } from '../utils/hockeyTechLeagues';

export function ECHLPuckDropPopup(props) {
  return <PuckDropPopup league={ECHL} {...props} />;
}

export function ECHLGoalPopup(props) {
  return <GoalPopup league={ECHL} {...props} />;
}

export function ECHLPenaltyPopup(props) {
  return <PenaltyPopup league={ECHL} {...props} />;
}

export { WinPopup as ECHLWinPopup };

export function useECHLGameEvents(liveData, isLive, teamId, teamAbbr, isPlayoff = false) {
  return useHockeyTechGameEvents(ECHL, liveData, isLive, teamId, teamAbbr, isPlayoff);
}
