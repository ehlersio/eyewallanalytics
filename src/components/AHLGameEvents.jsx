/**
 * AHLGameEvents.jsx
 *
 * Game event popups (goal, penalty, win, puck drop) for the AHL live
 * game view — port of PWHLGameEvents.jsx's sessionStorage-deduped popup
 * layer (Phase 6, AHL/PWHL parity). Deliberately does NOT port
 * PWHLLiveInsights/PWHLInsightsCard: several of its callouts (faceoff
 * dominance in particular) depend on event types AHL's PBP doesn't have
 * at all (see ahl.js's own header comment -- no faceoff/hit/blocked_shot
 * events exist for this league), and the plan's own Phase 6 scope only
 * calls for the popup layer, not the full insights panel. Revisit as a
 * separate follow-up if wanted later.
 *
 * Event shape (from /ahl/live/:gameId, before any further normalization):
 *   { eventType, teamId, period, time, timeSeconds, scoredBy, assists,
 *     takenBy, shotType, isPowerPlay, goalieIn, goalieOut }
 * Confirmed live 2026-08-29 against a real completed game (1028925) that
 * penalty/goalie_change carry the exact same field names as PWHL's.
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getAHLTeamById } from '../utils/ahlConfig';

// ── Tailwind class constants -- duplicated from PWHLGameEvents.jsx per
// established per-file convention (see that file's own header comment
// for why: DevReplayView.jsx/PWHLDevReplayView.jsx, Phase 4 sub-PR 1).
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

export function AHLPuckDropPopup({ data, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
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
          {t('ahlGameEvents.puckDrop.line3')}
        </div>
        <div className={GAME_EVENT_DISMISS_CLASSES}>{t('gameEvents.dismissHint')}</div>
      </div>
    </div>
  );
}

// ── Goal Popup ────────────────────────────────────────────────

export function AHLGoalPopup({ data, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [data, onClose]);

  if (!data) return null;

  const modifiers = [
    data.isPowerPlay    && t('ahlGameEvents.goal.modifierPowerPlay'),
    data.isShortHanded  && t('ahlGameEvents.goal.modifierShortHanded'),
    data.isEmptyNet     && t('ahlGameEvents.goal.modifierEmptyNet'),
    data.isPenaltyShot  && t('ahlGameEvents.goal.modifierPenaltyShot'),
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

export function AHLPenaltyPopup({ data, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(onClose, 12000);
    return () => clearTimeout(timer);
  }, [data?.id, onClose]);

  if (!data) return null;
  return (
    <div className={overlayClasses(false)} onClick={onClose}>
      <div className={PENALTY_POPUP_CLASSES}>
        <div className={PENALTY_WORDS_CLASSES}>
          <span className={PENALTY_WORD_SPAN_CLASSES}>{t('ahlGameEvents.penalty.word1')}</span>
          <span className={PENALTY_WORD_SPAN_CLASSES}>{t('ahlGameEvents.penalty.word2')}</span>
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

export function AHLWinPopup({ data, onClose }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(onClose, 12000);
    return () => clearTimeout(timer);
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
// HockeyTech prefixes encode penalty severity, same convention
// confirmed for AHL as PWHL (see this file's header comment):
//   Ob-   → throwaway prefix (objective call), strip silently
//   Min-  → 2 min minor (redundant — duration shown separately), strip
//   Maj-  → 5 min major
//   Mis-  → misconduct (10 min)
//   Gm-   → game misconduct

const PENALTY_PREFIX_MAP = {
  'maj': 'ahlGameEvents.penalty.severity.major',
  'mis': 'ahlGameEvents.penalty.severity.misconduct',
  'gm':  'ahlGameEvents.penalty.severity.gameMisconduct',
};

function parsePenaltyDesc(raw, t) {
  if (!raw) return { desc: t('gameEvents.penalty.fallbackDescription'), severity: null };
  const match = raw.match(/^([A-Za-z]+)-(.+)$/);
  if (!match) return { desc: raw, severity: null };
  const prefix = match[1].toLowerCase();
  const body   = match[2].trim();
  const severity = PENALTY_PREFIX_MAP[prefix] ? t(PENALTY_PREFIX_MAP[prefix]) : null;
  return { desc: body, severity };
}

// ── Period label helper ───────────────────────────────────────
// No isPlayoff branching, unlike PWHL's version -- AHL has no
// confirmed regular-season shootout period the way PWHL does (period
// 5 = 'SO'); penaltyshot is a confirmed distinct PBP event type
// instead of a period-5 shootout round (see ahl.js's live normalizer
// comment), so every period past OT is just OT2/OT3/etc regardless of
// season type.
function periodLabel(n) {
  if (!n) return '—';
  if (n <= 3) return `P${n}`;
  if (n === 4) return 'OT';
  return `OT${n - 3}`;
}

// ── useAHLGameEvents hook ────────────────────────────────────
/**
 * Watches liveData.events for new events and fires popups. Direct port
 * of usePWHLGameEvents -- see that hook's own comments for the
 * sessionStorage-key/ref-vs-state race rationale, unchanged here.
 *
 * @param {object}  liveData     - from /ahl/live/:gameId (raw, before normalization)
 * @param {boolean} isLive
 * @param {number}  teamId       - our selected team ID (integer)
 * @param {string}  teamAbbr     - our team abbrev for win popup
 * @param {boolean} isPlayoff    - is the current game a playoffs game
 */
