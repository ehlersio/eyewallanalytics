import { useState, useEffect, useRef } from 'react';
import { TEAM_CONFIG } from '../utils/nhlApi';

// ── Tailwind class constants (Phase 4, sub-PR 2 -- GameEvents.css deleted) ──
// Duplicated in PWHLGameEvents.jsx per established per-file convention
// (see DevReplayView.jsx / PWHLDevReplayView.jsx, Phase 4 sub-PR 1).

const OVERLAY_BASE_CLASSES = 'fixed inset-0 z-[500] flex items-center justify-center animate-[fade-in_0.2s_ease]';
// .game-event-overlay (bg 0.75) and .win-overlay/.hat-trick-overlay (bg 0.85)
// both set `background` unconditionally -- concatenating two Tailwind bg-[...]
// utilities for the same property risks the same-layer ordering bug from
// DevReplayView.css (lesson #9), so this is a single helper with a complete,
// mutually exclusive class string per state instead.
function overlayClasses(darker) {
  return `${OVERLAY_BASE_CLASSES} ${darker ? 'bg-[rgba(0,0,0,0.85)]' : 'bg-[rgba(0,0,0,0.75)]'}`;
}

const PUCK_DROP_POPUP_CLASSES = 'puck-drop-popup bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius-lg)] pt-7 px-6 pb-5 text-center max-w-[300px] animate-[pop-in_0.18s_cubic-bezier(0.34,1.56,0.64,1)]';
const PUCK_DROP_SIREN_CLASSES = 'text-[48px] mb-3.5 animate-[pulse-dot_1s_ease-in-out_infinite]';
const PUCK_DROP_TEXT_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold text-[color:var(--text)] leading-[1.4] tracking-[0.02em] mb-4';
const PUCK_DROP_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[32px] font-bold text-[color:var(--red-bright)] tracking-[0.08em] mb-3';

const GOAL_POPUP_CLASSES = 'goal-popup bg-[var(--bg1)] border-[2px] border-[var(--red-bright)] rounded-[20px] py-8 px-10 text-center max-w-[320px] w-[90%] animate-[goalBurst_0.4s_cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_0_60px_rgba(255,68,34,0.4)]';
const GOAL_LIGHT_CLASSES = 'text-[64px] animate-[spin_0.8s_linear_infinite] inline-block mb-2';
const GOAL_WORD_CLASSES = 'font-[family-name:var(--font-display)] text-[48px] font-black text-[color:var(--red-bright)] tracking-[0.05em] [text-shadow:0_0_20px_rgba(255,68,34,0.6)] mb-3';
const GOAL_SCORER_CLASSES = 'text-[20px] font-bold text-[color:var(--text)] mb-1';
const GOAL_ASSISTS_CLASSES = 'text-[13px] text-[color:var(--text-muted)] mb-1';
const GOAL_SHOT_TYPE_CLASSES = 'text-[11px] text-[color:var(--text-dim)] uppercase tracking-[0.08em]';
const GOAL_PERIOD_CLASSES = 'text-[11px] text-[color:var(--text-dim)] mt-1';

const PENALTY_POPUP_CLASSES = 'penalty-popup bg-[var(--bg1)] border-[2px] border-[var(--amber)] rounded-[20px] py-8 px-10 text-center max-w-[300px] w-[90%] animate-[goalBurst_0.3s_ease] shadow-[0_0_40px_rgba(240,160,48,0.3)]';
const PENALTY_WORDS_CLASSES = 'flex flex-col gap-1 mb-4';
const PENALTY_WORD_SPAN_CLASSES = 'font-[family-name:var(--font-display)] text-[36px] font-black text-[color:var(--amber)] tracking-[0.06em] leading-none';
const PENALTY_DIVIDER_CLASSES = 'h-px bg-[var(--border)] my-3';
const PENALTY_PLAYER_CLASSES = 'text-[18px] font-bold text-[color:var(--text)] mb-1';
const PENALTY_DESC_CLASSES = 'text-[13px] text-[color:var(--text-muted)] capitalize mb-1';
const PENALTY_DURATION_CLASSES = 'text-[11px] text-[color:var(--text-dim)]';

const WIN_POPUP_CLASSES = 'win-popup bg-[var(--bg1)] border-[2px] border-[var(--red-bright)] rounded-[20px] pt-10 px-12 pb-10 text-center max-w-[340px] w-[90%] z-[501] animate-[goalBurst_0.5s_cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_0_80px_rgba(255,68,34,0.5)]';
const WIN_LOGO_CLASSES = 'text-[64px] mb-3 animate-[spin_1.5s_linear_infinite] inline-block';
const WIN_TEXT_CLASSES = 'font-[family-name:var(--font-display)] text-[44px] font-black text-[color:var(--red-bright)] tracking-[0.04em] [text-shadow:0_0_30px_rgba(255,68,34,0.7)] mb-3';
const WIN_SCORE_CLASSES = 'text-[24px] font-bold text-[color:var(--text)] mb-2';

const CONFETTI_PIECE_CLASSES = 'absolute top-[-20px] rounded-[2px] animate-[confettiFall_linear_forwards] z-[500]';

