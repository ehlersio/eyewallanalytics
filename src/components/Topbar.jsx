import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getCarScore, getOppScore, getOpponent, withPbpScore } from '../utils/nhlApi';
import { useLiveGame } from '../hooks/useLiveGame';
import { useHockeyTechLiveGame } from '../hooks/useHockeyTechLiveGame';
import { chipScore, periodLabel } from '../utils/hockeyTechLiveStore';
import { AHL_TEAM_ID } from '../utils/ahlApi';
import { ECHL_TEAM_ID } from '../utils/echlApi';
import { AHL_TEAM_MAP } from '../utils/ahlConfig';
import { ECHL_TEAM_MAP } from '../utils/echlConfig';
import { PWHL_TEAM_ID } from '../utils/pwhlApi';
import { PWHL_TEAM_MAP } from '../utils/pwhlConfig';
import { teamTextColor } from '../utils/teamConfig';
import TeamLogo from './TeamLogo';
import { TEAM_CONFIG } from '../utils/nhlApi';
import { useSport } from '../utils/SportContext';
import AboutPopup from './AboutPopup';
import { subscribeClock, getClockDisplay, publishClock, subscribeMomentum, subscribeMockLiveGame } from '../utils/liveClockStore';
import SettingsMenu from './SettingsMenu';
import NotificationsBell from './NotificationsBell';
import TeamSwitcher from './TeamSwitcher';
import PlayerSearch from './PlayerSearch';

// The live score comes from the shared live-game poller
// (utils/liveGameStore.js), the same one the shot map reads: every 10 s
// during a game, livePollInterval() otherwise, and at once on a push.

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

// Only NHL routes run the NHL favourite's live-score poll: the other leagues
// have no NHL game to follow, and their shot maps poll their own feeds. The
// gate used to list the non-NHL sports by hand (`isPWHL || isAHL`), so the
// ECHL routes, added later, kept polling the NHL favourite's schedule and
// could show its live chip over ECHL pages (audit 2026-10-06, arch F1).
export function pollsNhlLive(sport) {
  return sport === 'nhl';
}

// The followed team on a PWHL/AHL/ECHL route, for the HockeyTech live
// chip (utils/hockeyTechLiveStore.js); null on NHL routes.
function hockeyTechTeamId(sport) {
  if (sport === 'pwhl') return PWHL_TEAM_ID;
  if (sport === 'ahl') return AHL_TEAM_ID;
  if (sport === 'echl') return ECHL_TEAM_ID;
  return null;
}
function hockeyTechTeamColor(sport, abbr) {
  const teams = { pwhl: PWHL_TEAM_MAP, ahl: AHL_TEAM_MAP, echl: ECHL_TEAM_MAP }[sport];
  return teams?.[abbr]?.displayColor;
}

// What the HockeyTech live chip shows: the followed team's side of the
// score, and the period and time of the latest event (null when there's
// no live game).
export function hockeyTechChip(state, teamId) {
  if (!state?.game) return null;
  const score = chipScore(state.game, teamId);
  return { ...score, period: periodLabel(state.clock), time: state.clock?.time || null };
}

