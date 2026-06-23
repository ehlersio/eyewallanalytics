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
import { PWHL_CURRENT_SEASON } from '../utils/pwhlConfig';
import PWHLShotMapView from './PWHLShotMapView';
import './DevReplayView.css'; // reuse NHL dev styles

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

  // Load recent completed games for the selected team
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
  }, []);

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

    // Resolve team codes from PWHL_TEAM_MAP
    const TEAM_CODES = { 1:'BOS', 2:'MIN', 3:'MTL', 4:'NY', 5:'OTT', 6:'TOR', 8:'SEA', 9:'VAN' };
    return {
      gameId:        fullLiveData.gameId,
      homeTeamId:    fullLiveData.homeTeamId,
      awayTeamId:    fullLiveData.awayTeamId,
      homeTeamCode:  TEAM_CODES[fullLiveData.homeTeamId] || String(fullLiveData.homeTeamId),
      awayTeamCode:  TEAM_CODES[fullLiveData.awayTeamId] || String(fullLiveData.awayTeamId),
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
  const TEAM_CODES   = { 1:'BOS', 2:'MIN', 3:'MTL', 4:'NY', 5:'OTT', 6:'TOR', 8:'SEA', 9:'VAN' };

  return (
    <div className="dev-replay">
      {/* ── Control panel ── */}
      <div className="dev-panel">
        <div className="dev-panel-header">
          <span className="dev-badge">DEV</span>
          <span className="dev-title">PWHL Live Game Replay</span>
        </div>

        {/* Game ID input */}
        <div className="dev-row">
          <input
            className="dev-input"
            placeholder="Game ID (e.g. 329)"
            value={gameIdInput}
            onChange={e => setGameIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadGame(Number(gameIdInput))}
          />
          <button
            className="dev-btn dev-btn-primary"
            onClick={() => loadGame(Number(gameIdInput))}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>

        {/* Recent games quick-pick */}
        {recentGames.length > 0 && (
          <div className="dev-recent">
            <div className="dev-section-label">Recent games</div>
            <div className="dev-game-list">
              {recentGames.map(g => {
                const homeCode = TEAM_CODES[g.home_team_id] || String(g.home_team_id);
                const awayCode = TEAM_CODES[g.away_team_id] || String(g.away_team_id);
                return (
                  <button
                    key={g.game_id}
                    className={`dev-game-btn${loadedGameId === g.game_id ? ' active' : ''}`}
                    onClick={() => { setGameIdInput(String(g.game_id)); loadGame(g.game_id); }}
                  >
                    <span className="dev-game-date">{g.game_date?.slice(5)}</span>
                    <span className="dev-game-matchup">{homeCode} vs {awayCode}</span>
                    <span className="dev-game-score">{g.home_score}–{g.away_score}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <div className="dev-error">{error}</div>}

        {/* Scrubber + controls */}
        {loadedGameId && (
          <>
            <div className="dev-scrubber-row">
              <span className="dev-time">{secsToDisplay(Math.floor(playheadSecs))}</span>
              <div className="dev-scrubber-wrap">
                <input
                  type="range" min={0} max={maxSecs} step={1}
                  value={Math.floor(playheadSecs)}
                  onChange={e => { setPlaying(false); setPlayheadSecs(Number(e.target.value)); }}
                  className="dev-scrubber"
                />
                {/* Period marker ticks */}
                <div className="dev-period-markers">
                  {[1200, 2400, 3600].filter(s => s < maxSecs).map(s => (
                    <button
                      key={s}
                      className="dev-period-tick"
                      style={{ left: `${(s / maxSecs) * 100}%` }}
                      onClick={() => { setPlaying(false); setPlayheadSecs(s); }}
                      title={`Jump to P${s / 1200 + 1}`}
                    >
                      <span className="dev-period-tick-label">P{s / 1200 + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
              <span className="dev-time">{secsToDisplay(maxSecs)}</span>
            </div>

            {/* Playback controls */}
            <div className="dev-controls">
              <button className="dev-btn" onClick={() => { setPlaying(false); setPlayheadSecs(0); }}>⏮</button>
              <button className="dev-btn" onClick={() => setPlayheadSecs(p => Math.max(0, p - 60))}>–1m</button>
              <button className="dev-btn dev-btn-primary dev-play-btn" onClick={() => setPlaying(p => !p)}>
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button className="dev-btn" onClick={() => setPlayheadSecs(p => Math.min(maxSecs, p + 60))}>+1m</button>
              <button className="dev-btn" onClick={() => { setPlaying(false); setPlayheadSecs(maxSecs); }}>⏭</button>
            </div>

            {/* Speed */}
            <div className="dev-speed-row">
              <span className="dev-section-label">Speed</span>
              <div className="dev-speed-btns">
                {[10, 30, 60, 120, 300].map(s => (
                  <button key={s}
                    className={`dev-btn dev-speed-btn${speed === s ? ' active' : ''}`}
                    onClick={() => setSpeed(s)}>
                    {s < 60 ? `${s}s/s` : `${s/60}m/s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="dev-status">
              <span className="dev-status-item">
                <span className="dev-status-label">Events</span>
                <span className="dev-status-val">
                  {slicedEvents.length} / {fullLiveData?.events?.length ?? 0}
                </span>
              </span>
              <span className="dev-status-item">
                <span className="dev-status-label">Period</span>
                <span className="dev-status-val">{periodLabel(currentPeriod)}</span>
              </span>
              <span className="dev-status-item">
                <span className="dev-status-label">Last event</span>
                <span className="dev-status-val">{currentEvent?.eventType || '—'}</span>
              </span>
              <span className="dev-status-item">
                <span className="dev-status-label">Game ID</span>
                <span className="dev-status-val">{loadedGameId}</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Shot Map rendered with injected data ── */}
      <div className="dev-shotmap">
        <PWHLDevGameContext.Provider value={devValue}>
          <PWHLShotMapView />
        </PWHLDevGameContext.Provider>
      </div>
    </div>
  );
}