const GAME_EVENT_DISMISS_CLASSES = 'game-event-dismiss mt-4 bg-transparent border-[0.5px] border-[var(--border)] text-[color:var(--text-dim)] text-[11px] py-1 px-3 rounded-[6px] cursor-pointer hover:bg-[var(--bg3)] hover:text-[color:var(--text)]';

const HAT_PIECE_CLASSES = 'hat-piece absolute top-[-40px] animate-[hatFall_linear_forwards] z-[500] select-none';
const HAT_TRICK_POPUP_CLASSES = 'hat-trick-popup bg-[var(--bg1)] border-[2px] border-[#c8a951] rounded-[20px] py-8 px-10 text-center max-w-[320px] w-[90%] animate-[goalBurst_0.4s_cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_0_60px_rgba(200,169,81,0.5)] z-[501] relative';
const HAT_TRICK_WORD_CLASSES = 'font-[family-name:var(--font-display)] text-[40px] font-black text-[#c8a951] tracking-[0.05em] [text-shadow:0_0_20px_rgba(200,169,81,0.7)] mb-3';

// ── Puck Drop Popup ───────────────────────────────────────────
export function PuckDropPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;
  return (
    <div className={overlayClasses(false)} onClick={onClose}>
      <div className={PUCK_DROP_POPUP_CLASSES}>
        <div className={PUCK_DROP_SIREN_CLASSES}>🚨</div>
        <div className={PUCK_DROP_TITLE_CLASSES}>PUCK DROP</div>
        <div className={PUCK_DROP_TEXT_CLASSES}>
          Pucks in deep. Pucks on net.<br />
          Win the battles.<br />
          Here we go, boys!
        </div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>tap to dismiss</div>
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
    <div className={overlayClasses(false)} onClick={onClose}>
      <div className={GOAL_POPUP_CLASSES}>
        <div className={GOAL_LIGHT_CLASSES}>🚨</div>
        <div className={GOAL_WORD_CLASSES}>GOAL!</div>
        {data.scorer && <div className={GOAL_SCORER_CLASSES}>{data.scorer}</div>}
        {data.assists?.length > 0 && (
          <div className={GOAL_ASSISTS_CLASSES}>Assists: {data.assists.join(', ')}</div>
        )}
        {data.shotType && <div className={GOAL_SHOT_TYPE_CLASSES}>{data.shotType}</div>}
        <div className={GOAL_PERIOD_CLASSES}>{data.time ? `${data.period} · ${data.time}` : data.period}</div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>tap to dismiss</div>
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
    <div className={overlayClasses(false)} onClick={onClose}>
      <div className={PENALTY_POPUP_CLASSES}>
        <div className={PENALTY_WORDS_CLASSES}>
          <span className={PENALTY_WORD_SPAN_CLASSES}>CHEATERS</span>
          <span className={PENALTY_WORD_SPAN_CLASSES}>NEVER</span>
          <span className={PENALTY_WORD_SPAN_CLASSES}>WIN</span>
        </div>
        <div className={PENALTY_DIVIDER_CLASSES} />
        {data.player && <div className={PENALTY_PLAYER_CLASSES}>{data.player}</div>}
        <div className={PENALTY_DESC_CLASSES}>{data.description}</div>
        <div className={PENALTY_DURATION_CLASSES}>{data.duration} min · {data.time ? `${data.period} ${data.time}` : data.period}</div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>tap to dismiss</div>
      </div>
    </div>
  );
}


// ── Hat Rain ──────────────────────────────────────────────────
function HatRain({ teamColor }) {
  const hats = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left:     `${Math.random() * 100}%`,
    size:     `${20 + Math.random() * 24}px`,
    delay:    `${Math.random() * 1.5}s`,
    duration: `${1.8 + Math.random() * 1.5}s`,
    rotate:   `${Math.random() * 360}deg`,
    color:    i % 3 === 0 ? (teamColor || 'var(--red-bright)') : i % 3 === 1 ? '#ffffff' : '#c8a951',
  }));
  return (
    <>
      {hats.map(h => (
        <div key={h.id} className={HAT_PIECE_CLASSES} style={{
          left:            h.left,
          fontSize:        h.size,
          animationDelay:  h.delay,
          animationDuration: h.duration,
          '--hat-rotate':  h.rotate,
          filter: `drop-shadow(0 0 4px ${h.color})`,
        }}>🧢</div>
      ))}
    </>
  );
}

