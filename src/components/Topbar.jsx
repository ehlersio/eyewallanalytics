import { useState, useEffect, useRef } from 'react';
import { getLiveGame, getCarScore, getOppScore, getOpponent, getGameDetail, bustLiveGameCache } from '../utils/nhlApi';
import TeamLogo from './TeamLogo';
import { TEAM_COLORS } from '../utils/nhlApi';
import './Topbar.css';
import AboutPopup from './AboutPopup';
import { subscribeClock, getClockDisplay, getMomentum, subscribeMomentum } from '../utils/liveClockStore';
import NotificationBell from './NotificationBell';

const POLL_LIVE_MS = 10_000;      // 10s — matches ShotMapView
const POLL_IDLE_MS = 5 * 60_000;  // 5min — no game active
const SEASON_END   = new Date('2026-07-01');

export default function Topbar() {
  const [liveGame,    setLiveGame]    = useState(null);
  const [liveMeta,    setLiveMeta]    = useState(null);
  const [displayClock, setDisplayClock] = useState(null);
  const [clockRunning, setClockRunning] = useState(true);
  const [momentum,    setMomentum]    = useState(null);

  const intervalRef  = useRef(null);
  const clockRef     = useRef(null);

  // Clock display is derived from shared liveClockStore — no local countdown needed

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
          setLiveMeta({ period: pbp.periodDescriptor, clock: pbp.clock });
          // Clock display handled by shared store — no local countdown needed
        }
      } else {
        setLiveMeta(null);
        setDisplayClock(null);
        if (clockRef.current) clearInterval(clockRef.current);
      }
      scheduleNext(!!game);
    } catch { /* ignore */ }
  }

  // Tick from shared clock store — same source as ShotMapView, guaranteed in sync
  useEffect(() => {
    if (clockRef.current) clearInterval(clockRef.current);
    clockRef.current = setInterval(() => {
      const r = getClockDisplay();
      if (r) {
        setDisplayClock(r.display);
        setClockRunning(r.running !== false);
      } else {
        setDisplayClock(null);
      }
    }, 250);
    return () => clearInterval(clockRef.current);
  }, []);

  // Subscribe to momentum store
  useEffect(() => {
    const unsub = subscribeMomentum(data => setMomentum(data));
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
      <div className="topbar-row">
        <AboutPopup isLive={!!liveGame} />

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
                {displayClock && !clockRunning && <span className="clock-stopped-tb">⏸</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="topbar-status">
            <span className="status-dot-idle" />
            <span className="topbar-no-live">Off season</span>
          </div>
        )}

        <NotificationBell />
      </div>

      {liveGame && momentum && (
        <div className="topbar-momentum">
          <div className="tb-mom-labels">
            <span className="tb-mom-car">CAR</span>
            <span className="tb-mom-window">{momentum.window}m</span>
            <span className="tb-mom-opp">{opp?.abbrev}</span>
          </div>
          <div className="tb-mom-track">
            <div className="tb-mom-center" />
            <div className="tb-mom-fill-car" style={{ width: `${Math.max(0, momentum.carPct - 50)}%` }} />
            <div className="tb-mom-fill-opp" style={{ width: `${Math.max(0, 50 - momentum.carPct)}%` }} />
          </div>
        </div>
      )}
    </header>
  );
}
