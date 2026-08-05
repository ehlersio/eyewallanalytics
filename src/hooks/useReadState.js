// hooks/useReadState.js — Phase 2: unseen-content badges for the
// News/Milestones/Trivia tabs and BottomNav's combined News icon dot.
//
// Deliberately local-only, boolean-only (a dot, not a count), no per-item
// tracking — see the Phase 2 brief's explicit v1 scope. News/Milestones
// track a "last seen item id" in localStorage; Trivia needs no separate
// marker at all — its unseen state is fully derived from data Phase 2
// already builds (today's questions vs. triviaAnswers.js's answered map),
// so answering a question is what clears it, not merely viewing the tab.
//
// Cross-component reactivity (so BottomNav's badge clears the instant
// NewsView marks a tab seen, without a shared context/provider) reuses
// this app's existing convention for exactly this problem — see
// SportContext.jsx/teamConfig.js's 'eyewall:*-season-updated' pattern.
// triviaAnswers.js dispatches the same event name after recording an
// answer, for the same reason.
import { useState, useEffect, useCallback } from 'react';
import { useSport } from '../utils/SportContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { getAnsweredMap } from '../utils/triviaAnswers';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
const EVENT_NAME = 'eyewall:read-state-updated';

function seenKey(kind, sport, team) {
  return team ? `eyewall:seen:${kind}:${sport}:${team}` : `eyewall:seen:${kind}:${sport}`;
}

function getSeen(kind, sport, team) {
  try {
    return localStorage.getItem(seenKey(kind, sport, team));
  } catch {
    return null;
  }
}

function setSeen(kind, sport, team, id) {
  try {
    localStorage.setItem(seenKey(kind, sport, team), id);
  } catch {
    // localStorage unavailable — badge just won't clear this session
  }
}

export function useReadState() {
  const { isPWHL } = useSport();
  const sport = isPWHL ? 'pwhl' : 'nhl';
  const team = (isPWHL ? PWHL_TEAM_CONFIG : TEAM_CONFIG)?.abbr;

  const [news, setNews] = useState({ unseen: false, latestId: null });
  const [milestones, setMilestones] = useState({ unseen: false, latestId: null });
  const [trivia, setTrivia] = useState(false);

  const refresh = useCallback(async () => {
    if (!WORKER_URL || !team) return;

    try {
      const params = new URLSearchParams({ sport, team });
      const res = await fetch(`${WORKER_URL}/news/latest?${params}`);
      if (res.ok) {
        const { latestId } = await res.json();
        setNews({ unseen: !!latestId && latestId !== getSeen('news', sport, team), latestId });
      }
    } catch {
      // leave previous state — a failed check shouldn't flip the badge off
    }

    try {
      const res = await fetch(`${WORKER_URL}/milestones/latest?sport=${sport}`);
      if (res.ok) {
        const { latestId } = await res.json();
        const idStr = latestId != null ? String(latestId) : null;
        setMilestones({ unseen: idStr != null && idStr !== getSeen('milestones', sport, null), latestId: idStr });
      }
    } catch {
      // leave previous state
    }

    try {
      const params = new URLSearchParams({ sport, team });
      const res = await fetch(`${WORKER_URL}/trivia/today?${params}`);
      if (res.ok) {
        const data = await res.json();
        const answered = getAnsweredMap();
        const unseen = ['easy', 'medium', 'hard'].some((tier) => {
          const q = data[tier];
          return q && !answered[String(q.id)];
        });
        setTrivia(unseen);
      }
    } catch {
      // leave previous state
    }
  }, [sport, team]);

  useEffect(() => {
    refresh();
    window.addEventListener(EVENT_NAME, refresh);
    return () => window.removeEventListener(EVENT_NAME, refresh);
  }, [refresh]);

  const markSeen = useCallback(
    (tab) => {
      if (tab === 'news' && news.latestId) {
        setSeen('news', sport, team, news.latestId);
        setNews((s) => ({ ...s, unseen: false }));
        window.dispatchEvent(new window.CustomEvent(EVENT_NAME));
      } else if (tab === 'milestones' && milestones.latestId) {
        setSeen('milestones', sport, null, milestones.latestId);
        setMilestones((s) => ({ ...s, unseen: false }));
        window.dispatchEvent(new window.CustomEvent(EVENT_NAME));
      }
      // 'trivia' has no markSeen — viewing the tab doesn't clear it, only
      // answering does (triviaAnswers.recordAnswer dispatches the same
      // event itself once an answer is recorded).
    },
    [sport, team, news.latestId, milestones.latestId]
  );

  return {
    news: news.unseen,
    milestones: milestones.unseen,
    trivia,
    any: news.unseen || milestones.unseen || trivia,
    markSeen,
  };
}
