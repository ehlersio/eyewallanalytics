// views/hockeytech/HockeyTechGuestGameView.jsx
// /{league}/game/:gameId?as=HER -- one AHL/ECHL game, watched from a team
// that isn't the user's followed one: HockeyTechShotMapView inside a
// GameTeamProvider for that team, pinned to that game (no season tabs or
// game chips). The followed team, and everything else in the app, stays as
// it was: nothing about the guest team is saved. The NHL's GuestGameView.jsx
// is the model; AHLGuestGameView/ECHLGuestGameView are the wrappers.
//
// Reached from a live game's team row on the league's Scoreboard, which
// always names the side (?as=). A link without one opens as the home team,
// read from the game's own /live answer. The live score and play-by-play
// come from the shared poller (hockeyTechLiveStore.js) for the guest team,
// as they do for the followed team's own page.
//
// Unlike the NHL guest view the app keeps its colors: the AHL/ECHL pages
// don't wear the followed team's colors either.
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import HockeyTechShotMapView from './HockeyTechShotMapView';
import GuestGameBar from '../../components/GuestGameBar';
import { GameTeamProvider } from '../../utils/GameTeamContext';
import { guestTeamFor } from '../../utils/hockeyTechGuestGame';
import { useFetch } from '../../hooks/useFetch';
import { PAGE_CLASSES } from '../../utils/pageClasses';
import { SKELETON_CLASSES } from '../../utils/skeletonClasses';

const WRAP_CLASSES = 'h-full flex flex-col';
const VIEW_CLASSES = 'flex-1 min-h-0';

export default function HockeyTechGuestGameView({ league }) {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const asAbbr = searchParams.get('as');
  const id = Number(gameId);
  const validId = Number.isInteger(id) && id > 0;

  // Only without ?as=: which team is at home.
  const needsGame = validId && !asAbbr;
  const { data: game, loading } = useFetch(
    () => needsGame ? league.api.fetchLive(id) : Promise.resolve(null),
    [needsGame, id]
  );

  if (needsGame && loading) {
    return (
      <div className={PAGE_CLASSES}>
        <div className={SKELETON_CLASSES} style={{ height: 280, width: '100%', borderRadius: 8 }} />
      </div>
    );
  }

  const team = validId ? guestTeamFor(league, asAbbr, game) : null;
  // A malformed link has no game to show, and the followed team's own
  // games are already what its Shot Map shows.
  if (!team || team.abbr === league.team?.abbr) return <Navigate to={`/${league.key}/shots`} replace />;

  // Keyed so moving from one game or team to another starts clean.
  return (
    <div className={WRAP_CLASSES}>
      <GuestGameBar abbr={team.abbr} sport={league.key} backTo={`/${league.key}/league`} />
      <div className={VIEW_CLASSES}>
        <GameTeamProvider team={team} gameId={id}>
          <HockeyTechShotMapView key={`${team.abbr}-${id}`} league={league} />
        </GameTeamProvider>
      </div>
    </div>
  );
}