export function useAHLGameEvents(liveData, isLive, teamId, teamAbbr, isPlayoff = false) {
  const { t } = useTranslation();
  const [goalPopup,     setGoalPopup]     = useState(null);
  const [penaltyPopup,  setPenaltyPopup]  = useState(null);
  const [winPopup,      setWinPopup]      = useState(null);
  const [puckDropPopup, setPuckDropPopup] = useState(null);

  const gameId       = liveData?.gameId ? String(liveData.gameId) : null;
  const lastEventIdx = useRef(-1);
  const wasLiveRef   = useRef(false);
  const gameEndFired = useRef(false);
  const puckDropFired = useRef(false);

  const shownGoals = useRef(new Set(
    gameId ? JSON.parse(sessionStorage.getItem(`ahl_goals_${gameId}`) || '[]') : []
  ));
  const shownPenalties = useRef(new Set(
    gameId ? JSON.parse(sessionStorage.getItem(`ahl_penalties_${gameId}`) || '[]') : []
  ));

  useEffect(() => {
    if (isLive) wasLiveRef.current = true;
  }, [isLive]);

  useEffect(() => {
    wasLiveRef.current  = false;
    gameEndFired.current = false;
    puckDropFired.current = false;
    lastEventIdx.current = gameId
      ? parseInt(sessionStorage.getItem(`ahl_lastEvent_${gameId}`) || '-1', 10)
      : -1;
    shownGoals.current = new Set(
      gameId ? JSON.parse(sessionStorage.getItem(`ahl_goals_${gameId}`) || '[]') : []
    );
    shownPenalties.current = new Set(
      gameId ? JSON.parse(sessionStorage.getItem(`ahl_penalties_${gameId}`) || '[]') : []
    );
  }, [gameId]);

  const events       = liveData?.events || [];
  const eventsLength = events.length;

  useEffect(() => {
    if (!eventsLength) return;
    if (!isLive && !wasLiveRef.current) return;

    if (lastEventIdx.current === -1) {
      lastEventIdx.current = eventsLength - 1;
      return;
    }

    const newEvents = events.slice(lastEventIdx.current + 1);
    lastEventIdx.current = eventsLength - 1;
    if (gameId) sessionStorage.setItem(`ahl_lastEvent_${gameId}`, String(lastEventIdx.current));
    if (!newEvents.length) return;

    for (const ev of newEvents) {
      const per  = periodLabel(ev.period);
      const time = ev.time || null;

      // ── Our team scores ─────────────────────────────────────
      // No hat trick detection here, unlike PWHL -- kept for a future
      // pass if wanted; not in the plan's stated Phase 6 scope.
      if (ev.eventType === 'goal' && ev.teamId === teamId) {
        const scorer  = ev.scoredBy ? `${ev.scoredBy.firstName} ${ev.scoredBy.lastName}`.trim() : null;
        const assists = (ev.assists || [])
          .map(a => `${a.firstName} ${a.lastName}`.trim())
          .filter(Boolean);
        const goalSig = `${ev.period}-${ev.timeSeconds}-${scorer}`;
        if (!shownGoals.current.has(goalSig)) {
          shownGoals.current.add(goalSig);
          if (gameId) sessionStorage.setItem(`ahl_goals_${gameId}`, JSON.stringify([...shownGoals.current]));

          setGoalPopup({
            scorer, assists,
            shotType:       ev.shotType    || null,
            isPowerPlay:    ev.isPowerPlay  || false,
            isShortHanded:  ev.isShortHanded || false,
            isEmptyNet:     ev.isEmptyNet   || false,
            isPenaltyShot:  ev.isPenaltyShot || false,
            periodLabel:    per,
            time,
          });
          continue;
        }
      }

      // ── Opponent penalty → our power play ──────────────────
      if (ev.eventType === 'penalty' && ev.isPowerPlay && ev.teamId !== teamId && ev.teamId != null) {
        const penId = `${ev.period}-${ev.timeSeconds}-${ev.takenBy?.id || 'bench'}`;
        if (!shownPenalties.current.has(penId)) {
          shownPenalties.current.add(penId);
          if (gameId) sessionStorage.setItem(`ahl_penalties_${gameId}`, JSON.stringify([...shownPenalties.current]));
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
    if ((firstEv?.period || 1) !== 1) return;
    const sessionKey = `ahl_puckdrop_${gameId}`;
    if (gameId && sessionStorage.getItem(sessionKey)) return;
    puckDropFired.current = true;
    if (gameId) sessionStorage.setItem(sessionKey, '1');
    setPuckDropPopup({ gameId });
  }, [isLive, eventsLength, gameId]);

  // Win detection
  useEffect(() => {
    if (!liveData || gameEndFired.current || !wasLiveRef.current) return;
    if (liveData.gameStatus !== 'final') return;
    const sessionKey = `ahl_win_${gameId}`;
    if (gameId && sessionStorage.getItem(sessionKey)) return;

    const isHome   = liveData.homeTeamId === teamId;
    const myScore  = isHome ? liveData.homeScore : liveData.awayScore;
    const oppScore = isHome ? liveData.awayScore : liveData.homeScore;

    if (myScore > oppScore) {
      gameEndFired.current = true;
      if (gameId) sessionStorage.setItem(sessionKey, '1');
      const oppId   = isHome ? liveData.awayTeamId : liveData.homeTeamId;
      const oppAbbr = getAHLTeamById(oppId)?.abbr || String(oppId);
      setWinPopup({
        teamAbbr: teamAbbr || 'WIN',
        score: `${teamAbbr} ${myScore} – ${oppAbbr} ${oppScore}`,
      });
    }
  }, [liveData?.gameStatus, eventsLength, teamId, teamAbbr, gameId, isPlayoff]);

  return {
    goalPopup,     clearGoalPopup:     () => setGoalPopup(null),
    penaltyPopup,  clearPenaltyPopup:  () => setPenaltyPopup(null),
    winPopup,      clearWinPopup:      () => setWinPopup(null),
    puckDropPopup, clearPuckDropPopup: () => setPuckDropPopup(null),
  };
}
