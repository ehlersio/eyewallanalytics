// components/HolidayMark.jsx
//
// The finished EyeWall mark with a holiday's accent (holidayDecor.js
// markAccents): a poppy, maple leaf or turkey in place of the faceoff dot, a
// star in it, a Santa hat on the E... Same geometry as the generated
// /eyewall-logo*.svg (src/brand/rinkMark.js) and colored by the --brand-*
// tokens, so it follows light/dark like EyeWallLogo does. BrandLogo.jsx
// shows it in place of the plain logo on a holiday.

import { MARK } from '../brand/rinkMark';
import { DECOR_SHAPES, markAccents } from '../brand/holidayDecor';

const { center: C, ring, hashes, E, dot } = MARK;
const BARS = ['spine', 'top', 'bottom', 'middle'];

export default function HolidayMark({ holiday, size, className = '', alt = 'EyeWall Analytics' }) {
  const accents = markAccents(holiday);
  const dotReplaced = accents.some(a => a.onDot);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className}
      role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
      data-holiday={holiday}>
      <g fill="none" strokeWidth={ring.stroke} style={{ stroke: 'var(--brand-red)' }}>
        <circle cx={C} cy={C} r={ring.r} />
        {hashes.ys.flatMap(y => [
          <line key={`l${y}`} x1={hashes.left[0]} y1={y} x2={hashes.left[1]} y2={y} />,
          <line key={`r${y}`} x1={hashes.right[0]} y1={y} x2={hashes.right[1]} y2={y} />,
        ])}
      </g>
      <g style={{ fill: 'var(--brand-ink)' }}>
        {BARS.map(key => {
          const b = E[key];
          return <rect key={key} x={b.x} y={b.y} width={b.w} height={b.h} rx={key === 'middle' ? undefined : E.radius} />;
        })}
      </g>
      {!dotReplaced && <circle cx={C} cy={C} r={dot.r} style={{ fill: 'var(--brand-red)' }} />}
      {accents.map((a, i) => (
        <g key={i} transform={`translate(${a.x} ${a.y}) rotate(${a.rot ?? 0}) scale(${a.s})`}
          style={{ fill: a.fill, stroke: a.stroke, strokeWidth: a.strokeWidth }} data-accent={a.kind}>
          {DECOR_SHAPES[a.kind].map(([Tag, attrs], j) => <Tag key={j} {...attrs} />)}
        </g>
      ))}
    </svg>
  );
}
