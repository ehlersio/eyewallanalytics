// components/FaceoffRink.jsx
//
// Animated EyeWall faceoff mark. Draws the mark's geometry from
// src/brand/rinkMark.js and moves the players, ref, puck and E each animation
// frame using a pure frame function from src/brand/faceoffTimeline.js.
// Attributes are written straight to the SVG nodes through refs rather than
// via React state, so the animation never re-renders the component.
//
// Colors come from the --brand-* tokens in index.css, so the same drawing is
// Ice Rink in light mode and Night Rink in dark mode and follows a live
// theme toggle.
//
// Used by FaceoffIntro (plays once, then calls onDone) and FaceoffLoader
// (loops). With prefers-reduced-motion it renders a single still frame.

import { useEffect, useRef } from 'react';
import { MARK } from '../brand/rinkMark';

const REF_STRIPES = '#0B1426';
const { center: C, ring, hashes, E, dot } = MARK;
const BARS = ['spine', 'top', 'bottom', 'middle'];

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// The SVG draws with overflow visible, so skaters fade out as they leave the
// 100x100 box instead of lingering beside the mark.
const EDGE_FADE = 10;
const edgeOpacity = (pos) => String(Math.max(0, Math.min(1, 1 - Math.max(0, -pos, pos - 100) / EDGE_FADE)));

function applyFrame(nodes, f) {
  for (const side of ['home', 'away']) {
    const opacity = edgeOpacity(f[side].x);
    nodes[`${side}Body`].setAttribute('cx', f[side].x.toFixed(2));
    nodes[`${side}Body`].setAttribute('opacity', opacity);
    nodes[`${side}Stick`].setAttribute('points', f[side].stick.map(p => p.map(n => n.toFixed(2)).join(',')).join(' '));
    nodes[`${side}Stick`].setAttribute('opacity', opacity);
  }
  if (nodes.ref) {
    const y = f.ref ? f.ref.y : -20;
    nodes.ref.setAttribute('transform', `translate(${C} ${y.toFixed(2)})`);
    nodes.ref.setAttribute('opacity', edgeOpacity(y));
  }
  const puck = nodes.puck;
  puck.setAttribute('cx', f.puck.x.toFixed(2));
  puck.setAttribute('cy', f.puck.y.toFixed(2));
  puck.setAttribute('r', Math.max(0, f.puck.r).toFixed(2));
  puck.style.fill = f.puck.isDot ? 'var(--brand-red)' : 'var(--brand-puck)';
  if (f.letter) {
    const s = f.letter;
    const spineH = E.spine.h * s.spine;
    nodes.spine.setAttribute('height', spineH.toFixed(2));
    nodes.spine.setAttribute('y', (C - spineH / 2).toFixed(2));
    nodes.top.setAttribute('width', (E.top.w * s.top).toFixed(2));
    nodes.bottom.setAttribute('width', (E.bottom.w * s.bottom).toFixed(2));
    nodes.middle.setAttribute('width', (E.middle.w * s.middle).toFixed(2));
  }
}

export default function FaceoffRink({
  frameAt,           // (elapsedMs) => frame, from faceoffTimeline.js
  durationMs,        // stop after this long and call onDone; omit to loop
  onDone,
  showLetter = true,
  showRef = true,
  sheet = false,     // paint the rink sheet behind the mark
  size = 190,
  className = '',
  title,
}) {
  const nodes = useRef({});
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const n = nodes.current;
    if (prefersReducedMotion()) {
      applyFrame(n, frameAt(durationMs ?? 0));
      if (durationMs != null) onDoneRef.current?.();
      return undefined;
    }
    let raf = 0;
    let start = null;
    const tick = (now) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const done = durationMs != null && elapsed >= durationMs;
      applyFrame(n, frameAt(done ? durationMs : elapsed));
      if (done) onDoneRef.current?.();
      else raf = requestAnimationFrame(tick);
    };
    applyFrame(n, frameAt(0));
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frameAt, durationMs]);

  const set = key => el => { if (el) nodes.current[key] = el; };
  const bar = key => {
    const b = E[key];
    return <rect key={key} ref={set(key)} x={b.x} y={b.y} width={b.w} height={b.h}
      rx={key === 'middle' ? undefined : E.radius} />;
  };

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`overflow-visible ${className}`}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {sheet && <rect width="100" height="100" style={{ fill: 'var(--brand-sheet)' }} />}
      <g fill="none" strokeWidth={ring.stroke} style={{ stroke: 'var(--brand-red)' }}>
        <circle cx={C} cy={C} r={ring.r} />
        {hashes.ys.flatMap(y => [
          <line key={`l${y}`} x1={hashes.left[0]} y1={y} x2={hashes.left[1]} y2={y} />,
          <line key={`r${y}`} x1={hashes.right[0]} y1={y} x2={hashes.right[1]} y2={y} />,
        ])}
      </g>
      {showLetter && <g style={{ fill: 'var(--brand-ink)' }}>{BARS.map(bar)}</g>}
      <polyline ref={set('homeStick')} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={{ stroke: 'var(--brand-ink)' }} />
      <polyline ref={set('awayStick')} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={{ stroke: 'var(--brand-away)' }} />
      <circle ref={set('homeBody')} cy={C} r="4.5" strokeWidth="1"
        style={{ fill: 'var(--brand-ink)', stroke: 'var(--brand-sheet)' }} />
      <circle ref={set('awayBody')} cy={C} r="4.5" strokeWidth="1"
        style={{ fill: 'var(--brand-away)', stroke: 'var(--brand-sheet)' }} />
      <circle ref={set('puck')} cx={C} cy={C} r={dot.r} style={{ fill: 'var(--brand-red)' }} />
      {showRef && (
        <g ref={set('ref')} transform="translate(50 -20)">
          <circle r="4.5" fill="#FFFFFF" stroke={REF_STRIPES} strokeWidth="1" />
          <line x1="-1.6" y1="-3.8" x2="-1.6" y2="3.8" stroke={REF_STRIPES} strokeWidth="0.9" />
          <line x1="1.6" y1="-3.8" x2="1.6" y2="3.8" stroke={REF_STRIPES} strokeWidth="0.9" />
        </g>
      )}
    </svg>
  );
}
