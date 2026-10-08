// views/PWHLGuestGameView.jsx
// /pwhl/game/:gameId?as=MTL -- one PWHL game, watched from a team that
// isn't the user's followed one: PWHLShotMapView inside a GameTeamProvider
// for that team, pinned to that game (no season chips or game chips). The
// followed team, and everything else in the app, stays as it was: nothing
// about the guest team is saved, its summaries stay out of the bell, and
// its "already shown" popup flags are its own. The AHL/ECHL
// HockeyTechGuestGameView.jsx is the model.
//
// Reached from a live game's team row on the PWHL Scoreboard, which always
// names the side (?as=). A link without one opens as the home team, read
// from the game's own /pwhl/live answer. The live score and play-by-play
// come from the shared poller (hockeyTechLiveStore.js) for the guest team,
// as they do for the followed team's own page.
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import PWHLShotMapView from './PWHLShotMapView';
import GuestGameBar from '../components/GuestGameBar';
import { GameTeamProvider } from '../utils/GameTeamContext';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLLive, PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { pwhlGuestTeamFor } from '../utils/pwhlGuestGame';
import { PAGE_CLASSES } from '../utils/pageClasses';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const WRAP_CLASSES = 'h-full flex flex-col';
const VIEW_CLASSES = 'flex-1 min-h-0';

export default function PWHLGuestGameView() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const asAbbr = searchParams.get('as');
  const id = Number(gameId);
  const validId = Number.isInteger(id) && id > 0;

  // Only without ?as=: which team is at home.
  const needsGame = validId && !asAbbr;
  const { data: game, loading } = useFetch(
    () => needsGame ? fetchPWHLLive(id) : Promise.resolve(null),
    [needsGame, id]
  );

  if (needsGame && loading) {
    return (
      <div className={PAGE_CLASSES}>
        <div className={SKELETON_CLASSES} style={{ height: 280, width: '100%', borderRadius: 8 }} />
      </div>
    );
  }

  const team = validId ? pwhlGuestTeamFor(asAbbr, game) : null;
  // A malformed link has no game to show, and the followed team's own
  // games are already what its Shot Map shows.
  if (!team || team.abbr === PWHL_TEAM_CONFIG?.abbr) return <Navigate to="/pwhl/shots" replace />;

  // Keyed so moving from one game or team to another starts clean.
  return (
    <div className={WRAP_CLASSES}>
      <GuestGameBar abbr={team.abbr} sport="pwhl" backTo="/pwhl/league" />
      <div className={VIEW_CLASSES}>
        <GameTeamProvider team={team} gameId={id}>
          <PWHLShotMapView key={`${team.abbr}-${id}`} />
        </GameTeamProvider>
      </div>
    </div>
  );
}
