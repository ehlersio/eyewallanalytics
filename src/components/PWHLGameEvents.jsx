/**
 * PWHLGameEvents.jsx
 *
 * Game event popups (goal, penalty, win, puck drop) and live insights
 * for the PWHL live game view. Mirrors GameEvents.jsx + LiveInsights
 * from the NHL side, adapted for the PWHL normalized event shape.
 *
 * Event shape (normalized by PWHLShotMapView.normalizeLiveEvents):
 *   { event_type, team_id, period_id, time_seconds,
 *     player_name, is_power_play, penalty_minutes, description }
 *
 * Raw live event shape (from /pwhl/live/:gameId before normalization):
 *   { eventType, teamId, period, time, scoredBy, assists,
 *     takenBy, shotType, isPowerPlay, goalieIn, goalieOut }
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import './GameEvents.css'; // reuse NHL styles
import { HatTrickPopup as _HatTrickPopup } from './GameEvents'; // reuse hat trick popup

// ── Puck Drop ─────────────────────────────────────────────────

export function PWHLPuckDropPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [data, onClose]);

  if (!data) return null;
  return (
    <div className="game-event-overlay" onClick={onClose}>
      <div className="puck-drop-popup">
        <div className="puck-drop-siren">🏒</div>
        <div className="puck-drop-title">PUCK DROP</div>
        <div className="puck-drop-text">
          Pucks in deep. Pucks on net.<br />
          Win the battles.<br />
          Let's go!
        </div>
        <div className="game-event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Goal Popup ────────────────────────────────────────────────

export function PWHLGoalPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [data, onClose]);

  if (!data) return null;

  const modifiers = [
    data.isPowerPlay    && 'Power Play',
    data.isShortHanded  && 'Short Handed',
    data.isEmptyNet     && 'Empty Net',
    data.isPenaltyShot  && 'Penalty Shot',
  ].filter(Boolean);

  return (
    <div className="game-event-overlay" onClick={onClose}>
      <div className="goal-popup">
        <div className="goal-light">🚨</div>
        <div className="goal-word">GOAL!</div>
        {data.scorer && <div className="goal-scorer">{data.scorer}</div>}
        {data.assists?.length > 0 && (
          <div className="goal-assists">Assists: {data.assists.join(', ')}</div>
        )}
        {modifiers.length > 0 && (
          <div className="goal-shot-type">{modifiers.join(' · ')}</div>
        )}
        {data.shotType && <div className="goal-shot-type">{data.shotType}</div>}
        <div className="goal-period">
          {data.time ? `${data.periodLabel} · ${data.time}` : data.periodLabel}
        </div>
        <div className="game-event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Penalty Popup ─────────────────────────────────────────────

export function PWHLPenaltyPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [data?.id, onClose]);

  if (!data) return null;
  return (
    <div className="game-event-overlay" onClick={onClose}>
      <div className="penalty-popup">
        <div className="penalty-words">
          <span>POWER</span>
          <span>PLAY!</span>
        </div>
        <div className="penalty-divider" />
        {data.player && <div className="penalty-player">{data.player}</div>}
        {data.severity && (
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em',
            color:'var(--amber)', textTransform:'uppercase', marginBottom:4 }}>
            {data.severity}
          </div>
        )}
        <div className="penalty-desc">{data.desc || data.description}</div>
        <div className="penalty-duration">
          {data.duration} min · {data.time ? `${data.periodLabel} ${data.time}` : data.periodLabel}
        </div>
        <div className="game-event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────

function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left:     `${Math.random() * 100}%`,
    color:    ['#cc2233','#ffffff','#c8a951','#4ade80','#60a5fa'][i % 5],
    width:    `${6 + Math.random() * 8}px`,
    height:   `${10 + Math.random() * 8}px`,
    delay:    `${Math.random() * 2}s`,
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

export function PWHLWinPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [data, onClose]);

  if (!data) return null;
  return (
    <div className="game-event-overlay win-overlay" onClick={onClose}>
      <Confetti />
      <div className="win-popup">
        <div className="win-logo">🏆</div>
        <div className="win-text">{data.teamAbbr} WIN!</div>
        <div className="win-score">{data.score}</div>
        <div className="game-event-dismiss">tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Penalty description parser ───────────────────────────────
// HockeyTech prefixes encode penalty severity:
//   Ob-   → throwaway prefix (objective call), strip silently
//   Min-  → 2 min minor (redundant — duration shown separately), strip
//   Maj-  → 5 min major
//   Mis-  → misconduct (10 min)
//   Gm-   → game misconduct

const PENALTY_PREFIX_MAP = {
  'maj': 'Major',
  'mis': 'Misconduct',
  'gm':  'Game Misconduct',
};

// Returns { desc, severity } where severity is null for minor/unknown
function parsePenaltyDesc(raw) {
  if (!raw) return { desc: 'Penalty', severity: null };
  const match = raw.match(/^([A-Za-z]+)-(.+)$/);
  if (!match) return { desc: raw, severity: null };
  const prefix = match[1].toLowerCase();
  const body   = match[2].trim();
  const severity = PENALTY_PREFIX_MAP[prefix] || null;
  return { desc: body, severity };
}

// Simple cleaner for use outside the popup (normalizer, drill-downs)
function _cleanPenaltyDesc(raw) {
  const { desc, severity } = parsePenaltyDesc(raw);
  return severity ? `${severity} — ${desc}` : desc;
}

// ── Period label helper ───────────────────────────────────────

// Regular-season period 5 is a shootout ('SO'); playoffs never have one
// (full OT periods instead) — pass the current game's playoff status so
// period 5+ labels correctly.
function periodLabel(n, isPlayoff = false) {
  if (!n) return '—';
  if (n <= 3) return `P${n}`;
  if (n === 4) return 'OT';
  if (isPlayoff) return `OT${n - 3}`;
  return n === 5 ? 'SO' : `OT${n - 3}`;
}

// ── usePWHLGameEvents hook ────────────────────────────────────
/**
 * Watches liveData.events for new events and fires popups.
 *
 * @param {object}  liveData     - from /pwhl/live/:gameId (raw, before normalization)
 * @param {boolean} isLive
 * @param {number}  teamId       - our selected team ID (integer)
 * @param {string}  teamAbbr     - our team abbrev for win popup
 * @param {boolean} isPlayoff    - is the current game a playoffs game (period 5+ labeling)
 */
