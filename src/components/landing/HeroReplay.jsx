// src/components/landing/HeroReplay.jsx
// The hero's live tracking replay: a real goal drawn by GoalTrackingReplay
// from the Worker's /nhl/goal-replay, looping after a pause. If the Worker
// can't be reached the same replay comes from the bundled JSON (a finished
// game's tracking never changes). Hidden only if both fail.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GoalTrackingReplay from '../GoalTrackingReplay';
import { getGoalReplay } from '../../utils/nhlApi';
import { HERO_GOAL, HERO_REPLAY_FALLBACK, HERO_LOOP_PAUSE_MS } from './landingContent';

async function loadHeroReplay() {
  const live = await getGoalReplay(HERO_GOAL.gameId, HERO_GOAL.eventId);
  if (live) return live;
  try {
    const res = await fetch(HERO_REPLAY_FALLBACK);
    const data = res.ok ? await res.json() : null;
    return data?.available ? data : null;
  } catch {
    return null;
  }
}

const CARD_CLASSES = 'landing-hero-replay rounded-[var(--radius-lg)] border border-[var(--border-2)] bg-[var(--bg2)] p-3 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] md:p-4';
const LABEL_CLASSES = 'font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] sm:text-[11px] sm:tracking-[0.08em]';

export default function HeroReplay() {
  const { t } = useTranslation();
  const [state, setState] = useState({ status: 'loading', replay: null });

  useEffect(() => {
    let cancelled = false;
    loadHeroReplay().then((replay) => {
      if (!cancelled) setState({ status: replay ? 'ready' : 'failed', replay });
    });
    return () => { cancelled = true; };
  }, []);

  if (state.status === 'failed') return null;

  return (
    <figure className={CARD_CLASSES}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className={`${LABEL_CLASSES} text-[color:var(--red-bright)]`}>{t('landing.hero.replayLabel')}</span>
        <span className={`${LABEL_CLASSES} text-[color:var(--text-muted)]`}>{t('landing.hero.replayGame')}</span>
      </div>
      {state.replay ? (
        <GoalTrackingReplay
          replay={state.replay}
          scorerName={t('landing.hero.scorer')}
          loop={HERO_LOOP_PAUSE_MS}
        />
      ) : (
        // Same 120 ft x 85 ft window GoalTrackingReplay draws, plus its
        // controls row, so nothing jumps when the replay arrives.
        <div className="flex aspect-[120/85] w-full items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg3)] text-[12px] text-[color:var(--text-muted)]" role="status">
          {t('landing.hero.loading')}
        </div>
      )}
      <figcaption className="mt-2 text-[12.5px] leading-[1.5] text-[color:var(--text-muted)]">
        {t('landing.hero.caption')}
      </figcaption>
    </figure>
  );
}
