// utils/pwhlGuestGame.js
// The PWHL guest game view's pure piece (PWHLGuestGameView.jsx), the twin
// of hockeyTechGuestGame.js's guestTeamFor.
import { getPWHLTeamConfig, getPWHLTeamById } from './pwhlConfig';

// The team a link opens as: ?as= when it names a PWHL team, the home team
// (from the game's own /pwhl/live) without one, else null (a link the view
// can't open).
export function pwhlGuestTeamFor(asAbbr, game) {
  if (asAbbr) return getPWHLTeamConfig(asAbbr) || null;
  return game?.homeTeamId != null ? getPWHLTeamById(game.homeTeamId) || null : null;
}
