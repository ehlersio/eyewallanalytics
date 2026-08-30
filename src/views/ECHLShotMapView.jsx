// views/ECHLShotMapView.jsx
// A deliberately leaner shot map than PWHLShotMapView (2300+ lines) --
// season-aggregate rink + PP/PK summary, not a per-game history browser.
// Mirrors AHLShotMapView.jsx's own shape (including its later Phase 6
// live-tracking addition) -- same real, confirmed reasons for the
// smaller scope:
//   - No blocked_shot event type exists in ECHL's data at all -- so no
//     Corsi/Fenwick/PDO panels anywhere in this file, only real shots-on-
//     goal + goals (matches echl_shot_events' actual event_type values).
//   - No ECHLPlayerPopup equivalent wired here -- shot markers don't
//     open a player profile on click.
//   - No per-game history browsing (GameChipsRow's past-games list,
//     danger-zone drill popups, period/game AI summaries) -- out of the
//     parity plan's stated Phase 6 scope, which is live tracking
//     specifically, not the full per-game view PWHLShotMapView.jsx is.
//     The live pieces added below (score chip, event popups, debug
//     panel) layer on top of the season-aggregate view rather than
//     replacing it with one.
// PP/PK summary numbers come straight from echl_team_seasons (via
// /echl/team-season-summary), which the pipeline already populates from
// HockeyTech's own special-teams view -- not derived from PBP here.
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch, usePoll } from '../hooks/useFetch';
import { fetchECHLShots, fetchECHLRoster, fetchECHLTeamSeasonSummary, fetchECHLToday, fetchECHLLive, ECHL_TEAM_CONFIG, ECHL_TEAM_ID } from '../utils/echlApi';
import { ECHL_CURRENT_SEASON, ECHL_SEASONS, getECHLTeamConfig } from '../utils/echlConfig';
import { HockeyRink } from 'react-hockey-rink';
import { toHockeyRinkEvents } from '../utils/hockeyRinkEvents';
import TeamLogo from '../components/TeamLogo';
import { MetCard } from '../components/StatBar';
import { LiveGameChip } from '../components/GameChipsRow';
import {
  ECHLPuckDropPopup, ECHLGoalPopup, ECHLPenaltyPopup, ECHLWinPopup, useECHLGameEvents,
} from '../components/ECHLGameEvents';
import { PAGE_CLASSES } from '../utils/pageClasses';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const HEADER_WRAP_CLASSES = 'mb-[14px]';
const VIEW_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold flex items-center gap-2 mb-[2px]';
const SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)]';
const RINK_CARD_CLASSES = 'card mb-3 p-2';
const METRICS_GRID_CLASSES = 'grid grid-cols-3 gap-2 mb-3';
const TABS_WRAP_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-14px] mb-[14px] px-[14px]';
const TAB_BASE_CLASSES = 'flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]';
const TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent';
const TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]';
function tabClasses(isActive) {
  return `${TAB_BASE_CLASSES} ${isActive ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`;
}

// ── Debug panel (5 taps on the header, dev only) -- same mechanism as
// AHLShotMapView.jsx's identical panel. Lets goal/penalty/win/puck-drop
// popups be verified without a live ECHL game -- none exists until the
// 2026-27 season opener.
const DEBUG_PANEL_CLASSES = 'debug-panel fixed left-1/2 -translate-x-1/2 bg-[var(--bg1)] border-[1.5px] border-[color:var(--red-bright)] rounded-[var(--radius)] p-[14px] w-[min(420px,94vw)] z-[999] shadow-[0_8px_32px_rgba(0,0,0,0.6)]';
const DEBUG_PANEL_BOTTOM_STYLE = { bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 16px)' };
const DEBUG_PANEL_HEADER_CLASSES = 'flex items-start justify-between mb-[10px]';
const DEBUG_CLOSE_BTN_CLASSES = 'debug-close-btn bg-[var(--bg3)] border-0 text-[color:var(--text-dim)] text-[13px] py-1 px-2 rounded-[6px] cursor-pointer shrink-0 ml-2 min-h-0 min-w-0 hover:text-[color:var(--text)]';
const DEBUG_PANEL_TITLE_CLASSES = 'text-[14px] font-bold mb-0.5';
const DEBUG_PANEL_SUB_CLASSES = 'text-[11px] text-[color:var(--text-dim)]';
const DEBUG_PANEL_BTNS_CLASSES = 'flex flex-col gap-[5px]';
const DEBUG_BTN_BASE = 'py-[7px] px-[10px] rounded-[7px] text-[11px] font-semibold cursor-pointer border-0 text-left min-h-0 min-w-0 w-full';
const DEBUG_BTN_VARIANTS = {
  goal: 'bg-[rgba(200,30,30,0.2)] text-[#f87171]',
  penalty: 'bg-[rgba(250,190,30,0.2)] text-[#fbbf24]',
  win: 'bg-[rgba(74,222,128,0.2)] text-[#4ade80]',
};
const debugBtnClasses = (variant) => `${DEBUG_BTN_BASE} ${DEBUG_BTN_VARIANTS[variant] || ''}`.trim();

