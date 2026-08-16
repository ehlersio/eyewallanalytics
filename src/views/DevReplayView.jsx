/**
 * DevReplayView — replay a completed game as if it were live.
 * Only accessible in development (import.meta.env.DEV).
 *
 * Route: /dev
 * Usage: enter a game ID, scrub or play through the game,
 *        watch all live UI (momentum, insights, topbar bar) respond in real time.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { getGameDetail, getGameBoxscore } from '../utils/nhlApi';
import { DevGameContext } from '../utils/DevGameContext';
import { publishClock, publishMockLiveGame, clearMockLiveGame } from '../utils/liveClockStore';
import { CURRENT_SEASON } from '../utils/teamConfig';
import ShotMapView from './ShotMapView';

// Tailwind migration (Session 97, Phase 4, sub-PR 1). DevReplayView.css had
// a clean 2-consumer graph (this file + PWHLDevReplayView.jsx, confirmed by
// investigation) -- no transitive consumers, no cross-file collisions.
// `.dev-input`/`.dev-btn`/`.dev-game-btn`/`.dev-period-tick`'s
// `min-height: unset; min-width: unset;` had no competing global rule to
// defend against (checked index.css's `@layer base { button {...} }` --
// it doesn't set either), so they're simply omitted here rather than
// translated to `min-h-0`/`min-w-0` (which would force zero, not "unset").
// `.dev-btn.active`'s static red styling technically loses to
// `.dev-btn:hover:not(:disabled)` on specificity in the original CSS (a
// likely-incidental artifact, not deliberate design) -- replicated here as
// mutually exclusive active/hover states instead of chasing that specificity
// quirk on a dev-only speed selector.
// Cypress marker classnames kept (audited via grep, pwhl-dev.cy.js):
// .dev-game-btn, .dev-period-tick, .dev-scrubber, .dev-shotmap (also used
// as a scope container: `.dev-shotmap .score-card`).
const DEV_REPLAY_CLASSES = 'flex flex-col h-[calc(100vh-var(--topbar-height)-var(--nav-height))] overflow-hidden'
const DEV_PANEL_CLASSES = 'bg-[var(--bg1)] border-b-[0.5px] border-[var(--border-2)] py-3 px-[14px] flex flex-col gap-[10px] shrink-0'
const DEV_PANEL_HEADER_CLASSES = 'flex items-center gap-2'
const DEV_BADGE_CLASSES = 'text-[9px] font-bold tracking-[0.1em] bg-[var(--amber)] text-[#000] py-[2px] px-[6px] rounded-[4px]'
const DEV_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[14px] font-semibold text-[color:var(--text)]'
const DEV_ROW_CLASSES = 'flex gap-2'
const DEV_INPUT_CLASSES = 'dev-input flex-1 bg-[var(--bg3)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius-sm)] text-[color:var(--text)] font-[family-name:var(--font-mono)] text-[12px] py-[6px] px-[10px] focus:outline-none focus:border-[var(--red-border)]'

// bg/border-color/text-color live entirely in the per-state variants below,
// never in BASE -- combining an unconditional BASE color utility with a
// state variant's own unconditional color utility for the same property in
// one string is a real bug (Tailwind's generated CSS order between two
// same-specificity, same-layer utilities isn't guaranteed to match string
// order; found live as the Load button rendering muted-gray text instead
// of red-bright). Each devBtnClasses() call includes exactly one color state.
const DEV_BTN_BASE_CLASSES = 'border-[0.5px] rounded-[var(--radius-sm)] text-[12px] py-[6px] px-3 [transition:all_0.12s] whitespace-nowrap disabled:opacity-40 disabled:cursor-default'
const DEV_BTN_DEFAULT_CLASSES = 'bg-[var(--bg3)] border-[var(--border-2)] text-[color:var(--text-muted)] enabled:hover:bg-[var(--bg4)] enabled:hover:text-[color:var(--text)]'
const DEV_BTN_PRIMARY_CLASSES = 'bg-[var(--red-dim)] border-[var(--red-border)] text-[color:var(--red-bright)] enabled:hover:bg-[rgba(204,34,0,0.25)]'
const DEV_BTN_ACTIVE_CLASSES = 'bg-[var(--red-dim)] border-[var(--red-border)] text-[color:var(--red-bright)]'
function devBtnClasses({ primary, active } = {}) {
  if (primary) return `${DEV_BTN_BASE_CLASSES} ${DEV_BTN_PRIMARY_CLASSES}`
  if (active) return `${DEV_BTN_BASE_CLASSES} ${DEV_BTN_ACTIVE_CLASSES}`
  return `${DEV_BTN_BASE_CLASSES} ${DEV_BTN_DEFAULT_CLASSES}`
}
const DEV_PLAY_BTN_CLASSES = 'py-[6px] px-5 font-semibold'

const DEV_RECENT_CLASSES = 'flex flex-col gap-[6px]'
const DEV_SECTION_LABEL_CLASSES = 'text-[9px] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-dim)]'
const DEV_GAME_LIST_CLASSES = 'flex gap-[6px] flex-wrap'
const DEV_GAME_BTN_BASE_CLASSES = 'dev-game-btn flex flex-col items-center gap-px border-[0.5px] rounded-[var(--radius-sm)] py-[5px] px-[10px] cursor-pointer [transition:all_0.12s]'
const DEV_GAME_BTN_INACTIVE_CLASSES = 'bg-[var(--bg3)] border-[var(--border)] hover:border-[var(--border-2)] hover:bg-[var(--bg4)]'
const DEV_GAME_BTN_ACTIVE_CLASSES = 'border-[var(--red-border)] bg-[var(--red-dim)]'
function devGameBtnClasses(active) {
  return `${DEV_GAME_BTN_BASE_CLASSES} ${active ? DEV_GAME_BTN_ACTIVE_CLASSES : DEV_GAME_BTN_INACTIVE_CLASSES}`
}
const DEV_GAME_DATE_CLASSES = 'text-[9px] text-[color:var(--text-dim)]'
const DEV_GAME_MATCHUP_CLASSES = 'text-[11px] font-semibold text-[color:var(--text)]'
const DEV_GAME_SCORE_CLASSES = 'text-[10px] text-[color:var(--text-muted)] font-[family-name:var(--font-mono)]'

const DEV_ERROR_CLASSES = 'text-[12px] text-[color:var(--red-bright)] bg-[var(--red-dim)] border-[0.5px] border-[var(--red-border)] rounded-[var(--radius-sm)] py-[6px] px-[10px]'

const DEV_SCRUBBER_ROW_CLASSES = 'flex items-center gap-2'
const DEV_SCRUBBER_WRAP_CLASSES = 'flex-1 relative flex flex-col gap-[2px]'
const DEV_SCRUBBER_CLASSES = 'dev-scrubber w-full [accent-color:var(--red-bright)]'
const DEV_PERIOD_MARKERS_CLASSES = 'relative h-4'
const DEV_PERIOD_TICK_CLASSES = 'dev-period-tick group absolute -translate-x-1/2 bg-transparent border-0 p-0 cursor-pointer flex flex-col items-center gap-px before:content-[\'\'] before:block before:w-px before:h-[5px] before:bg-[var(--border-2)] hover:before:bg-[var(--red-bright)]'
const DEV_PERIOD_TICK_LABEL_CLASSES = 'text-[8px] text-[color:var(--text-dim)] font-[family-name:var(--font-mono)] whitespace-nowrap group-hover:text-[color:var(--red-bright)]'
const DEV_TIME_CLASSES = 'text-[10px] font-[family-name:var(--font-mono)] text-[color:var(--text-muted)] whitespace-nowrap min-w-[52px] last:text-right'

const DEV_CONTROLS_CLASSES = 'flex items-center gap-[6px]'

const DEV_SPEED_ROW_CLASSES = 'flex items-center gap-2'
const DEV_SPEED_BTNS_CLASSES = 'flex gap-1'
const DEV_SPEED_BTN_EXTRA_CLASSES = 'py-1 px-2 text-[10px]'

const DEV_STATUS_CLASSES = 'flex gap-4 py-[6px] px-[10px] bg-[var(--bg3)] rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border)]'
const DEV_STATUS_ITEM_CLASSES = 'flex flex-col gap-px'
const DEV_STATUS_LABEL_CLASSES = 'text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.08em]'
const DEV_STATUS_VAL_CLASSES = 'text-[11px] font-[family-name:var(--font-mono)] text-[color:var(--text-muted)]'

const DEV_SHOTMAP_CLASSES = 'dev-shotmap flex-1 overflow-y-auto'

const PERIOD_SECS = 1200; // 20 minutes

function playTimeSecs(play) {
  const period = play.periodDescriptor?.number || 1;
  const [m, s] = (play.timeInPeriod || '00:00').split(':').map(Number);
  return (period - 1) * PERIOD_SECS + m * 60 + (s || 0);
}

function secsToDisplay(secs) {
  const period = Math.floor(secs / PERIOD_SECS) + 1;
  const rem    = secs % PERIOD_SECS;
  const m      = Math.floor(rem / 60).toString().padStart(2, '0');
  const s      = (rem % 60).toString().padStart(2, '0');
  const pLabel = period <= 3 ? `P${period}` : `OT${period - 3}`;
  return `${pLabel} ${m}:${s}`;
}

function synthesizeLiveGame(fullPbp, loadedGameId, plays) {
  if (!fullPbp || !loadedGameId) return null;
  // Count goals up to playhead
  const homeId = fullPbp.homeTeam?.id;
  let homeScore = 0, awayScore = 0;
  plays.forEach(p => {
    if (p.typeDescKey !== 'goal') return;
    if (p.details?.eventOwnerTeamId === homeId) homeScore++;
    else awayScore++;
  });
  return {
    id:        loadedGameId,
    gameType:  fullPbp.gameType || 2,
    gameDate:  fullPbp.gameDate || '',
    gameState: 'LIVE',
    homeTeam:  { ...fullPbp.homeTeam, score: homeScore },
    awayTeam:  { ...fullPbp.awayTeam, score: awayScore },
  };
}

function synthesizeBoxscore(fullBoxscore, fullPbp, plays) {
  if (!fullBoxscore || !fullPbp) return null;

  // ── Goalie stats ──────────────────────────────────────────────
  // Count shots against each goalie from PBP up to playhead
  const goalieStats = {}; // goalieId -> { saves, shotsAgainst, goals }
  plays.forEach(p => {
    const t = p.typeDescKey;
    if (t !== 'shot-on-goal' && t !== 'goal') return;
    const goalieId = p.details?.goalieInNetId;
    if (!goalieId) return;
    if (!goalieStats[goalieId]) goalieStats[goalieId] = { saves: 0, shotsAgainst: 0 };
    goalieStats[goalieId].shotsAgainst++;
    if (t === 'shot-on-goal') goalieStats[goalieId].saves++;
  });

  // Patch goalie rows in both team sides
  function patchGoalies(goalies = []) {
    return goalies.map(g => {
      const s = goalieStats[g.playerId];
      if (!s) return { ...g, saves: 0, shotsAgainst: 0, savePctg: null };
      const svp = s.shotsAgainst > 0 ? s.saves / s.shotsAgainst : null;
      return { ...g, saves: s.saves, shotsAgainst: s.shotsAgainst, savePctg: svp };
    });
  }

  const pbg = fullBoxscore.playerByGameStats;
  const patchedPbg = pbg ? {
    homeTeam: {
      ...pbg.homeTeam,
      goalies: patchGoalies(pbg.homeTeam?.goalies),
    },
    awayTeam: {
      ...pbg.awayTeam,
      goalies: patchGoalies(pbg.awayTeam?.goalies),
    },
  } : null;

  // ── Period scoring summary ────────────────────────────────────
  const periodMap = {};
  plays.forEach(p => {
    if (p.typeDescKey !== 'goal') return;
    const per = p.periodDescriptor?.number || 1;
    if (!periodMap[per]) periodMap[per] = { period: per, goals: [] };
    periodMap[per].goals.push({
      teamAbbrev: { default: p.details?.eventOwnerTeamId === fullPbp.homeTeam?.id
        ? fullPbp.homeTeam?.abbrev
        : fullPbp.awayTeam?.abbrev },
      ...p.details,
    });
  });
  const scoring = Object.values(periodMap).sort((a, b) => a.period - b.period);

  return {
    ...fullBoxscore,
    playerByGameStats: patchedPbg,
    summary: { ...fullBoxscore.summary, scoring },
  };
}

export default function DevReplayView() {
  if (!import.meta.env.DEV) {
    return <div style={{ padding: 32, color: '#888' }}>Not available in production.</div>;
  }
  return <DevReplayViewInner />;
}

function DevReplayViewInner() {
  const [gameIdInput, setGameIdInput]   = useState('');
  const [loadedGameId, setLoadedGameId] = useState(null);
  const [fullPbp, setFullPbp]           = useState(null);
  const [fullBoxscore, setFullBoxscore] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [playheadSecs, setPlayheadSecs] = useState(0);
  const [maxSecs, setMaxSecs]           = useState(3600);
  const [playing, setPlaying]           = useState(false);
  const [speed, setSpeed]               = useState(60); // secs of game time per real second
  const [recentGames, setRecentGames]   = useState([]);
  const playRef = useRef(null);

  // Load recent CAR games for quick picks. Re-run on
  // teamConfig.js's 'eyewall:nhl-season-updated' event (same fix pattern
  // PWHLScheduleView.jsx/PWHLPlayersView.jsx already use for their own
  // season-picker defaults) -- defensive against CURRENT_SEASON correcting
  // itself away from its hardcoded seed (teamConfig.js:31) after this
  // effect already fired once.
  //
  // Whole-season-empty fallback: CURRENT_SEASON can correctly resolve to
  // the new season before that season's first game (confirmed live 2026-08
  // -- the real live resolver already treats 2026-27 as current, with
  // CAR's entire 88-game schedule still 'FUT', first game 2026-09-20).
  // That's not a bug to route around, just the expected steady state for
  // the ~2 months between season flip and puck drop -- same reasoning
  // eyewall-poller's /goalie-analytics and /player-analytics routes
  // already use their own one-season-back fallback for. Mirrored here so
  // this dev tool has real games to load against year-round instead of
  // silently going empty for that whole window.
  const [seasonVersion, setSeasonVersion] = useState(0);
  useEffect(() => {
    const handler = () => setSeasonVersion(v => v + 1);
    window.addEventListener('eyewall:nhl-season-updated', handler);
    return () => window.removeEventListener('eyewall:nhl-season-updated', handler);
  }, []);
  useEffect(() => {
    async function fetchCompleted(season) {
      const r = await fetch(`/nhl-api/v1/club-schedule-season/CAR/${season}`);
      const d = await r.json();
      return (d?.games || []).filter(g => ['OFF', 'FINAL', 'F'].includes(g.gameState));
    }
    (async () => {
      try {
        let completed = await fetchCompleted(CURRENT_SEASON);
        if (completed.length === 0) {
          const priorSeason = String(Number(CURRENT_SEASON) - 10001); // 20262027 -> 20252026
          completed = await fetchCompleted(priorSeason);
        }
        setRecentGames(completed.slice(-8).reverse());
      } catch {
        // leave recentGames as-is -- the quick-pick list just stays empty/stale
      }
    })();
  }, [seasonVersion]);

  const loadGame = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setPlayheadSecs(0);
    try {
      const [pbp, box] = await Promise.all([
        getGameDetail(id),
        getGameBoxscore(id),
      ]);
      if (!pbp?.plays?.length) throw new Error('No play-by-play data for this game.');
      // Clear session keys so win/goal popups and period summaries fire fresh
      sessionStorage.removeItem(`win_shown_${id}`);
      sessionStorage.removeItem(`lastPlay_${id}`);
      sessionStorage.removeItem(`goals_${id}`);
      sessionStorage.removeItem('eyewall_period_summaries');
      sessionStorage.removeItem('eyewall_game_summary');
      sessionStorage.removeItem(`puckdrop_shown_${id}`);
      sessionStorage.removeItem(`penalties_${id}`);
      const plays = pbp.plays;
      const last  = plays[plays.length - 1];
      const total = playTimeSecs(last) + 60;
      setFullPbp(pbp);
      setFullBoxscore(box);
      setMaxSecs(total);
      setLoadedGameId(id);
    } catch (e) {
      setError(e.message || 'Failed to load game.');
    } finally {
      setLoading(false);
    }
  };

  // Play/pause ticker
  useEffect(() => {
    if (playRef.current) clearInterval(playRef.current);
    if (!playing || !loadedGameId) return;
    playRef.current = setInterval(() => {
      setPlayheadSecs(prev => {
        const next = prev + speed / 10; // update 10x/sec
        if (next >= maxSecs) { setPlaying(false); return maxSecs; }
        return next;
      });
    }, 100);
    return () => clearInterval(playRef.current);
  }, [playing, speed, maxSecs, loadedGameId]);

  // Sliced PBP — only plays up to playhead
  const slicedPbp = useMemo(() => {
    if (!fullPbp) return null;
    const plays = fullPbp.plays.filter(p => playTimeSecs(p) <= playheadSecs);

    // Cap period at the actual last period in the game (no phantom OT)
    const lastPlay     = fullPbp.plays[fullPbp.plays.length - 1];
    const finalPeriod  = lastPlay?.periodDescriptor?.number || 3;
    const isGameOver   = playheadSecs >= maxSecs;

    const periodNum    = isGameOver
      ? finalPeriod
      : Math.min(Math.floor(playheadSecs / PERIOD_SECS) + 1, finalPeriod);
    const periodSecs   = playheadSecs % PERIOD_SECS;
    const remaining    = PERIOD_SECS - periodSecs;
    const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
    const ss = (remaining % 60).toString().padStart(2, '0');

    const homeId = fullPbp.homeTeam?.id;
    const homeScore = plays.filter(p => p.typeDescKey === 'goal' && p.details?.eventOwnerTeamId === homeId).length;
    const awayScore = plays.filter(p => p.typeDescKey === 'goal' && p.details?.eventOwnerTeamId !== homeId).length;

    return {
      ...fullPbp,
      plays,
      gameState: isGameOver ? 'FINAL' : 'LIVE',
      homeTeam: { ...fullPbp.homeTeam, score: homeScore },
      awayTeam: { ...fullPbp.awayTeam, score: awayScore },
      clock: {
        timeRemaining:  isGameOver ? '00:00' : `${mm}:${ss}`,
        // Intermission: playhead is within the last 5s of a completed period
        // and there's still another period to play. This triggers period summary
        // generation in usePeriodSummary the same way a real intermission would.
        inIntermission: !isGameOver && periodSecs >= PERIOD_SECS - 5 && periodNum < finalPeriod,
        running:        !isGameOver,
      },
      periodDescriptor: {
        number:     periodNum,
        periodType: periodNum <= 3 ? 'REG' : 'OT',
      },
    };
  }, [fullPbp, playheadSecs, maxSecs]);

  // Mock live game object — scores derived from plays up to playhead
  // Transitions to FINAL when playhead reaches end so Win popup fires
  const mockLiveGame = useMemo(() => {
    const game = synthesizeLiveGame(fullPbp, loadedGameId, slicedPbp?.plays || []);
    if (!game) return null;
    const isGameOver = playheadSecs >= maxSecs;
    return {
      ...game,
      gameState: isGameOver ? 'FINAL' : 'LIVE',
      // Include period for Topbar display
      _period: slicedPbp?.periodDescriptor,
      _clock:  slicedPbp?.clock,
    };
  }, [fullPbp, loadedGameId, slicedPbp, playheadSecs, maxSecs]);

  // Synthesized boxscore — goalie stats and scoring from plays up to playhead
  const synthBoxscore = useMemo(() =>
    synthesizeBoxscore(fullBoxscore, fullPbp, slicedPbp?.plays || []),
    [fullBoxscore, fullPbp, slicedPbp?.plays?.length]
  );

  // Publish mock live game to Topbar whenever it changes
  useEffect(() => {
    if (mockLiveGame) publishMockLiveGame(mockLiveGame);
    else clearMockLiveGame();
  }, [mockLiveGame]);

  // Clear mock on unmount
  useEffect(() => () => clearMockLiveGame(), []);

  // Publish clock whenever playhead moves — frozen (not counting down)
  useEffect(() => {
    if (!slicedPbp) return;
    const c = slicedPbp.clock;
    if (c?.timeRemaining) publishClock(c.timeRemaining, false, false);
  }, [playheadSecs, slicedPbp]);

  const devValue = loadedGameId ? {
    liveGame: mockLiveGame,
    pbp:      slicedPbp,
    boxscore: synthBoxscore,
  } : null;

  const currentPlay = slicedPbp?.plays?.[slicedPbp.plays.length - 1];
  const currentEvent = currentPlay?.typeDescKey || '—';

  return (
    <div className={DEV_REPLAY_CLASSES}>
      {/* ── Control panel ── */}
      <div className={DEV_PANEL_CLASSES}>
        <div className={DEV_PANEL_HEADER_CLASSES}>
          <span className={DEV_BADGE_CLASSES}>DEV</span>
          <span className={DEV_TITLE_CLASSES}>Live Game Replay</span>
        </div>

        {/* Game picker */}
        <div className={DEV_ROW_CLASSES}>
          <input
            className={DEV_INPUT_CLASSES}
            placeholder="Game ID (e.g. 2025020800)"
            value={gameIdInput}
            onChange={e => setGameIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadGame(Number(gameIdInput))}
          />
          <button className={devBtnClasses({ primary: true })} onClick={() => loadGame(Number(gameIdInput))} disabled={loading}>
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>

        {/* Recent games quick-pick */}
        {recentGames.length > 0 && (
          <div className={DEV_RECENT_CLASSES}>
            <div className={DEV_SECTION_LABEL_CLASSES}>Recent CAR games</div>
            <div className={DEV_GAME_LIST_CLASSES}>
              {recentGames.map(g => {
                const isHome = g.homeTeam?.abbrev === 'CAR';
                const opp    = isHome ? g.awayTeam?.abbrev : g.homeTeam?.abbrev;
                const carG   = isHome ? g.homeTeam?.score : g.awayTeam?.score;
                const oppG   = isHome ? g.awayTeam?.score : g.homeTeam?.score;
                return (
                  <button key={g.id}
                    className={devGameBtnClasses(loadedGameId === g.id)}
                    onClick={() => { setGameIdInput(String(g.id)); loadGame(g.id); }}>
                    <span className={DEV_GAME_DATE_CLASSES}>{g.gameDate?.slice(5)}</span>
                    <span className={DEV_GAME_MATCHUP_CLASSES}>{isHome ? 'vs' : '@'} {opp}</span>
                    <span className={DEV_GAME_SCORE_CLASSES}>{carG}–{oppG}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <div className={DEV_ERROR_CLASSES}>{error}</div>}

        {/* Scrubber */}
        {loadedGameId && (
          <>
            <div className={DEV_SCRUBBER_ROW_CLASSES}>
              <span className={DEV_TIME_CLASSES}>{secsToDisplay(Math.floor(playheadSecs))}</span>
              <div className={DEV_SCRUBBER_WRAP_CLASSES}>
                <input
                  type="range" min={0} max={maxSecs} step={1}
                  value={Math.floor(playheadSecs)}
                  onChange={e => { setPlaying(false); setPlayheadSecs(Number(e.target.value)); }}
                  className={DEV_SCRUBBER_CLASSES}
                />
                {/* Period marker ticks */}
                <div className={DEV_PERIOD_MARKERS_CLASSES}>
                  {[1200, 2400, 3600].filter(s => s < maxSecs).map(s => (
                    <button
                      key={s}
                      className={DEV_PERIOD_TICK_CLASSES}
                      style={{ left: `${(s / maxSecs) * 100}%` }}
                      onClick={() => { setPlaying(false); setPlayheadSecs(s); }}
                      title={`Jump to P${s / 1200 + 1}`}
                    >
                      <span className={DEV_PERIOD_TICK_LABEL_CLASSES}>P{s / 1200 + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
              <span className={DEV_TIME_CLASSES}>{secsToDisplay(maxSecs)}</span>
            </div>

            {/* Controls */}
            <div className={DEV_CONTROLS_CLASSES}>
              <button className={devBtnClasses()} onClick={() => { setPlaying(false); setPlayheadSecs(0); }}>⏮</button>
              <button className={devBtnClasses()} onClick={() => setPlayheadSecs(p => Math.max(0, p - 60))}>–1m</button>
              <button className={`${devBtnClasses({ primary: true })} ${DEV_PLAY_BTN_CLASSES}`} onClick={() => setPlaying(p => !p)}>
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button className={devBtnClasses()} onClick={() => setPlayheadSecs(p => Math.min(maxSecs, p + 60))}>+1m</button>
              <button className={devBtnClasses()} onClick={() => { setPlaying(false); setPlayheadSecs(maxSecs); }}>⏭</button>
            </div>

            {/* Speed */}
            <div className={DEV_SPEED_ROW_CLASSES}>
              <span className={DEV_SECTION_LABEL_CLASSES}>Speed</span>
              <div className={DEV_SPEED_BTNS_CLASSES}>
                {[10, 30, 60, 120, 300].map(s => (
                  <button key={s}
                    className={`${devBtnClasses({ active: speed === s })} ${DEV_SPEED_BTN_EXTRA_CLASSES}`}
                    onClick={() => setSpeed(s)}>
                    {s < 60 ? `${s}s/s` : `${s/60}m/s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Dev tools */}
            <div className={DEV_SPEED_ROW_CLASSES}>
              <span className={DEV_SECTION_LABEL_CLASSES}>Dev</span>
              <div className={DEV_SPEED_BTNS_CLASSES}>
                <button className={devBtnClasses()} onClick={() => {
                  sessionStorage.removeItem('eyewall_period_summaries');
                  sessionStorage.removeItem('eyewall_game_summary');
                  if (loadedGameId) {
                    sessionStorage.removeItem(`win_shown_${loadedGameId}`);
                    sessionStorage.removeItem(`lastPlay_${loadedGameId}`);
                    sessionStorage.removeItem(`goals_${loadedGameId}`);
                    sessionStorage.removeItem(`puckdrop_shown_${loadedGameId}`);
                    sessionStorage.removeItem(`penalties_${loadedGameId}`);
                  }
                  setPlayheadSecs(0);
                  setPlaying(false);
                  window.location.reload();
                }} title="Clear all cached summaries and reset replay">
                  🗑 Clear &amp; Reset
                </button>
              </div>
            </div>

            {/* Status */}
            <div className={DEV_STATUS_CLASSES}>
              <span className={DEV_STATUS_ITEM_CLASSES}>
                <span className={DEV_STATUS_LABEL_CLASSES}>Plays</span>
                <span className={DEV_STATUS_VAL_CLASSES}>{slicedPbp?.plays?.length ?? 0} / {fullPbp?.plays?.length ?? 0}</span>
              </span>
              <span className={DEV_STATUS_ITEM_CLASSES}>
                <span className={DEV_STATUS_LABEL_CLASSES}>Last event</span>
                <span className={DEV_STATUS_VAL_CLASSES}>{currentEvent}</span>
              </span>
              <span className={DEV_STATUS_ITEM_CLASSES}>
                <span className={DEV_STATUS_LABEL_CLASSES}>Game ID</span>
                <span className={DEV_STATUS_VAL_CLASSES}>{loadedGameId}</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Shot Map rendered with injected data ── */}
      <div className={DEV_SHOTMAP_CLASSES}>
        <DevGameContext.Provider value={devValue}>
          <ShotMapView />
        </DevGameContext.Provider>
      </div>
    </div>
  );
}
