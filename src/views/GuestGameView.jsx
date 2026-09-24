// views/GuestGameView.jsx
// /game/:gameId?as=BOS -- one NHL game, watched from a team that isn't
// the user's favorite. It's the regular game view (ShotMapView) inside a
// GameTeamProvider, so the guest team reaches only that view: the saved
// favorite, and everything else in the app, stays as it was. See
// GameTeamContext.jsx.
//
// Reached from a live game's team row on the League page's Scoreboard.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import ShotMapView from './ShotMapView';
import TeamLogo from '../components/TeamLogo';
import { GameTeamProvider } from '../utils/GameTeamContext';
import { getTeamByAbbr, TEAM_CONFIG } from '../utils/teamConfig';
import { applyTeamTheme, setGuestThemeTeam } from '../utils/applyTeamTheme';
import { getTheme } from '../utils/themeConfig';

const WRAP_CLASSES = 'h-full flex flex-col';
const BAR_CLASSES = 'guest-game-bar shrink-0 flex items-center justify-between gap-3 py-2 px-3.5 max-[700px]:px-2.5 bg-[var(--bg1)] border-b-[0.5px] border-b-[color:var(--border)]';
const VIEWING_CLASSES = 'flex items-center gap-2 min-w-0 text-[12px] font-semibold team-primary-text';
const BACK_CLASSES = 'guest-game-back shrink-0 flex items-center gap-1.5 min-h-[36px] py-1 px-3 rounded-[20px] text-[12px] font-semibold text-[color:var(--text-muted)] bg-[var(--btn-fill)] hover:bg-[var(--btn-fill-hover)] hover:text-[color:var(--text)]';
const VIEW_CLASSES = 'flex-1 min-h-0';

function GuestBar({ team }) {
  const { t } = useTranslation();
  return (
    <div className={BAR_CLASSES}>
      <span className={VIEWING_CLASSES}>
        <TeamLogo abbr={team.abbr} size={20} />
        <span className="truncate">{t('guestGame.viewingAs', { team: team.abbr })}</span>
      </span>
      <Link to="/" className={BACK_CLASSES}>
        <TeamLogo abbr={TEAM_CONFIG.abbr} size={16} />
        {t('guestGame.backTo', { team: TEAM_CONFIG.abbr })}
      </Link>
    </div>
  );
}

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
      <GuestBar team={team} />
      <div className={VIEW_CLASSES}>
        <GameTeamProvider team={team} gameId={id}>
          <ShotMapView key={`${team.abbr}-${id}`} />
        </GameTeamProvider>
      </div>
    </div>
  );
}