function mapEventType(evType) {
  return evType === 'goal' ? 'goal' : 'shot-on-goal';
}

// Mirrors AHLShotMapView.jsx's adaptShot() fold exactly -- same
// coordinate convention (same transform_coords() in the pipeline, copied
// verbatim from AHL's/PWHL's), same reasoning for folding negative-x
// onto the positive side for a consistent single-attacking-zone rink
// display.
function adaptShot(row, playerMap) {
  const secs = row.time_seconds || 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  let x = parseFloat(row.x_norm);
  let y = parseFloat(row.y_norm);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  if (x < 0) { x = -x; y = -y; }
  x = Math.min(x, 99);
  y = Math.max(-42, Math.min(42, y));
  return {
    id: row.id, x, y,
    type: mapEventType(row.event_type),
    isCanes: true,
    period: row.period_id,
    timeInPeriod: `${mm}:${ss}`,
    shooterName: playerMap[row.shooter_id] || null,
    gameId: row.game_id,
    shotType: row.shot_type || null,
  };
}

export default function ECHLShotMapView() {
  const { t } = useTranslation();
  const team = ECHL_TEAM_CONFIG;
  const teamId = ECHL_TEAM_ID;
  const abbr = team?.abbr || '—';

  const [season, setSeason] = useState(ECHL_CURRENT_SEASON);

  // useState's initial value only runs once, at first mount -- if this
  // component mounts before echlConfig.js's async live-season fetch
  // resolves, `season` would otherwise permanently lock onto whatever
  // fallback seed was current at that instant. Same fix
  // AHLShotMapView.jsx/PWHLPlayersView.jsx already apply for the
  // identical race, see those files' comments.
  const userPickedSeason = useRef(false);
  useEffect(() => {
    function handleSeasonUpdate(e) {
      if (!userPickedSeason.current) setSeason(e.detail);
    }
    window.addEventListener('eyewall:echl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:echl-season-updated', handleSeasonUpdate);
  }, []);

  function handleSeasonPick(id) {
    userPickedSeason.current = true;
    setSeason(id);
  }

  // ── Live game detection ───────────────────────────────────────
  // Poll /echl/today every 60s (30s once live) to detect a live/pre game
  // for our team today. Mirrors AHLShotMapView.jsx's identical pattern.
  const isLiveRef = useRef(false);
  const liveInterval = useMemo(() => isLiveRef.current ? 30_000 : 60_000, []);

  const { data: todayGames } = usePoll(
    () => fetchECHLToday(season),
    liveInterval,
    [season]
  );

  const liveGame = useMemo(() => {
    if (!todayGames?.length || !teamId) return null;
    return todayGames.find(g =>
      (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
      (g.status === 'live' || g.status === 'pre')
    ) || null;
  }, [todayGames, teamId]);

  const liveGameChipData = useMemo(() => {
    if (!liveGame) return null;
    const isHome = liveGame.homeTeamId === teamId;
    const oppAbbr = isHome ? liveGame.awayTeamCode : liveGame.homeTeamCode;
    return {
      gameId: liveGame.gameId,
      opponentAbbr:  oppAbbr,
      opponentColor: getECHLTeamConfig(oppAbbr)?.displayColor,
      myScore:  isHome ? liveGame.homeScore : liveGame.awayScore,
      oppScore: isHome ? liveGame.awayScore : liveGame.homeScore,
    };
  }, [liveGame, teamId]);

  const isLive = liveGame?.status === 'live';
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);

  // Auto-select the live game when it starts
  const [selectedGameId, setSelectedGameId] = useState(null);
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (isLive && liveGame && !autoSelectedRef.current) {
      setSelectedGameId(liveGame.gameId);
      autoSelectedRef.current = true;
    }
    if (!isLive) autoSelectedRef.current = false;
  }, [isLive, liveGame]);

  // Poll live PBP every 30s when a live game is selected.
  const { data: liveData } = usePoll(
    () => isLive && selectedGameId === liveGame?.gameId
      ? fetchECHLLive(selectedGameId)
      : Promise.resolve(null),
    30_000,
    [isLive, selectedGameId, liveGame?.gameId]
  );

  // ── Game event popups ───────────────────────────────────────────
  const {
    goalPopup,     clearGoalPopup,
    penaltyPopup,  clearPenaltyPopup,
    winPopup,      clearWinPopup,
    puckDropPopup, clearPuckDropPopup,
  } = useECHLGameEvents(isLive ? liveData : null, isLive, teamId, abbr);

  // ── Debug panel (5 taps on the header, dev only) ─────────────────
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugTaps, setDebugTaps] = useState(0);
  const debugTapRef = useRef(null);
  const [debugGoalPopup,    setDebugGoalPopup]    = useState(null);
  const [debugPenaltyPopup, setDebugPenaltyPopup] = useState(null);
  const [debugWinPopup,     setDebugWinPopup]     = useState(null);
  const [debugPuckPopup,    setDebugPuckPopup]    = useState(null);

  const handleDebugTap = () => {
    if (!import.meta.env.DEV) return;
    const next = debugTaps + 1;
    setDebugTaps(next);
    clearTimeout(debugTapRef.current);
    if (next >= 5) { setDebugOpen(o => !o); setDebugTaps(0); return; }
    debugTapRef.current = setTimeout(() => setDebugTaps(0), 2000);
  };

  const { data: shots, loading: shotsLoading } = useFetch(
    () => teamId ? fetchECHLShots(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );
  const { data: roster } = useFetch(
    () => teamId ? fetchECHLRoster(teamId) : Promise.resolve(null),
    [teamId]
  );
  const { data: summary, loading: summaryLoading } = useFetch(
    () => teamId ? fetchECHLTeamSeasonSummary(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  const playerMap = useMemo(() => {
    const map = {};
    for (const p of roster || []) {
      map[p.player_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    }
    return map;
  }, [roster]);

  const rinkEvents = useMemo(() => {
    if (!shots) return [];
    return shots.map(r => adaptShot(r, playerMap)).filter(Boolean);
  }, [shots, playerMap]);

  const goals = useMemo(() => (shots || []).filter(s => s.event_type === 'goal').length, [shots]);
  const shotsOnGoal = useMemo(() => (shots || []).length, [shots]);

  if (!abbr || !teamId) {
    return (
      <div className={PAGE_CLASSES}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>{t('echlPlayersView.noTeamSelected')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_CLASSES}>
      <div className={HEADER_WRAP_CLASSES} onClick={handleDebugTap} style={{ userSelect: 'none' }}>
        <h2 className={VIEW_TITLE_CLASSES}>
          <TeamLogo abbr={abbr} sport="echl" size={22} />
          {t('nav.shotMap')}
        </h2>
        <p className={SUB_CLASSES}>{t('echlShotMapView.subtitle')}</p>
      </div>

      {liveGame && (
        <div style={{ display: 'flex', marginBottom: 10 }}>
          <LiveGameChip
            liveGame={liveGameChipData}
            sport="echl"
            selected={selectedGameId === liveGame.gameId}
            onSelect={() => setSelectedGameId(liveGame.gameId)}
          />
        </div>
      )}

      <div className={TABS_WRAP_CLASSES} style={{ marginTop: 0 }}>
        {ECHL_SEASONS.map(s => (
          <button key={s.id} className={tabClasses(season === s.id)} onClick={() => handleSeasonPick(s.id)}>{s.label}</button>
        ))}
      </div>

      <div className={METRICS_GRID_CLASSES}>
        <MetCard label={t('echlShotMapView.goals')} value={shotsLoading ? '—' : goals} />
        <MetCard label={t('echlShotMapView.shotsOnGoal')} value={shotsLoading ? '—' : shotsOnGoal} />
        <MetCard
          label={t('echlShotMapView.ppPct')}
          value={summaryLoading || summary?.ppPct == null ? '—' : `${(summary.ppPct * 100).toFixed(1)}%`}
        />
      </div>

      <div className={METRICS_GRID_CLASSES}>
        <MetCard
          label={t('echlShotMapView.pkPct')}
          value={summaryLoading || summary?.pkPct == null ? '—' : `${(summary.pkPct * 100).toFixed(1)}%`}
        />
        <MetCard
          label={t('echlShotMapView.sogFor')}
          value={summaryLoading ? '—' : summary?.sog?.car ?? '—'}
        />
        <MetCard
          label={t('echlShotMapView.sogAgainst')}
          value={summaryLoading ? '—' : summary?.sog?.opp ?? '—'}
        />
      </div>

      <div className={RINK_CARD_CLASSES}>
        {shotsLoading ? (
          <div className={SKELETON_CLASSES} style={{ height: 280, width: '100%', borderRadius: 8 }} />
        ) : rinkEvents.length > 0 ? (
          <HockeyRink events={toHockeyRinkEvents(rinkEvents)} teamAbbr={abbr} />
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)', fontSize: 13 }}>
            {t('echlShotMapView.noShots')}
          </div>
        )}
      </div>

      <p style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '8px 0' }}>
        {t('echlPlayersView.footerHintSource')}
      </p>

      {/* ── Game event popups ── */}
      {puckDropPopup && <ECHLPuckDropPopup data={puckDropPopup} onClose={clearPuckDropPopup} />}
      {goalPopup     && <ECHLGoalPopup     data={goalPopup}     onClose={clearGoalPopup}     />}
      {penaltyPopup  && <ECHLPenaltyPopup  data={penaltyPopup}  onClose={clearPenaltyPopup}  />}
      {winPopup      && <ECHLWinPopup      data={winPopup}      onClose={clearWinPopup}      />}

      {/* ── Debug popups ── */}
      {debugGoalPopup    && <ECHLGoalPopup     data={debugGoalPopup}    onClose={() => setDebugGoalPopup(null)}    />}
      {debugPenaltyPopup && <ECHLPenaltyPopup  data={debugPenaltyPopup} onClose={() => setDebugPenaltyPopup(null)} />}
      {debugWinPopup     && <ECHLWinPopup      data={debugWinPopup}     onClose={() => setDebugWinPopup(null)}     />}
      {debugPuckPopup    && <ECHLPuckDropPopup data={debugPuckPopup}    onClose={() => setDebugPuckPopup(null)}    />}

      {/* ── Debug panel (5 taps on the header, dev only) ── */}
      {import.meta.env.DEV && debugOpen && (
        <div className={DEBUG_PANEL_CLASSES} style={DEBUG_PANEL_BOTTOM_STYLE}>
          <div className={DEBUG_PANEL_HEADER_CLASSES}>
            <div>
              <div className={DEBUG_PANEL_TITLE_CLASSES}>🛠 ECHL Event Debug</div>
              <div className={DEBUG_PANEL_SUB_CLASSES}>Tap to fire game events</div>
            </div>
            <button className={DEBUG_CLOSE_BTN_CLASSES} onClick={() => setDebugOpen(false)}>✕</button>
          </div>
          <div className={DEBUG_PANEL_BTNS_CLASSES}>
            <button className={debugBtnClasses('goal')} onClick={() => setDebugGoalPopup({
              scorer: 'Anthony Romano', assists: ['Oliver Chau', 'Jordan Sambrook'],
              shotType: 'Wrist', isPowerPlay: false, isShortHanded: false,
              isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P2', time: '14:32',
            })}>🚨 Goal</button>
            <button className={debugBtnClasses('goal')} onClick={() => setDebugGoalPopup({
              scorer: 'Craig Needham', assists: [],
              shotType: 'Snap', isPowerPlay: true, isShortHanded: false,
              isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P1', time: '08:11',
            })}>⚡ PP Goal</button>
            <button className={debugBtnClasses()} style={{ background: 'rgba(204,34,0,0.15)', color: 'var(--red-bright)' }}
              onClick={() => setDebugPuckPopup({ gameId: 'debug' })}>🏒 Puck Drop</button>
            <button className={debugBtnClasses('penalty')} onClick={() => setDebugPenaltyPopup({
              id: 'debug-1', player: 'Cam Johnson',
              desc: 'Holding', severity: null, duration: 2, periodLabel: 'P1', time: '9:26',
            })}>⚡ PP Alert</button>
            <button className={debugBtnClasses('penalty')} onClick={() => setDebugPenaltyPopup({
              id: 'debug-2', player: 'Reid Duke',
              desc: 'Fighting', severity: 'Major', duration: 5, periodLabel: 'P3', time: '12:04',
            })}>🟠 Major</button>
            <button className={debugBtnClasses('win')} onClick={() => setDebugWinPopup({
              teamAbbr: abbr || 'FLA',
              score: `${abbr || 'FLA'} 3 – REA 2`,
            })}>🏆 Win</button>
          </div>
        </div>
      )}
    </div>
  );
}
