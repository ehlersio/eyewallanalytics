import { useState, useMemo, useRef, useEffect } from 'react';
import { useWindowWidth } from '../hooks/useFetch';
import { TEAM_CONFIG } from '../utils/teamConfig';
import './IceRink.css';

// ─── Constants ───────────────────────────────────────────────
// NHL ice: 200ft x 85ft. Origin (0,0) = center ice.
// x: -100 (left goal) → +100 (right goal)
// y: -42.5 (bottom boards) → +42.5 (top boards)
const W  = 600;
const H  = 255;
const CX = W / 2;
const CY = H / 2;

// Convert NHL ice coords → SVG pixel coords
function toSvg(x, y) {
  return {
    px: CX + (x / 100) * (W / 2),
    py: CY - (y / 42.5) * (H / 2),
  };
}

// Distance from goal mouth (right goal at x=89, y=0)
function distFromGoal(x, y) {
  const dx = Math.abs(x) - 89;
  const dy = y;
  return Math.sqrt(dx * dx + dy * dy).toFixed(1);
}

// Zone label from coordinates
function zoneLabel(x) {
  if (Math.abs(x) > 64) return 'Slot';
  if (Math.abs(x) > 25) return 'Neutral zone';
  return 'Defensive zone';
}

// Shot type display labels
const TYPE_LABELS = {
  'goal':         'Goal',
  'shot-on-goal': 'Shot on goal',
  'missed-shot':  'Missed shot',
  'blocked-shot': 'Blocked shot',
};

// Shot type → dot style (fill is set dynamically in renderShot for the team side)
const SHOT_STYLE = {
  'goal':         { r: 7,  stroke: '#333',   strokeWidth: 2,   opacity: 1    },
  'shot-on-goal': { r: 5,  stroke: 'none',   strokeWidth: 0,   opacity: 0.65 },
  'missed-shot':  { r: 4,  stroke: 'none',   strokeWidth: 0,   opacity: 0.32 },
  'blocked-shot': { r: 4,  fill: '#8899aa',  stroke: 'none',   strokeWidth: 0,   opacity: 0.45 },
};
const OPP_SHOT_STYLE = {
  'goal':         { r: 7,  fill: '#4477ee', stroke: '#333',   strokeWidth: 2,   opacity: 1    },
  'shot-on-goal': { r: 5,  fill: '#4477ee', stroke: 'none',   strokeWidth: 0,   opacity: 0.55 },
  'missed-shot':  { r: 4,  fill: '#4477ee', stroke: 'none',   strokeWidth: 0,   opacity: 0.28 },
  'blocked-shot': { r: 4,  fill: '#8899aa', stroke: 'none',   strokeWidth: 0,   opacity: 0.40 },
};

