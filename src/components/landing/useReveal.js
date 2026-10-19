// src/components/landing/useReveal.js
// The landing page's soft fade-in on scroll. The resting state is visible:
// a section only starts hidden when it is below the fold, motion is allowed
// and IntersectionObserver exists, and it fades in once it scrolls into
// view. Anything already on screen at load, and everything under
// prefers-reduced-motion, is simply shown.

import { useLayoutEffect, useRef, useState } from 'react';

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useReveal() {
  const ref = useRef(null);
  const [state, setState] = useState('shown'); // 'shown' | 'hidden' | 'revealed'

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return undefined;
    if (el.getBoundingClientRect().top < window.innerHeight) return undefined;
    setState('hidden');
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setState('revealed');
        io.disconnect();
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const className = state === 'hidden'
    ? 'opacity-0 translate-y-4'
    : state === 'revealed'
      ? 'opacity-100 translate-y-0 [transition:opacity_600ms_ease-out,transform_600ms_ease-out]'
      : '';
  return [ref, className];
}
