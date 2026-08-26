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
import { useTranslation } from 'react-i18next';
import { getPWHLTeamById } from '../utils/pwhlConfig';
import { HatTrickPopup as _HatTrickPopup } from './GameEvents'; // reuse hat trick popup

// ── Tailwind class constants (Phase 4, sub-PR 2 -- GameEvents.css deleted) ──
// Duplicated from GameEvents.jsx per established per-file convention
// (see DevReplayView.jsx / PWHLDevReplayView.jsx, Phase 4 sub-PR 1).
// PWHLLiveInsights/PWHLInsightsCard's own classNames (`card`, `live-insights`,
// `insights-*`, `insight-*`) belonged to ShotMapView.css -- were left
// untouched here in Phase 4 (out of scope for GameEvents.css), migrated in
// Phase 5, ShotMapView.css sub-PR 4 (see the constants block right before
// PWHLLiveInsights below). `sec-label` stays literal, untouched -- a global
// index.css class, not ShotMapView.css's.

const OVERLAY_BASE_CLASSES = 'fixed inset-0 z-[500] flex items-center justify-center animate-[fade-in_0.2s_ease]';
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

// ── Puck Drop ─────────────────────────────────────────────────

export function PWHLPuckDropPopup({ data, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [data, onClose]);

  if (!data) return null;
  return (
    <div className={overlayClasses(false)} onClick={onClose}>
      <div className={PUCK_DROP_POPUP_CLASSES}>
        <div className={PUCK_DROP_SIREN_CLASSES}>🏒</div>
        <div className={PUCK_DROP_TITLE_CLASSES}>{t('gameEvents.puckDrop.title')}</div>
        <div className={PUCK_DROP_TEXT_CLASSES}>
          {t('gameEvents.puckDrop.line1')}<br />
          {t('gameEvents.puckDrop.line2')}<br />
          {t('pwhlGameEvents.puckDrop.line3')}
        </div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>{t('gameEvents.dismissHint')}</div>
      </div>
    </div>
  );
}

// ── Goal Popup ────────────────────────────────────────────────

export function PWHLGoalPopup({ data, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [data, onClose]);

  if (!data) return null;

  const modifiers = [
    data.isPowerPlay    && t('pwhlGameEvents.goal.modifierPowerPlay'),
    data.isShortHanded  && t('pwhlGameEvents.goal.modifierShortHanded'),
    data.isEmptyNet     && t('pwhlGameEvents.goal.modifierEmptyNet'),
    data.isPenaltyShot  && t('pwhlGameEvents.goal.modifierPenaltyShot'),
  ].filter(Boolean);

  return (
    <div className={overlayClasses(false)} onClick={onClose}>
      <div className={GOAL_POPUP_CLASSES}>
        <div className={GOAL_LIGHT_CLASSES}>🚨</div>
        <div className={GOAL_WORD_CLASSES}>{t('gameEvents.goal.title')}</div>
        {data.scorer && <div className={GOAL_SCORER_CLASSES}>{data.scorer}</div>}
        {data.assists?.length > 0 && (
          <div className={GOAL_ASSISTS_CLASSES}>{t('gameEvents.goal.assistsLabel', { assists: data.assists.join(', ') })}</div>
        )}
        {modifiers.length > 0 && (
          <div className={GOAL_SHOT_TYPE_CLASSES}>{modifiers.join(' · ')}</div>
        )}
        {data.shotType && <div className={GOAL_SHOT_TYPE_CLASSES}>{data.shotType}</div>}
        <div className={GOAL_PERIOD_CLASSES}>
          {data.time ? t('gameEvents.goal.periodTime', { period: data.periodLabel, time: data.time }) : data.periodLabel}
        </div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>{t('gameEvents.dismissHint')}</div>
      </div>
    </div>
  );
}

// ── Penalty Popup ─────────────────────────────────────────────

