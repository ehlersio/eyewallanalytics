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
//
// Holiday intros (src/brand/introThemes.js) pass `decor`, the holiday's
// name: frames then carry a `decor` field (src/brand/holidayDecor.js) with
// what's drawn on the mark itself -- an overlay on the faceoff dot or the
// puck, the ref's costume. Full-screen effects are HolidayParticles.jsx.

import { useEffect, useId, useRef } from 'react';
import { MARK } from '../brand/rinkMark';
import { DECOR, DECOR_SHAPES } from '../brand/holidayDecor';

const REF_STRIPES = '#0B1426';
// The ref's right arm in a salute, seen from above with the ref facing the
// dot (+y): upper arm out to the elbow, forearm back across to the brow.
// Points are relative to the ref's center; at 0 the arm is down at the side.
const SALUTE_ARM = { shoulder: [-3.4, 0.6], elbow: [-8.6, 3.2], hand: [-0.6, 3.0] };
function saluteArmPoints(k) {
  const { shoulder: s, elbow: e, hand: h } = SALUTE_ARM;
  const at = p => [s[0] + (p[0] - s[0]) * k, s[1] + (p[1] - s[1]) * k];
  return [s, at(e), at(h)].map(p => p.map(n => n.toFixed(2)).join(',')).join(' ');
}
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

const fmt = n => n.toFixed(2);

function applyDecor(nodes, f) {
  const d = f.decor;
  if (nodes.dotOverlay) {
    const o = d?.dot;
    const show = o && o.s > 0.01;
    nodes.dotOverlay.setAttribute('opacity', show ? '1' : '0');
    if (show) {
      nodes.dotOverlay.setAttribute('href', `#${nodes.prefix}-${o.kind}`);
      nodes.dotOverlay.setAttribute('transform', `translate(${C} ${C}) scale(${o.s.toFixed(3)})`);
    }
  }
  if (nodes.puckOverlay) {
    const show = d?.puck && !f.puck.isDot && f.puck.r > 0;
    nodes.puckOverlay.setAttribute('opacity', show ? '1' : '0');
    if (show) {
      nodes.puckOverlay.setAttribute('href', `#${nodes.prefix}-${d.puck}`);
      nodes.puckOverlay.setAttribute('transform', `translate(${fmt(f.puck.x)} ${fmt(f.puck.y)}) scale(${(f.puck.r * 1.2).toFixed(3)})`);
    }
  }
}

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
  if (nodes.refArm) {
    const k = f.ref?.salute ?? 0;
    const points = saluteArmPoints(k);
    for (const el of [nodes.refArm, nodes.refArmEdge]) {
      el.setAttribute('points', points);
      el.setAttribute('opacity', k > 0.02 ? '1' : '0');
    }
  }
  ['rippleHome', 'rippleAway'].forEach((key, i) => {
    const el = nodes[key];
    if (!el) return;
    const r = f.ripples?.[i];
    el.setAttribute('opacity', r ? r.opacity.toFixed(2) : '0');
    if (r) {
      el.setAttribute('cx', r.x.toFixed(2));
      el.setAttribute('cy', r.y.toFixed(2));
      el.setAttribute('r', r.r.toFixed(2));
    }
  });
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
  applyDecor(nodes, f);
}

