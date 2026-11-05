// components/HolidayParticles.jsx
//
// The full-screen layer of a holiday intro: snow, leaves, confetti,
// fireworks... (src/brand/holidayDecor.js). It fills its positioned parent
// -- the intro overlay, or a tile in the dev gallery -- and maps the mark's
// 100x100 grid onto it with the mark (`markSize` px) centered, the way
// FaceoffIntro centers FaceoffRink, so a burst out of the faceoff dot starts
// on the dot. Its size comes from measuring the parent, so the effects cover
// the whole screen on a phone, an iPad or in landscape.
//
// Like FaceoffRink, it writes attributes straight to the SVG nodes each
// animation frame, from a fixed pool of <use> nodes, and never re-renders
// while it plays. Taps go through to the overlay underneath.

import { useEffect, useId, useRef, useState } from 'react';
import { DECOR_SHAPES, PARTICLE_POOL, screenBounds } from '../brand/holidayDecor';
import { prefersReducedMotion } from './FaceoffRink';

const LAYER_STYLE = { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' };

function applyParticles(pool, prefix, particles) {
  pool.forEach((el, i) => {
    const p = particles[i];
    if (!p || p.opacity <= 0) {
      el.setAttribute('opacity', '0');
      return;
    }
    el.setAttribute('href', `#${prefix}-${p.kind}`);
    el.setAttribute('transform',
      `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(1)}) scale(${p.s.toFixed(3)})`);
    el.setAttribute('opacity', p.opacity.toFixed(3));
    el.style.fill = p.fill;
  });
}

export default function HolidayParticles({
  particlesAt,       // (elapsedMs, bounds) => particles, from introThemes.js
  durationMs,
  markSize = 190,
  freezeAt = null,   // dev: hold a single frame at this elapsed ms
}) {
  const box = useRef(null);
  const pool = useRef([]);
  const [size, setSize] = useState(null);
  const prefix = `fx${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    const el = box.current;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One clock for the layer's life, so a resize mid-intro doesn't restart it.
  const start = useRef(null);
  useEffect(() => {
    if (!size?.w || !size?.h) return undefined;
    const bounds = screenBounds(size.w, size.h, markSize);
    const draw = ms => applyParticles(pool.current, prefix, particlesAt(ms, bounds));
    if (freezeAt != null) {
      draw(freezeAt);
      return undefined;
    }
    if (prefersReducedMotion()) return undefined;
    let raf = 0;
    const tick = (now) => {
      if (start.current === null) start.current = now;
      const elapsed = now - start.current;
      draw(Math.min(elapsed, durationMs));
      if (elapsed < durationMs) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, particlesAt, durationMs, markSize, freezeAt, prefix]);

  const b = size?.w && size?.h ? screenBounds(size.w, size.h, markSize) : null;
  return (
    <div ref={box} aria-hidden="true" style={LAYER_STYLE} data-testid="holiday-particles">
      {b && (
        <svg width="100%" height="100%" viewBox={`${b.x0} ${b.y0} ${b.x1 - b.x0} ${b.y1 - b.y0}`}
          style={{ display: 'block' }}>
          <defs>
            {Object.entries(DECOR_SHAPES).map(([kind, parts]) => (
              <g key={kind} id={`${prefix}-${kind}`}>
                {parts.map(([Tag, attrs], i) => <Tag key={i} {...attrs} />)}
              </g>
            ))}
          </defs>
          {Array.from({ length: PARTICLE_POOL }, (_, i) => (
            <use key={i} ref={el => { if (el) pool.current[i] = el; }} opacity="0" />
          ))}
        </svg>
      )}
    </div>
  );
}
