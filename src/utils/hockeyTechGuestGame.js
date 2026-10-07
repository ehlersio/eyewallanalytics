// utils/hockeyTechGuestGame.js
// The AHL/ECHL guest game view's pure pieces (HockeyTechGuestGameView.jsx,
// and HockeyTechShotMapView.jsx when it's in a guest provider).

// Which side of its game the guest view is on, for the subtitle when the
// game isn't among the team's finals on screen: from today's row while the
// game is live, from the ended game's last snapshot (/live, which carries
// no date) once it's final. null when neither says, or the team isn't in
// the game.
export function guestGameLine(teamId, { liveGame, ended }) {
  const game = liveGame || ended;
  if (!game || teamId == null) return null;
  const isHome = game.homeTeamId === teamId;
  if (!isHome && game.awayTeamId !== teamId) return null;
  const state = liveGame ? 'live' : game.gameStatus === 'final' ? 'final' : null;
  if (!state) return null;
  return {
    state,
    isHome,
    oppId: isHome ? game.awayTeamId : game.homeTeamId,
    endedIn: state === 'final' ? (game.endedIn ?? null) : null,
  };
}

// The team a guest link opens as: ?as= when it names one of the league's
// current teams, the home team (from the game's own /live answer) when
// there's no ?as=, otherwise null (a link the view can't open).
export function guestTeamFor(league, asAbbr, game) {
  if (asAbbr) return league.config.getTeamByAbbr(asAbbr) || null;
  return game?.homeTeamId != null ? league.config.getTeamById(game.homeTeamId) || null : null;
}