// ─── Main component ───────────────────────────────────────────
export default function IceRink({ events = [], _roster = {}, hidePlayerFilter = false, readOnly = false, flipPerspective = false }) {
  const [halfRink,    setHalfRink]    = useState(false);
  const [period,      setPeriod]      = useState('all');
  const [viewMode,    setViewMode]    = useState('dots'); // 'dots' | 'heat'
  const [heatTeam,    setHeatTeam]    = useState('both'); // 'car' | 'opp' | 'both'
  const [selectedPlayer, setSelectedPlayer] = useState(null); // playerId string or null = all
  const [filterOpen,    setFilterOpen]    = useState(false);
  const filterRef = useRef(null);
  const [hovered,     setHovered]     = useState(null);   // { event, svgX, svgY, screenX, screenY }
  const [selected,    setSelected]    = useState(null);   // full event object for popup
  const [zoom,        setZoom]        = useState(1);
  const [pan,         setPan]         = useState({ x: 0, y: 0 });
  const [isPanning,   setIsPanning]   = useState(false);
  const panStart      = useRef(null);
  const svgRef        = useRef(null);
  const wrapRef       = useRef(null);
  const width         = useWindowWidth();

  // Close player filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const close = e => { if (!filterRef.current?.contains(e.target)) setFilterOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [filterOpen]);
  const isMobile      = width < 600;
  const showHalf      = isMobile || halfRink;

  const MAX_ZOOM = 5;
  const MIN_ZOOM = 1;

  // Names are now embedded directly in each event via extractShotEvents+buildPlayerMap
  // roster prop kept for future use but name lookup is no longer needed here
  const playerNames = {};

  // Derive which OT periods actually have events — only show those buttons
  const otPeriods = useMemo(() => {
    const seen = new Set(events.map(e => e.period).filter(p => p >= 4));
    return [...seen].sort((a, b) => a - b); // [4, 5, 6, ...]
  }, [events]);

  // Filter events by selected period
  // period state is 'all' | '1' | '2' | '3' | 'ot4' | 'ot5' | ...
  const filtered = useMemo(() => {
    if (period === 'all') return events;
    if (period.startsWith('ot')) {
      const p = parseInt(period.slice(2));  // 'ot4' -> 4
      return events.filter(e => e.period === p);
    }
    return events.filter(e => e.period === parseInt(period));
  }, [events, period]);

  // Label for an OT period number: 4 -> 'OT', 5 -> 'OT2', 6 -> 'OT3', etc.
  // (NHL playoffs: first OT is just "OT", subsequent ones are OT2, OT3...)
  function otLabel(periodNum) {
    return periodNum === 4 ? 'OT' : `OT${periodNum - 3}`;
  }

  // Normalize event coords so CAR always attacks right (positive x).
  // When flipPerspective=true (e.g. PK mini-rink), OPP attacks right instead,
  // so the half-rink shows the OPP offensive zone (CAR's defensive zone).
  function normalizeCoords(e) {
    let x = e.x, y = e.y;
    if (!flipPerspective) {
      if (e.isCanes  && x < 0) { x = -x; y = -y; }
      if (!e.isCanes && x > 0) { x = -x; y = -y; }
    } else {
      // Flip: OPP attacks right, CAR attacks left
      if (!e.isCanes && x < 0) { x = -x; y = -y; }
      if (e.isCanes  && x > 0) { x = -x; y = -y; }
    }
    return { x, y };
  }

  // ── Zoom helpers ──
  function clampZoom(z) { return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)); }

  function zoomToward(delta, cx, cy) {
    setZoom(prev => {
      const next = clampZoom(prev + delta);
      // Adjust pan so the point under cursor stays fixed
      const scale = next / prev;
      setPan(p => ({
        x: cx - scale * (cx - p.x),
        y: cy - scale * (cy - p.y),
      }));
      return next;
    });
  }

  // Reset zoom/pan
  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // Scroll-to-zoom on desktop
  function handleWheel(e) {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    zoomToward(e.deltaY < 0 ? 0.25 : -0.25, cx, cy);
  }

  // Mouse pan
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }
  function handleMouseMove(e) {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }
  function handleMouseUp() { setIsPanning(false); }

  // Touch pinch-zoom
  const lastTouch = useRef(null);
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouch.current = { dist: Math.sqrt(dx*dx + dy*dy), zoom };
    } else if (e.touches.length === 1) {
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    }
  }
  function handleTouchMove(e) {
    if (e.touches.length === 2 && lastTouch.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const scale = dist / lastTouch.current.dist;
      setZoom(clampZoom(lastTouch.current.zoom * scale));
    } else if (e.touches.length === 1 && isPanning) {
      setPan({ x: e.touches[0].clientX - panStart.current.x, y: e.touches[0].clientY - panStart.current.y });
    }
  }
  function handleTouchEnd() {
    setIsPanning(false);
    lastTouch.current = null;
  }

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoom, pan]);

  // ── Render a single shot dot ──
  function renderShot(e, isCanes, index) {
    const { x, y } = normalizeCoords(e);
    if (showHalf && x < 0) return null;

    const { px, py } = toSvg(x, y);
    const styles = isCanes ? SHOT_STYLE : OPP_SHOT_STYLE;
    const s = styles[e.type] || styles['shot-on-goal'];
    // For the team's own shots, use the CSS variable for team primary color.
    // SVG fill can't read CSS vars directly, so we use currentColor trick via a
    // data attribute on the SVG, or just read the computed value at render time.
    // Simplest reliable approach: inline style with the CSS variable string —
    // modern browsers resolve CSS vars in SVG fill when set via style attribute.
    const teamFill = isCanes && !s.fill ? 'var(--team-primary)' : s.fill;
    const isHov = hovered?.event?.id === e.id;
    const isSel = selected?.id === e.id;

    return (
      <circle
        key={`${e.id}-${index}`}
        cx={px}
        cy={py}
        r={!readOnly && (isHov || isSel) ? s.r * 1.6 : s.r}
        fill={teamFill}
        stroke={!readOnly && isSel ? '#fff' : !readOnly && isHov ? 'rgba(255,255,255,0.6)' : s.stroke}
        strokeWidth={!readOnly && isSel ? 2.5 : !readOnly && isHov ? 1.5 : s.strokeWidth}
        opacity={!readOnly && (isHov || isSel) ? 1 : s.opacity}
        style={{ cursor: readOnly ? 'default' : 'pointer', transition: 'r 0.1s, opacity 0.1s' }}
        onMouseEnter={readOnly ? undefined : ev => {
          setHovered({ event: e, screenX: ev.clientX, screenY: ev.clientY });
        }}
        onMouseLeave={readOnly ? undefined : () => setHovered(null)}
        onClick={readOnly ? undefined : ev => {
          ev.stopPropagation();
          setSelected(prev => prev?.id === e.id ? null : e);
          setHovered(null);
        }}
      />
    );
  }

  const viewBox = showHalf ? `${CX} 0 ${W/2} ${H}` : `0 0 ${W} ${H}`;
  const canesEvents = filtered.filter(e =>
    e.isCanes && (selectedPlayer === null || String(e.shooterId) === selectedPlayer)
  );
  const oppEvents    = filtered.filter(e => !e.isCanes);
  // Unique CAR shooters for player filter chips
  const carShooters  = useMemo(() => {
    const seen = new Set();
    return filtered
      .filter(e => e.isCanes && e.shooterId && !seen.has(e.shooterId) && seen.add(e.shooterId))
      .map(e => ({ id: String(e.shooterId), name: e.shooterName || `#${e.shooterId}` }));
  }, [filtered]);

  return (
    <div className="ice-rink-wrap" ref={wrapRef}>

      {/* Toolbar */}
      {!readOnly && (
      <div className="rink-toolbar">
        <div className="rink-filters">
          {/* Regular periods always shown */}
          {['all','1','2','3'].map(p => (
            <button key={p} className={`rink-btn ${period === p ? 'on' : ''}`}
              onClick={() => { setPeriod(p); setSelectedPlayer(null); }}>
              {p === 'all' ? 'All' : `P${p}`}
            </button>
          ))}
          {/* OT periods — only rendered if that period has events */}
          {otPeriods.map(p => (
            <button key={`ot${p}`} className={`rink-btn ot-btn ${period === `ot${p}` ? 'on' : ''}`}
              onClick={() => setPeriod(`ot${p}`)}>
              {otLabel(p)}
            </button>
          ))}
        </div>
        <div className="rink-right-controls">
          {/* Player filter popover */}
          {carShooters.length > 0 && !hidePlayerFilter && (
            <div className="rink-filter-wrap" ref={filterRef}>
              <button
                className={`rink-btn rink-filter-btn${selectedPlayer ? ' on' : ''}`}
                onClick={() => setFilterOpen(o => !o)}
                aria-expanded={filterOpen}
              >
                {selectedPlayer
                  ? <>{carShooters.find(s => s.id === selectedPlayer)?.name.split(' ').pop() || 'Player'} <span className="rink-filter-clear" onClick={e => { e.stopPropagation(); setSelectedPlayer(null); setFilterOpen(false); }}>✕</span></>
                  : <>Player ▾</>
                }
              </button>
              {filterOpen && (
                <div className="rink-filter-dropdown" role="listbox">
                  <button
                    className={`rink-filter-option${selectedPlayer === null ? ' active' : ''}`}
                    onClick={() => { setSelectedPlayer(null); setFilterOpen(false); }}
                    role="option"
                  >All players</button>
                  {carShooters.map(s => (
                    <button
                      key={s.id}
                      className={`rink-filter-option${selectedPlayer === s.id ? ' active' : ''}`}
                      onClick={() => { setSelectedPlayer(s.id); setFilterOpen(false); }}
                      role="option"
                    >
                      <span className="rink-filter-name">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            className={`rink-btn ${viewMode === 'heat' ? 'on heat-on' : ''}`}
            onClick={() => setViewMode(m => m === 'dots' ? 'heat' : 'dots')}
          >
            {viewMode === 'heat' ? '🔥 Heat' : '🔥 Heat'}
          </button>
          {!isMobile && (
            <button className="rink-btn rink-toggle" onClick={() => setHalfRink(h => !h)}>
              {showHalf ? 'Full rink' : 'Half rink'}
            </button>
          )}
        </div>
      </div>
      )}

      {/* Zoom controls */}
      {!readOnly && (
      <div className="zoom-bar">
        <button className="zoom-btn" onClick={() => zoomToward(-0.5, 0, 0)} disabled={zoom <= MIN_ZOOM}>−</button>
        <div className="zoom-track">
          <div className="zoom-fill" style={{ width: `${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%` }} />
        </div>
        <button className="zoom-btn" onClick={() => zoomToward(0.5, 0, 0)} disabled={zoom >= MAX_ZOOM}>+</button>
        {(zoom > 1 || pan.x !== 0 || pan.y !== 0) && (
          <button className="zoom-reset" onClick={resetView}>Reset</button>
        )}
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
      </div>
      )}

      {/* Heat team selector — only in heat mode */}
      {!readOnly && viewMode === 'heat' && (
        <div className="heat-controls">
          <span className="heat-label">Show:</span>
          {[['car',`${TEAM_CONFIG.abbr} shots`],['opp','Opp shots'],['both','Both']].map(([val, lbl]) => (
            <button
              key={val}
              className={`rink-btn ${heatTeam === val ? 'on' : ''}`}
              onClick={() => setHeatTeam(val)}
            >{lbl}</button>
          ))}
          <span className="heat-scale">
            <span className="heat-scale-low">Low</span>
            <span className="heat-scale-bar" />
            <span className="heat-scale-high">High</span>
          </span>
        </div>
      )}

      {/* Legend — only in dots mode, not readOnly */}
      {!readOnly && viewMode === 'dots' && (
        <div className="rink-legend">
          <div className="legend-item"><span className="leg-dot" style={{background:'var(--team-primary)',opacity:0.65}} />{TEAM_CONFIG.abbr} shot</div>
          <div className="legend-item"><span className="leg-dot leg-goal" style={{background:'var(--team-primary)'}} />{TEAM_CONFIG.abbr} goal</div>
          <div className="legend-item"><span className="leg-dot" style={{background:'#4477ee',opacity:0.55}} />Opp shot</div>
          <div className="legend-item"><span className="leg-dot leg-goal" style={{background:'#4477ee'}} />Opp goal</div>
          <div className="legend-item"><span className="leg-dot" style={{background:'#8899aa',opacity:0.45}} />Blocked</div>
        </div>
      )}

      {/* SVG rink */}
      <div
        className="rink-svg-container"
        style={{ cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => setSelected(null)}
      >
        <svg
          ref={svgRef}
          className="rink-svg"
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'top left',
            transition: isPanning ? 'none' : 'transform 0.1s ease',
          }}
        >
          <RinkMarkings showHalf={showHalf} flipPerspective={flipPerspective} />
          {viewMode === 'heat' && (
            <HeatmapLayer
              canesEvents={canesEvents}
              oppEvents={oppEvents}
              heatTeam={heatTeam}
              showHalf={showHalf}
              flipPerspective={flipPerspective}
              W={W} H={H} CX={CX} CY={CY}
            />
          )}
          {viewMode === 'dots' && (
            <>
              {oppEvents.map((e, i)   => renderShot(e, false, i))}
              {canesEvents.map((e, i) => renderShot(e, true,  i))}
            </>
          )}
          {/* Always show goals on top even in heat mode */}
          {viewMode === 'heat' && (
            <>
              {oppEvents.filter(e => e.type === 'goal').map((e, i)   => renderShot(e, false, i))}
              {canesEvents.filter(e => e.type === 'goal').map((e, i) => renderShot(e, true,  i))}
            </>
          )}
        </svg>
      </div>

      {/* Hover tooltip — dots mode, plus goals in heat mode */}
      {!readOnly && (viewMode === 'dots' || (viewMode === 'heat' && hovered?.event?.type === 'goal')) && hovered && !selected && (
        <HoverTooltip event={hovered.event} screenX={hovered.screenX} screenY={hovered.screenY} playerNames={playerNames} wrapRef={wrapRef} />
      )}

      {/* Click popup — dots mode + goals in heat mode */}
      {!readOnly && (viewMode === 'dots' || viewMode === 'heat') && selected && (
        <ShotPopup event={selected} playerNames={playerNames} onClose={() => setSelected(null)} />
      )}

      {events.length === 0 && (
        <div className="rink-empty">Shot data appears here during and after games.</div>
      )}
    </div>
  );
}

// ─── Heatmap layer ───────────────────────────────────────────
// Renders a kernel density estimation as a canvas-based image inside the SVG.
// Uses a 2D Gaussian kernel. Works entirely in-browser, no extra libraries.
function HeatmapLayer({ canesEvents, oppEvents, heatTeam, showHalf, flipPerspective = false, W, H, CX, CY }) {
  const dataUrl = useMemo(() => {
    // Pick which events to render
    let pts = [];
    if (heatTeam === 'car' || heatTeam === 'both') {
      pts = pts.concat(canesEvents.map(e => ({ x: e.x, y: e.y, isCanes: true })));
    }
    if (heatTeam === 'opp' || heatTeam === 'both') {
      pts = pts.concat(oppEvents.map(e => ({ x: e.x, y: e.y, isCanes: false })));
    }
    if (!pts.length) return null;

    // Canvas size: half-rink on mobile (W/2 × H), full rink otherwise
    const cw = showHalf ? W / 2 : W;
    const ch = H;
    const canvas = document.createElement('canvas');
    canvas.width  = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // Build a density grid using Gaussian kernel
    const BANDWIDTH = 28; // px — controls blur radius; higher = smoother
    const grid = new Float32Array(cw * ch);

    pts.forEach(({ x, y, isCanes }) => {
      // Normalize coords: respect flipPerspective same as normalizeCoords()
      let nx = x, ny = y;
      if (!flipPerspective) {
        if (isCanes  && nx < 0) { nx = -nx; ny = -ny; }
        if (!isCanes && nx > 0) { nx = -nx; ny = -ny; }
      } else {
        if (!isCanes && nx < 0) { nx = -nx; ny = -ny; }
        if (isCanes  && nx > 0) { nx = -nx; ny = -ny; }
      }
      if (showHalf && nx < 0) return; // outside half-rink view

      // When showing half-rink, offset x from 0 (not CX) since canvas is W/2 wide
      const px = showHalf
        ? ((nx / 100) * (W / 2))           // 0-based for half-rink canvas
        : (CX + (nx / 100) * (W / 2));     // CX-based for full rink canvas
      const py = CY - (ny / 42.5) * (H / 2);

      // Paint Gaussian kernel onto grid
      const r = Math.ceil(BANDWIDTH * 2.5);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const gx = Math.round(px) + dx;
          const gy = Math.round(py) + dy;
          if (gx < 0 || gx >= cw || gy < 0 || gy >= ch) continue;
          const dist2 = dx * dx + dy * dy;
          const val   = Math.exp(-dist2 / (2 * BANDWIDTH * BANDWIDTH));
          grid[gy * cw + gx] += val;
        }
      }
    });

    // Find max value for normalisation
    let maxVal = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] > maxVal) maxVal = grid[i];
    if (maxVal === 0) return null;

    // Write RGBA pixels using a hot colour scale
    // Low → transparent, mid → amber, high → red
    const imageData = ctx.createImageData(cw, ch);
    const d = imageData.data;

    // Apply power curve to density values to increase contrast:
    // squash low values further, punch up high values
    const powered = new Float32Array(grid.length);
    for (let i = 0; i < grid.length; i++) {
      powered[i] = Math.pow(grid[i] / maxVal, 0.55); // < 1 = boost mid/high contrast
    }

    for (let i = 0; i < powered.length; i++) {
      const t = powered[i]; // 0..1 after power curve
      if (t < 0.08) continue; // skip very low density — reduces noise on white rink

      // Colour ramp designed for a white/light background:
      // uses semi-opaque dark colours that are visible on white
      // Low → deep blue, mid → gold/orange, high → bright red
      let r2, g, b, a;
      if (t < 0.3) {
        const s = t / 0.3;
        // Deep indigo → dark blue
        r2 = Math.round(20  + 20  * s);
        g  = Math.round(20  + 60  * s);
        b  = Math.round(160 + 40  * s);
        a  = Math.round(160 + 80  * s);
      } else if (t < 0.6) {
        const s = (t - 0.3) / 0.3;
        // Blue → orange/gold
        r2 = Math.round(40  + 215 * s);
        g  = Math.round(80  + 80  * s);
        b  = Math.round(200 - 200 * s);
        a  = Math.round(230 + 15  * s);
      } else if (t < 0.85) {
        const s = (t - 0.6) / 0.25;
        // Orange → deep red
        r2 = 255;
        g  = Math.round(160 - 140 * s);
        b  = 0;
        a  = 245;
      } else {
        const s = (t - 0.85) / 0.15;
        // Deep red → near-black red for peak zones
        r2 = Math.round(255 - 50  * s);
        g  = Math.round(20  - 20  * s);
        b  = 0;
        a  = 255;
      }
      const base = i * 4;
      d[base]     = r2;
      d[base + 1] = g;
      d[base + 2] = b;
      d[base + 3] = Math.min(255, a);
    }

    ctx.putImageData(imageData, 0, 0);

    // Smooth the pixelated grid with a blur pass
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width  = cw;
    blurCanvas.height = ch;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.filter = `blur(${Math.round(BANDWIDTH * 0.55)}px)`;
    blurCtx.drawImage(canvas, 0, 0);

    return blurCanvas.toDataURL('image/png');
  }, [canesEvents, oppEvents, heatTeam, showHalf, flipPerspective]);

  if (!dataUrl) return null;

  return (
    <image
      href={dataUrl}
      x={showHalf ? CX : 0}
      y={0}
      width={showHalf ? W / 2 : W}
      height={H}
      opacity={0.88}
      preserveAspectRatio="none"
    />
  );
}

// ─── Hover tooltip ────────────────────────────────────────────
function HoverTooltip({ event: e, screenX, screenY, _playerNames, wrapRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const tip  = ref.current?.getBoundingClientRect();
    if (!wrap || !tip) return;

    let left = screenX - wrap.left + 12;
    let top  = screenY - wrap.top  - tip.height / 2;

    // Keep inside wrap
    if (left + tip.width  > wrap.width  - 8) left = screenX - wrap.left - tip.width - 12;
    if (top  < 4)                             top  = 4;
    if (top  + tip.height > wrap.height - 4)  top  = wrap.height - tip.height - 4;

    setPos({ top, left });
  }, [screenX, screenY]);

  const dist   = distFromGoal(e.x, e.y);
  const isGoal = e.type === 'goal';

  return (
    <div ref={ref} className="hover-tip" style={{ top: pos.top, left: pos.left }}>
      <div className={`tip-type tip-${e.isCanes ? 'car' : 'opp'}`}>
        {isGoal ? '🚨 ' : ''}{TYPE_LABELS[e.type] || e.type}
      </div>
      {e.shooterName && <div className="tip-row"><span className="tip-label">{isGoal ? 'Scorer' : 'Shooter'}</span><span className="tip-val">{e.shooterName}</span></div>}
      {isGoal && e.assist1Name && <div className="tip-row"><span className="tip-label">Assist</span><span className="tip-val">{e.assist1Name}{e.assist2Name ? `, ${e.assist2Name}` : ''}</span></div>}
      <div className="tip-row">
        <span className="tip-label">Period</span>
        <span className="tip-val">
          {e.period <= 3 ? `P${e.period}` : e.period === 4 ? 'OT' : `OT${e.period - 3}`} · {e.timeInPeriod}
        </span>
      </div>
      <div className="tip-row"><span className="tip-label">Distance</span><span className="tip-val">{dist} ft</span></div>
      {e.shotType && <div className="tip-row"><span className="tip-label">Type</span><span className="tip-val">{e.shotType}</span></div>}
      {e.shotSpeed && <div className="tip-row"><span className="tip-label">Speed</span><span className="tip-val tip-speed">{e.shotSpeed} mph</span></div>}
      <div className="tip-footer">Click for full details</div>
    </div>
  );
}

