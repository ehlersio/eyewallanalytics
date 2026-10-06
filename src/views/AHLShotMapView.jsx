// views/AHLShotMapView.jsx
// A deliberately leaner shot map than PWHLShotMapView (2300+ lines) --
// season-aggregate rink + PP/PK summary, not a per-game history browser.
// Real, confirmed reasons for the smaller scope (see AHL_BUILD_BRIEF.md):
//   - No blocked_shot event type exists in AHL's data at all -- so no
//     Corsi/Fenwick/PDO panels anywhere in this file, only real shots-on-
//     goal + goals (matches ahl_shot_events' actual event_type values).
//   - No PWHLPlayerPopup equivalent built -- shot markers don't open a
//     player profile on click.
//   - A lighter per-game view than PWHL's: game chips over the season
//     tabs, opening on the last game played (2026-10), with that game's
//     shots for both teams and cards computed from them -- no danger-zone
//     drill popups or period/game AI summaries.
//     The live pieces below (score chip, event popups, debug panel) are
//     separate from it.
// PP/PK summary numbers come straight from ahl_team_seasons (via
// /ahl/team-season-summary), which the pipeline already populates from
// HockeyTech's own special-teams view -- not derived from PBP here.
import { useState, useMemo, useEffect, useRef } from 'react';
import { hockeyTechTodayInterval } from '../utils/livePolling';
import { useTranslation } from 'react-i18next';
import { useFetch, usePoll } from '../hooks/useFetch';
import { useTeamSeasonGames } from '../hooks/useTeamSeasonGames';
import { seasonsWithGames, teamHasGames } from '../utils/teamSeasons';
import { fetchAHLShots, fetchAHLGameShots, fetchAHLSchedule, fetchAHLRoster, fetchAHLTeamSeasonSummary, fetchAHLToday, fetchAHLLive, AHL_TEAM_CONFIG, AHL_TEAM_ID } from '../utils/ahlApi';
import { AHL_CURRENT_SEASON, AHL_SEASONS, getAHLTeamConfig, getAHLTeamById } from '../utils/ahlConfig';
import { HockeyRink } from 'react-hockey-rink';
import { toHockeyRinkEvents } from '../utils/hockeyRinkEvents';
import TeamLogo from '../components/TeamLogo';
import { MetCard } from '../components/StatBar';
import GameChipsRow, { LiveGameChip } from '../components/GameChipsRow';
import { finalSuffix } from '../utils/scoreboard';
import { formatDate as formatDateIntl } from '../utils/formatters';
import {
  AHLPuckDropPopup, AHLGoalPopup, AHLPenaltyPopup, AHLWinPopup, useAHLGameEvents,
} from '../components/AHLGameEvents';
import { PAGE_CLASSES } from '../utils/pageClasses';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';

const HEADER_WRAP_CLASSES = 'mb-[14px]';
const VIEW_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold flex items-center gap-2 mb-[2px]';
const SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)]';
const RINK_CARD_CLASSES = 'card mb-3 p-2';
const METRICS_GRID_CLASSES = 'grid grid-cols-3 gap-2 mb-3';
const TABS_WRAP_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-14px] mb-[14px] px-[14px]';
const FALLBACK_NOTE_CLASSES = 'mb-2.5 py-2 px-3 rounded-[10px] bg-[var(--bg2)] border border-[var(--border)] text-[11px] leading-[1.45] text-[color:var(--text-dim)]';
const TAB_BASE_CLASSES = 'flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]';
const TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent';
const TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]';
function tabClasses(isActive) {
  return `${TAB_BASE_CLASSES} ${isActive ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`;
}

// ── Debug panel (5 taps on the header, dev only) -- same mechanism as
// PWHLShotMapView.jsx's score-card tap, adapted to this view's simpler
// layout (no per-game score card exists here outside a real live game,
// so the header title itself is the tap target). Lets goal/penalty/win/
// puck-drop popups be verified without a live AHL game -- none exists
// until the 2026-27 season opener (2026-10-02).
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

