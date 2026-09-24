// views/GuestGameView.jsx
// /game/:gameId?as=BOS -- one NHL game, watched from a team that isn't
// the user's favorite. It's the regular game view (ShotMapView) inside a
// GameTeamProvider, so the guest team reaches only that view: the saved
// favorite, and everything else in the app, stays as it was. See
// GameTeamContext.jsx.
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import ShotMapView from './ShotMapView';
import { GameTeamProvider } from '../utils/GameTeamContext';
import { getTeamByAbbr, TEAM_CONFIG } from '../utils/teamConfig';

export default function GuestGameView() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const team = getTeamByAbbr(searchParams.get('as'));
  const id = Number(gameId);

  // A malformed link has no game to show. The favorite's own game is
  // already what / shows, so there's nothing to be a guest of.
  if (!team || !Number.isInteger(id) || id <= 0 || team.abbr === TEAM_CONFIG.abbr) {
    return <Navigate to="/" replace />;
  }

  // Keyed so moving from one game or team to another starts clean,
  // rather than carrying the last game's popups and drill-downs over.
  return (
    <GameTeamProvider team={team} gameId={id}>
      <ShotMapView key={`${team.abbr}-${id}`} />
    </GameTeamProvider>
  );
}
