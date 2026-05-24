import { useState, useEffect, useRef } from 'react';
import './GameEvents.css';

// ── Goal celebration popup ────────────────────────────────────
export function GoalPopup({ goal, onDismiss }) {
  const audioRef = useRef(null);

  useEffect(() => {
    // Play goal horn (base64-encoded short buzzer tone using Web Audio API)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playHorn = () => {
        // Simple synthesized goal horn: low buzzer tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 2.5);
      };
      playHorn();
    } catch { /* audio not available */ }

    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="game-event-overlay" onClick={onDismiss}>
      <div className="goal-popup" onClick={e => e.stopPropagation()}>
        <div className="goal-light">🚨</div>
        <div className="goal-word">GOAL!</div>
        <div className="goal-scorer">{goal.scorer}</div>
        {goal.assists?.length > 0 && (
          <div className="goal-assists">Assists: {goal.assists.join(', ')}</div>
        )}
        {goal.shotType && <div className="goal-shot-type">{goal.shotType}</div>}
        <div className="goal-period">{goal.period}</div>
        <button className="game-event-dismiss" onClick={onDismiss}>dismiss</button>
      </div>
    </div>
  );
}

// ── Penalty popup ─────────────────────────────────────────────
export function PenaltyPopup({ penalty, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="game-event-overlay" onClick={onDismiss}>
      <div className="penalty-popup" onClick={e => e.stopPropagation()}>
        <div className="penalty-words">
          <span>CHEATERS</span>
          <span>NEVER</span>
          <span>WIN</span>
        </div>
        <div className="penalty-divider" />
        <div className="penalty-player">{penalty.player}</div>
        <div className="penalty-desc">{penalty.description}</div>
        <div className="penalty-duration">{penalty.duration} min · {penalty.period}</div>
        <button className="game-event-dismiss" onClick={onDismiss}>dismiss</button>
      </div>
    </div>
  );
}

// ── Win celebration ───────────────────────────────────────────
export function WinPopup({ score, onDismiss }) {
  const [confetti] = useState(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      color: ['#cc2200','#ffffff','#c8c8c8','#ff4422'][Math.floor(Math.random() * 4)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
    }))
  );

  useEffect(() => {
    const timer = setTimeout(onDismiss, 10000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="game-event-overlay win-overlay" onClick={onDismiss}>
      {/* Confetti */}
      {confetti.map(c => (
        <div key={c.id} className="confetti-piece" style={{
          left: `${c.x}%`,
          animationDelay: `${c.delay}s`,
          animationDuration: `${c.duration}s`,
          background: c.color,
          width: c.size, height: c.size,
          transform: `rotate(${c.rotation}deg)`,
        }} />
      ))}
      <div className="win-popup" onClick={e => e.stopPropagation()}>
        <div className="win-logo">🌀</div>
        <div className="win-text">CANES WIN!</div>
        <div className="win-score">{score}</div>
        <div className="win-sub">Let's go Canes! 🎉</div>
        <button className="game-event-dismiss" onClick={onDismiss}>dismiss</button>
      </div>
    </div>
  );
}

// ── Hook: detect new goals/penalties/win from PBP ─────────────
export function useGameEvents(pbp, isLive, playerMap, gameHome) {
  const [goalPopup,    setGoalPopup]    = useState(null);
  const [penaltyPopup, setPenaltyPopup] = useState(null);
  const [winPopup,     setWinPopup]     = useState(null);

  const lastPlayIdx  = useRef(-1);
  const gameEndFired = useRef(false);

  const pName = id => {
    if (!id || !playerMap) return '—';
    const n = playerMap[String(id)];
    return n?.trim() || `#${id}`;
  };
  const periodLabel = n => n === 4 ? 'OT' : n === 5 ? 'SO' : `P${n}`;

  useEffect(() => {
    if (!pbp?.plays?.length || !isLive) return;
    const plays = pbp.plays;

    // Find plays we haven't seen yet
    const newPlays = plays.slice(lastPlayIdx.current + 1);
    lastPlayIdx.current = plays.length - 1;

    if (newPlays.length === 0) return;

    for (const play of newPlays) {
      const d = play.details || {};
      const per = periodLabel(play.periodDescriptor?.number);

      // CAR goal
      if (play.typeDescKey === 'goal' && d.eventOwnerTeamId === 12) {
        const assists = [d.assist1PlayerId, d.assist2PlayerId]
          .filter(Boolean).map(pName).filter(n => n !== '—');
        setGoalPopup({
          scorer:   pName(d.scoringPlayerId),
          assists,
          shotType: d.shotType || null,
          period:   per,
        });
        return; // show one at a time
      }

      // Opponent penalty (CAR goes on PP)
      if (play.typeDescKey === 'penalty' && d.eventOwnerTeamId !== 12) {
        setPenaltyPopup({
          player:      pName(d.committedByPlayerId),
          description: d.descKey ? d.descKey.replace(/-/g, ' ') : 'Penalty',
          duration:    d.duration || '?',
          period:      per,
        });
        return;
      }
    }
  }, [pbp?.plays?.length, isLive]);

  // Win detection: game just ended and CAR won
  useEffect(() => {
    if (!pbp || isLive || gameEndFired.current) return;
    const carScore  = gameHome ? pbp.homeTeam?.score : pbp.awayTeam?.score;
    const oppScore  = gameHome ? pbp.awayTeam?.score : pbp.homeTeam?.score;
    const oppAbbrev = gameHome ? pbp.awayTeam?.abbrev : pbp.homeTeam?.abbrev;
    if (carScore != null && oppScore != null && carScore > oppScore) {
      gameEndFired.current = true;
      setWinPopup({ score: `CAR ${carScore} – ${oppAbbrev} ${oppScore}` });
    }
  }, [isLive, pbp]);

  return {
    goalPopup,    clearGoal:    () => setGoalPopup(null),
    penaltyPopup, clearPenalty: () => setPenaltyPopup(null),
    winPopup,     clearWin:     () => setWinPopup(null),
  };
}
