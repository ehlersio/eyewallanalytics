// components/GuestGameBar.jsx
// The bar over a guest game view (GuestGameView.jsx for the NHL,
// HockeyTechGuestGameView.jsx for the AHL/ECHL): which team the game is
// being watched as, and the way back to the Scoreboard it was opened from.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import TeamLogo from './TeamLogo';

const BAR_CLASSES = 'guest-game-bar shrink-0 flex items-center justify-between gap-3 py-2 px-3.5 max-[700px]:px-2.5 bg-[var(--bg1)] border-b-[0.5px] border-b-[color:var(--border)]';
const VIEWING_CLASSES = 'flex items-center gap-2 min-w-0 text-[12px] font-semibold team-primary-text';
const BACK_CLASSES = 'guest-game-back shrink-0 flex items-center gap-1.5 min-h-[36px] py-1 px-3 rounded-[20px] text-[12px] font-semibold text-[color:var(--text-muted)] bg-[var(--btn-fill)] hover:bg-[var(--btn-fill-hover)] hover:text-[color:var(--text)]';

// `backTo`: the league's League page, whose first tab is the Scoreboard.
export default function GuestGameBar({ abbr, sport = 'nhl', backTo }) {
  const { t } = useTranslation();
  return (
    <div className={BAR_CLASSES}>
      <span className={VIEWING_CLASSES}>
        <TeamLogo abbr={abbr} sport={sport} size={20} />
        <span className="truncate">{t('guestGame.viewingAs', { team: abbr })}</span>
      </span>
      <Link to={backTo} className={BACK_CLASSES}>
        <span aria-hidden="true">‹</span>
        {t('guestGame.backToScoreboard')}
      </Link>
    </div>
  );
}
