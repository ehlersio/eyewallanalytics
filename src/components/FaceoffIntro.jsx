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

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
import FaceoffRink, { prefersReducedMotion } from './FaceoffRink';
import { INTRO_DURATION_MS, introFrame } from '../brand/faceoffTimeline';

const PLAYED_KEY = 'eyewall:intro-played';
const HOLD_MS = 250;
const FADE_MS = 300;

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

const OVERLAY_CLASSES = 'faceoff-intro fixed inset-0 z-[10000] flex items-center justify-center bg-[var(--brand-sheet)] cursor-pointer [transition:opacity_300ms_ease-out]';

export default function FaceoffIntro() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState(PLAY_ON_LOAD ? 'playing' : 'gone');

  useEffect(() => {
    if (phase === 'held') {
      const id = setTimeout(() => setPhase('fading'), HOLD_MS);
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
      <FaceoffRink frameAt={introFrame} durationMs={INTRO_DURATION_MS}
        onDone={() => setPhase(p => (p === 'playing' ? 'held' : p))} title={t('app.introAriaLabel')} />
    </div>
  );
}
