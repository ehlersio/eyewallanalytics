// src/components/TriviaFeed.jsx
// Daily trivia (Phase 2) — three tiers: easy (league-wide), medium
// (user's team), hard (hand-curated). Rendered as a tab inside NewsView
// alongside News/Milestones, same pattern as MilestonesFeed — reuses
// NewsView's card classes, adds its own tier/option classes.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSport } from '../utils/SportContext';
import { useAuth } from '../utils/AuthContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { getAnsweredMap, getStats, recordAnswer } from '../utils/triviaAnswers';
import { capture } from '../utils/analytics';
import TeamLogo from './TeamLogo';
import {
  NEWS_HEADER_CLASSES, NEWS_HEADER_ROW_CLASSES, NEWS_TITLE_CLASSES, NEWS_UPDATED_CLASSES,
  NEWS_REFRESH_BTN_CLASSES, NEWS_LOADING_CLASSES, NEWS_SKELETON_CLASSES, SKEL_BADGE_CLASSES,
  SKEL_TITLE_CLASSES, SKEL_TEXT_CLASSES, NEWS_ERROR_CLASSES, NEWS_ERROR_ICON_CLASSES,
  NEWS_ERROR_MSG_CLASSES,
} from '../utils/newsViewClasses';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

// Tailwind migration (Session 95, Phase 1; NewsView.css classes finished in
// Phase 4 once NewsView.css itself was migrated/deleted -- imported from
// newsViewClasses.js since they're genuinely shared with NewsView.jsx/
// PWHLNewsView.jsx/MilestonesFeed.jsx, not duplicated here).
//
// Several original class names are kept as literal marker strings
// alongside the Tailwind utilities (trivia-card/trivia-tier-badge/
// trivia-result-badge/trivia-question-text/trivia-option/trivia-explanation/
// trivia-empty-msg, plus the bare `correct`/`incorrect` state classes) --
// trivia.cy.js and read-state-badges.cy.js select and assert on these
// exact class names (`cy.get('.trivia-option')`,
// `.should('have.class', 'correct')`, etc). They carry no CSS of their own
// anymore; Tailwind owns the visuals, these are pure test hooks now.
const TIERS_CLASSES = 'flex flex-col gap-2.5';
const CARD_CLASSES = 'trivia-card flex flex-col gap-2.5';
const CARD_HEADER_CLASSES = 'flex items-center justify-between';
const TIER_BADGE_CLASSES = 'trivia-tier-badge inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[color:var(--text-muted)]';
const RESULT_BADGE_BASE = 'trivia-result-badge text-[11px] font-bold py-[3px] px-2 rounded-[6px]';
const RESULT_BADGE_COLOR = {
  correct: 'correct text-[color:var(--green)] bg-[rgba(61,186,126,0.12)]',
  incorrect: 'incorrect text-[color:var(--red-bright)] bg-[rgba(255,68,34,0.1)]',
};
const QUESTION_TEXT_CLASSES = 'trivia-question-text text-[14px] font-semibold text-[color:var(--text)] leading-[1.4] m-0';
const OPTIONS_CLASSES = 'flex flex-col gap-1.5';
const OPTION_BASE = 'trivia-option text-left py-2.5 px-3 rounded-[8px] border-[0.5px] border-[var(--border-2)] bg-[var(--bg3)] text-[color:var(--text)] text-[13px] font-medium cursor-pointer [transition:background_0.15s,opacity_0.15s] enabled:hover:bg-[var(--bg4)] disabled:cursor-default';
const OPTION_CORRECT = 'correct border-[var(--green)] bg-[rgba(61,186,126,0.14)] text-[color:var(--green)] font-bold';
const OPTION_INCORRECT = 'incorrect border-[var(--red-bright)] bg-[rgba(255,68,34,0.1)] text-[color:var(--red-bright)] font-bold';
const OPTION_DIMMED = 'dimmed opacity-50';
const EXPLANATION_CLASSES = 'trivia-explanation text-[12px] text-[color:var(--text-muted)] leading-[1.5] m-0';
const EMPTY_MSG_CLASSES = 'trivia-empty-msg text-[12px] text-[color:var(--text-dim)] m-0';

const TIER_ICON = { easy: '🟢', medium: '🟡', hard: '🔴' };

