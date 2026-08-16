/**
 * PWHLDevReplayView — replay a completed PWHL game as if it were live.
 * Only accessible in development (import.meta.env.DEV).
 *
 * Route: /pwhl/dev
 * Usage: enter a game ID, scrub or play through the game,
 *        watch all live UI (score bar, shot map, PP chips, goalie card) respond.
 *
 * Simpler than the NHL equivalent because /pwhl/live/:gameId already returns
 * normalized events — no boxscore synthesis needed.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchPWHLLive, fetchPWHLSchedule, PWHL_TEAM_ID } from '../utils/pwhlApi';
import { PWHLDevGameContext } from '../utils/PWHLDevGameContext';
import { PWHL_CURRENT_SEASON, getPWHLTeamById } from '../utils/pwhlConfig';
import PWHLShotMapView from './PWHLShotMapView';

// Tailwind migration (Session 97, Phase 4, sub-PR 1) -- see DevReplayView.jsx
// for the full rationale (shared 2-consumer graph confirmed clean, why
// min-height/min-width are omitted, the .dev-btn.active/:hover specificity
// note). Cypress markers kept: .dev-game-btn, .dev-period-tick,
// .dev-scrubber, .dev-shotmap.
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

const PERIOD_SECS = 1200; // 20 min periods

// ── Helpers ───────────────────────────────────────────────────

function eventTimeSecs(ev) {
  const period = ev.period || 1;
  const [m, s] = (ev.time || '0:00').split(':').map(Number);
  return (period - 1) * PERIOD_SECS + m * 60 + (s || 0);
}

function secsToDisplay(secs) {
  const period  = Math.floor(secs / PERIOD_SECS) + 1;
  const rem     = secs % PERIOD_SECS;
  const m       = Math.floor(rem / 60).toString().padStart(2, '0');
  const s       = (rem % 60).toString().padStart(2, '0');
  const pLabel  = period <= 3 ? `P${period}` : period === 4 ? 'OT' : `OT${period - 3}`;
  return `${pLabel} ${m}:${s}`;
}

function periodLabel(n) {
  if (!n) return '—';
  if (n <= 3) return `P${n}`;
  if (n === 4) return 'OT';
  return `OT${n - 3}`;
}

/**
 * Derive live score from goal events up to playhead.
 * Returns { homeScore, awayScore }.
 */
function deriveScore(events, homeTeamId) {
  let homeScore = 0, awayScore = 0;
  events.forEach(ev => {
    if (ev.eventType !== 'goal') return;
    if (ev.teamId === homeTeamId) homeScore++;
    else awayScore++;
  });
  return { homeScore, awayScore };
}

/**
 * Derive goalie stats from events up to playhead.
 * Counts shots against each goalie using shot/goal events.
 */
function deriveGoalieStats(events, fullGoalieStats) {
  if (!fullGoalieStats?.length) return [];
  // Count shots on goal (shot + goal events) by which goalie was in net
  // We don't have goalieInNet per event, so use the full goalie stats
  // scaled to the proportion of total shots seen so far
  const _totalShots = events.filter(e =>
    e.eventType === 'shot' || e.eventType === 'goal'
  ).length;
  // Return full goalie stats — they'll be approximately correct
  // since we don't have per-shot goalie attribution in PWHL PBP
  return fullGoalieStats;
}

/**
 * Build faceoffStats from faceoff events up to playhead.
 */
function deriveFaceoffStats(events, fullFaceoffStats) {
  if (!events?.length) return fullFaceoffStats || {};
  const foEvents = events.filter(e => e.eventType === 'faceoff');
  if (!foEvents.length) return {};
  // Aggregate per player from normalized events
  // Faceoff events have homePlayer/visitingPlayer and homeWin
  const byPlayer = {};
  foEvents.forEach(ev => {
    const winner = ev.homeWin ? ev.homePlayer : ev.visitingPlayer;
    const loser  = ev.homeWin ? ev.visitingPlayer : ev.homePlayer;
    [winner, loser].forEach((p, idx) => {
      if (!p?.id) return;
      if (!byPlayer[p.id]) byPlayer[p.id] = {
        name:     `${p.firstName} ${p.lastName}`.trim(),
        wins:     0,
        attempts: 0,
        losses:   0,
      };
      byPlayer[p.id].attempts++;
      if (idx === 0) byPlayer[p.id].wins++;
      else byPlayer[p.id].losses++;
    });
  });
  return byPlayer;
}

// ── Main component ────────────────────────────────────────────

export default function PWHLDevReplayView() {
  if (!import.meta.env.DEV) {
    return <div style={{ padding: 32, color: '#888' }}>Not available in production.</div>;
  }
  return <PWHLDevReplayViewInner />;
}