export function PWHLPenaltyPopup({ data, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [data?.id, onClose]);

  if (!data) return null;
  return (
    <div className={overlayClasses(false)} onClick={onClose}>
      <div className={PENALTY_POPUP_CLASSES}>
        <div className={PENALTY_WORDS_CLASSES}>
          <span className={PENALTY_WORD_SPAN_CLASSES}>{t('pwhlGameEvents.penalty.word1')}</span>
          <span className={PENALTY_WORD_SPAN_CLASSES}>{t('pwhlGameEvents.penalty.word2')}</span>
        </div>
        <div className={PENALTY_DIVIDER_CLASSES} />
        {data.player && <div className={PENALTY_PLAYER_CLASSES}>{data.player}</div>}
        {data.severity && (
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em',
            color:'var(--amber)', textTransform:'uppercase', marginBottom:4 }}>
            {data.severity}
          </div>
        )}
        <div className={PENALTY_DESC_CLASSES}>{data.desc || data.description}</div>
        <div className={PENALTY_DURATION_CLASSES}>
          {data.duration} min · {data.time ? `${data.periodLabel} ${data.time}` : data.periodLabel}
        </div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>{t('gameEvents.dismissHint')}</div>
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

export function PWHLWinPopup({ data, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [data, onClose]);

  if (!data) return null;
  return (
    <div className={overlayClasses(true)} onClick={onClose}>
      <Confetti />
      <div className={WIN_POPUP_CLASSES}>
        <div className={WIN_LOGO_CLASSES}>🏆</div>
        <div className={WIN_TEXT_CLASSES}>{t('gameEvents.win.title', { teamAbbr: data.teamAbbr })}</div>
        <div className={WIN_SCORE_CLASSES}>{data.score}</div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>{t('gameEvents.dismissHint')}</div>
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
  'maj': 'pwhlGameEvents.penalty.severity.major',
  'mis': 'pwhlGameEvents.penalty.severity.misconduct',
  'gm':  'pwhlGameEvents.penalty.severity.gameMisconduct',
};

// Returns { desc, severity } where severity is null for minor/unknown
function parsePenaltyDesc(raw, t) {
  if (!raw) return { desc: t('gameEvents.penalty.fallbackDescription'), severity: null };
  const match = raw.match(/^([A-Za-z]+)-(.+)$/);
  if (!match) return { desc: raw, severity: null };
  const prefix = match[1].toLowerCase();
  const body   = match[2].trim();
  const severity = PENALTY_PREFIX_MAP[prefix] ? t(PENALTY_PREFIX_MAP[prefix]) : null;
  return { desc: body, severity };
}

// Simple cleaner for use outside the popup (normalizer, drill-downs)
function _cleanPenaltyDesc(raw, t) {
  const { desc, severity } = parsePenaltyDesc(raw, t);
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
  const { t } = useTranslation();
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
            ...parsePenaltyDesc(ev.description, t),
            duration:    ev.minutes || 2,
            periodLabel: per,
            time,
          });
          continue;
        }
      }
    }
  }, [eventsLength, isLive, teamId, gameId, t]);

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
      const oppId   = isHome ? liveData.awayTeamId : liveData.homeTeamId;
      const oppAbbr = getPWHLTeamById(oppId)?.abbr || String(oppId);
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

// ── Live Insights Tailwind constants (Phase 5, ShotMapView.css sub-PR 4)
// -- PWHLInsightsCard below was flagged as an undeclared consumer of
// ShotMapView.css during the Phase 5 investigation (found via full-tree
// grep, not from ShotMapView.jsx/PWHLShotMapView.jsx's own declared
// consumer list) -- explicitly out of scope back in Phase 4 sub-PR 2 (see
// this file's header comment above), in scope now. Mirrors ShotMapView.jsx's
// LiveInsightsCard constants exactly -- same classes, same property-race
// fix (.insights-header/.insights-header-collapsed on margin-bottom).
const liveInsightsClasses = (collapsed) => `card mb-[10px] ${collapsed ? 'cursor-pointer' : ''}`;
const insightsHeaderClasses = (collapsed) => collapsed ? 'flex items-center gap-2' : 'flex items-center gap-2 mb-[10px]';
const INSIGHTS_PEEK_CLASSES = 'text-[11px] text-[color:var(--text-muted)] font-[family-name:var(--font-body)] font-normal tracking-normal normal-case overflow-hidden text-ellipsis whitespace-nowrap flex-1';
const INSIGHTS_CHEVRON_CLASSES = 'text-[16px] text-[color:var(--text-dim)] leading-none shrink-0 [transition:transform_0.2s_ease] ml-auto';
const INSIGHTS_LIST_CLASSES = 'grid grid-cols-1 gap-[6px] mt-2 min-[480px]:grid-cols-2';
const INSIGHT_ROW_VARIANTS = {
  good: 'bg-[rgba(74,222,128,0.10)] border-l-[3px] border-l-[#4ade80]',
  warn: 'bg-[rgba(251,191,36,0.10)] border-l-[3px] border-l-[#fbbf24]',
  neutral: 'bg-[rgba(148,163,184,0.10)] border-l-[3px] border-l-[#94a3b8]',
};
const insightRowClasses = (type) =>
  `insight-row flex items-center gap-[10px] py-2 px-[10px] rounded-[8px] text-[13px] font-medium text-[color:var(--text)] ${INSIGHT_ROW_VARIANTS[type]}`;