export default function FaceoffRink({
  frameAt,           // (elapsedMs) => frame, from faceoffTimeline.js
  durationMs,        // stop after this long and call onDone; omit to loop
  onDone,
  showLetter = true,
  showRef = true,
  decor = null,      // holiday name from introThemes.js, or null
  vars,              // CSS custom properties to override (e.g. --brand-away)
  freezeAt = null,   // dev: hold a single frame at this elapsed ms
  sheet = false,     // paint the rink sheet behind the mark
  size = 190,
  className = '',
  title,
}) {
  const nodes = useRef({});
  nodes.current.prefix = `decor${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const n = nodes.current;
    if (freezeAt != null) {
      applyFrame(n, frameAt(freezeAt));
      return undefined;
    }
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
  }, [frameAt, durationMs, freezeAt]);

  const set = key => el => { if (el) nodes.current[key] = el; };
  const refLook = decor ? DECOR[decor]?.ref : null;
  const salutes = decor === 'veterans-day';
  const bar = key => {
    const b = E[key];
    return <rect key={key} ref={set(key)} x={b.x} y={b.y} width={b.w} height={b.h}
      rx={key === 'middle' ? undefined : E.radius} />;
  };

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`overflow-visible ${className}`}
      style={{ overflow: 'visible', ...vars }} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {decor && (
        <defs>
          {Object.entries(DECOR_SHAPES).map(([kind, parts]) => (
            <g key={kind} id={`${nodes.current.prefix}-${kind}`}>
              {parts.map(([Tag, attrs], i) => <Tag key={i} {...attrs} />)}
            </g>
          ))}
        </defs>
      )}
      {sheet && <rect width="100" height="100" style={{ fill: 'var(--brand-sheet)' }} />}
      <g fill="none" strokeWidth={ring.stroke} style={{ stroke: 'var(--brand-red)' }}>
        <circle cx={C} cy={C} r={ring.r} />
        {hashes.ys.flatMap(y => [
          <line key={`l${y}`} x1={hashes.left[0]} y1={y} x2={hashes.left[1]} y2={y} />,
          <line key={`r${y}`} x1={hashes.right[0]} y1={y} x2={hashes.right[1]} y2={y} />,
        ])}
      </g>
      {showLetter && <g style={{ fill: 'var(--brand-ink)' }}>{BARS.map(bar)}</g>}
      {salutes && ['rippleHome', 'rippleAway'].map(key => (
        <circle key={key} ref={set(key)} r="0" fill="none" strokeWidth="0.6" opacity="0"
          style={{ stroke: 'var(--brand-ink)' }} />
      ))}
      <polyline ref={set('homeStick')} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={{ stroke: 'var(--brand-ink)' }} />
      <polyline ref={set('awayStick')} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={{ stroke: 'var(--brand-away)' }} />
      <circle ref={set('homeBody')} cy={C} r="4.5" strokeWidth="1"
        style={{ fill: 'var(--brand-ink)', stroke: 'var(--brand-sheet)' }} />
      <circle ref={set('awayBody')} cy={C} r="4.5" strokeWidth="1"
        style={{ fill: 'var(--brand-away)', stroke: 'var(--brand-sheet)' }} />
      <circle ref={set('puck')} cx={C} cy={C} r={dot.r} style={{ fill: 'var(--brand-red)' }} />
      {decor && <use ref={set('puckOverlay')} opacity="0" />}
      {decor && <use ref={set('dotOverlay')} opacity="0" style={{ fill: 'var(--brand-red)' }} />}
      {showRef && (
        <g ref={set('ref')} transform="translate(50 -20)">
          <circle r="4.5" fill="#FFFFFF" stroke={REF_STRIPES} strokeWidth="1" />
          {refLook === 'ghost' ? (
            <>
              <ellipse cx="-1.4" cy="-0.7" rx="0.6" ry="0.85" fill={REF_STRIPES} />
              <ellipse cx="1.4" cy="-0.7" rx="0.6" ry="0.85" fill={REF_STRIPES} />
              <ellipse cx="0" cy="1.7" rx="0.7" ry="0.85" fill={REF_STRIPES} />
            </>
          ) : (
            <>
              <line x1="-1.6" y1="-3.8" x2="-1.6" y2="3.8" stroke={REF_STRIPES} strokeWidth="0.9" />
              <line x1="1.6" y1="-3.8" x2="1.6" y2="3.8" stroke={REF_STRIPES} strokeWidth="0.9" />
            </>
          )}
          {refLook === 'santa' && (
            <>
              <path d="M-3.6,-3.4 Q-0.5,-10.5 5.4,-8 L3.6,-3.4Z" fill="#D6203A" />
              <rect x="-4.3" y="-4.4" width="8.6" height="1.9" rx="0.95" fill="#FFFFFF" />
              <circle cx="5.6" cy="-8" r="1.25" fill="#FFFFFF" />
            </>
          )}
          {salutes && (
            <>
              <polyline ref={set('refArmEdge')} fill="none" stroke="#FFFFFF" strokeWidth="3.2"
                strokeLinecap="round" strokeLinejoin="round" opacity="0" />
              <polyline ref={set('refArm')} fill="none" stroke={REF_STRIPES} strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round" opacity="0" />
            </>
          )}
        </g>
      )}
    </svg>
  );
}
