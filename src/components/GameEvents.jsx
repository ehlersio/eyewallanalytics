import { useState, useEffect, useRef } from 'react';
import './GameEvents.css';

// ── Goal horn ────────────────────────────────────────────────
function playGoalHorn() {
  try {
    const audio = new Audio('/goal-horn.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

// ── Goal Popup ───────────────────────────────────────────────
export function GoalPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return; // don't play horn if no data
    playGoalHorn();
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;
  return (
    <div className="event-popup goal-popup" onClick={onClose}>
      <div className="event-popup-inner">
        <div className="goal-siren">🚨</div>
        <div className="goal-title">GOAL!</div>
        {data.scorer && data.scorer !== '—' && (
          <div className="goal-scorer">{data.scorer}</div>
        )}
        {data.assists?.length > 0 && (
          <div className="goal-assists">
            Assists: {data.assists.join(', ')}
          </div>
        )}
        {data.shotType && (
          <div className="goal-shot">{data.shotType}</div>
        )}
        <div className="goal-period">{data.period}</div>
        <div className="event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Penalty Popup ─────────────────────────────────────────────
export function PenaltyPopup({ data, onClose }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!data) return;
    // initialise countdown from penalty duration in seconds
    const dur = typeof data.duration === 'number'
      ? data.duration * 60
      : parseInt(data.duration || '2') * 60;
    setRemaining(dur);

    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(interval); onClose(); return 0; }
        return r - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data?.id]);

  if (!data) return null;

  const mins = Math.floor((remaining ?? 0) / 60);
  const secs = ((remaining ?? 0) % 60).toString().padStart(2, '0');

  return (
    <div className="event-popup penalty-popup" onClick={onClose}>
      <div className="event-popup-inner">
        <div className="penalty-title">⚡ POWER PLAY</div>
        <div className="penalty-clock">{mins}:{secs}</div>
        {data.player && data.player !== '—' && (
          <div className="penalty-player">{data.player}</div>
        )}
        <div className="penalty-desc">{data.description}</div>
        <div className="penalty-sub">{data.duration} min · {data.period}</div>
        <div className="event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Win Popup ─────────────────────────────────────────────────
export function WinPopup({ data, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, []);

  if (!data) return null;
  return (
    <div className="event-popup win-popup" onClick={onClose}>
      <div className="event-popup-inner">
        <div className="win-trophy">🏆</div>
        <div className="win-title">CANES WIN!</div>
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

  const lastPlayIdx  = useRef(-1);
  const gameEndFired = useRef(false);
  // Track which goal eventIds we've shown this session
  const shownGoals   = useRef(new Set());

  const pName = id => {
    if (!id || !playerMap) return null;
    const n = playerMap[String(id)];
    return n?.trim() || null;
  };
  const periodLabel = n => n === 4 ? 'OT' : n === 5 ? 'SO' : `P${n}`;

  // New plays → show events
  useEffect(() => {
    if (!pbp?.plays?.length || !isLive) return;
    const plays = pbp.plays;

    // On first load, skip all existing plays — only react to NEW plays going forward
    if (lastPlayIdx.current === -1) {
      lastPlayIdx.current = plays.length - 1;
      return;
    }

    const newPlays = plays.slice(lastPlayIdx.current + 1);
    lastPlayIdx.current = plays.length - 1;
    if (newPlays.length === 0) return;

    for (const play of newPlays) {
      const d   = play.details || {};
      const per = periodLabel(play.periodDescriptor?.number);

      // CAR goal — only show once per unique event
      if (play.typeDescKey === 'goal' && d.eventOwnerTeamId === 12) {
        const eventId = play.eventId || `goal-${play.sortOrder}`;
        if (!shownGoals.current.has(eventId)) {
          shownGoals.current.add(eventId);
          const scorer  = pName(d.scoringPlayerId);
          const assists = [d.assist1PlayerId, d.assist2PlayerId]
            .filter(Boolean).map(pName).filter(Boolean);
          setGoalPopup({ scorer, assists, shotType: d.shotType || null, period: per });
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
        });
        return;
      }
    }
  }, [pbp?.plays?.length, isLive]);

  // Win detection
  useEffect(() => {
    if (!isLive || !pbp) return;
    const state = pbp.gameState;
    if (['OFF','FINAL','F'].includes(state) && !gameEndFired.current) {
      gameEndFired.current = true;
      const sessionKey = `win_shown_${pbp.id || 'game'}`;
      if (sessionStorage.getItem(sessionKey)) return;

      const homeScore = pbp.homeTeam?.score ?? 0;
      const awayScore = pbp.awayTeam?.score ?? 0;
      const carScore  = gameHome ? homeScore : awayScore;
      const oppScore  = gameHome ? awayScore : homeScore;
      const oppAbbrev = gameHome ? pbp.awayTeam?.abbrev : pbp.homeTeam?.abbrev;

      if (carScore > oppScore) {
        sessionStorage.setItem(sessionKey, '1');
        setWinPopup({ score: `CAR ${carScore} – ${oppAbbrev} ${oppScore}` });
      }
    }
  }, [isLive, pbp]);

  return {
    goalPopup,    clearGoalPopup:    () => setGoalPopup(null),
    penaltyPopup, clearPenaltyPopup: () => setPenaltyPopup(null),
    winPopup,     clearWinPopup:     () => setWinPopup(null),
  };
}