const INSIGHT_ICON_CLASSES = 'text-[16px] shrink-0';
const INSIGHT_TEXT_CLASSES = 'leading-[1.35]';

// ── PWHLLiveInsights ──────────────────────────────────────────
/**
 * Derives game insights from normalized pbpEvents + live shot events.
 * Mirrors NHL LiveInsights but uses the PWHL normalized event shapes.
 */
export function PWHLLiveInsights({ pbpEvents, ourShotEvents, oppShotEvents,
  teamId, abbr, oppAbbr, myScore, oppScore, isLive, liveData, isPlayoff = false }) {
  const { t } = useTranslation();

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
            ? t('shotMapView.liveInsights.periodDominanceFor', { abbr, period: pLabel, car: ps.car, opp: ps.opp })
            : t('shotMapView.liveInsights.periodDominanceAgainst', { oppAbbr, period: pLabel, car: ps.car, opp: ps.opp }),
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
        if (carRecent >= 7) results.push({ icon: '🌀', text: t('shotMapView.liveInsights.onARoll', { abbr, n: carRecent, total: recentAttempts.length }), type: 'good' });
        else if (oppRecent >= 7) results.push({ icon: '🧱', text: t('shotMapView.liveInsights.oppPressing', { oppAbbr, n: oppRecent, total: recentAttempts.length }), type: 'warn' });
      }
    }

    // ── Top scorer callout ────────────────────────────────────
    const goalsByScorer = {};
    ourShotEvents.filter(s => s.type === 'goal' && s.shooterName).forEach(s => {
      goalsByScorer[s.shooterName] = (goalsByScorer[s.shooterName] || 0) + 1;
    });
    const topScorer = Object.entries(goalsByScorer).sort((a, b) => b[1] - a[1])[0];
    if (topScorer && topScorer[1] >= 2) {
      results.push({ icon: '⭐', text: t('pwhlGameEvents.liveInsights.topScorer', { name: topScorer[0], abbr, n: topScorer[1] }), type: 'good' });
    }

    // ── Faceoff dominance ─────────────────────────────────────
    const faceoffs = events.filter(e => e.event_type === 'faceoff');
    if (faceoffs.length >= 10) {
      const carFOW  = faceoffs.filter(e => e.team_id === teamId).length;
      const totalFO = faceoffs.length;
      const foPct   = Math.round(carFOW / totalFO * 100);
      if (foPct >= 58) {
        results.push({ icon: '🏒', text: t('shotMapView.liveInsights.faceoffControlFor', { abbr, pct: foPct, won: carFOW, total: totalFO }), type: 'good' });
      } else if (foPct <= 42) {
        results.push({ icon: '😬', text: t('shotMapView.liveInsights.faceoffControlAgainst', { oppAbbr, abbr, pct: foPct, won: carFOW, total: totalFO }), type: 'warn' });
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
      results.push({ icon: '🛡️', text: t('shotMapView.liveInsights.perfectPk', { abbr, n: carPens.length }), type: 'good' });
    } else if (ppGoalsAg >= 2) {
      results.push({ icon: '😤', text: t('shotMapView.liveInsights.pkStruggled', { n: ppGoalsAg }), type: 'warn' });
    }

    // ── Opp shots limited by period ───────────────────────────
    completedPeriods.forEach(per => {
      const ps = periodShots[per];
      if (!ps) return;
      const pLabel = periodLabel(per, isPlayoff);
      if (ps.opp <= 5 && ps.car >= 4) {
        results.push({ icon: '🧱', text: t('pwhlGameEvents.liveInsights.limitedShots', { abbr, oppAbbr, n: ps.opp, period: pLabel }), type: 'good' });
      }
    });

    // ── Scoring drought (live only) ───────────────────────────
    if (isLive && currentPeriod >= 2) {
      const carGoals = ourShotEvents.filter(s => s.type === 'goal');
      if (carGoals.length === 0) {
        results.push({ icon: '🥶', text: t('shotMapView.liveInsights.scorelessSoFar', { abbr }), type: 'warn' });
      } else {
        const lastGoal = carGoals[carGoals.length - 1];
        const droughtPeriods = currentPeriod - (lastGoal.period || 1);
        if (droughtPeriods >= 2) {
          results.push({ icon: '🥶', text: t('pwhlGameEvents.liveInsights.scoringDrought', { abbr, n: droughtPeriods }), type: 'warn' });
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
          ? t('pwhlGameEvents.liveInsights.struckFirst', { abbr })
          : t('shotMapView.liveInsights.oppStruckFirst', { oppAbbr }),
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
        results.push({ icon: '🔥', text: t('pwhlGameEvents.liveInsights.backToBackGoals', { abbr, gap }), type: 'good' });
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
      results.push({ icon: '🧤', text: t('shotMapView.liveInsights.consecutiveSaves', { abbr, n: consecutiveSaves }), type: 'good' });
    }

    // ── Score situation (live only) ──────────────────────────
    if (isLive && myScore != null && oppScore != null) {
      const diff = myScore - oppScore;
      if (diff === 0 && myScore > 0) {
        results.push({ icon: '⚡', text: t('shotMapView.liveInsights.tiedGame', { car: myScore, opp: oppScore }), type: 'neutral' });
      } else if (diff >= 3) {
        results.push({ icon: '🏒', text: t('shotMapView.liveInsights.leadingBig', { abbr, diff }), type: 'good' });
      } else if (diff <= -2 && currentPeriod >= 3) {
        results.push({ icon: '🚨', text: t('shotMapView.liveInsights.trailingLate', { abbr, diff: Math.abs(diff), period: periodLabel(currentPeriod, isPlayoff) }), type: 'warn' });
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
            ? t('shotMapView.liveInsights.finalWinOutshot', { abbr, car: myScore, opp: oppScore, oppAbbr, carTot, oppTot })
            : t('shotMapView.liveInsights.finalLoss', { abbr, car: myScore, opp: oppScore, clause: carTot > oppTot
                ? t('shotMapView.liveInsights.outshootingClause', { oppAbbr, carTot, oppTot })
                : t('shotMapView.liveInsights.outshotClause', { carTot, oppTot }) }),
          type: won ? 'good' : 'warn',
        });
      }
    }

    return results.slice(0, 6);
  }, [pbpEvents, ourShotEvents, oppShotEvents, teamId, abbr, oppAbbr,
      myScore, oppScore, isLive, liveData, isPlayoff, t]);

  if (!insights.length) return null;
  return <PWHLInsightsCard insights={insights} isLive={isLive} />;
}

function PWHLInsightsCard({ insights, isLive }) {
  const { t } = useTranslation();
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
      className={liveInsightsClasses(isLive && !expanded)}
      onClick={handleTap}
    >
      <div className={insightsHeaderClasses(!expanded)}>
        <span className="sec-label" style={{ marginBottom: 0 }}>
          {isLive ? t('shotMapView.liveInsightsCard.liveHeader') : t('shotMapView.liveInsightsCard.gameHeader')}
        </span>
        {isLive && !expanded && (
          <span className={INSIGHTS_PEEK_CLASSES}>
            {insights[0]?.icon} {insights[0]?.text}
          </span>
        )}
        {isLive && (
          <span className={INSIGHTS_CHEVRON_CLASSES} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ›
          </span>
        )}
      </div>
      {expanded && (
        <div className={INSIGHTS_LIST_CLASSES}>
          {insights.map((ins, i) => (
            <div key={i} className={insightRowClasses(ins.type)}>
              <span className={INSIGHT_ICON_CLASSES}>{ins.icon}</span>
              <span className={INSIGHT_TEXT_CLASSES}>{ins.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
