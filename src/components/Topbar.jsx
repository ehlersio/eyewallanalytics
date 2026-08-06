import { useState, useEffect, useRef } from 'react';
import { getLiveGame, getCarScore, getOppScore, getOpponent, getGameDetail, bustLiveGameCache } from '../utils/nhlApi';
import TeamLogo from './TeamLogo';
import { TEAM_COLORS, TEAM_CONFIG } from '../utils/nhlApi';
import { useSport } from '../utils/SportContext';
import AboutPopup from './AboutPopup';
import { subscribeClock, getClockDisplay, publishClock, subscribeMomentum, subscribeMockLiveGame } from '../utils/liveClockStore';
import NotificationBell from './NotificationBell';
import PlayerSearch from './PlayerSearch';

const POLL_LIVE_MS = 10_000;      // 10s — matches ShotMapView
const POLL_IDLE_MS = 5 * 60_000;  // 5min — no game active
const SEASON_END   = new Date('2026-07-01');

// Tailwind migration (Session 95, Phase 1) -- previously Topbar.css.
// .topbar and .topbar-no-live are kept as literal marker strings alongside
// the Tailwind utilities -- a large number of Cypress specs (navigation,
// shot-map, pwhl-*, player-search, topnav-safe-area, this repo's own
// visual-regression.cy.js) select `.topbar` as their page-ready gate, and
// viewports.cy.js's off-season detection reads `.topbar-no-live` by class
// name specifically (see that file's own comment). Neither carries CSS of
// its own anymore; Tailwind owns the visuals, these are pure test hooks.
const TOPBAR_CLASSES = 'topbar h-auto min-h-[var(--topbar-height)] bg-[var(--bg1)] border-b-[0.5px] border-b-[var(--red-border)] flex flex-col px-4 pb-0 pt-[env(safe-area-inset-top,0px)] shrink-0 sticky top-0 z-[100]';
const ROW_CLASSES = 'flex items-center justify-between gap-3 h-[var(--topbar-height)]';
const ICONS_CLASSES = 'flex items-center gap-1';
const LIVE_CLASSES = 'flex items-center gap-2 bg-[var(--red-dim)] border-[0.5px] border-[var(--red-border)] rounded-[20px] py-[5px] px-3 max-[480px]:py-1 max-[480px]:px-2 max-[480px]:gap-[5px]';
const LIVE_SCORE_CLASSES = 'flex items-center gap-[5px] font-[family-name:var(--font-display)] text-[14px] font-semibold max-[480px]:text-[12px] max-[480px]:gap-[3px]';
const LIVE_TEAM_RED_CLASSES = 'text-[color:var(--red-bright)]';
const LIVE_TEAM_MUTED_CLASSES = 'text-[color:var(--text-muted)]';
const LIVE_NUM_CLASSES = 'text-[color:var(--text)]';
const LIVE_SEP_CLASSES = 'text-[color:var(--text-dim)]';
const LIVE_CLOCK_CLASSES = 'text-[11px] text-[color:var(--amber)] font-[family-name:var(--font-mono)] max-[480px]:hidden';
const STATUS_CLASSES = 'flex items-center gap-1.5 text-[11px] text-[color:var(--text-dim)]';
const STATUS_DOT_CLASSES = 'w-1.5 h-1.5 rounded-full bg-[var(--text-dim)]';
const NO_LIVE_CLASSES = 'topbar-no-live hidden';
const CLOCK_STOPPED_CLASSES = 'text-[#fbbf24] text-[10px] ml-[3px]';
const MOMENTUM_CLASSES = 'pb-[7px] flex flex-col gap-[3px]';
const MOM_LABELS_CLASSES = 'flex justify-between text-[9px] tracking-[0.05em] uppercase';
const MOM_CAR_CLASSES = 'text-[color:var(--red-bright)] font-semibold';
const MOM_OPP_CLASSES = 'text-[color:var(--text-dim)]';
const MOM_WINDOW_CLASSES = 'text-[color:var(--text-dim)]';
const MOM_TRACK_CLASSES = 'h-[3px] bg-[var(--bg3)] rounded-[2px] relative overflow-hidden';
const MOM_CENTER_CLASSES = 'absolute left-1/2 top-0 bottom-0 w-px bg-[var(--border-2)]';
const MOM_FILL_CAR_CLASSES = 'absolute right-1/2 top-0 bottom-0 bg-[var(--red-bright)] rounded-[2px_0_0_2px] [transition:width_0.5s_ease]';
const MOM_FILL_OPP_CLASSES = 'absolute left-1/2 top-0 bottom-0 bg-[var(--text-dim)] rounded-[0_2px_2px_0] opacity-50 [transition:width_0.5s_ease]';

