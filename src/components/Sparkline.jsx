// Generic sparkline (Session 76 consolidation) -- draws an SVG line+area
// chart over an array of values, with optional axis labels, a reference
// line, first/last endpoint dots+labels, and hover tracking. Callers own
// data shaping, color, and all wrapper markup (header, legend, tooltip
// content) -- this component only draws the plot itself, the same
// "caller owns everything outside the plot" split SeasonOverlayChart uses.
// Replaces two independently hand-rolled sparkline SVGs that had
// converged on the same shape (LeagueView's rank trend, TeamView's xGF%
// per-game trend) found during the Session 76 inline-SVG audit.
export default function Sparkline({
  points,                            // [{ value: number, ...caller-owned fields }]
  color = 'var(--team-primary)',
  width = 240,
  height = 80,
  padding = 16,                      // number, or { left, right, top, bottom }
  invertY = false,                   // true when a *lower* value should plot higher (e.g. rank)
  yDomain = 'auto',                  // 'auto' | { min, max, pad }
  referenceValue = null,
  showAxisLabels = false,
  formatAxisLabel = (v) => Math.round(v),
  showEndpoints = false,
  formatEndpointLabel = (v) => v,
  onHover = null,                    // (point, index) => void -- passing this enables mouse tracking
  hoverIndex = null,                 // caller-controlled highlighted point, paired with onHover
  className,
  ariaLabel,
}) {
  if (!points?.length) return null;

  const pad = typeof padding === 'number'
    ? { left: padding, right: padding, top: padding, bottom: padding }
    : padding;
  const plotW = width  - pad.left - pad.right;
  const plotH = height - pad.top  - pad.bottom;

  const single = points.length === 1;
  const vals = points.map(p => p.value);

  let minV, maxV;
  if (yDomain === 'auto') {
    minV = Math.min(...vals);
    maxV = Math.max(...vals);
  } else {
    const dPad = yDomain.pad ?? 0;
    minV = Math.max(yDomain.min, Math.min(...vals) - dPad);
    maxV = Math.min(yDomain.max, Math.max(...vals) + dPad);
  }
  const range = maxV - minV || 1;

  const toX = (i) => single ? width / 2 : pad.left + (i / (points.length - 1)) * plotW;
  const toY = (v) => {
    if (single) return height / 2;
    const t = (v - minV) / range; // 0 at min, 1 at max
    return pad.top + (invertY ? t : 1 - t) * plotH;
  };

  const last = points.length - 1;
  const linePoints = points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ');
  const areaPoints = single ? '' : [
    `${toX(0)},${pad.top + plotH}`,
    ...points.map((p, i) => `${toX(i)},${toY(p.value)}`),
    `${toX(last)},${pad.top + plotH}`,
  ].join(' ');

  const refY = referenceValue != null ? toY(referenceValue) : null;
  const refVisible = refY != null && refY >= pad.top && refY <= pad.top + plotH;

  function handleMouseMove(e) {
    if (!onHover) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (width / rect.width);
    let best = 0, bestDist = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(toX(i) - mx);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    if (bestDist < plotW / points.length) onHover(points[best], best);
    else onHover(null, null);
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label={ariaLabel}
      style={{ display: 'block', overflow: 'visible', cursor: onHover ? 'crosshair' : undefined }}
      onMouseMove={onHover ? handleMouseMove : undefined}
      onMouseLeave={onHover ? () => onHover(null, null) : undefined}
    >
      {refVisible && (
        <line x1={pad.left} y1={refY} x2={width - pad.right} y2={refY}
          stroke="var(--text-dim)" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
      )}

      {!single && <polygon points={areaPoints} fill={color} opacity="0.08" />}
      {!single && (
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
      )}

      {showAxisLabels && (
        <>
          <text x={pad.left - 3} y={pad.top + 4} fontSize="9" fill="var(--text-dim)" textAnchor="end">
            {formatAxisLabel(maxV)}
          </text>
          {refVisible && (
            <text x={pad.left - 3} y={refY + 3} fontSize="9" fill="var(--text-dim)" textAnchor="end">
              {formatAxisLabel(referenceValue)}
            </text>
          )}
          <text x={pad.left - 3} y={pad.top + plotH + 4} fontSize="9" fill="var(--text-dim)" textAnchor="end">
            {formatAxisLabel(minV)}
          </text>
        </>
      )}

      {showEndpoints && (
        <>
          <circle cx={toX(last)} cy={toY(points[last].value)} r="4" fill={color} />
          <text x={toX(last)} y={toY(points[last].value) - 5} fontSize="11" fill={color}
            textAnchor="middle" fontWeight="700">
            {formatEndpointLabel(points[last].value)}
          </text>
          {!single && (
            <>
              <circle cx={toX(0)} cy={toY(points[0].value)} r="3" fill={color} opacity="0.5" />
              <text x={toX(0)} y={toY(points[0].value) - 5} fontSize="10" fill="var(--text-dim)" textAnchor="middle">
                {formatEndpointLabel(points[0].value)}
              </text>
            </>
          )}
        </>
      )}

      {hoverIndex != null && points[hoverIndex] && (
        <circle cx={toX(hoverIndex)} cy={toY(points[hoverIndex].value)} r="4"
          fill={color} stroke="var(--bg)" strokeWidth="2" />
      )}
    </svg>
  );
}