export function usePWHLGameEvents(liveData, isLive, teamId, teamAbbr, isPlayoff = false) {
  const [goalPopup,     setGoalPopup]     = useState(null);
  const [hatTrickPopup, setHatTrickPopup] = useState(null);
  const [penaltyPopup,  setPenaltyPopup]  = useState(null);
  const [winPopup,      setWinPopup]      = useState(null);
  const [puckDropPopup, setPuckDropPopup] = useState(null);

  const gameId       = liveData?.gameId ? String(liveData.gameId) : null;
  const lastEventIdx = useRef(-1);
  const wasLiveRef   = useRef(false);
  const gameEndFired = useRef(false);
  const puckDropFired = useRef(false);

  const shownGoals = useRef(new Set(
    gameId ? JSON.parse(sessionStorage.getItem(`pwhl_goals_${gameId}`) || '[]') : []
  ));
  const shownPenalties = useRef(new Set(
    gameId ? JSON.parse(sessionStorage.getItem(`pwhl_penalties_${gameId}`) || '[]') : []
  ));

  // Track liveness for catching the final OT event
  useEffect(() => {
    if (isLive) wasLiveRef.current = true;
  }, [isLive]);

  // Reset on game change
  useEffect(() => {
    wasLiveRef.current  = false;
    gameEndFired.current = false;
    puckDropFired.current = false;
    lastEventIdx.current = gameId
      ? parseInt(sessionStorage.getItem(`pwhl_lastEvent_${gameId}`) || '-1', 10)
      : -1;
    shownGoals.current = new Set(
      gameId ? JSON.parse(sessionStorage.getItem(`pwhl_goals_${gameId}`) || '[]') : []
    );
    shownPenalties.current = new Set(
      gameId ? JSON.parse(sessionStorage.getItem(`pwhl_penalties_${gameId}`) || '[]') : []
    );
  }, [gameId]);

  const events       = liveData?.events || [];
  const eventsLength = events.length;

  // Process new events on each poll
  useEffect(() => {
    if (!eventsLength) return;
    if (!isLive && !wasLiveRef.current) return;

    // On first load: skip existing events, watch only new ones
    if (lastEventIdx.current === -1) {
      lastEventIdx.current = eventsLength - 1;
      return;
    }

    const newEvents = events.slice(lastEventIdx.current + 1);
    lastEventIdx.current = eventsLength - 1;
    if (gameId) sessionStorage.setItem(`pwhl_lastEvent_${gameId}`, String(lastEventIdx.current));
    if (!newEvents.length) return;

    for (const ev of newEvents) {
      const per  = periodLabel(ev.period, isPlayoff);
      const time = ev.time || null;

      // ── Our team scores ─────────────────────────────────────
      if (ev.eventType === 'goal' && ev.teamId === teamId) {
        const scorer  = ev.scoredBy ? `${ev.scoredBy.firstName} ${ev.scoredBy.lastName}`.trim() : null;
        const assists = (ev.assists || [])
          .map(a => `${a.firstName} ${a.lastName}`.trim())
          .filter(Boolean);
        const goalSig = `${ev.period}-${ev.timeSeconds}-${scorer}`;
        if (!shownGoals.current.has(goalSig)) {
          shownGoals.current.add(goalSig);
          if (gameId) sessionStorage.setItem(`pwhl_goals_${gameId}`, JSON.stringify([...shownGoals.current]));

          // Track goals per scorer for hat trick detection
          const scorerId = ev.scoredBy?.id ? String(ev.scoredBy.id) : '';
          if (scorerId) {
            if (!shownGoals._scorerGoals) shownGoals._scorerGoals = {};
            shownGoals._scorerGoals[scorerId] = (shownGoals._scorerGoals[scorerId] || 0) + 1;
          }

          const goalData = {
            scorer, assists,
            shotType:       ev.shotType    || null,
            isPowerPlay:    ev.isPowerPlay  || false,
            isShortHanded:  ev.isShortHanded || false,
            isEmptyNet:     ev.isEmptyNet   || false,
            isPenaltyShot:  ev.isPenaltyShot || false,
            periodLabel:    per,
            time,
            teamColor:      null, // populated by PWHLShotMapView if needed
          };

          if (scorerId && shownGoals._scorerGoals?.[scorerId] === 3) {
            setHatTrickPopup(goalData);
          } else {
            setGoalPopup(goalData);
          }
          continue;
        }
      }

      // ── Opponent penalty → our power play ──────────────────
      if (ev.eventType === 'penalty' && ev.isPowerPlay && ev.teamId !== teamId && ev.teamId != null) {
        const penId = `${ev.period}-${ev.timeSeconds}-${ev.takenBy?.id || 'bench'}`;
        if (!shownPenalties.current.has(penId)) {
          shownPenalties.current.add(penId);
          if (gameId) sessionStorage.setItem(`pwhl_penalties_${gameId}`, JSON.stringify([...shownPenalties.current]));
          const player = ev.takenBy
            ? `${ev.takenBy.firstName} ${ev.takenBy.lastName}`.trim()
            : null;
          setPenaltyPopup({
            id:          penId,
            player,
            ...parsePenaltyDesc(ev.description),
            duration:    ev.minutes || 2,
            periodLabel: per,
            time,
          });
          continue;
        }
      }
    }
  }, [eventsLength, isLive, teamId, gameId]);

  // Puck drop — fires once when game goes live in P1
  useEffect(() => {
    if (!isLive || puckDropFired.current || !eventsLength) return;
    const firstEv = events[0];
    if ((firstEv?.period || 1) !== 1) return; // only at game start
    const sessionKey = `pwhl_puckdrop_${gameId}`;
    if (gameId && sessionStorage.getItem(sessionKey)) return;
    puckDropFired.current = true;
    if (gameId) sessionStorage.setItem(sessionKey, '1');
    setPuckDropPopup({ gameId });
  }, [isLive, eventsLength, gameId]);

  // Win detection
  useEffect(() => {
    if (!liveData || gameEndFired.current || !wasLiveRef.current) return;
    if (liveData.gameStatus !== 'final') return;
    const sessionKey = `pwhl_win_${gameId}`;
    if (gameId && sessionStorage.getItem(sessionKey)) return;

    const isHome   = liveData.homeTeamId === teamId;
    const myScore  = isHome ? liveData.homeScore : liveData.awayScore;
    const oppScore = isHome ? liveData.awayScore : liveData.homeScore;

    if (myScore > oppScore) {
      gameEndFired.current = true;
      if (gameId) sessionStorage.setItem(sessionKey, '1');
      const TEAM_CODES = { 1:'BOS', 2:'MIN', 3:'MTL', 4:'NY', 5:'OTT', 6:'TOR', 8:'SEA', 9:'VAN' };
      const oppId   = isHome ? liveData.awayTeamId : liveData.homeTeamId;
      const oppAbbr = TEAM_CODES[oppId] || String(oppId);
      setWinPopup({
        teamAbbr: teamAbbr || 'WIN',
        score: `${teamAbbr} ${myScore} – ${oppAbbr} ${oppScore}`,
      });
    }
  }, [liveData?.gameStatus, eventsLength, teamId, teamAbbr, gameId, isPlayoff]);

  return {
    goalPopup,     clearGoalPopup:     () => setGoalPopup(null),
    hatTrickPopup, clearHatTrickPopup: () => setHatTrickPopup(null),
    penaltyPopup,  clearPenaltyPopup:  () => setPenaltyPopup(null),
    winPopup,      clearWinPopup:      () => setWinPopup(null),
    puckDropPopup, clearPuckDropPopup: () => setPuckDropPopup(null),
  };
}