// ── Hat Trick Popup ───────────────────────────────────────────
export function HatTrickPopup({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [data, onClose]);

  if (!data) return null;
  return (
    <div className={overlayClasses(true)} onClick={onClose}>
      <HatRain teamColor={data.teamColor} />
      <div className={HAT_TRICK_POPUP_CLASSES}>
        <div className={GOAL_LIGHT_CLASSES}>🚨</div>
        <div className={HAT_TRICK_WORD_CLASSES}>HAT TRICK!</div>
        {data.scorer && <div className={GOAL_SCORER_CLASSES}>{data.scorer}</div>}
        {data.assists?.length > 0 && (
          <div className={GOAL_ASSISTS_CLASSES}>Assists: {data.assists.join(', ')}</div>
        )}
        {data.shotType && <div className={GOAL_SHOT_TYPE_CLASSES}>{data.shotType}</div>}
        <div className={GOAL_PERIOD_CLASSES}>{data.time ? `${data.period} · ${data.time}` : data.period}</div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>tap to dismiss</div>
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
        <div key={p.id} className={CONFETTI_PIECE_CLASSES} style={{
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
    <div className={overlayClasses(true)} onClick={onClose}>
      <Confetti />
      <div className={WIN_POPUP_CLASSES}>
        <div className={WIN_LOGO_CLASSES}>🏆</div>
        <div className={WIN_TEXT_CLASSES}>{data.teamAbbr || 'CANES'} WIN!</div>
        <div className={WIN_SCORE_CLASSES}>{data.score}</div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>tap to dismiss</div>
      </div>
    </div>
  );
}

// ── Hook ──────────────────────────────────────────────────────
export function useGameEvents(pbp, isLive, playerMap, gameHome, teamId, teamAbbr, teamColor) {
  // teamId: integer team ID (replaces hardcoded TEAM_CONFIG.teamId)
  // teamAbbr: e.g. 'CAR' for win popup
  // teamColor: displayColor for hat trick popup
  // Falls back to TEAM_CONFIG for backwards compat if not passed
  const _teamId    = teamId    ?? TEAM_CONFIG.teamId;
  const _teamAbbr  = teamAbbr  ?? TEAM_CONFIG.abbr;
  const _teamColor = teamColor ?? 'var(--red-bright)';
  const [goalPopup,     setGoalPopup]     = useState(null);
  const [hatTrickPopup, setHatTrickPopup] = useState(null);
  const [penaltyPopup,  setPenaltyPopup]  = useState(null);
  const [winPopup,      setWinPopup]      = useState(null);
  const [puckDropPopup, setPuckDropPopup] = useState(null);

  const gameId = pbp?.id ? String(pbp.id) : null;
  const puckDropFired = useRef(false);

  // Persist lastPlayIdx to sessionStorage so manual refreshes don't retrigger old events
  const lastPlayIdx = useRef(-1);
  const gameEndFired = useRef(false);
  const shownGoals   = useRef(new Set(
    gameId ? JSON.parse(sessionStorage.getItem(`goals_${gameId}`) || '[]') : []
  ));
  const shownPenalties = useRef(new Set(
    gameId ? JSON.parse(sessionStorage.getItem(`penalties_${gameId}`) || '[]') : []
  ));
  const scorerGoals = useRef({}); // { scorerId: goalCount } for hat trick tracking
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

  // Reset on game change — new game ID means fresh state
  useEffect(() => {
    wasLiveRef.current = false;
    lastPlayIdx.current = gameId
      ? parseInt(sessionStorage.getItem(`lastPlay_${gameId}`) || '-1', 10)
      : -1;
  }, [gameId]);

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
      if (play.typeDescKey === 'goal' && d.eventOwnerTeamId === _teamId) {
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

          // Track goals per scorer for hat trick detection
          const scorerId = String(d.scoringPlayerId || '');
          if (scorerId) {
            scorerGoals.current[scorerId] = (scorerGoals.current[scorerId] || 0) + 1;
          }

          if (scorerId && scorerGoals.current[scorerId] === 3) {
            // Hat trick — fire hat trick popup instead of regular goal
            setHatTrickPopup({ scorer, assists, shotType: d.shotType || null, period: per, time, teamColor: _teamColor });
          } else {
            setGoalPopup({ scorer, assists, shotType: d.shotType || null, period: per, time });
          }
          continue;
        }
      }

      // Opponent penalty → CAR power play
      if (play.typeDescKey === 'penalty' && d.eventOwnerTeamId !== _teamId) {
        const penId = String(play.eventId || play.sortOrder);
        if (!shownPenalties.current.has(penId)) {
          shownPenalties.current.add(penId);
          if (gameId) sessionStorage.setItem(`penalties_${gameId}`, JSON.stringify([...shownPenalties.current]));
          setPenaltyPopup({
            id:          penId,
            player:      pName(d.committedByPlayerId),
            description: d.descKey ? d.descKey.replace(/-/g, ' ') : 'Penalty',
            duration:    d.duration || 2,
            period:      per,
            time,
          });
          continue;
        }
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
      setWinPopup({ score: `${_teamAbbr} ${carScore} – ${oppAbbrev} ${oppScore}`, teamAbbr: _teamAbbr });
    }
  }, [pbp?.gameState, pbp?.plays?.length]);

  return {
    goalPopup,     clearGoalPopup:     () => setGoalPopup(null),
    hatTrickPopup, clearHatTrickPopup: () => setHatTrickPopup(null),
    penaltyPopup,  clearPenaltyPopup:  () => setPenaltyPopup(null),
    winPopup,      clearWinPopup:      () => setWinPopup(null),
    puckDropPopup, clearPuckDropPopup: () => setPuckDropPopup(null),
  };
}
