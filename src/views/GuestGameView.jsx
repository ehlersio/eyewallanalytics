// views/GuestGameView.jsx
// /game/:gameId?as=BOS -- one NHL game, watched from a team that isn't
// the user's favorite. It's the regular game view (ShotMapView) inside a
// GameTeamProvider, so the guest team reaches only that view: the saved
// favorite, and everything else in the app, stays as it was. See
// GameTeamContext.jsx.
//
// Reached from a live game's team row on the League page's Scoreboard.
import { useEffect } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import ShotMapView from './ShotMapView';
import GuestGameBar from '../components/GuestGameBar';
import { GameTeamProvider } from '../utils/GameTeamContext';
import { getTeamByAbbr, TEAM_CONFIG } from '../utils/teamConfig';
import { applyTeamTheme, setGuestThemeTeam } from '../utils/applyTeamTheme';
import { getTheme } from '../utils/themeConfig';

const WRAP_CLASSES = 'h-full flex flex-col';
const VIEW_CLASSES = 'flex-1 min-h-0';

// The guest team's colors while the view is open, the favorite's again
// on the way out.
function useGuestTheme(team) {
  useEffect(() => {
    if (!team) return;
    setGuestThemeTeam(team);
    applyTeamTheme(team, getTheme());
    return () => {
      setGuestThemeTeam(null);
      applyTeamTheme(TEAM_CONFIG, getTheme());
    };
  }, [team]);
}

export default function GuestGameView() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const team = getTeamByAbbr(searchParams.get('as'));
  const id = Number(gameId);
  // A malformed link has no game to show. The favorite's own game is
  // already what / shows, so there's nothing to be a guest of.
  const valid = !!team && Number.isInteger(id) && id > 0 && team.abbr !== TEAM_CONFIG.abbr;

  useGuestTheme(valid ? team : null);

  if (!valid) return <Navigate to="/" replace />;

  // Keyed so moving from one game or team to another starts clean,
  // rather than carrying the last game's popups and drill-downs over.
  return (
    <div className={WRAP_CLASSES}>
      <GuestGameBar abbr={team.abbr} backTo="/league" />
      <div className={VIEW_CLASSES}>
        <GameTeamProvider team={team} gameId={id}>
          <ShotMapView key={`${team.abbr}-${id}`} />
        </GameTeamProvider>
      </div>
    </div>
  );
}