// ── PWHLLiveInsights ──────────────────────────────────────────
/**
 * Derives game insights from normalized pbpEvents + live shot events.
 * Mirrors NHL LiveInsights but uses the PWHL normalized event shapes.
 */
export function PWHLLiveInsights({ pbpEvents, ourShotEvents, oppShotEvents,
  teamId, abbr, oppAbbr, myScore, oppScore, isLive, liveData, isPlayoff = false }) {

  const insights = useMemo(() => {
    if (!pbpEvents?.length && !ourShotEvents?.length) return [];
    const results = [];
    const events = pbpEvents || [];

    // Current period from last event
    const lastEv = events[events.length - 1];
    const currentPeriod = lastEv?.period_id || 1;

    // ── Shot advantage by period ──────────────────────────────
    const periodShots = {};
    [...ourShotEvents, ...oppShotEvents].forEach(s => {
      const per = s.period || 1;
      if (!periodShots[per]) periodShots[per] = { car: 0, opp: 0 };
      if (s.isCanes) periodShots[per].car++; else periodShots[per].opp++;
    });

    const completedPeriods = Object.keys(periodShots).map(Number)
      .filter(per => !isLive || per < currentPeriod);
    const periodsToCheck = isLive && currentPeriod
      ? [currentPeriod]
      : Object.keys(periodShots).map(Number);

    periodsToCheck.forEach(per => {
      const ps = periodShots[per];
      if (!ps) return;
      const diff = ps.car - ps.opp;
      const pLabel = periodLabel(per, isPlayoff);
      const threshold = isLive ? 4 : 6;
      if (Math.abs(diff) >= threshold) {
        results.push({
          icon: diff > 0 ? '🎯' : '😬',
          text: diff > 0
            ? `${abbr} dominated ${pLabel} shots ${ps.car}–${ps.opp}`
            : `${oppAbbr} dominated ${pLabel} shots ${ps.opp}–${ps.car}`,
          type: diff > 0 ? 'good' : 'warn',
        });
      }
    });

    // ── Momentum — last 10 shot attempts (live only) ──────────
    if (isLive) {
      const recentAttempts = [...ourShotEvents, ...oppShotEvents]
        .sort((a, b) => {
          const aS = (a.period || 1) * 10000 + (a.timeInPeriod
            ? parseInt(a.timeInPeriod.split(':')[0]) * 60 + parseInt(a.timeInPeriod.split(':')[1])
            : 0);
          const bS = (b.period || 1) * 10000 + (b.timeInPeriod
            ? parseInt(b.timeInPeriod.split(':')[0]) * 60 + parseInt(b.timeInPeriod.split(':')[1])
            : 0);
          return aS - bS;
        })
        .slice(-10);
      if (recentAttempts.length >= 6) {
        const carRecent = recentAttempts.filter(s => s.isCanes).length;
        const oppRecent = recentAttempts.length - carRecent;
        if (carRecent >= 7) results.push({ icon: '🌀', text: `${abbr} on a roll — ${carRecent} of last ${recentAttempts.length} shot attempts`, type: 'good' });
        else if (oppRecent >= 7) results.push({ icon: '🧱', text: `${oppAbbr} pressing — ${oppRecent} of last ${recentAttempts.length} shot attempts`, type: 'warn' });
      }
    }

    // ── Top scorer callout ────────────────────────────────────
    const goalsByScorer = {};
    ourShotEvents.filter(s => s.type === 'goal' && s.shooterName).forEach(s => {
      goalsByScorer[s.shooterName] = (goalsByScorer[s.shooterName] || 0) + 1;
    });
    const topScorer = Object.entries(goalsByScorer).sort((a, b) => b[1] - a[1])[0];
    if (topScorer && topScorer[1] >= 2) {
      results.push({ icon: '⭐', text: `${topScorer[0]} leads ${abbr} with ${topScorer[1]} goals`, type: 'good' });
    }

    // ── Faceoff dominance ─────────────────────────────────────
    const faceoffs = events.filter(e => e.event_type === 'faceoff');
    if (faceoffs.length >= 10) {
      const carFOW  = faceoffs.filter(e => e.team_id === teamId).length;
      const totalFO = faceoffs.length;
      const foPct   = Math.round(carFOW / totalFO * 100);
      if (foPct >= 58) {
        results.push({ icon: '🏒', text: `${abbr} controlling faceoffs — winning ${foPct}% (${carFOW}/${totalFO})`, type: 'good' });
      } else if (foPct <= 42) {
        results.push({ icon: '😬', text: `${oppAbbr} winning faceoffs — ${abbr} at ${foPct}% (${carFOW}/${totalFO})`, type: 'warn' });
      }
    }

    // ── PK performance ───────────────────────────────────────
    const penalties   = events.filter(e => e.event_type === 'penalty');
    const carPens     = penalties.filter(e => e.team_id === teamId && e.is_power_play);
    const ppGoalsAg   = events.filter(e =>
      e.event_type === 'goal' && e.team_id !== teamId && e.team_id != null &&
      // Check if there was a recent car penalty before this goal
      penalties.some(p => p.team_id === teamId && p.period_id === e.period_id &&
        e.time_seconds - p.time_seconds > 0 && e.time_seconds - p.time_seconds <= 130)
    ).length;

    if (carPens.length >= 2 && ppGoalsAg === 0) {
      results.push({ icon: '🛡️', text: `${abbr} PK went ${carPens.length}-for-${carPens.length} — perfect penalty kill`, type: 'good' });
    } else if (ppGoalsAg >= 2) {
      results.push({ icon: '😤', text: `PK struggled — allowed ${ppGoalsAg} power play goals`, type: 'warn' });
    }

    // ── Opp shots limited by period ───────────────────────────
    completedPeriods.forEach(per => {
      const ps = periodShots[per];
      if (!ps) return;
      const pLabel = periodLabel(per, isPlayoff);
      if (ps.opp <= 5 && ps.car >= 4) {
        results.push({ icon: '🧱', text: `${abbr} held ${oppAbbr} to ${ps.opp} shots in ${pLabel}`, type: 'good' });
      }
    });

    // ── Scoring drought (live only) ───────────────────────────
    if (isLive && currentPeriod >= 2) {
      const carGoals = ourShotEvents.filter(s => s.type === 'goal');
      if (carGoals.length === 0) {
        results.push({ icon: '🥶', text: `${abbr} hasn't scored yet — looking for the first one`, type: 'warn' });
      } else {
        const lastGoal = carGoals[carGoals.length - 1];
        const droughtPeriods = currentPeriod - (lastGoal.period || 1);
        if (droughtPeriods >= 2) {
          results.push({ icon: '🥶', text: `${abbr} hasn't scored in ${droughtPeriods} periods`, type: 'warn' });
        }
      }
    }

    // ── First goal advantage ──────────────────────────────────
    const firstGoal = events.find(e => e.event_type === 'goal');
    if (firstGoal) {
      const carScoredFirst = firstGoal.team_id === teamId;
      results.push({
        icon: carScoredFirst ? '🚀' : '😤',
        text: carScoredFirst
          ? `${abbr} struck first — teams that score first win ~65% of games`
          : `${oppAbbr} struck first`,
        type: carScoredFirst ? 'good' : 'warn',
      });
    }

    // ── Back-to-back goals ────────────────────────────────────
    const allOurGoals = ourShotEvents.filter(s => s.type === 'goal');
    for (let i = 1; i < allOurGoals.length; i++) {
      const prev = allOurGoals[i - 1];
      const curr = allOurGoals[i];
      const prevSecs = (prev.period || 1) * 1200 + (prev.timeInPeriod
        ? parseInt(prev.timeInPeriod.split(':')[0]) * 60 + parseInt(prev.timeInPeriod.split(':')[1]) : 0);
      const currSecs = (curr.period || 1) * 1200 + (curr.timeInPeriod
        ? parseInt(curr.timeInPeriod.split(':')[0]) * 60 + parseInt(curr.timeInPeriod.split(':')[1]) : 0);
      const gap = currSecs - prevSecs;
      if (gap <= 180) {
        results.push({ icon: '🔥', text: `${abbr} scored twice in ${gap}s — two quick goals`, type: 'good' });
        break;
      }
    }

    // ── Consecutive saves ─────────────────────────────────────
    let consecutiveSaves = 0;
    for (let i = oppShotEvents.length - 1; i >= 0; i--) {
      if (oppShotEvents[i].type === 'goal') break;
      if (oppShotEvents[i].type === 'shot-on-goal') consecutiveSaves++;
    }
    if (consecutiveSaves >= 10) {
      results.push({ icon: '🧤', text: `${abbr} goalie has stopped ${consecutiveSaves} straight shots`, type: 'good' });
    }

    // ── Score situation (live only) ──────────────────────────
    if (isLive && myScore != null && oppScore != null) {
      const diff = myScore - oppScore;
      if (diff === 0 && myScore > 0) {
        results.push({ icon: '⚡', text: `Tied ${myScore}–${oppScore} — anyone's game`, type: 'neutral' });
      } else if (diff >= 3) {
        results.push({ icon: '🏒', text: `${abbr} up ${diff} — dominant performance`, type: 'good' });
      } else if (diff <= -2 && currentPeriod >= 3) {
        results.push({ icon: '🚨', text: `${abbr} down ${Math.abs(diff)} in ${periodLabel(currentPeriod, isPlayoff)} — need a push`, type: 'warn' });
      }
    }

    // ── Final result callout (completed games) ────────────────
    if (!isLive && myScore != null && oppScore != null) {
      const won     = myScore > oppScore;
      const carTot  = Object.values(periodShots).reduce((s, p) => s + p.car, 0);
      const oppTot  = Object.values(periodShots).reduce((s, p) => s + p.opp, 0);
      if (carTot !== oppTot) {
        results.push({
          icon: won ? '✅' : '📉',
          text: won
            ? `${abbr} won ${myScore}–${oppScore} and outshot ${oppAbbr} ${carTot}–${oppTot}`
            : `${abbr} lost ${myScore}–${oppScore} — outshot ${carTot > oppTot ? `${abbr} ${carTot}–${oppTot}` : `${oppAbbr} ${oppTot}–${carTot}`}`,
          type: won ? 'good' : 'warn',
        });
      }
    }

    return results.slice(0, 6);
  }, [pbpEvents, ourShotEvents, oppShotEvents, teamId, abbr, oppAbbr,
      myScore, oppScore, isLive, liveData, isPlayoff]);

  if (!insights.length) return null;
  return <PWHLInsightsCard insights={insights} isLive={isLive} />;
}