export default function Topbar() {
  const { isPWHL } = useSport();
  const [liveGame,    setLiveGame]    = useState(null);
  const [liveMeta,    setLiveMeta]    = useState(null);
  const [displayClock, setDisplayClock] = useState(null);
  const [clockRunning, setClockRunning] = useState(true);
  const [momentum,    setMomentum]    = useState(null);
  const [mockLiveGame, setMockLiveGame] = useState(null);

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
          // Publish clock — fall back to raw string if structured data missing
          const tr = pbp.clock?.timeRemaining;
          if (tr) {
            publishClock(tr, pbp.clock.inIntermission, pbp.clock.running !== false);
          } else if (pbp.clock?.secondsRemaining != null) {
            // Some API responses use secondsRemaining instead
            const sec = pbp.clock.secondsRemaining;
            const mm = String(Math.floor(sec / 60)).padStart(2, '0');
            const ss = String(sec % 60).padStart(2, '0');
            publishClock(`${mm}:${ss}`, pbp.clock.inIntermission, pbp.clock.running !== false);
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

  // Also subscribe directly so dev mock clock updates immediately
  useEffect(() => {
    const unsub = subscribeClock(() => {
      const r = getClockDisplay();
      if (r) {
        setDisplayClock(r.display);
        setClockRunning(r.running !== false);
      }
    });
    return unsub;
  }, []);

  // Subscribe to momentum store
  useEffect(() => {
    const unsub = subscribeMomentum(data => setMomentum(data));
    return unsub;
  }, []);

  // Subscribe to dev mock live game
  useEffect(() => {
    const unsub = subscribeMockLiveGame(game => setMockLiveGame(game));
    return unsub;
  }, []);

  useEffect(() => {
    if (isPWHL) return; // PWHL has no live game feed
    if (Date.now() > SEASON_END.getTime()) return;
    checkLive();
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(clockRef.current);
    };
  }, [isPWHL]);

  const activeLiveGame = mockLiveGame || liveGame;
  const opp      = activeLiveGame ? getOpponent(activeLiveGame) : null;
  const carScore = activeLiveGame ? getCarScore(activeLiveGame) : null;
  const oppScore = activeLiveGame ? getOppScore(activeLiveGame) : null;
  const pd       = liveMeta?.period || mockLiveGame?._period;
  const isIntermission = liveMeta?.clock?.inIntermission;
  const period = pd
    ? isIntermission
      ? `${pd.number === 1 ? '1st' : pd.number === 2 ? '2nd' : '3rd'} INT`
      : (pd.periodType === 'REG' ? `P${pd.number}` : (pd.periodType || `P${pd.number}`))
    : null;

  return (
    <header className={TOPBAR_CLASSES}>
      <div className={ROW_CLASSES}>
        <AboutPopup isLive={!!activeLiveGame} />

        {activeLiveGame ? (
          <div className={LIVE_CLASSES}>
            <div className="live-dot" />
            <div className={LIVE_SCORE_CLASSES}>
              <TeamLogo abbr={TEAM_CONFIG.abbr} size={18} />
              <span className={LIVE_TEAM_RED_CLASSES}>{TEAM_CONFIG.abbr}</span>
              <span className={LIVE_NUM_CLASSES}>{carScore}</span>
              <span className={LIVE_SEP_CLASSES}>–</span>
              <span className={LIVE_NUM_CLASSES}>{oppScore}</span>
              <span className={LIVE_TEAM_MUTED_CLASSES}>{opp?.abbrev}</span>
              <TeamLogo abbr={opp?.abbrev} size={18} color={TEAM_COLORS[opp?.abbrev]} />
            </div>
            {(period || displayClock) && activeLiveGame?.gameState !== 'FINAL' && (
              <div className={LIVE_CLOCK_CLASSES}>
                {period}{period && displayClock ? ' · ' : ''}{displayClock}
                {displayClock && !clockRunning && <span className={CLOCK_STOPPED_CLASSES}>⏸</span>}
              </div>
            )}
          </div>
        ) : (
          <div className={STATUS_CLASSES}>
            <span className={STATUS_DOT_CLASSES} />
            <span className={NO_LIVE_CLASSES}>{isPWHL ? 'PWHL' : 'Off season'}</span>
          </div>
        )}

        <div className={ICONS_CLASSES}>
          <PlayerSearch />
          <NotificationBell />
        </div>
      </div>

      {activeLiveGame && momentum && (
        <div className={MOMENTUM_CLASSES}>
          <div className={MOM_LABELS_CLASSES}>
            <span className={MOM_CAR_CLASSES}>{TEAM_CONFIG.abbr}</span>
            <span className={MOM_WINDOW_CLASSES}>{momentum.window}m</span>
            <span className={MOM_OPP_CLASSES}>{opp?.abbrev}</span>
          </div>
          <div className={MOM_TRACK_CLASSES}>
            <div className={MOM_CENTER_CLASSES} />
            <div className={MOM_FILL_CAR_CLASSES} style={{ width: `${Math.max(0, momentum.carPct - 50)}%` }} />
            <div className={MOM_FILL_OPP_CLASSES} style={{ width: `${Math.max(0, 50 - momentum.carPct)}%` }} />
          </div>
        </div>
      )}
    </header>
  );
}
