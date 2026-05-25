import { useEffect, useRef, useMemo } from 'react';
import './PlayerHeatMap.css';

// Rink dimensions (same as IceRink.jsx)
const W = 600, H = 255, CX = W / 2, CY = H / 2;

/**
 * PlayerHeatMap — renders shot locations for one player on a half-rink SVG.
 *
 * Props:
 *   events   — array of shot events from extractShotEvents(pbp)
 *              each: { x, y, shotType, result, isCanes, shooterId }
 *   playerId — filter to this player (null = show all)
 *   playerName — display name
 *   teamColor — accent color for shots
 *   showAll  — if true, show all CAR shots regardless of playerId
 */
export default function PlayerHeatMap({ events = [], playerId, playerName, teamColor = 'var(--red-bright)', showAll = false }) {
  const canvasRef = useRef(null);

  // Filter to just this player's shots (or all if showAll)
  const shots = useMemo(() => {
    const carEvents = events.filter(e => e.isCanes);
    if (showAll || !playerId) return carEvents;
    return carEvents.filter(e => String(e.shooterId) === String(playerId));
  }, [events, playerId, showAll]);

  // Draw heatmap on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || shots.length === 0) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const BANDWIDTH = 20;

    // Build density grid
    const grid = new Float32Array(cw * ch);
    shots.forEach(({ x, y }) => {
      // Normalize: CAR always attacks to the right
      let nx = Math.abs(x), ny = y;
      if (x < 0) ny = -y;

      // Map to canvas coords (half-rink: 0..W/2 × 0..H)
      const px = Math.round((nx / 100) * (W / 2));
      const py = Math.round(CY - (ny / 42.5) * (H / 2));

      if (px < 0 || px >= cw || py < 0 || py >= ch) return;

      for (let dy = -BANDWIDTH * 2; dy <= BANDWIDTH * 2; dy++) {
        for (let dx = -BANDWIDTH * 2; dx <= BANDWIDTH * 2; dx++) {
          const gx = px + dx, gy = py + dy;
          if (gx < 0 || gx >= cw || gy < 0 || gy >= ch) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > BANDWIDTH) continue;
          grid[gy * cw + gx] += Math.exp(-(dist * dist) / (2 * BANDWIDTH * BANDWIDTH / 4));
        }
      }
    });

    // Normalize
    const max = Math.max(...grid) || 1;
    const imgData = ctx.createImageData(cw, ch);
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i] / max;
      if (v < 0.04) continue;
      const alpha = Math.round(v * 200);
      const r = v > 0.6 ? 255 : Math.round(v / 0.6 * 200 + 55);
      const g = v > 0.5 ? Math.round((1 - v) / 0.5 * 200) : 200;
      const b = v < 0.3 ? 255 : Math.round((1 - v) * 255);
      imgData.data[i * 4]     = r;
      imgData.data[i * 4 + 1] = g;
      imgData.data[i * 4 + 2] = b;
      imgData.data[i * 4 + 3] = alpha;
    }
    ctx.putImageData(imgData, 0, 0);
  }, [shots]);

  const goals  = shots.filter(s => s.result === 'goal').length;
  const onGoal = shots.filter(s => ['goal', 'shot-on-goal'].includes(s.result)).length;
  const total  = shots.length;

  return (
    <div className="phm-wrap">
      {/* Header */}
      <div className="phm-header">
        {playerName && (
          <span className="phm-player-name" style={{ color: teamColor }}>{playerName}</span>
        )}
        <div className="phm-stats">
          <span className="phm-stat"><span className="phm-stat-val">{goals}</span><span className="phm-stat-label">G</span></span>
          <span className="phm-stat"><span className="phm-stat-val">{onGoal}</span><span className="phm-stat-label">SOG</span></span>
          <span className="phm-stat"><span className="phm-stat-val">{total}</span><span className="phm-stat-label">ATT</span></span>
        </div>
      </div>

      {/* Rink SVG with canvas overlay */}
      <div className="phm-rink-wrap">
        <svg
          viewBox={`${CX} 0 ${W / 2} ${H}`}
          className="phm-rink-svg"
          aria-label="Player shot heat map"
        >
          {/* Half-rink markings */}
          <rect x={CX} y={0} width={W / 2} height={H} fill="#0a1520" />
          {/* Boards */}
          <rect x={CX} y={2} width={W/2 - 2} height={H - 4}
            fill="none" stroke="#3a5068" strokeWidth="2" rx="8" />
          {/* Goal crease */}
          <ellipse cx={W - 15} cy={CY} rx={18} ry={22}
            fill="rgba(100,150,220,0.15)" stroke="#4477cc" strokeWidth="1" />
          {/* Goal line */}
          <line x1={W - 20} y1={CY - 18} x2={W - 20} y2={CY + 18}
            stroke="#cc2200" strokeWidth="1.5" />
          {/* Face-off circles */}
          <circle cx={W/4 * 3} cy={CY - 58} r={18}
            fill="none" stroke="#3a5068" strokeWidth="1" />
          <circle cx={W/4 * 3} cy={CY + 58} r={18}
            fill="none" stroke="#3a5068" strokeWidth="1" />
          {/* Danger zones */}
          <rect x={CX} y={CY - 58} width={90} height={116}
            fill="rgba(255,68,34,0.04)" stroke="none" />

          {/* Heatmap canvas as foreignObject */}
          <foreignObject x={CX} y={0} width={W / 2} height={H}>
            <canvas
              ref={canvasRef}
              width={W / 2}
              height={H}
              style={{ width: '100%', height: '100%' }}
            />
          </foreignObject>

          {/* Individual shot dots */}
          {shots.map((s, i) => {
            let nx = Math.abs(s.x), ny = s.y;
            if (s.x < 0) ny = -s.y;
            const px = CX + (nx / 100) * (W / 2);
            const py = CY - (ny / 42.5) * (H / 2);
            const isGoal = s.result === 'goal';
            return (
              <circle key={i} cx={px} cy={py}
                r={isGoal ? 4 : 2.5}
                fill={isGoal ? '#ffdd00' : teamColor}
                fillOpacity={isGoal ? 0.9 : 0.6}
                stroke={isGoal ? '#fff' : 'none'}
                strokeWidth={isGoal ? 1 : 0}
              />
            );
          })}
        </svg>

        {shots.length === 0 && (
          <div className="phm-empty">No shot data for this game</div>
        )}
      </div>

      <div className="phm-legend">
        <span className="phm-legend-item">
          <span className="phm-dot goal" />Goal
        </span>
        <span className="phm-legend-item">
          <span className="phm-dot shot" />Shot
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 9, marginLeft: 'auto' }}>
          Heat = shot density
        </span>
      </div>
    </div>
  );
}