function PWHLInsightsCard({ insights, isLive }) {
  const [expanded, setExpanded] = useState(true);
  const timerRef = useRef(null);

  const insightKey = insights.map(i => i.text).join('|');
  useEffect(() => {
    if (!isLive) return;
    setExpanded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setExpanded(false), 8000);
    return () => clearTimeout(timerRef.current);
  }, [insightKey, isLive]);

  const handleTap = () => {
    if (!isLive) return;
    setExpanded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setExpanded(false), 8000);
  };

  return (
    <div
      className={`card live-insights${isLive && !expanded ? ' insights-collapsed' : ''}`}
      onClick={handleTap}
    >
      <div className={`insights-header${expanded ? '' : ' insights-header-collapsed'}`}>
        <span className="sec-label" style={{ marginBottom: 0 }}>
          {isLive ? '🔴 Live Insights' : '📊 Game Insights'}
        </span>
        {isLive && !expanded && (
          <span className="insights-peek">
            {insights[0]?.icon} {insights[0]?.text}
          </span>
        )}
        {isLive && (
          <span className="insights-chevron" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ›
          </span>
        )}
      </div>
      {expanded && (
        <div className="insights-list">
          {insights.map((ins, i) => (
            <div key={i} className={`insight-row insight-${ins.type}`}>
              <span className="insight-icon">{ins.icon}</span>
              <span className="insight-text">{ins.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
