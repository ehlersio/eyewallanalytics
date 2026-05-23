import { useState, useEffect, useRef } from 'react';
import { getLiveGame, getCarScore, getOppScore, getOpponent } from '../utils/nhlApi';
import TeamLogo from './TeamLogo';
import { TEAM_COLORS } from '../utils/nhlApi';
import './Topbar.css';

// Poll fast when live, slow when idle, stop when no games remain
const POLL_LIVE_MS  = 30_000;   // 30s  — active game, keep score fresh
const POLL_IDLE_MS  = 5 * 60_000; // 5min — waiting for a game to start
const SEASON_END    = new Date('2026-07-01'); // stop polling after season

export default function Topbar() {
  const [liveGame, setLiveGame] = useState(null);
  const intervalRef = useRef(null);

  function scheduleNext(isLive) {
    clearInterval(intervalRef.current);
    // If past season end date, don't poll at all
    if (Date.now() > SEASON_END.getTime()) return;
    const ms = isLive ? POLL_LIVE_MS : POLL_IDLE_MS;
    intervalRef.current = setInterval(checkLive, ms);
  }

  async function checkLive() {
    try {
      const game = await getLiveGame();
      setLiveGame(game);
      scheduleNext(!!game); // reschedule at appropriate rate
    } catch {
      // Swallow errors silently — don't spam console during network issues
    }
  }

  useEffect(() => {
    if (Date.now() > SEASON_END.getTime()) return; // season over, skip entirely
    checkLive();
    return () => clearInterval(intervalRef.current);
  }, []);

  const opp      = liveGame ? getOpponent(liveGame) : null;
  const carScore = liveGame ? getCarScore(liveGame) : null;
  const oppScore = liveGame ? getOppScore(liveGame) : null;
  const period   = liveGame?.periodDescriptor?.number;
  const clock    = liveGame?.clock?.timeRemaining;

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <img
          src="/eyewall-logo.svg"
          alt="EyeWall Analytics"
          className="topbar-logoimg"
          width="36" height="36"
        />
        <div>
          <div className="topbar-name">EyeWall Analytics</div>
          <div className="topbar-sub">Carolina Hurricanes</div>
        </div>
      </div>

      {liveGame ? (
        <div className="topbar-live">
          <div className="live-dot" />
          <div className="live-score">
            <TeamLogo abbr="CAR" size={18} />
            <span className="live-team-red">CAR</span>
            <span className="live-num">{carScore}</span>
            <span className="live-sep">–</span>
            <span className="live-num">{oppScore}</span>
            <span className="live-team-muted">{opp?.abbrev}</span>
            <TeamLogo abbr={opp?.abbrev} size={18} color={TEAM_COLORS[opp?.abbrev]} />
          </div>
          <div className="live-clock">P{period} · {clock}</div>
        </div>
      ) : (
        <div className="topbar-status">
          <span className="status-dot-idle" />
          <span className="topbar-no-live">No game in progress</span>
        </div>
      )}
    </header>
  );
}
