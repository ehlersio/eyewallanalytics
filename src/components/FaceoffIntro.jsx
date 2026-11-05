// components/FaceoffIntro.jsx
//
// Brief faceoff animation shown over the app on a cold start of the iOS app:
// the static launch splash hands off to the same mark here, a ref drops the
// puck, the centers take the draw, and it settles back into the mark before
// fading out. The app mounts and starts loading data underneath the whole
// time, so the intro doesn't add to load time.
//
// Plays at most once per session (sessionStorage, which a cold start clears;
// a team switch's full-page reload doesn't), skips on tap, and never plays
// with prefers-reduced-motion or under Cypress. Web visitors don't get it by
// default -- add ?intro=1 to the URL to force it on any platform.
//
// Holidays (src/brand/introHolidays.js) swap in their own version for the
// day (src/brand/introThemes.js), ending on the "EyeWall Analytics" wordmark with a short line under the
// mark. To preview one any day, add &theme=<name> to ?intro=1 (for example
// ?intro=1&theme=veterans-day); in dev builds &introAt=<ms> also freezes the
// intro on that frame.

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
import FaceoffRink, { prefersReducedMotion } from './FaceoffRink';
import HolidayParticles from './HolidayParticles';
import { deviceRegion, introHoliday } from '../brand/introHolidays';
import { DEFAULT_THEME, THEMES } from '../brand/introThemes';

const PLAYED_KEY = 'eyewall:intro-played';
const FADE_MS = 300;
// FaceoffRink's size; HolidayParticles lines its effects up with it.
const MARK_SIZE = 190;

// A ?theme= preview wins; otherwise today's holiday, if there is one.
function pickTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const preview = new URLSearchParams(window.location.search).get('theme');
  const name = preview || introHoliday(new Date(), deviceRegion());
  return THEMES[name] || DEFAULT_THEME;
}

function shouldPlay() {
  if (typeof window === 'undefined' || window.Cypress) return false;
  const forced = new URLSearchParams(window.location.search).get('intro') === '1';
  if (!forced && Capacitor.getPlatform() === 'web') return false;
  if (prefersReducedMotion()) return false;
  try {
    if (!forced && sessionStorage.getItem(PLAYED_KEY)) return false;
    sessionStorage.setItem(PLAYED_KEY, '1');
  } catch {
    // sessionStorage unavailable -- play it; worst case it replays on reload
  }
  return true;
}

// Decided once at module load: StrictMode double-invokes useState
// initializers in dev, and the second call would see the flag the first set.
const PLAY_ON_LOAD = shouldPlay();
const THEME = pickTheme();
const FREEZE_AT = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const ms = Number(new URLSearchParams(window.location.search).get('introAt'));
  return Number.isFinite(ms) && ms > 0 ? ms : null;
})();

const OVERLAY_CLASSES = 'faceoff-intro fixed inset-0 z-[10000] flex items-center justify-center bg-[var(--brand-sheet)] cursor-pointer [transition:opacity_300ms_ease-out]';

export default function FaceoffIntro() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState(PLAY_ON_LOAD ? 'playing' : 'gone');

  useEffect(() => {
    if (phase === 'held') {
      const id = setTimeout(() => setPhase('fading'), THEME.holdMs);
      return () => clearTimeout(id);
    }
    if (phase === 'fading') {
      const id = setTimeout(() => setPhase('gone'), FADE_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [phase]);

  if (phase === 'gone') return null;

  const skip = () => setPhase('fading');

  return (
    <div className={OVERLAY_CLASSES} style={{ opacity: phase === 'fading' ? 0 : 1 }}
      onClick={skip} role="presentation" data-testid="faceoff-intro">
      <div className="relative">
        <FaceoffRink frameAt={THEME.frameAt} durationMs={THEME.durationMs} freezeAt={FREEZE_AT} size={MARK_SIZE}
          decor={THEME.tagline ? THEME.name : null} vars={THEME.vars}
          onDone={() => setPhase(p => (p === 'playing' ? 'held' : p))} title={t('app.introAriaLabel')} />
        {THEME.tagline && (
          <div className="faceoff-wordmark absolute left-1/2 top-full mt-5 whitespace-nowrap text-center"
            style={{
              animationDelay: `${THEME.letterAtMs - (FREEZE_AT ?? 0)}ms`,
              animationPlayState: FREEZE_AT != null ? 'paused' : undefined,
            }}>
            <div className="text-xl font-bold tracking-tight text-[var(--brand-ink)]">EyeWall Analytics</div>
            <div className="mt-1 text-sm text-[var(--brand-ink)] opacity-75">{t(THEME.tagline)}</div>
          </div>
        )}
      </div>
      {THEME.particlesAt && (
        <HolidayParticles particlesAt={THEME.particlesAt} durationMs={THEME.durationMs}
          markSize={MARK_SIZE} freezeAt={FREEZE_AT} />
      )}
    </div>
  );
}
