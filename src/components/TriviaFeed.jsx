// src/components/TriviaFeed.jsx
// Daily trivia (Phase 2) — three tiers: easy (league-wide), medium
// (user's team), hard (hand-curated). Rendered as a tab inside NewsView
// alongside News/Milestones, same pattern as MilestonesFeed — reuses
// NewsView's card classes, adds its own tier/option classes.
import { useState, useEffect, useCallback } from 'react';
import { useSport } from '../utils/SportContext';
import { useAuth } from '../utils/AuthContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { getAnsweredMap, getStats, recordAnswer } from '../utils/triviaAnswers';
import { capture } from '../utils/analytics';
import TeamLogo from './TeamLogo';
import './TriviaFeed.css';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

const TIER_META = {
  easy:   { label: 'Easy',   icon: '🟢' },
  medium: { label: 'Medium', icon: '🟡' },
  hard:   { label: 'Hard',   icon: '🔴' },
};

function TierCard({ tier, question, answered, userId, onAnswered, sportKey }) {
  const meta = TIER_META[tier];
  // Medium-tier question text is deliberately team-name-free (see
  // trivia_questions.py's module docstring — the model hallucinated a
  // wrong team name even when given the correct one). Team identity comes
  // from the logo here instead, driven by this row's own real `team`
  // column, not anything the LLM said.
  const showTeamLogo = tier === 'medium' && question?.team && question.team !== 'ALL';

  if (!question) {
    return (
      <div className="trivia-card card">
        <div className="trivia-card-header">
          <span className="trivia-tier-badge">{meta.icon} {meta.label}</span>
        </div>
        <p className="trivia-empty-msg">No {meta.label.toLowerCase()} question today yet — check back soon.</p>
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
    <div className="trivia-card card">
      <div className="trivia-card-header">
        <span className="trivia-tier-badge">
          {meta.icon} {meta.label}
          {showTeamLogo && <TeamLogo abbr={question.team} sport={sportKey} size={18} />}
        </span>
        {answered && (
          <span className={`trivia-result-badge ${answered.isCorrect ? 'correct' : 'incorrect'}`}>
            {answered.isCorrect ? '✓ Correct' : '✕ Incorrect'}
          </span>
        )}
      </div>
      <p className="trivia-question-text">{question.question_text}</p>
      <div className="trivia-options">
        {question.options.map((opt, i) => {
          let cls = 'trivia-option';
          if (answered) {
            if (i === question.correct_index) cls += ' correct';
            else if (i === selectedIndex) cls += ' incorrect';
            else cls += ' dimmed';
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
        <p className="trivia-explanation">{question.explanation}</p>
      )}
    </div>
  );
}

export default function TriviaFeed() {
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
    if (!WORKER_URL) { setError('Worker URL not configured'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sport: sportKey, team: activeTeamAbbr });
      const res = await fetch(`${WORKER_URL}/trivia/today?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Trivia not available — check back soon');
      const data = await res.json();
      setQuestions({ easy: data.easy, medium: data.medium, hard: data.hard });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sportKey, activeTeamAbbr]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const refreshAnswered = () => setAnsweredMap(getAnsweredMap());

  const stats = getStats();

  return (
    <div className="trivia-feed">
      <div className="news-header card">
        <div className="news-header-row">
          <div>
            <div className="news-title">Daily Trivia</div>
            {stats.attempted > 0 && (
              <div className="news-updated">
                {stats.correct}/{stats.attempted} correct ({Math.round((stats.correct / stats.attempted) * 100)}%)
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="news-loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="news-skeleton card">
              <div className="skel skel-badge" />
              <div className="skel skel-title" />
              <div className="skel skel-text" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="news-error card">
          <div className="news-error-icon">🏒</div>
          <div className="news-error-msg">{error}</div>
          <button className="news-refresh-btn" onClick={fetchQuestions}>Try again</button>
        </div>
      )}

      {!loading && !error && (
        <div className="trivia-tiers">
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
