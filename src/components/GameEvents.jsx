import { useState, useEffect, useRef } from 'react';
import './GameEvents.css';

// ── Puck Drop Popup ───────────────────────────────────────────
export function PuckDropPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;
  return (
    <div className="game-event-overlay" onClick={onClose}>
      <div className="puck-drop-popup">
        <div className="puck-drop-siren">🚨</div>
        <div className="puck-drop-title">PUCK DROP</div>
        <div className="puck-drop-text">
          Pucks in deep. Pucks on net.<br />
          Win the battles.<br />
          Here we go, boys!
        </div>
        <div className="event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Goal horn ─────────────────────────────────────────────────
function playGoalHorn() {
  try {
    const audio = new Audio('/goal-horn.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

// ── Goal Popup ────────────────────────────────────────────────
export function GoalPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    playGoalHorn();
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;
  return (
    <div className="game-event-overlay" onClick={onClose}>
      <div className="goal-popup">
        <div className="goal-light">🚨</div>
        <div className="goal-word">GOAL!</div>
        {data.scorer && <div className="goal-scorer">{data.scorer}</div>}
        {data.assists?.length > 0 && (
          <div className="goal-assists">Assists: {data.assists.join(', ')}</div>
        )}
        {data.shotType && <div className="goal-shot-type">{data.shotType}</div>}
        <div className="goal-period">{data.time ? `${data.period} · ${data.time}` : data.period}</div>
        <div className="event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Penalty Popup ─────────────────────────────────────────────
export function PenaltyPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [data?.id]);

  if (!data) return null;
  return (
    <div className="game-event-overlay" onClick={onClose}>
      <div className="penalty-popup">
        <div className="penalty-words">
          <span>CHEATERS</span>
          <span>NEVER</span>
          <span>WIN</span>
        </div>
        <div className="penalty-divider" />
        {data.player && <div className="penalty-player">{data.player}</div>}
        <div className="penalty-desc">{data.description}</div>
        <div className="penalty-duration">{data.duration} min · {data.time ? `${data.period} ${data.time}` : data.period}</div>
        <div className="event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: ['#cc2233','#ffffff','#c8a951','#4ade80','#60a5fa'][i % 5],
    width: `${6 + Math.random() * 8}px`,
    height: `${10 + Math.random() * 8}px`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
  }));
  return (
    <>
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: p.left, background: p.color,
          width: p.width, height: p.height,
          animationDelay: p.delay, animationDuration: p.duration,
        }} />
      ))}
    </>
  );
}

