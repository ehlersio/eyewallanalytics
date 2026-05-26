import { useState, useEffect, useRef } from 'react';
import { getLiveGame, getCarScore, getOppScore, getOpponent, getGameDetail, bustLiveGameCache } from '../utils/nhlApi';
import TeamLogo from './TeamLogo';
import { TEAM_COLORS } from '../utils/nhlApi';
import './Topbar.css';
import AboutPopup from './AboutPopup';
import { subscribeClock } from '../utils/liveClockStore';
import NotificationBell from './NotificationBell';

const POLL_LIVE_MS = 10_000;      // 10s — matches ShotMapView
const POLL_IDLE_MS = 5 * 60_000;  // 5min — no game active
const SEASON_END   = new Date('2026-07-01');

export default function Topbar() {
  const [liveGame,    setLiveGame]    = useState(null);
  const [liveMeta,    setLiveMeta]    = useState(null);
  const [displayClock, setDisplayClock] = useState(null);

  const intervalRef  = useRef(null);
  const clockRef     = useRef(null);
  const lastSyncRef  = useRef(null);

  // ── Countdown tick ──────────────────────────────────────────
  function startCountdown(timeRemaining) {
    if (!timeRemaining) return;
    const [m, s]  = timeRemaining.split(':').map(Number);
    const totalSecs = m * 60 + (s || 0);
    lastSyncRef.current = { totalSecs, syncTime: Date.now() };
    setDisplayClock(timeRemaining);

    if (clockRef.current) clearInterval(clockRef.current);
    clockRef.current = setInterval(() => {
      const elapsed   = Math.floor((Date.now() - lastSyncRef.current.syncTime) / 1000);
      const remaining = Math.max(0, lastSyncRef.current.totalSecs - elapsed);
      const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
      const ss = (remaining % 60).toString().padStart(2, '0');
      setDisplayClock(`${mm}:${ss}`);
      if (remaining === 0) clearInterval(clockRef.current);
    }, 1000);
  }

  // ── Live poll ───────────────────────────────────────────────
  function scheduleNext(isLive) {
    clearInterval(intervalRef.current);
    if (Date.now() > SEASON_END.getTime()) return;
    intervalRef.current = setInterval(checkLive, isLive ? POLL_LIVE_MS : POLL_IDLE_MS);
  }

  async function checkLive() {
    try {
      const game = await getLiveGame();
      setLiveGame(game);
      if (game?.id) {
        bustLiveGameCache(game.id); // bypass module cache
        const pbp = await getGameDetail(game.id).catch(() => null);
        if (pbp) {
          const meta = { period: pbp.periodDescriptor, clock: pbp.clock };
          setLiveMeta(meta);
          if (!pbp.clock?.inIntermission && pbp.clock?.timeRemaining) {
            startCountdown(pbp.clock.timeRemaining);
          } else {
            if (clockRef.current) clearInterval(clockRef.current);
            setDisplayClock(pbp.clock?.timeRemaining || null);
          }
        }
      } else {
        setLiveMeta(null);
        setDisplayClock(null);
        if (clockRef.current) clearInterval(clockRef.current);
      }
      scheduleNext(!!game);
    } catch { /* ignore */ }
  }

  // Subscribe to clock published by ShotMapView (most authoritative source)
  useEffect(() => {
    const unsub = subscribeClock(({ timeRemaining, inIntermission }) => {
      if (!timeRemaining) return;
      if (inIntermission) {
        if (clockRef.current) clearInterval(clockRef.current);
        setDisplayClock(timeRemaining);
      } else {
        startCountdown(timeRemaining);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (Date.now() > SEASON_END.getTime()) return;
    checkLive();
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(clockRef.current);
    };
  }, []);

  const opp      = liveGame ? getOpponent(liveGame) : null;
  const carScore = liveGame ? getCarScore(liveGame) : null;
  const oppScore = liveGame ? getOppScore(liveGame) : null;
  const pd       = liveMeta?.period;
  const isIntermission = liveMeta?.clock?.inIntermission;
  const period = pd
    ? isIntermission
      ? `${pd.number === 1 ? '1st' : pd.number === 2 ? '2nd' : '3rd'} INT`
      : (pd.periodType === 'REG' ? `P${pd.number}` : (pd.periodType || `P${pd.number}`))
    : null;

  return (
    <header className="topbar">
      <AboutPopup />

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
          {(period || displayClock) && (
            <div className="live-clock">
              {period}{period && displayClock ? ' · ' : ''}{displayClock}
            </div>
          )}
        </div>
      ) : (
        <div className="topbar-status">
          <span className="status-dot-idle" />
          <span className="topbar-no-live">No game in progress</span>
        </div>
      )}

      <NotificationBell />
    </header>
  );
}
