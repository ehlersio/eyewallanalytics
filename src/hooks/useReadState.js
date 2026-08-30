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
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSport } from '../utils/SportContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { AHL_TEAM_CONFIG } from '../utils/ahlApi';
import { ECHL_TEAM_CONFIG } from '../utils/echlApi';
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
  const { isPWHL, isAHL, isECHL } = useSport();
  const { i18n } = useTranslation();
  const sport = isPWHL ? 'pwhl' : isAHL ? 'ahl' : isECHL ? 'echl' : 'nhl';
  const team = (isPWHL ? PWHL_TEAM_CONFIG : isAHL ? AHL_TEAM_CONFIG : isECHL ? ECHL_TEAM_CONFIG : TEAM_CONFIG)?.abbr;

  const [news, setNews] = useState({ unseen: false, latestId: null });
  const [milestones, setMilestones] = useState({ unseen: false, latestId: null });
  const [trivia, setTrivia] = useState(false);

  // markSeen reads these instead of closing over `news`/`milestones` state
  // directly. A useCallback depending on that state only gets a fresh
  // closure bound to the tab button's onClick once React re-renders and
  // commits -- there's a real gap between refresh()'s fetch resolving and
  // that commit landing, and a click in that gap silently no-ops (reads
  // the stale latestId: null from before the fetch, skips the `&&
  // milestones.latestId` guard entirely). Confirmed as the root cause of a
  // recurring read-state-badges.cy.js CI flake (two different assertions
  // across two runs, same underlying race) -- and a real, if narrow,
  // production bug: a user clicking a tab fast enough after the page loads
  // hits the same gap. Refs are updated at the same instant as the state
  // setters below, independent of React's render/commit cycle entirely.
  const newsRef = useRef(news);
  const milestonesRef = useRef(milestones);

  const refresh = useCallback(async () => {
    if (!WORKER_URL || !team) return;

    try {
      const params = new URLSearchParams({ sport, team });
      const res = await fetch(`${WORKER_URL}/news/latest?${params}`);
      if (res.ok) {
        const { latestId } = await res.json();
        const nextNews = { unseen: !!latestId && latestId !== getSeen('news', sport, team), latestId };
        newsRef.current = nextNews;
        setNews(nextNews);
      }
    } catch {
      // leave previous state — a failed check shouldn't flip the badge off
    }

    // Milestones/trivia have no AHL/ECHL data source at all (no
    // ahl_milestones.py/echl_milestones.py/trivia_questions.py-equivalent
    // pipeline exists for either) -- skip these two fetches entirely
    // rather than hitting routes that only ever badRequest for
    // sport=ahl/echl. news/latest above is the only one of the three with
    // a real AHL/ECHL backing (eyewall-poller#73, #80).
    if (isAHL || isECHL) return;

    try {
      const res = await fetch(`${WORKER_URL}/milestones/latest?sport=${sport}`);
      if (res.ok) {
        const { latestId } = await res.json();
        const idStr = latestId != null ? String(latestId) : null;
        const nextMilestones = { unseen: idStr != null && idStr !== getSeen('milestones', sport, null), latestId: idStr };
        milestonesRef.current = nextMilestones;
        setMilestones(nextMilestones);
      }
    } catch {
      // leave previous state
    }

    try {
      // French/English localization, Track B Phase B2 -- trivia_questions
      // rows are keyed per-locale now (Phase B0/B1, eyewall-pipeline), so
      // the en and fr rows for the same day/tier/sport/team are different
      // rows with different ids. This must fetch the same locale the user
      // is actually viewing (TriviaFeed.jsx), or `answered[String(q.id)]`
      // below compares against the wrong row's id -- the badge could stay
      // "unseen" after a real answer, or clear without the shown question
      // actually being answered.
      const params = new URLSearchParams({ sport, team, locale: i18n.language });
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
  }, [sport, team, i18n.language, isAHL, isECHL]);

  useEffect(() => {
    refresh();
    window.addEventListener(EVENT_NAME, refresh);
    return () => window.removeEventListener(EVENT_NAME, refresh);
  }, [refresh]);

  const markSeen = useCallback(
    (tab) => {
      if (tab === 'news' && newsRef.current.latestId) {
        setSeen('news', sport, team, newsRef.current.latestId);
        newsRef.current = { ...newsRef.current, unseen: false };
        setNews((s) => ({ ...s, unseen: false }));
        window.dispatchEvent(new window.CustomEvent(EVENT_NAME));
      } else if (tab === 'milestones' && milestonesRef.current.latestId) {
        setSeen('milestones', sport, null, milestonesRef.current.latestId);
        milestonesRef.current = { ...milestonesRef.current, unseen: false };
        setMilestones((s) => ({ ...s, unseen: false }));
        window.dispatchEvent(new window.CustomEvent(EVENT_NAME));
      }
      // 'trivia' has no markSeen — viewing the tab doesn't clear it, only
      // answering does (triviaAnswers.recordAnswer dispatches the same
      // event itself once an answer is recorded).
    },
    [sport, team]
  );

  return {
    news: news.unseen,
    milestones: milestones.unseen,
    trivia,
    any: news.unseen || milestones.unseen || trivia,
    markSeen,
  };
}