// Mirrors PWHLShotMapView.jsx's adaptOurShot() fold exactly -- same
// coordinate convention (same transform_coords() in the pipeline, copied
// verbatim from PWHL's), same reasoning for folding negative-x onto the
// positive side for a consistent single-attacking-zone rink display.
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

// The opponent's shots in a game view, same fold as PWHLShotMapView.jsx's
// adaptOppShot(): onto the attacking half, marked as the opponent's.
function adaptOppShot(row) {
  const secs = row.time_seconds || 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  let x = parseFloat(row.x_norm);
  let y = parseFloat(row.y_norm);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  if (x > 0) { x = -x; y = -y; }
  x = Math.min(Math.abs(x), 99);
  y = Math.max(-42, Math.min(42, y));
  return {
    id: row.id, x, y,
    type: mapEventType(row.event_type),
    isCanes: false,
    period: row.period_id,
    timeInPeriod: `${mm}:${ss}`,
    shooterName: null,
    gameId: row.game_id,
    shotType: row.shot_type || null,
  };
}

function shortDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr || '';
  return formatDateIntl(d, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const pct = (num, den) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—');

// pickedGameId for the season aggregate, as opposed to null, "nothing
// picked", which opens the newest final.
const ALL_GAMES = 'all';

export default function AHLShotMapView() {
  const { t } = useTranslation();
  const team = AHL_TEAM_CONFIG;
  const teamId = AHL_TEAM_ID;
  const abbr = team?.abbr || '—';

  const [season, setSeason] = useState(AHL_CURRENT_SEASON);

  // useState's initial value only runs once, at first mount -- if this
  // component mounts before ahlConfig.js's async live-season fetch
  // resolves, `season` would otherwise permanently lock onto whatever
  // fallback seed was current at that instant. Same fix PWHLPlayersView.jsx
  // already applies for the identical race, see that file's comment.
  const userPickedSeason = useRef(false);
  // Set to the season we fell back FROM once the empty-season fallback
  // below fires -- both the "did we already fall back" guard and the
  // label the notice needs. State, not a ref, because the notice has to
  // render when it changes.
  const [fellBackFrom, setFellBackFrom] = useState(null);
  useEffect(() => {
    function handleSeasonUpdate(e) {
      if (!userPickedSeason.current && !fellBackFrom) setSeason(e.detail);
    }
    window.addEventListener('eyewall:ahl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:ahl-season-updated', handleSeasonUpdate);
  }, [fellBackFrom]);

  // A game id, ALL_GAMES for the season aggregate, or null: the newest
  // final, which is where the page opens.
  const [pickedGameId, setPickedGameId] = useState(null);

  // Picking a season opens its aggregate.
  function handleSeasonPick(id) {
    userPickedSeason.current = true;
    setFellBackFrom(null);
    setSeason(id);
    setPickedGameId(ALL_GAMES);
  }

  // ── Live game detection ───────────────────────────────────────
  // Poll /ahl/today every 60s (30s once live) to detect a live/pre game
  // for our team today. Mirrors PWHLShotMapView.jsx's identical pattern.
  const isLiveRef = useRef(false);
  const liveInterval = useMemo(() => hockeyTechTodayInterval(isLiveRef), []);

  // Always the live current season, not the one on screen: the view can
  // open on an older season (the fallback below), and today's games are
  // in the current one.
  const { data: todayGames } = usePoll(
    () => fetchAHLToday(),
    liveInterval,
    []
  );

  const liveGame = useMemo(() => {
    if (!todayGames?.length || !teamId) return null;
    // Only a game that's under way: the chip always reads "🔴 LIVE" with a
    // score, so a scheduled game read "LIVE 0-0" until puck drop (AHL
    // Chicago, 2026-10-04), and tapping it showed nothing.
    return todayGames.find(g =>
      (g.homeTeamId === teamId || g.awayTeamId === teamId) && g.status === 'live'
    ) || null;
  }, [todayGames, teamId]);

  const liveGameChipData = useMemo(() => {
    if (!liveGame) return null;
    const isHome = liveGame.homeTeamId === teamId;
    const oppAbbr = isHome ? liveGame.awayTeamCode : liveGame.homeTeamCode;
    return {
      gameId: liveGame.gameId,
      opponentAbbr:  oppAbbr,
      opponentColor: getAHLTeamConfig(oppAbbr)?.displayColor,
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
      ? fetchAHLLive(selectedGameId)
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
  } = useAHLGameEvents(isLive ? liveData : null, isLive, teamId, abbr);

  // ── Debug panel (5 taps on the header, dev only) ─────────────────
  const [debugOpen, setDebugOpen] = useState(false);
  const debugTapRef = useRef(null);
  const debugTapCount = useRef(0);
  const [debugGoalPopup,    setDebugGoalPopup]    = useState(null);
  const [debugPenaltyPopup, setDebugPenaltyPopup] = useState(null);
  const [debugWinPopup,     setDebugWinPopup]     = useState(null);
  const [debugPuckPopup,    setDebugPuckPopup]    = useState(null);

  const handleDebugTap = () => {
    if (!import.meta.env.DEV) return;
    // Counted in a ref, not state: taps that land before a re-render all
    // read the same count from state, so some went uncounted and five
    // quick taps didn't always open the panel.
    const next = ++debugTapCount.current;
    clearTimeout(debugTapRef.current);
    if (next >= 5) { debugTapCount.current = 0; setDebugOpen(o => !o); return; }
    debugTapRef.current = setTimeout(() => { debugTapCount.current = 0; }, 2000);
  };

  const { data: shots, loading: shotsLoading } = useFetch(
    () => teamId ? fetchAHLShots(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  // ── Empty-season fallback ──────────────────────────────────────
  // AHL_CURRENT_SEASON is whatever the resolver found data for league-
  // wide -- a new season before this team's first game, or the playoffs
  // for a team that missed them -- and landing on a season this team has
  // no shots in gives a brand-new user an all-zero shot map on the app's
  // first screen, which is what got the TestFlight build rejected under
  // 2.1(a) in September 2026.
  //
  // The season tabs offer only seasons this team has played games in
  // (#15/#33: AHL Hamilton has none before 2026-27, ECHL's 2026-27 none
  // until it starts), and the view opens on the newest of them -- a
  // regular season first -- when the current one has no games or no shots.
  // One hop; if there's nothing to hop to, the existing "no shot data"
  // message is the honest answer.
  const seasonCounts = useTeamSeasonGames(fetchAHLSchedule, teamId, [AHL_CURRENT_SEASON, ...AHL_SEASONS.map(s => s.id)]);
  const seasonOptions = useMemo(() => seasonsWithGames(AHL_SEASONS, seasonCounts, { played: true }), [seasonCounts]);
  useEffect(() => {
    if (userPickedSeason.current || fellBackFrom || !seasonCounts) return;
    const noGames = teamHasGames(seasonCounts, season, { played: true }) === false;
    const noShots = !shotsLoading && Array.isArray(shots) && shots.length === 0;
    if (!noGames && !noShots) return;
    const others = seasonOptions.filter(s => s.id !== season);
    const next = (others.find(s => s.type === 'regular') ?? others[0])?.id;
    if (!next) return;
    setFellBackFrom(season);
    setSeason(next);
  }, [shots, shotsLoading, season, fellBackFrom, seasonCounts, seasonOptions]);

  const seasonLabel = id => AHL_SEASONS.find(s => s.id === id)?.label ?? id;
  const { data: roster } = useFetch(
    () => teamId ? fetchAHLRoster(teamId) : Promise.resolve(null),
    [teamId]
  );
  const { data: summary, loading: summaryLoading } = useFetch(
    () => teamId ? fetchAHLTeamSeasonSummary(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );

  const playerMap = useMemo(() => {
    const map = {};
    for (const p of roster || []) {
      map[p.player_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    }
    return map;
  }, [roster]);

  // ── Game view ────────────────────────────────────────────────
  const { data: schedule } = useFetch(
    () => teamId ? fetchAHLSchedule(teamId, season) : Promise.resolve(null),
    [teamId, season]
  );
  // Finished games, newest first.
  const games = useMemo(() => (schedule || [])
    .filter(g => g.game_state === 'Final')
    .sort((a, b) => (b.game_date || '').localeCompare(a.game_date || '') || b.game_id - a.game_id),
  [schedule]);
  const viewGameId = pickedGameId === ALL_GAMES ? null : pickedGameId ?? games[0]?.game_id ?? null;
  const viewGame = games.find(g => g.game_id === viewGameId) || null;
  const isGameView = !!viewGame;
  const handleGameSelect = id => setPickedGameId(id === viewGameId ? ALL_GAMES : id);
  const handleAllGames = () => setPickedGameId(ALL_GAMES);

  const gameChipGames = useMemo(() => games.map(g => {
    const isHome = g.home_team_id === teamId;
    const oppAbbr = getAHLTeamById(isHome ? g.away_team_id : g.home_team_id)?.abbr;
    return {
      id: g.game_id,
      opponentAbbr: oppAbbr,
      opponentColor: getAHLTeamConfig(oppAbbr)?.displayColor,
      myScore: isHome ? g.home_score : g.away_score,
      oppScore: isHome ? g.away_score : g.home_score,
      isHome,
    };
  }), [games, teamId]);

  const { data: gameShots, loading: gameShotsLoading } = useFetch(
    () => viewGameId ? fetchAHLGameShots(viewGameId) : Promise.resolve(null),
    [viewGameId]
  );
  const ourGameShots = useMemo(() => (gameShots || []).filter(r => r.team_id === teamId), [gameShots, teamId]);
  const oppGameShots = useMemo(() => (gameShots || []).filter(r => r.team_id !== teamId), [gameShots, teamId]);
  const countGoals = rows => rows.filter(r => r.event_type === 'goal').length;

  const rinkEvents = useMemo(() => {
    if (isGameView) {
      return [
        ...ourGameShots.map(r => adaptShot(r, playerMap)),
        ...oppGameShots.map(adaptOppShot),
      ].filter(Boolean);
    }
    if (!shots) return [];
    return shots.map(r => adaptShot(r, playerMap)).filter(Boolean);
  }, [isGameView, ourGameShots, oppGameShots, shots, playerMap]);

  const goals = useMemo(() => (shots || []).filter(s => s.event_type === 'goal').length, [shots]);
  const shotsOnGoal = useMemo(() => (shots || []).length, [shots]);
  const rinkLoading = isGameView ? gameShotsLoading : shotsLoading;

  let subtitle = t('ahlShotMapView.subtitle');
  if (viewGame) {
    const isHome = viewGame.home_team_id === teamId;
    subtitle = t('ahlShotMapView.gameSubtitle', {
      final: `${t('shotMapView.scoreBar.final')}${finalSuffix(viewGame.ended_in)}`,
      where: isHome ? t('ahlShotMapView.vs') : t('ahlShotMapView.at'),
      opp: getAHLTeamById(isHome ? viewGame.away_team_id : viewGame.home_team_id)?.abbr || '',
      date: shortDate(viewGame.game_date),
    });
  }

  if (!abbr || !teamId) {
    return (
      <div className={PAGE_CLASSES}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-dim)' }}>{t('ahlPlayersView.noTeamSelected')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_CLASSES}>
      <div className={HEADER_WRAP_CLASSES} onClick={handleDebugTap} style={{ userSelect: 'none' }}>
        <h2 className={VIEW_TITLE_CLASSES}>
          <TeamLogo abbr={abbr} sport="ahl" size={22} />
          {t('nav.shotMap')}
        </h2>
        <p className={SUB_CLASSES}>{subtitle}</p>
      </div>

      {liveGame && (
        <div style={{ display: 'flex', marginBottom: 10 }}>
          <LiveGameChip
            liveGame={liveGameChipData}
            sport="ahl"
            selected={selectedGameId === liveGame.gameId}
            onSelect={() => setSelectedGameId(liveGame.gameId)}
          />
        </div>
      )}

      {fellBackFrom && (
        <div className={FALLBACK_NOTE_CLASSES}>
          {t('ahlShotMapView.fallbackNote', {
            empty:    seasonLabel(fellBackFrom),
            fallback: seasonLabel(season),
          })}
        </div>
      )}

      {games.length > 0 && (
        <GameChipsRow games={gameChipGames} sport="ahl"
          selectedGameId={viewGameId} onSelect={handleGameSelect} onAll={handleAllGames} />
      )}

      <div className={TABS_WRAP_CLASSES} style={{ marginTop: 0 }}>
        {seasonOptions.map(s => (
          <button key={s.id} className={tabClasses(season === s.id)} onClick={() => handleSeasonPick(s.id)}>{s.label}</button>
        ))}
      </div>

      {isGameView ? (
        <>
          <div className={METRICS_GRID_CLASSES}>
            <MetCard label={t('ahlShotMapView.goals')} value={gameShotsLoading || !gameShots?.length ? '—' : countGoals(ourGameShots)} />
            <MetCard label={t('ahlShotMapView.shotsOnGoal')} value={gameShotsLoading || !gameShots?.length ? '—' : ourGameShots.length} />
            <MetCard label={t('ahlShotMapView.shootingPct')} value={gameShotsLoading ? '—' : pct(countGoals(ourGameShots), ourGameShots.length)} />
          </div>
          <div className={METRICS_GRID_CLASSES}>
            <MetCard label={t('ahlShotMapView.oppGoals')} value={gameShotsLoading || !gameShots?.length ? '—' : countGoals(oppGameShots)} />
            <MetCard label={t('ahlShotMapView.oppShotsOnGoal')} value={gameShotsLoading || !gameShots?.length ? '—' : oppGameShots.length} />
            <MetCard label={t('ahlShotMapView.savePct')} value={gameShotsLoading ? '—' : pct(oppGameShots.length - countGoals(oppGameShots), oppGameShots.length)} />
          </div>
        </>
      ) : (
        <>
          <div className={METRICS_GRID_CLASSES}>
            <MetCard label={t('ahlShotMapView.goals')} value={shotsLoading ? '—' : goals} />
            <MetCard label={t('ahlShotMapView.shotsOnGoal')} value={shotsLoading ? '—' : shotsOnGoal} />
            <MetCard
              label={t('ahlShotMapView.ppPct')}
              value={summaryLoading || summary?.ppPct == null ? '—' : `${(summary.ppPct * 100).toFixed(1)}%`}
            />
          </div>

          <div className={METRICS_GRID_CLASSES}>
            <MetCard
              label={t('ahlShotMapView.pkPct')}
              value={summaryLoading || summary?.pkPct == null ? '—' : `${(summary.pkPct * 100).toFixed(1)}%`}
            />
            <MetCard
              label={t('ahlShotMapView.sogFor')}
              value={summaryLoading ? '—' : summary?.sog?.car ?? '—'}
            />
            <MetCard
              label={t('ahlShotMapView.sogAgainst')}
              value={summaryLoading ? '—' : summary?.sog?.opp ?? '—'}
            />
          </div>
        </>
      )}

      <div className={RINK_CARD_CLASSES} data-tour="rink">
        {rinkLoading ? (
          <div className={SKELETON_CLASSES} style={{ height: 280, width: '100%', borderRadius: 8 }} />
        ) : rinkEvents.length > 0 ? (
          <HockeyRink events={toHockeyRinkEvents(rinkEvents)} teamAbbr={abbr} />
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)', fontSize: 13 }}>
            {isGameView ? t('ahlShotMapView.noShotsGame') : t('ahlShotMapView.noShots')}
          </div>
        )}
      </div>

      <p style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '8px 0' }}>
        {t('ahlPlayersView.footerHintSource')}
      </p>

      {/* ── Game event popups ── */}
      {puckDropPopup && <AHLPuckDropPopup data={puckDropPopup} onClose={clearPuckDropPopup} />}
      {goalPopup     && <AHLGoalPopup     data={goalPopup}     onClose={clearGoalPopup}     />}
      {penaltyPopup  && <AHLPenaltyPopup  data={penaltyPopup}  onClose={clearPenaltyPopup}  />}
      {winPopup      && <AHLWinPopup      data={winPopup}      onClose={clearWinPopup}      />}

      {/* ── Debug popups ── */}
      {debugGoalPopup    && <AHLGoalPopup     data={debugGoalPopup}    onClose={() => setDebugGoalPopup(null)}    />}
      {debugPenaltyPopup && <AHLPenaltyPopup  data={debugPenaltyPopup} onClose={() => setDebugPenaltyPopup(null)} />}
      {debugWinPopup     && <AHLWinPopup      data={debugWinPopup}     onClose={() => setDebugWinPopup(null)}     />}
      {debugPuckPopup    && <AHLPuckDropPopup data={debugPuckPopup}    onClose={() => setDebugPuckPopup(null)}    />}

      {/* ── Debug panel (5 taps on the header, dev only) ── */}
      {import.meta.env.DEV && debugOpen && (
        <div className={DEBUG_PANEL_CLASSES} style={DEBUG_PANEL_BOTTOM_STYLE}>
          <div className={DEBUG_PANEL_HEADER_CLASSES}>
            <div>
              <div className={DEBUG_PANEL_TITLE_CLASSES}>🛠 AHL Event Debug</div>
              <div className={DEBUG_PANEL_SUB_CLASSES}>Tap to fire game events</div>
            </div>
            <button className={DEBUG_CLOSE_BTN_CLASSES} onClick={() => setDebugOpen(false)}>✕</button>
          </div>
          <div className={DEBUG_PANEL_BTNS_CLASSES}>
            <button className={debugBtnClasses('goal')} onClick={() => setDebugGoalPopup({
              scorer: 'Easton Cowan', assists: ['Luke Haymes', 'Alex Nylander'],
              shotType: 'Wrist', isPowerPlay: false, isShortHanded: false,
              isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P2', time: '14:32',
            })}>🚨 Goal</button>
            <button className={debugBtnClasses('goal')} onClick={() => setDebugGoalPopup({
              scorer: 'Dakota Mermis', assists: [],
              shotType: 'Snap', isPowerPlay: true, isShortHanded: false,
              isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P1', time: '08:11',
            })}>⚡ PP Goal</button>
            <button className={debugBtnClasses()} style={{ background: 'rgba(204,34,0,0.15)', color: 'var(--red-bright)' }}
              onClick={() => setDebugPuckPopup({ gameId: 'debug' })}>🏒 Puck Drop</button>
            <button className={debugBtnClasses('penalty')} onClick={() => setDebugPenaltyPopup({
              id: 'debug-1', player: 'Luke Tuch',
              desc: 'Holding', severity: null, duration: 2, periodLabel: 'P1', time: '9:26',
            })}>⚡ PP Alert</button>
            <button className={debugBtnClasses('penalty')} onClick={() => setDebugPenaltyPopup({
              id: 'debug-2', player: 'Marc Del Gaizo',
              desc: 'Fighting', severity: 'Major', duration: 5, periodLabel: 'P3', time: '12:04',
            })}>🟠 Major</button>
            <button className={debugBtnClasses('win')} onClick={() => setDebugWinPopup({
              teamAbbr: abbr || 'TOR',
              score: `${abbr || 'TOR'} 3 – GR 2`,
            })}>🏆 Win</button>
          </div>
        </div>
      )}
    </div>
  );
}