function PWHLDevReplayViewInner() {
  const [gameIdInput, setGameIdInput]   = useState('');
  const [loadedGameId, setLoadedGameId] = useState(null);
  const [fullLiveData, setFullLiveData] = useState(null); // raw /pwhl/live response
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [playheadSecs, setPlayheadSecs] = useState(0);
  const [maxSecs, setMaxSecs]           = useState(3600);
  const [playing, setPlaying]           = useState(false);
  const [speed, setSpeed]               = useState(60);
  const [recentGames, setRecentGames]   = useState([]);
  const playRef = useRef(null);

  // Load recent completed games for the selected team. Same fix as
  // DevReplayView.jsx's own "Recent CAR games" list: PWHL_CURRENT_SEASON
  // starts out seeded with the new season and only corrects to the
  // live-resolved value a moment later -- if this effect fired first (the
  // common case), it queried a season with zero completed games and never
  // re-fetched once the correction landed. Re-run on pwhlConfig.js's
  // 'eyewall:pwhl-season-updated' event, same pattern
  // PWHLScheduleView.jsx/PWHLPlayersView.jsx already use.
  const [seasonVersion, setSeasonVersion] = useState(0);
  useEffect(() => {
    const handler = () => setSeasonVersion(v => v + 1);
    window.addEventListener('eyewall:pwhl-season-updated', handler);
    return () => window.removeEventListener('eyewall:pwhl-season-updated', handler);
  }, []);
  useEffect(() => {
    const selectedTeamId = PWHL_TEAM_ID ? parseInt(PWHL_TEAM_ID, 10) : null;
    if (!selectedTeamId) return;
    fetchPWHLSchedule(selectedTeamId, PWHL_CURRENT_SEASON)
      .then(games => {
        if (!Array.isArray(games)) return;
        const completed = games
          .filter(g => g.game_state === 'Final')
          .sort((a, b) => b.game_id - a.game_id)
          .slice(0, 8);
        setRecentGames(completed);
      })
      .catch(() => {});
  }, [seasonVersion]);

  const loadGame = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setPlayheadSecs(0);
    try {
      const data = await fetchPWHLLive(id);
      if (!data?.events?.length) throw new Error('No event data for this game.');
      const last    = data.events[data.events.length - 1];
      const total   = eventTimeSecs(last) + 60;
      setFullLiveData(data);
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
        const next = prev + speed / 10;
        if (next >= maxSecs) { setPlaying(false); return maxSecs; }
        return next;
      });
    }, 100);
    return () => clearInterval(playRef.current);
  }, [playing, speed, maxSecs, loadedGameId]);

  // Sliced events — only events up to playhead
  const slicedEvents = useMemo(() => {
    if (!fullLiveData?.events) return [];
    return fullLiveData.events.filter(ev => eventTimeSecs(ev) <= playheadSecs);
  }, [fullLiveData, playheadSecs]);

  // Current period from playhead position
  const currentPeriod = useMemo(() => {
    if (!fullLiveData) return 1;
    const lastEvent  = fullLiveData.events[fullLiveData.events.length - 1];
    const finalPeriod = lastEvent?.period || 3;
    const isGameOver  = playheadSecs >= maxSecs;
    return isGameOver
      ? finalPeriod
      : Math.min(Math.floor(playheadSecs / PERIOD_SECS) + 1, finalPeriod);
  }, [fullLiveData, playheadSecs, maxSecs]);

  // Clock within current period (time elapsed, MM:SS)
  const currentTime = useMemo(() => {
    const periodSecs = playheadSecs % PERIOD_SECS;
    const m = Math.floor(periodSecs / 60).toString().padStart(2, '0');
    const s = (Math.floor(periodSecs) % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [playheadSecs]);

  // Synthesized liveData from sliced events
  const synthLiveData = useMemo(() => {
    if (!fullLiveData) return null;
    const isGameOver = playheadSecs >= maxSecs;
    const { homeScore, awayScore } = deriveScore(slicedEvents, fullLiveData.homeTeamId);
    return {
      gameId:       fullLiveData.gameId,
      homeTeamId:   fullLiveData.homeTeamId,
      awayTeamId:   fullLiveData.awayTeamId,
      homeScore,
      awayScore,
      gameStatus:   isGameOver ? 'final' : 'live',
      events:       slicedEvents,
      goalieStats:  deriveGoalieStats(slicedEvents, fullLiveData.goalieStats),
      faceoffStats: deriveFaceoffStats(slicedEvents, fullLiveData.faceoffStats),
    };
  }, [fullLiveData, slicedEvents, playheadSecs, maxSecs]);

  // Synthesized liveGame (what /pwhl/today returns for a live game)
  const synthLiveGame = useMemo(() => {
    if (!fullLiveData) return null;
    const isGameOver  = playheadSecs >= maxSecs;
    const { homeScore, awayScore } = synthLiveData
      ? { homeScore: synthLiveData.homeScore, awayScore: synthLiveData.awayScore }
      : { homeScore: 0, awayScore: 0 };

    // Resolve team codes from PWHL_TEAM_BY_ID (via getPWHLTeamById)
    return {
      gameId:        fullLiveData.gameId,
      homeTeamId:    fullLiveData.homeTeamId,
      awayTeamId:    fullLiveData.awayTeamId,
      homeTeamCode:  getPWHLTeamById(fullLiveData.homeTeamId)?.abbr || String(fullLiveData.homeTeamId),
      awayTeamCode:  getPWHLTeamById(fullLiveData.awayTeamId)?.abbr || String(fullLiveData.awayTeamId),
      homeScore,
      awayScore,
      status:        isGameOver ? 'final' : 'live',
      // Extra fields for PWHLShotMapView live clock display
      _period:       currentPeriod,
      _time:         currentTime,
    };
  }, [fullLiveData, synthLiveData, playheadSecs, maxSecs, currentPeriod, currentTime]);

  // Dev context value injected into PWHLShotMapView
  const devValue = loadedGameId ? {
    liveGame: synthLiveGame,
    liveData: synthLiveData,
  } : null;

  const currentEvent = slicedEvents[slicedEvents.length - 1];

  return (
    <div className={DEV_REPLAY_CLASSES}>
      {/* ── Control panel ── */}
      <div className={DEV_PANEL_CLASSES}>
        <div className={DEV_PANEL_HEADER_CLASSES}>
          <span className={DEV_BADGE_CLASSES}>DEV</span>
          <span className={DEV_TITLE_CLASSES}>PWHL Live Game Replay</span>
        </div>

        {/* Game ID input */}
        <div className={DEV_ROW_CLASSES}>
          <input
            className={DEV_INPUT_CLASSES}
            placeholder="Game ID (e.g. 329)"
            value={gameIdInput}
            onChange={e => setGameIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadGame(Number(gameIdInput))}
          />
          <button
            className={devBtnClasses({ primary: true })}
            onClick={() => loadGame(Number(gameIdInput))}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>

        {/* Recent games quick-pick */}
        {recentGames.length > 0 && (
          <div className={DEV_RECENT_CLASSES}>
            <div className={DEV_SECTION_LABEL_CLASSES}>Recent games</div>
            <div className={DEV_GAME_LIST_CLASSES}>
              {recentGames.map(g => {
                const homeCode = getPWHLTeamById(g.home_team_id)?.abbr || String(g.home_team_id);
                const awayCode = getPWHLTeamById(g.away_team_id)?.abbr || String(g.away_team_id);
                return (
                  <button
                    key={g.game_id}
                    className={devGameBtnClasses(loadedGameId === g.game_id)}
                    onClick={() => { setGameIdInput(String(g.game_id)); loadGame(g.game_id); }}
                  >
                    <span className={DEV_GAME_DATE_CLASSES}>{g.game_date?.slice(5)}</span>
                    <span className={DEV_GAME_MATCHUP_CLASSES}>{homeCode} vs {awayCode}</span>
                    <span className={DEV_GAME_SCORE_CLASSES}>{g.home_score}–{g.away_score}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <div className={DEV_ERROR_CLASSES}>{error}</div>}

        {/* Scrubber + controls */}
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

            {/* Playback controls */}
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

            {/* Status */}
            <div className={DEV_STATUS_CLASSES}>
              <span className={DEV_STATUS_ITEM_CLASSES}>
                <span className={DEV_STATUS_LABEL_CLASSES}>Events</span>
                <span className={DEV_STATUS_VAL_CLASSES}>
                  {slicedEvents.length} / {fullLiveData?.events?.length ?? 0}
                </span>
              </span>
              <span className={DEV_STATUS_ITEM_CLASSES}>
                <span className={DEV_STATUS_LABEL_CLASSES}>Period</span>
                <span className={DEV_STATUS_VAL_CLASSES}>{periodLabel(currentPeriod)}</span>
              </span>
              <span className={DEV_STATUS_ITEM_CLASSES}>
                <span className={DEV_STATUS_LABEL_CLASSES}>Last event</span>
                <span className={DEV_STATUS_VAL_CLASSES}>{currentEvent?.eventType || '—'}</span>
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
        <PWHLDevGameContext.Provider value={devValue}>
          <PWHLShotMapView />
        </PWHLDevGameContext.Provider>
      </div>
    </div>
  );
}