// ─── Click popup ─────────────────────────────────────────────
function ShotPopup({ event: e, _playerNames, onClose }) {
  const shooterName = e.shooterName || (e.isCanes ? `Unknown ${TEAM_CONFIG.abbr}` : 'Unknown');
  const goalieName  = e.goalieName  || null;
  const blockerName = e.blockerName || null;
  const assists = [e.assist1Name, e.assist2Name].filter(Boolean);

  const dist     = distFromGoal(e.x, e.y);
  const angle    = Math.abs(Math.atan2(Math.abs(e.y), Math.abs(Math.abs(e.x) - 89)) * (180 / Math.PI)).toFixed(1);
  const zone     = zoneLabel(e.x);
  const isGoal   = e.type === 'goal';
  const isCanes  = e.isCanes;

  // Danger zone classification
  let danger = 'Low danger';
  const distNum = parseFloat(dist);
  if (distNum < 15)                           danger = '🔴 High danger';
  else if (distNum < 30 && parseFloat(angle) > 20) danger = '🟡 Medium danger';
  else if (distNum < 25)                      danger = '🟡 Medium danger';

  return (
    <div className="shot-popup-backdrop" onClick={onClose}>
      <div className="shot-popup" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={`popup-header ${isGoal ? 'popup-goal' : ''} ${isCanes ? 'popup-car' : 'popup-opp'}`}>
          <div className="popup-type-row">
            <span className="popup-type-icon">{isGoal ? '🚨' : e.type === 'blocked-shot' ? '🛡' : e.type === 'missed-shot' ? '↗' : '🏒'}</span>
            <span className="popup-type-label">{TYPE_LABELS[e.type] || e.type}</span>
            <span className="popup-team-badge">{isCanes ? TEAM_CONFIG.abbr : 'OPP'}</span>
          </div>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>

        <div className="popup-body">
          {/* Time */}
          <div className="popup-section">
            <div className="popup-section-label">When</div>
            <div className="popup-row">
              <span className="popup-field">Period</span>
              <span className="popup-value">{
                e.period <= 3
                  ? `Period ${e.period}`
                  : e.period === 4 ? 'Overtime'
                  : `OT${e.period - 3}`
              }</span>
            </div>
            <div className="popup-row">
              <span className="popup-field">Time</span>
              <span className="popup-value">{e.timeInPeriod}</span>
            </div>
          </div>

          {/* Players */}
          <div className="popup-section">
            <div className="popup-section-label">Players</div>
            <div className="popup-row">
              <span className="popup-field">{isGoal ? 'Goal scorer' : e.type === 'blocked-shot' ? 'Shot by' : 'Shot by'}</span>
              <span className="popup-value popup-name">{shooterName}</span>
            </div>
            {isGoal && assists.length > 0 && (
              <div className="popup-row">
                <span className="popup-field">Assists</span>
                <span className="popup-value popup-name">{assists.join(', ')}</span>
              </div>
            )}
            {blockerName && (
              <div className="popup-row">
                <span className="popup-field">Blocked by</span>
                <span className="popup-value popup-name">{blockerName}</span>
              </div>
            )}
            {goalieName && (
              <div className="popup-row">
                <span className="popup-field">Goalie</span>
                <span className="popup-value popup-name">{goalieName}</span>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="popup-section">
            <div className="popup-section-label">Location</div>
            <div className="popup-row">
              <span className="popup-field">Distance</span>
              <span className="popup-value">{dist} ft from goal</span>
            </div>
            <div className="popup-row">
              <span className="popup-field">Angle</span>
              <span className="popup-value">{angle}°</span>
            </div>
            <div className="popup-row">
              <span className="popup-field">Zone</span>
              <span className="popup-value">{zone}</span>
            </div>

          </div>

          {/* Shot details */}
          <div className="popup-section">
            <div className="popup-section-label">Shot details</div>
            {e.shotType && (
              <div className="popup-row">
                <span className="popup-field">Shot type</span>
                <span className="popup-value">{e.shotType}</span>
              </div>
            )}
            {e.shotSpeed != null && (
              <div className="popup-row">
                <span className="popup-field">Shot speed</span>
                <span className="popup-value popup-speed">{e.shotSpeed} mph</span>
              </div>
            )}
            {e.shotSpeed == null && (
              <div className="popup-row">
                <span className="popup-field">Shot speed</span>
                <span className="popup-value" style={{color:'var(--text-dim)',fontSize:11}}>Not tracked</span>
              </div>
            )}
            <div className="popup-row">
              <span className="popup-field">Danger</span>
              <span className="popup-value">{danger}</span>
            </div>
            {e.zoneCode && (
              <div className="popup-row">
                <span className="popup-field">Zone code</span>
                <span className="popup-value">{e.zoneCode === 'O' ? 'Offensive' : e.zoneCode === 'D' ? 'Defensive' : 'Neutral'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rink markings SVG ────────────────────────────────────────
function RinkMarkings({ showHalf, flipPerspective = false }) {
  return (
    <g>
            {/* ── Rink surface ── */}
      <rect width={W} height={H} rx={28} ry={28} fill="#d6eaf5" stroke="#9ab8cc" strokeWidth="1.5"/>

      {/* ── Center line (red) ── */}
      <line x1={CX} y1="0" x2={CX} y2={H} stroke="#cc2200" strokeWidth="3" opacity="0.5"/>

      {/* ── Blue lines (75px = 25ft from center) ── */}
      <line x1={CX-75} y1="0" x2={CX-75} y2={H} stroke="#2255aa" strokeWidth="3" opacity="0.55"/>
      <line x1={CX+75} y1="0" x2={CX+75} y2={H} stroke="#2255aa" strokeWidth="3" opacity="0.55"/>

      {/* ── Goal lines (33px = 11ft from end boards) ── */}
      <line x1="33" y1="10" x2="33" y2={H-10} stroke="#cc2200" strokeWidth="1.5" opacity="0.6"/>
      <line x1={W-33} y1="10" x2={W-33} y2={H-10} stroke="#cc2200" strokeWidth="1.5" opacity="0.6"/>

      {/* ── Goal creases (6ft deep=18px, 4ft each side=12px) ── */}
      <path d={`M 33 ${CY-12} L 51 ${CY-12} A 18 18 0 0 1 51 ${CY+12} L 33 ${CY+12}`}
        fill="rgba(68,119,238,0.15)" stroke="#2255aa" strokeWidth="1"/>
      <path d={`M ${W-33} ${CY-12} L ${W-51} ${CY-12} A 18 18 0 0 0 ${W-51} ${CY+12} L ${W-33} ${CY+12}`}
        fill="rgba(204,34,0,0.12)" stroke="#cc2200" strokeWidth="1"/>

      {/* ── Goal frames (6ft wide=18px, 4ft deep=12px) ── */}
      <rect x="21" y={CY-9} width="12" height="18" fill="none" stroke="#2255aa" strokeWidth="1.5"/>
      <rect x={W-33} y={CY-9} width="12" height="18" fill="none" stroke="#cc2200" strokeWidth="1.5"/>

      {/* ── Center face-off circle (15ft radius = 45px) ── */}
      <circle cx={CX} cy={CY} r="45" fill="none" stroke="#9ab8cc" strokeWidth="1.2" opacity="0.7"/>
      <circle cx={CX} cy={CY} r="3" fill="#cc2200"/>

      {/* ── Zone face-off circles (15ft radius=45px, 20ft from goal line=60px, 22ft from boards=66px) ── */}
      {/* Left zone (OPP) — cx=33+60=93, cy=CY±(127.5-66)=CY±61.5≈CY±62 */}
      <circle cx="93" cy={CY-62} r="3" fill="#cc3333"/>
      <circle cx="93" cy={CY+62} r="3" fill="#cc3333"/>
      <circle cx="93" cy={CY-62} r="45" fill="none" stroke="#cc3333" strokeWidth="1" opacity="0.4"/>
      <circle cx="93" cy={CY+62} r="45" fill="none" stroke="#cc3333" strokeWidth="1" opacity="0.4"/>

      {/* Right zone (CAR) */}
      <circle cx={W-93} cy={CY-62} r="3" fill="#cc3333"/>
      <circle cx={W-93} cy={CY+62} r="3" fill="#cc3333"/>
      <circle cx={W-93} cy={CY-62} r="45" fill="none" stroke="#cc3333" strokeWidth="1" opacity="0.4"/>
      <circle cx={W-93} cy={CY+62} r="45" fill="none" stroke="#cc3333" strokeWidth="1" opacity="0.4"/>

      {/* ── Neutral zone face-off dots (5ft inside blue lines = 15px, 22ft from boards = 66px from boards = CY±62) ── */}
      <circle cx={CX-75+15} cy={CY-62} r="3" fill="#cc3333" opacity="0.7"/>
      <circle cx={CX-75+15} cy={CY+62} r="3" fill="#cc3333" opacity="0.7"/>
      <circle cx={CX+75-15} cy={CY-62} r="3" fill="#cc3333" opacity="0.7"/>
      <circle cx={CX+75-15} cy={CY+62} r="3" fill="#cc3333" opacity="0.7"/>

      {/* ── Zone labels ── */}
      {!showHalf && (
        <>
          <text x="22"   y="18" fontSize="9" fill="#2255aa" opacity="0.6" fontFamily="sans-serif">OPP offensive zone</text>
          <text x={W-108} y="18" fontSize="9" fill="var(--team-primary)" opacity="0.7" fontFamily="sans-serif">{TEAM_CONFIG.abbr} offensive zone</text>
        </>
      )}
      {showHalf && (
        <text x={CX+10} y="18" fontSize="9" fill={flipPerspective ? '#2255aa' : 'var(--team-primary)'} opacity="0.8" fontFamily="sans-serif">
          {flipPerspective ? 'OPP offensive zone' : `${TEAM_CONFIG.abbr} offensive zone`}
        </text>
      )}
    </g>
  );
}