// ── Win Popup ─────────────────────────────────────────────────
export function WinPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;
  return (
    <div className="game-event-overlay win-overlay" onClick={onClose}>
      <Confetti />
      <div className="win-popup">
        <div className="win-logo">🏆</div>
        <div className="win-text">CANES WIN!</div>
        <div className="win-score">{data.score}</div>
        <div className="event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Hook ──────────────────────────────────────────────────────
export function useGameEvents(pbp, isLive, playerMap, gameHome) {
  const [goalPopup,    setGoalPopup]    = useState(null);
  const [penaltyPopup, setPenaltyPopup] = useState(null);
  const [winPopup,     setWinPopup]     = useState(null);
  const [puckDropPopup, setPuckDropPopup] = useState(null);

  const gameId = pbp?.id ? String(pbp.id) : null;
  const puckDropFired = useRef(false);

  // Persist lastPlayIdx to sessionStorage so manual refreshes don't retrigger old events
  const lastPlayIdx  = useRef(
    gameId ? parseInt(sessionStorage.getItem(`lastPlay_${gameId}`) || '-1', 10) : -1
  );
  const gameEndFired = useRef(false);
  const shownGoals   = useRef(new Set(
    gameId ? JSON.parse(sessionStorage.getItem(`goals_${gameId}`) || '[]') : []
  ));
  // Track whether we were recently live (so we catch the final OT play)
  const wasLiveRef   = useRef(false);

  const pName = id => {
    if (!id || !playerMap) return null;
    const n = playerMap[String(id)];
    return n?.trim() || null;
  };
  const periodLabel = n => n === 4 ? 'OT' : n === 5 ? 'SO' : `P${n}`;

  // Track liveness — stay "active" for one extra cycle after game ends
  // so the OT/final goal can be processed even after isLive flips false
  useEffect(() => {
    if (isLive) wasLiveRef.current = true;
  }, [isLive]);

  // Process new plays — runs when PBP updates regardless of isLive
  // so OT goals aren't missed when gameState flips to OFF
  useEffect(() => {
    if (!pbp?.plays?.length) return;
    // Only process if we're live OR we were recently live (catch final play)
    if (!isLive && !wasLiveRef.current) return;

    const plays = pbp.plays;

    // On first load: skip existing plays, watch only new ones going forward
    if (lastPlayIdx.current === -1) {
      lastPlayIdx.current = plays.length - 1;
      return;
    }

    const newPlays = plays.slice(lastPlayIdx.current + 1);
    lastPlayIdx.current = plays.length - 1;
    if (gameId) sessionStorage.setItem(`lastPlay_${gameId}`, String(lastPlayIdx.current));
    if (newPlays.length === 0) return;

    for (const play of newPlays) {
      const d   = play.details || {};
      const per = periodLabel(play.periodDescriptor?.number);
      const time = play.timeInPeriod || null;

      // CAR goal — fire event, dedup by eventId
      // Also re-fire if scorer/assists changed (goal review)
      if (play.typeDescKey === 'goal' && d.eventOwnerTeamId === 12) {
        const eventId = play.eventId || `goal-${play.sortOrder}`;
        const scorer  = pName(d.scoringPlayerId);
        const assists = [d.assist1PlayerId, d.assist2PlayerId]
          .filter(Boolean).map(pName).filter(Boolean);
        const goalSig = `${eventId}:${scorer}:${assists.join(',')}`;
        if (!shownGoals.current.has(goalSig)) {
          // Remove any prior sig for this eventId (goal review — different players)
          shownGoals.current = new Set(
            [...shownGoals.current].filter(s => !s.startsWith(`${eventId}:`))
          );
          shownGoals.current.add(goalSig);
          if (gameId) sessionStorage.setItem(`goals_${gameId}`, JSON.stringify([...shownGoals.current]));
          setGoalPopup({ scorer, assists, shotType: d.shotType || null, period: per, time });
          return;
        }
      }

      // Opponent penalty → CAR power play
      if (play.typeDescKey === 'penalty' && d.eventOwnerTeamId !== 12) {
        setPenaltyPopup({
          id:          play.eventId || play.sortOrder,
          player:      pName(d.committedByPlayerId),
          description: d.descKey ? d.descKey.replace(/-/g, ' ') : 'Penalty',
          duration:    d.duration || 2,
          period:      per,
          time,
        });
        return;
      }
    }
  }, [pbp?.plays?.length, isLive]);

  // Puck drop detection — fires once when game goes live in P1
  useEffect(() => {
    if (!isLive || puckDropFired.current) return;
    if (!pbp?.plays?.length) return;
    const period = pbp.periodDescriptor?.number;
    if (period !== 1) return; // only fire at game start, not OT
    const sessionKey = `puckdrop_shown_${gameId}`;
    if (gameId && sessionStorage.getItem(sessionKey)) return;
    puckDropFired.current = true;
    if (gameId) sessionStorage.setItem(sessionKey, '1');
    setPuckDropPopup({ gameId });
  }, [isLive, pbp?.plays?.length]);

  // Win detection — use PBP gameState directly, not isLive
  // This catches wins in OT where isLive may already be false
  useEffect(() => {
    if (!pbp || gameEndFired.current) return;
    if (!wasLiveRef.current) return; // only fire if we were in the game

    const state = pbp.gameState;
    if (!['OFF','FINAL','F','FINAL_OVERTIME','FINAL_SHOOTOUT'].includes(state)) return;

    const sessionKey = `win_shown_${pbp.id || 'game'}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const homeScore = pbp.homeTeam?.score ?? 0;
    const awayScore = pbp.awayTeam?.score ?? 0;
    const carScore  = gameHome ? homeScore : awayScore;
    const oppScore  = gameHome ? awayScore : homeScore;
    const oppAbbrev = gameHome ? pbp.awayTeam?.abbrev : pbp.homeTeam?.abbrev;

    if (carScore > oppScore) {
      gameEndFired.current = true;
      sessionStorage.setItem(sessionKey, '1');
      setWinPopup({ score: `CAR ${carScore} – ${oppAbbrev} ${oppScore}` });
    }
  }, [pbp?.gameState, pbp?.plays?.length]);

  return {
    goalPopup,     clearGoalPopup:     () => setGoalPopup(null),
    penaltyPopup,  clearPenaltyPopup:  () => setPenaltyPopup(null),
    winPopup,      clearWinPopup:      () => setWinPopup(null),
    puckDropPopup, clearPuckDropPopup: () => setPuckDropPopup(null),
  };
}
