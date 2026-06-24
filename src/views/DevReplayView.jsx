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
import './DevReplayView.css';

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

  // Load recent CAR games for quick picks
  useEffect(() => {
    fetch(`/nhl-api/v1/club-schedule-season/CAR/${CURRENT_SEASON}`)
      .then(r => r.json())
      .then(d => {
        const completed = (d?.games || [])
          .filter(g => ['OFF','FINAL','F'].includes(g.gameState))
          .slice(-8).reverse();
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
    <div className="dev-replay">
      {/* ── Control panel ── */}
      <div className="dev-panel">
        <div className="dev-panel-header">
          <span className="dev-badge">DEV</span>
          <span className="dev-title">Live Game Replay</span>
        </div>

        {/* Game picker */}
        <div className="dev-row">
          <input
            className="dev-input"
            placeholder="Game ID (e.g. 2025020800)"
            value={gameIdInput}
            onChange={e => setGameIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadGame(Number(gameIdInput))}
          />
          <button className="dev-btn dev-btn-primary" onClick={() => loadGame(Number(gameIdInput))} disabled={loading}>
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>

        {/* Recent games quick-pick */}
        {recentGames.length > 0 && (
          <div className="dev-recent">
            <div className="dev-section-label">Recent CAR games</div>
            <div className="dev-game-list">
              {recentGames.map(g => {
                const isHome = g.homeTeam?.abbrev === 'CAR';
                const opp    = isHome ? g.awayTeam?.abbrev : g.homeTeam?.abbrev;
                const carG   = isHome ? g.homeTeam?.score : g.awayTeam?.score;
                const oppG   = isHome ? g.awayTeam?.score : g.homeTeam?.score;
                return (
                  <button key={g.id}
                    className={`dev-game-btn${loadedGameId === g.id ? ' active' : ''}`}
                    onClick={() => { setGameIdInput(String(g.id)); loadGame(g.id); }}>
                    <span className="dev-game-date">{g.gameDate?.slice(5)}</span>
                    <span className="dev-game-matchup">{isHome ? 'vs' : '@'} {opp}</span>
                    <span className="dev-game-score">{carG}–{oppG}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <div className="dev-error">{error}</div>}

        {/* Scrubber */}
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

            {/* Controls */}
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

            {/* Dev tools */}
            <div className="dev-speed-row">
              <span className="dev-section-label">Dev</span>
              <div className="dev-speed-btns">
                <button className="dev-btn" onClick={() => {
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
            <div className="dev-status">
              <span className="dev-status-item">
                <span className="dev-status-label">Plays</span>
                <span className="dev-status-val">{slicedPbp?.plays?.length ?? 0} / {fullPbp?.plays?.length ?? 0}</span>
              </span>
              <span className="dev-status-item">
                <span className="dev-status-label">Last event</span>
                <span className="dev-status-val">{currentEvent}</span>
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
        <DevGameContext.Provider value={devValue}>
          <ShotMapView />
        </DevGameContext.Provider>
      </div>
    </div>
  );
}