// Text of the hidden `.topbar-no-live` marker: the league on non-NHL routes,
// null on NHL routes (the caller shows the translated "Off season" there).
export function noLiveLabel(sport) {
  return pollsNhlLive(sport) ? null : sport.toUpperCase();
}
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
  const { t } = useTranslation();
  const { sport } = useSport();
  const pollNhl = pollsNhlLive(sport);
  const [displayClock, setDisplayClock] = useState(null);
  const [clockRunning, setClockRunning] = useState(true);
  const [momentum,    setMomentum]    = useState(null);
  const [mockLiveGame, setMockLiveGame] = useState(null);

  const clockRef     = useRef(null);

  // Clock display is derived from shared liveClockStore — no local countdown needed

  // ── Live game ───────────────────────────────────────────────
  // Only NHL routes follow the NHL favourite's live game. No end-of-season
  // cutoff: a hardcoded `SEASON_END = 2026-07-01` here (from the first
  // commit, never moved) once switched the poll off for good on that date.
  // The idle interval (up to 30min) is cheap enough to leave running
  // year-round. A push (Game Starting, usually) re-checks at once -- the
  // store handles that.
  const { game: storeGame, pbp } = useLiveGame(TEAM_CONFIG, pollNhl);
  // Score from pbp, as the shot map's score bar does -- the store hands
  // over the game and its play-by-play together, so the chip never
  // flashes the schedule's older score first.
  const liveGame = storeGame ? withPbpScore(storeGame, pbp) : null;
  const pbpForGame = storeGame && pbp && String(pbp.id) === String(storeGame.id) ? pbp : null;
  const liveMeta = pbpForGame ? { period: pbpForGame.periodDescriptor, clock: pbpForGame.clock } : null;

  // PWHL/AHL/ECHL: the followed team's live game from the shared
  // HockeyTech poller (the same /today the shot maps read).
  const htTeamId = pollNhl ? null : hockeyTechTeamId(sport);
  const htState  = useHockeyTechLiveGame(pollNhl ? null : sport, htTeamId);
  const htChip   = hockeyTechChip(htState, htTeamId);

  // Publish clock — fall back to raw string if structured data missing
  useEffect(() => {
    if (!pbpForGame) return;
    const tr = pbpForGame.clock?.timeRemaining;
    if (tr) {
      publishClock(tr, pbpForGame.clock.inIntermission, pbpForGame.clock.running !== false);
    } else if (pbpForGame.clock?.secondsRemaining != null) {
      // Some API responses use secondsRemaining instead
      const sec = pbpForGame.clock.secondsRemaining;
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      publishClock(`${mm}:${ss}`, pbpForGame.clock.inIntermission, pbpForGame.clock.running !== false);
    }
  }, [pbpForGame]);

  useEffect(() => {
    if (!storeGame) setDisplayClock(null);
  }, [storeGame]);

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
        <AboutPopup isLive={!!activeLiveGame || !!htChip} />

        {htChip ? (
          <div className={LIVE_CLASSES} data-testid="ht-live-chip">
            <div className="live-dot" />
            <div className={LIVE_SCORE_CLASSES}>
              <TeamLogo abbr={htChip.myAbbr} sport={sport} size={18} />
              <span className={LIVE_TEAM_RED_CLASSES}>{htChip.myAbbr}</span>
              <span className={LIVE_NUM_CLASSES}>{htChip.myScore}</span>
              <span className={LIVE_SEP_CLASSES}>–</span>
              <span className={LIVE_NUM_CLASSES}>{htChip.oppScore}</span>
              <span className={LIVE_TEAM_MUTED_CLASSES}>{htChip.oppAbbr}</span>
              <TeamLogo abbr={htChip.oppAbbr} sport={sport} size={18} color={hockeyTechTeamColor(sport, htChip.oppAbbr)} />
            </div>
            {(htChip.period || htChip.time) && (
              <div className={LIVE_CLOCK_CLASSES}>
                {htChip.period}{htChip.period && htChip.time ? ' · ' : ''}{htChip.time}
              </div>
            )}
          </div>
        ) : activeLiveGame ? (
          <div className={LIVE_CLASSES}>
            <div className="live-dot" />
            <div className={LIVE_SCORE_CLASSES}>
              <TeamLogo abbr={TEAM_CONFIG.abbr} size={18} />
              <span className={LIVE_TEAM_RED_CLASSES}>{TEAM_CONFIG.abbr}</span>
              <span className={LIVE_NUM_CLASSES}>{carScore}</span>
              <span className={LIVE_SEP_CLASSES}>–</span>
              <span className={LIVE_NUM_CLASSES}>{oppScore}</span>
              <span className={LIVE_TEAM_MUTED_CLASSES}>{opp?.abbrev}</span>
              <TeamLogo abbr={opp?.abbrev} size={18} color={teamTextColor(opp?.abbrev)} />
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
            <span className={NO_LIVE_CLASSES}>{noLiveLabel(sport) ?? t('topbar.offSeason')}</span>
          </div>
        )}

        <div className={ICONS_CLASSES}>
          <TeamSwitcher />
          <PlayerSearch />
          <NotificationsBell />
          <SettingsMenu />
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