function TierCard({ tier, question, answered, userId, onAnswered, sportKey }) {
  const { t } = useTranslation();
  const icon = TIER_ICON[tier];
  const label = t(`triviaFeed.tier.${tier}`);
  // Medium-tier question text is deliberately team-name-free (see
  // trivia_questions.py's module docstring — the model hallucinated a
  // wrong team name even when given the correct one). Team identity comes
  // from the logo here instead, driven by this row's own real `team`
  // column, not anything the LLM said.
  const showTeamLogo = tier === 'medium' && question?.team && question.team !== 'ALL';

  if (!question) {
    return (
      <div className={`${CARD_CLASSES} card`}>
        <div className={CARD_HEADER_CLASSES}>
          <span className={TIER_BADGE_CLASSES}>{icon} {label}</span>
        </div>
        <p className={EMPTY_MSG_CLASSES}>{t(`triviaFeed.emptyState.${tier}`)}</p>
      </div>
    );
  }

  const handlePick = (index) => {
    if (answered) return;
    const isCorrect = index === question.correct_index;
    capture('trivia_answered', { tier, correct: isCorrect });
    // recordAnswer writes localStorage synchronously before its first
    // await (the server write, signed-in users only) — by the time this
    // call statement returns, the local answer already exists, so
    // onAnswered() can safely re-read it immediately without waiting on
    // the network.
    recordAnswer(question.id, index, isCorrect, userId);
    onAnswered();
  };

  const selectedIndex = answered?.selectedIndex;

  return (
    <div className={`${CARD_CLASSES} card`}>
      <div className={CARD_HEADER_CLASSES}>
        <span className={TIER_BADGE_CLASSES}>
          {icon} {label}
          {showTeamLogo && <TeamLogo abbr={question.team} sport={sportKey} size={18} />}
        </span>
        {answered && (
          <span className={`${RESULT_BADGE_BASE} ${answered.isCorrect ? RESULT_BADGE_COLOR.correct : RESULT_BADGE_COLOR.incorrect}`}>
            {answered.isCorrect ? t('triviaFeed.resultCorrect') : t('triviaFeed.resultIncorrect')}
          </span>
        )}
      </div>
      <p className={QUESTION_TEXT_CLASSES}>{question.question_text}</p>
      <div className={OPTIONS_CLASSES}>
        {question.options.map((opt, i) => {
          let cls = OPTION_BASE;
          if (answered) {
            if (i === question.correct_index) cls += ` ${OPTION_CORRECT}`;
            else if (i === selectedIndex) cls += ` ${OPTION_INCORRECT}`;
            else cls += ` ${OPTION_DIMMED}`;
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => handlePick(i)}
              disabled={!!answered}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && question.explanation && (
        <p className={EXPLANATION_CLASSES}>{question.explanation}</p>
      )}
    </div>
  );
}

export default function TriviaFeed() {
  const { t } = useTranslation();
  const { isPWHL } = useSport();
  const { user } = useAuth();
  const [questions, setQuestions] = useState({ easy: null, medium: null, hard: null });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [answeredMap, setAnsweredMap] = useState(() => getAnsweredMap());

  const activeTeam     = isPWHL ? PWHL_TEAM_CONFIG : TEAM_CONFIG;
  const activeTeamAbbr = activeTeam?.abbr || TEAM_CONFIG.abbr;
  const sportKey        = isPWHL ? 'pwhl' : 'nhl';

  const fetchQuestions = useCallback(async () => {
    if (!WORKER_URL) { setError(t('triviaFeed.error.workerNotConfigured')); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sport: sportKey, team: activeTeamAbbr });
      const res = await fetch(`${WORKER_URL}/trivia/today?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(t('triviaFeed.error.notAvailable'));
      const data = await res.json();
      setQuestions({ easy: data.easy, medium: data.medium, hard: data.hard });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sportKey, activeTeamAbbr, t]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const refreshAnswered = () => setAnsweredMap(getAnsweredMap());

  const stats = getStats();

  return (
    <div className="trivia-feed">
      <div className={`${NEWS_HEADER_CLASSES} card`}>
        <div className={NEWS_HEADER_ROW_CLASSES}>
          <div>
            <div className={NEWS_TITLE_CLASSES}>{t('triviaFeed.header.title')}</div>
            {stats.attempted > 0 && (
              <div className={NEWS_UPDATED_CLASSES}>
                {t('triviaFeed.header.stats', {
                  correct: stats.correct,
                  attempted: stats.attempted,
                  pct: Math.round((stats.correct / stats.attempted) * 100),
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className={NEWS_LOADING_CLASSES}>
          {[1, 2, 3].map(i => (
            <div key={i} className={`${NEWS_SKELETON_CLASSES} card`}>
              <div className={SKEL_BADGE_CLASSES} />
              <div className={SKEL_TITLE_CLASSES} />
              <div className={SKEL_TEXT_CLASSES} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className={`${NEWS_ERROR_CLASSES} card`}>
          <div className={NEWS_ERROR_ICON_CLASSES}>🏒</div>
          <div className={NEWS_ERROR_MSG_CLASSES}>{error}</div>
          <button className={NEWS_REFRESH_BTN_CLASSES} onClick={fetchQuestions}>{t('triviaFeed.error.tryAgain')}</button>
        </div>
      )}

      {!loading && !error && (
        <div className={TIERS_CLASSES}>
          {['easy', 'medium', 'hard'].map((tier) => {
            const q = questions[tier];
            const answered = q ? answeredMap[String(q.id)] : undefined;
            return (
              <TierCard
                key={tier}
                tier={tier}
                question={q}
                answered={answered}
                userId={user?.id}
                onAnswered={refreshAnswered}
                sportKey={sportKey}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
