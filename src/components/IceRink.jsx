import { useState, useMemo, useRef, useEffect } from 'react';
import { useWindowWidth } from '../hooks/useFetch';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { rinkBtnClasses } from '../utils/rinkBtnClasses';
// IceRink.css import removed (Phase 6) -- migrated to Tailwind. .rink-btn's
// shared style now lives in utils/rinkBtnClasses.js since 3 other files
// (SeasonChipRow.jsx, PWHLShotMapView.jsx, ShotMapView.jsx) also render it
// without importing this component's CSS themselves.

const ZOOM_BTN_CLASSES = 'zoom-btn w-6 h-6 rounded-full border-[0.5px] border-[color:var(--border-2)] bg-[var(--bg3)] text-[color:var(--text-muted)] text-[14px] leading-none flex items-center justify-center shrink-0 [transition:all_0.12s] disabled:opacity-30 disabled:cursor-default enabled:hover:bg-[var(--bg4)] enabled:hover:text-[color:var(--text)]';
const LEG_DOT_CLASSES = 'leg-dot w-2 h-2 rounded-full shrink-0';
const TIP_ROW_CLASSES = 'tip-row flex justify-between gap-2 text-[11px] py-0.5';
const POPUP_SECTION_LABEL_CLASSES = 'popup-section-label font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-dim)] mb-1.5 pb-1 border-b-[0.5px] border-b-[color:var(--border)]';
const POPUP_ROW_CLASSES = 'popup-row flex justify-between items-baseline gap-3 py-1 text-[13px]';

function popupHeaderClasses(isGoal, isCanes) {
  // .popup-header.popup-goal is declared after .popup-car/.popup-opp in the
  // original CSS -- same specificity, so a goal's green background always
  // wins over the team-color background regardless of which team scored.
  // Computed directly here rather than stacked, the same reasoning as every
  // other same-property Tailwind-stacking risk found this migration.
  const bg = isGoal ? 'bg-[rgba(61,186,126,0.08)]' : isCanes ? 'bg-[rgba(204,34,0,0.08)]' : 'bg-[rgba(34,68,170,0.08)]';
  return `popup-header ${isGoal ? 'popup-goal ' : ''}${isCanes ? 'popup-car' : 'popup-opp'} flex items-center justify-between py-3.5 px-4 border-b-[0.5px] border-b-[color:var(--border)] rounded-t-[var(--radius-lg)] ${bg}`;
}
function popupTeamBadgeClasses(isCanes) {
  // .popup-header.popup-car/.popup-opp .popup-team-badge -- descendant
  // selectors keyed off car/opp only, independent of popup-goal (no
  // .popup-goal .popup-team-badge rule exists).
  return isCanes
    ? 'popup-team-badge font-[family-name:var(--font-display)] text-[11px] font-bold py-0.5 px-2 rounded-[4px] bg-[var(--red-dim)] text-[color:var(--red-bright)]'
    : 'popup-team-badge font-[family-name:var(--font-display)] text-[11px] font-bold py-0.5 px-2 rounded-[4px] bg-[var(--blue-dim)] text-[color:var(--blue-bright)]';
}

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
function zoneLabel(x, y = 0) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  // Behind the net: x > 89 (goal line) — never the slot
  if (ax > 89) return 'Behind net';
  // Slot: in front of net, inside the faceoff dots
  // NHL: faceoff dots at x≈69, y≈±22; goal line at x=89
  // True slot = x 69–89, y within ±17 (tighter than dot width)
  if (ax > 69 && ay < 17) return 'Slot';
  // High slot: top of circles toward blue line, still central
  if (ax > 54 && ay < 17) return 'High slot';
  // Wider offensive zone areas (corners, half-wall)
  if (ax > 25) return 'Offensive zone';
  if (ax > 0)  return 'Neutral zone';
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
export default function IceRink({ events = [], _roster = {}, hidePlayerFilter = false, readOnly = false, flipPerspective = false, teamAbbr, teamColor }) {
  // Use teamAbbr/teamColor when provided (PWHL), fall back to NHL TEAM_CONFIG
  const displayAbbr  = teamAbbr  || TEAM_CONFIG.abbr;
  const displayColor = teamColor || 'var(--team-primary)';

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
      // Normal: our team attacks right (positive x), OPP attacks left (negative x)
      if (e.isCanes  && x < 0) { x = -x; y = -y; }
      if (!e.isCanes && x > 0) { x = -x; y = -y; }
    } else {
      // flipPerspective (PK view): OPP attacks left, show their shots on the LEFT.
      // Our team attacks right but we're showing OPP perspective.
      // OPP shots: keep negative x so they render on the LEFT side of the rink.
      // Our shots: flip to negative so they also appear on the right (our defensive zone).
      if (!e.isCanes && x > 0) { x = -x; y = -y; }  // ensure OPP stays on left
      if (e.isCanes  && x < 0) { x = -x; y = -y; }  // our shots stay on right
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
    const teamFill = isCanes && !s.fill ? displayColor : s.fill;
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
    <div className="ice-rink-wrap flex flex-col gap-2 relative" ref={wrapRef}>

      {/* Toolbar */}
      {!readOnly && (
      <div className="rink-toolbar flex items-center justify-between gap-2 flex-wrap">
        <div className="rink-filters flex gap-[5px] flex-wrap">
          {/* Regular periods always shown */}
          {['all','1','2','3'].map(p => (
            <button key={p} className={rinkBtnClasses({ active: period === p })}
              onClick={() => { setPeriod(p); setSelectedPlayer(null); }}>
              {p === 'all' ? 'All' : `P${p}`}
            </button>
          ))}
          {/* OT periods — only rendered if that period has events */}
          {otPeriods.map(p => (
            <button key={`ot${p}`} className={rinkBtnClasses({ active: period === `ot${p}`, variant: 'ot' })}
              onClick={() => setPeriod(`ot${p}`)}>
              {otLabel(p)}
            </button>
          ))}
        </div>
        <div className="rink-right-controls flex gap-[5px]">
          {/* Player filter popover */}
          {carShooters.length > 0 && !hidePlayerFilter && (
            <div className="rink-filter-wrap relative" ref={filterRef}>
              <button
                className={rinkBtnClasses({ active: !!selectedPlayer, variant: 'filter' })}
                onClick={() => setFilterOpen(o => !o)}
                aria-expanded={filterOpen}
              >
                {selectedPlayer
                  ? <>{carShooters.find(s => s.id === selectedPlayer)?.name.split(' ').pop() || 'Player'} <span className="rink-filter-clear text-[10px] opacity-70 py-0 px-px rounded-full hover:opacity-100" onClick={e => { e.stopPropagation(); setSelectedPlayer(null); setFilterOpen(false); }}>✕</span></>
                  : <>Player ▾</>
                }
              </button>
              {filterOpen && (
                <div className="rink-filter-dropdown absolute top-[calc(100%+4px)] right-0 z-[200] bg-[var(--bg1)] border-[0.5px] border-[color:var(--border-2)] rounded-[10px] shadow-[0_8px_28px_rgba(0,0,0,0.5)] min-w-[160px] max-h-[280px] overflow-y-auto p-1" role="listbox">
                  <button
                    className={`rink-filter-option flex items-center w-full bg-none border-none py-[7px] px-[10px] rounded-[7px] text-[12px] cursor-pointer text-left min-h-0 min-w-0 [transition:background_0.1s] ${selectedPlayer === null ? 'active bg-[rgba(204,34,0,0.15)] text-[color:var(--red-bright)] font-semibold' : 'text-[color:var(--text-muted)] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]'}`}
                    onClick={() => { setSelectedPlayer(null); setFilterOpen(false); }}
                    role="option"
                  >All players</button>
                  {carShooters.map(s => (
                    <button
                      key={s.id}
                      className={`rink-filter-option flex items-center w-full bg-none border-none py-[7px] px-[10px] rounded-[7px] text-[12px] cursor-pointer text-left min-h-0 min-w-0 [transition:background_0.1s] ${selectedPlayer === s.id ? 'active bg-[rgba(204,34,0,0.15)] text-[color:var(--red-bright)] font-semibold' : 'text-[color:var(--text-muted)] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]'}`}
                      onClick={() => { setSelectedPlayer(s.id); setFilterOpen(false); }}
                      role="option"
                    >
                      <span className="rink-filter-name flex-1">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            className={rinkBtnClasses({ active: viewMode === 'heat', variant: 'heat' })}
            onClick={() => setViewMode(m => m === 'dots' ? 'heat' : 'dots')}
          >
            {viewMode === 'heat' ? '🔥 Heat' : '🔥 Heat'}
          </button>
          {!isMobile && (
            <button className={rinkBtnClasses({ active: false })} onClick={() => setHalfRink(h => !h)}>
              {showHalf ? 'Full rink' : 'Half rink'}
            </button>
          )}
        </div>
      </div>
      )}

      {/* Zoom controls */}
      {!readOnly && (
      <div className="zoom-bar flex items-center gap-2">
        <button className={ZOOM_BTN_CLASSES} onClick={() => zoomToward(-0.5, 0, 0)} disabled={zoom <= MIN_ZOOM}>−</button>
        <div className="zoom-track flex-1 h-1 rounded-[2px] bg-[var(--bg4)] overflow-hidden max-w-[120px]">
          <div className="zoom-fill h-full bg-[var(--red)] rounded-[2px] [transition:width_0.15s]" style={{ width: `${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%` }} />
        </div>
        <button className={ZOOM_BTN_CLASSES} onClick={() => zoomToward(0.5, 0, 0)} disabled={zoom >= MAX_ZOOM}>+</button>
        {(zoom > 1 || pan.x !== 0 || pan.y !== 0) && (
          <button className="zoom-reset text-[10px] text-[color:var(--text-dim)] border-[0.5px] border-[color:var(--border)] rounded-[4px] py-0.5 px-[7px] bg-transparent [transition:color_0.12s] hover:text-[color:var(--text-muted)]" onClick={resetView}>Reset</button>
        )}
        <span className="zoom-label text-[10px] font-[family-name:var(--font-mono)] text-[color:var(--text-dim)] w-9 text-right">{Math.round(zoom * 100)}%</span>
      </div>
      )}

      {/* Heat team selector — only in heat mode */}
      {!readOnly && viewMode === 'heat' && (
        <div className="heat-controls flex items-center gap-1.5 flex-wrap">
          <span className="heat-label text-[11px] text-[color:var(--text-dim)] shrink-0">Show:</span>
          {[['car',`${displayAbbr} shots`],['opp','Opp shots'],['both','Both']].map(([val, lbl]) => (
            <button
              key={val}
              className={rinkBtnClasses({ active: heatTeam === val })}
              onClick={() => setHeatTeam(val)}
            >{lbl}</button>
          ))}
          <span className="heat-scale flex items-center gap-[5px] ml-auto text-[10px] text-[color:var(--text-dim)]">
            <span className="heat-scale-low text-[9px] text-[color:var(--text-dim)]">Low</span>
            <span className="heat-scale-bar w-[60px] h-1.5 rounded-[3px] bg-[linear-gradient(to_right,#0050c8,#ffb400,#ff6600,#ff0000)] shrink-0" />
            <span className="heat-scale-high text-[9px] text-[color:var(--text-dim)]">High</span>
          </span>
        </div>
      )}

      {/* Legend — only in dots mode, not readOnly */}
      {!readOnly && viewMode === 'dots' && (
        <div className="rink-legend flex gap-3 flex-wrap">
          <div className="legend-item flex items-center gap-[5px] text-[11px] text-[color:var(--text-muted)]"><span className={LEG_DOT_CLASSES} style={{background:displayColor,opacity:0.65}} />{displayAbbr} shot</div>
          <div className="legend-item flex items-center gap-[5px] text-[11px] text-[color:var(--text-muted)]"><span className={`${LEG_DOT_CLASSES} leg-goal shadow-[0_0_0_2px_#333,0_0_0_3px_rgba(255,255,255,0.4)]`} style={{background:displayColor}} />{displayAbbr} goal</div>
          <div className="legend-item flex items-center gap-[5px] text-[11px] text-[color:var(--text-muted)]"><span className={LEG_DOT_CLASSES} style={{background:'#4477ee',opacity:0.55}} />Opp shot</div>
          <div className="legend-item flex items-center gap-[5px] text-[11px] text-[color:var(--text-muted)]"><span className={`${LEG_DOT_CLASSES} leg-goal shadow-[0_0_0_2px_#333,0_0_0_3px_rgba(255,255,255,0.4)]`} style={{background:'#4477ee'}} />Opp goal</div>
          <div className="legend-item flex items-center gap-[5px] text-[11px] text-[color:var(--text-muted)]"><span className={LEG_DOT_CLASSES} style={{background:'#8899aa',opacity:0.45}} />Blocked</div>
        </div>
      )}

      {/* SVG rink */}
      <div
        className="rink-svg-container overflow-hidden rounded-[var(--radius-sm)] leading-none select-none"
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
          className="rink-svg w-full block"
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'top left',
            transition: isPanning ? 'none' : 'transform 0.1s ease',
          }}
        >
          <RinkMarkings showHalf={showHalf} flipPerspective={flipPerspective} teamAbbr={teamAbbr} teamColor={teamColor} />
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
        <ShotPopup event={selected} playerNames={playerNames} onClose={() => setSelected(null)} displayAbbr={displayAbbr} />
      )}

      {events.length === 0 && (
        <div className="rink-empty text-center py-5 text-[12px] text-[color:var(--text-dim)] italic">Shot data appears here during and after games.</div>
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
    <div ref={ref} className="hover-tip absolute pointer-events-none z-50 bg-[var(--bg1)] border-[0.5px] border-[color:var(--border-2)] rounded-[var(--radius-sm)] py-2 px-2.5 min-w-[160px] max-w-[210px] shadow-[0_4px_16px_rgba(0,0,0,0.4)] animate-[tip-in_0.1s_ease]" style={{ top: pos.top, left: pos.left }}>
      <div className={`tip-type text-[12px] font-semibold mb-1.5 pb-[5px] border-b-[0.5px] border-b-[color:var(--border)] ${e.isCanes ? 'tip-car text-[color:var(--red-bright)]' : 'tip-opp text-[color:var(--blue-bright)]'}`}>
        {isGoal ? '🚨 ' : ''}{TYPE_LABELS[e.type] || e.type}
      </div>
      {e.shooterName && <div className={TIP_ROW_CLASSES}><span className="tip-label text-[color:var(--text-dim)] shrink-0">{isGoal ? 'Scorer' : 'Shooter'}</span><span className="tip-val text-[color:var(--text)] text-right">{e.shooterName}</span></div>}
      {isGoal && e.assist1Name && <div className={TIP_ROW_CLASSES}><span className="tip-label text-[color:var(--text-dim)] shrink-0">Assist</span><span className="tip-val text-[color:var(--text)] text-right">{e.assist1Name}{e.assist2Name ? `, ${e.assist2Name}` : ''}</span></div>}
      <div className={TIP_ROW_CLASSES}>
        <span className="tip-label text-[color:var(--text-dim)] shrink-0">Period</span>
        <span className="tip-val text-[color:var(--text)] text-right">
          {e.period <= 3 ? `P${e.period}` : e.period === 4 ? 'OT' : `OT${e.period - 3}`} · {e.timeInPeriod}
        </span>
      </div>
      <div className={TIP_ROW_CLASSES}><span className="tip-label text-[color:var(--text-dim)] shrink-0">Distance</span><span className="tip-val text-[color:var(--text)] text-right">{dist} ft</span></div>
      {e.shotType && <div className={TIP_ROW_CLASSES}><span className="tip-label text-[color:var(--text-dim)] shrink-0">Type</span><span className="tip-val text-[color:var(--text)] text-right">{e.shotType}</span></div>}
      {e.shotSpeed && <div className={TIP_ROW_CLASSES}><span className="tip-label text-[color:var(--text-dim)] shrink-0">Speed</span><span className="tip-val tip-speed text-[color:var(--amber)] font-semibold font-[family-name:var(--font-mono)] text-right">{e.shotSpeed} mph</span></div>}
      <div className="tip-footer text-[10px] text-[color:var(--text-dim)] mt-1.5 pt-[5px] border-t-[0.5px] border-t-[color:var(--border)] text-center italic">Click for full details</div>
    </div>
  );
}

// ─── Click popup ─────────────────────────────────────────────
function ShotPopup({ event: e, _playerNames, onClose, displayAbbr }) {
  const shooterName = e.shooterName || (e.isCanes ? `Unknown ${displayAbbr || TEAM_CONFIG.abbr}` : 'Unknown');
  const goalieName  = e.goalieName  || null;
  const blockerName = e.blockerName || null;
  const assists = [e.assist1Name, e.assist2Name].filter(Boolean);

  const dist     = distFromGoal(e.x, e.y);
  const angle    = Math.abs(Math.atan2(Math.abs(e.y), Math.abs(Math.abs(e.x) - 89)) * (180 / Math.PI)).toFixed(1);
  const zone     = zoneLabel(e.x, e.y);
  const isGoal   = e.type === 'goal';
  const isCanes  = e.isCanes;

  // Danger zone classification
  let danger = 'Low danger';
  const distNum = parseFloat(dist);
  if (distNum < 15)                           danger = '🔴 High danger';
  else if (distNum < 30 && parseFloat(angle) > 20) danger = '🟡 Medium danger';
  else if (distNum < 25)                      danger = '🟡 Medium danger';

  return (
    <div className="shot-popup-backdrop fixed inset-0 z-[200] bg-[rgba(0,0,0,0.5)] flex items-center justify-center p-4 animate-[fade-in_0.15s_ease]" onClick={onClose}>
      <div className="shot-popup bg-[var(--bg1)] border-[0.5px] border-[color:var(--border-2)] rounded-[var(--radius-lg)] w-full max-w-[360px] max-h-[85vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-[pop-in_0.18s_cubic-bezier(0.34,1.56,0.64,1)]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={popupHeaderClasses(isGoal, isCanes)}>
          <div className="popup-type-row flex items-center gap-2">
            <span className="popup-type-icon text-[18px]">{isGoal ? '🚨' : e.type === 'blocked-shot' ? '🛡' : e.type === 'missed-shot' ? '↗' : '🏒'}</span>
            <span className="popup-type-label font-[family-name:var(--font-display)] text-[16px] font-bold text-[color:var(--text)]">{TYPE_LABELS[e.type] || e.type}</span>
            <span className={popupTeamBadgeClasses(isCanes)}>{isCanes ? displayAbbr : 'OPP'}</span>
          </div>
          <button className="popup-close w-7 h-7 rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center shrink-0 [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]" onClick={onClose}>✕</button>
        </div>

        <div className="popup-body py-0 px-4 pb-4">
          {/* Time */}
          <div className="popup-section mt-3.5">
            <div className={POPUP_SECTION_LABEL_CLASSES}>When</div>
            <div className={POPUP_ROW_CLASSES}>
              <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Period</span>
              <span className="popup-value text-[color:var(--text)] text-right">{
                e.period <= 3
                  ? `Period ${e.period}`
                  : e.period === 4 ? 'Overtime'
                  : `OT${e.period - 3}`
              }</span>
            </div>
            <div className={POPUP_ROW_CLASSES}>
              <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Time</span>
              <span className="popup-value text-[color:var(--text)] text-right">{e.timeInPeriod}</span>
            </div>
          </div>

          {/* Players */}
          <div className="popup-section mt-3.5">
            <div className={POPUP_SECTION_LABEL_CLASSES}>Players</div>
            <div className={POPUP_ROW_CLASSES}>
              <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">{isGoal ? 'Goal scorer' : e.type === 'blocked-shot' ? 'Shot by' : 'Shot by'}</span>
              <span className="popup-value popup-name text-[color:var(--text)] font-medium text-right">{shooterName}</span>
            </div>
            {isGoal && assists.length > 0 && (
              <div className={POPUP_ROW_CLASSES}>
                <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Assists</span>
                <span className="popup-value popup-name text-[color:var(--text)] font-medium text-right">{assists.join(', ')}</span>
              </div>
            )}
            {blockerName && (
              <div className={POPUP_ROW_CLASSES}>
                <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Blocked by</span>
                <span className="popup-value popup-name text-[color:var(--text)] font-medium text-right">{blockerName}</span>
              </div>
            )}
            {goalieName && (
              <div className={POPUP_ROW_CLASSES}>
                <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Goalie</span>
                <span className="popup-value popup-name text-[color:var(--text)] font-medium text-right">{goalieName}</span>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="popup-section mt-3.5">
            <div className={POPUP_SECTION_LABEL_CLASSES}>Location</div>
            <div className={POPUP_ROW_CLASSES}>
              <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Distance</span>
              <span className="popup-value text-[color:var(--text)] text-right">{dist} ft from goal</span>
            </div>
            <div className={POPUP_ROW_CLASSES}>
              <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Angle</span>
              <span className="popup-value text-[color:var(--text)] text-right">{angle}°</span>
            </div>
            <div className={POPUP_ROW_CLASSES}>
              <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Zone</span>
              <span className="popup-value text-[color:var(--text)] text-right">{zone}</span>
            </div>

          </div>

          {/* Shot details */}
          <div className="popup-section mt-3.5">
            <div className={POPUP_SECTION_LABEL_CLASSES}>Shot details</div>
            {e.shotType && (
              <div className={POPUP_ROW_CLASSES}>
                <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Shot type</span>
                <span className="popup-value text-[color:var(--text)] text-right">{e.shotType}</span>
              </div>
            )}
            {e.shotSpeed != null && (
              <div className={POPUP_ROW_CLASSES}>
                <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Shot speed</span>
                <span className="popup-value popup-speed text-[color:var(--amber)] font-semibold font-[family-name:var(--font-mono)] text-right">{e.shotSpeed} mph</span>
              </div>
            )}
            {e.shotSpeed == null && (
              <div className={POPUP_ROW_CLASSES}>
                <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Shot speed</span>
                <span className="popup-value text-right" style={{color:'var(--text-dim)',fontSize:11}}>Not tracked</span>
              </div>
            )}
            <div className={POPUP_ROW_CLASSES}>
              <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Danger</span>
              <span className="popup-value text-[color:var(--text)] text-right">{danger}</span>
            </div>
            {e.zoneCode && (
              <div className={POPUP_ROW_CLASSES}>
                <span className="popup-field text-[color:var(--text-muted)] shrink-0 text-[12px]">Zone code</span>
                <span className="popup-value text-[color:var(--text)] text-right">{e.zoneCode === 'O' ? 'Offensive' : e.zoneCode === 'D' ? 'Defensive' : 'Neutral'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rink markings SVG ────────────────────────────────────────
function RinkMarkings({ showHalf, flipPerspective = false, teamAbbr, teamColor }) {
  return (
    <g>
            {/* ── Rink surface (corner radius 28ft = 84px) ── */}
      <rect width={W} height={H} rx={84} ry={84} fill="#d6eaf5" stroke="#9ab8cc" strokeWidth="1.5"/>

      {/* ── Center line (red) ── */}
      <line x1={CX} y1="0" x2={CX} y2={H} stroke="#cc2200" strokeWidth="3" opacity="0.5"/>

      {/* ── Blue lines (75px = 25ft from center) ── */}
      <line x1={CX-75} y1="0" x2={CX-75} y2={H} stroke="#2255aa" strokeWidth="3" opacity="0.55"/>
      <line x1={CX+75} y1="0" x2={CX+75} y2={H} stroke="#2255aa" strokeWidth="3" opacity="0.55"/>

      {/* ── Goal lines (33px = 11ft from end boards; y-span clipped to where the
           84px-radius corner arc actually is at that x, not a fixed inset —
           full straight-edge length would poke out past the curved boards) ── */}
      <line x1="33" y1={CY-110.25} x2="33" y2={CY+110.25} stroke="#cc2200" strokeWidth="1.5" opacity="0.6"/>
      <line x1={W-33} y1={CY-110.25} x2={W-33} y2={CY+110.25} stroke="#cc2200" strokeWidth="1.5" opacity="0.6"/>

      {/* ── Goal creases (NHL: 8ft wide at the goal line = ±12px, straight sides run
           6ft-radius-minus-4ft-half-width = sqrt(6²-4²)=√20ft ≈ 13.42px deep before
           curving into the 6ft-radius (18px) arc capped at the goal line's midpoint) ── */}
      <path d={`M 33 ${CY-12} L 46.42 ${CY-12} A 18 18 0 0 1 46.42 ${CY+12} L 33 ${CY+12}`}
        fill="rgba(68,119,238,0.15)" stroke="#2255aa" strokeWidth="1"/>
      <path d={`M ${W-33} ${CY-12} L ${W-46.42} ${CY-12} A 18 18 0 0 0 ${W-46.42} ${CY+12} L ${W-33} ${CY+12}`}
        fill="rgba(204,34,0,0.12)" stroke="#cc2200" strokeWidth="1"/>

      {/* ── Goaltender's restricted area ("trapezoid"): 22ft wide at goal line (±33px),
           28ft wide at the boards (±42px), 11ft deep (goal line to boards) ── */}
      <line x1="33" y1={CY-33} x2="0" y2={CY-42} stroke="#cc2200" strokeWidth="1" opacity="0.5"/>
      <line x1="33" y1={CY+33} x2="0" y2={CY+42} stroke="#cc2200" strokeWidth="1" opacity="0.5"/>
      <line x1={W-33} y1={CY-33} x2={W} y2={CY-42} stroke="#cc2200" strokeWidth="1" opacity="0.5"/>
      <line x1={W-33} y1={CY+33} x2={W} y2={CY+42} stroke="#cc2200" strokeWidth="1" opacity="0.5"/>

      {/* ── Goal frames (6ft wide=18px, 4ft deep=12px) ── */}
      <rect x="21" y={CY-9} width="12" height="18" fill="none" stroke="#2255aa" strokeWidth="1.5"/>
      <rect x={W-33} y={CY-9} width="12" height="18" fill="none" stroke="#cc2200" strokeWidth="1.5"/>

      {/* ── Center face-off circle (15ft radius = 45px) ── */}
      <circle cx={CX} cy={CY} r="45" fill="none" stroke="#9ab8cc" strokeWidth="1.2" opacity="0.7"/>
      <circle cx={CX} cy={CY} r="3" fill="#cc2200"/>

      {/* ── Zone face-off circles (15ft radius=45px, 20ft from goal line=60px, 22ft from centerline=66px) ── */}
      {/* Left zone (OPP) — cx=33+60=93, cy=CY±66 */}
      <circle cx="93" cy={CY-66} r="3" fill="#cc3333"/>
      <circle cx="93" cy={CY+66} r="3" fill="#cc3333"/>
      <circle cx="93" cy={CY-66} r="45" fill="none" stroke="#cc3333" strokeWidth="1" opacity="0.4"/>
      <circle cx="93" cy={CY+66} r="45" fill="none" stroke="#cc3333" strokeWidth="1" opacity="0.4"/>

      {/* Right zone (CAR) */}
      <circle cx={W-93} cy={CY-66} r="3" fill="#cc3333"/>
      <circle cx={W-93} cy={CY+66} r="3" fill="#cc3333"/>
      <circle cx={W-93} cy={CY-66} r="45" fill="none" stroke="#cc3333" strokeWidth="1" opacity="0.4"/>
      <circle cx={W-93} cy={CY+66} r="45" fill="none" stroke="#cc3333" strokeWidth="1" opacity="0.4"/>

      {/* ── End-zone hash marks (2ft long, parallel to goal line, entirely OUTSIDE the
           circle — starting at the circle's own top/bottom tangent point (±15ft=45px
           from center) and extending 2ft further out, not straddling the boundary;
           pair spacing 5ft7in=16.75px) ── */}
      {[[93, CY-66], [93, CY+66], [W-93, CY-66], [W-93, CY+66]].map(([ccx, ccy], i) => (
        <g key={`hash-${i}`}>
          <line x1={ccx-8.375} y1={ccy-45} x2={ccx-8.375} y2={ccy-51} stroke="#cc3333" strokeWidth="1.25"/>
          <line x1={ccx+8.375} y1={ccy-45} x2={ccx+8.375} y2={ccy-51} stroke="#cc3333" strokeWidth="1.25"/>
          <line x1={ccx-8.375} y1={ccy+45} x2={ccx-8.375} y2={ccy+51} stroke="#cc3333" strokeWidth="1.25"/>
          <line x1={ccx+8.375} y1={ccy+45} x2={ccx+8.375} y2={ccy+51} stroke="#cc3333" strokeWidth="1.25"/>
        </g>
      ))}

      {/* ── Player restraint lines (4 "L"-shaped marks surrounding each end-zone face-off
           spot, 2in wide, 4ft × 3ft, corner at the spot's own edge (1ft=3px radius)
           extending outward in a pinwheel — players must keep skates within these) ── */}
      {[[93, CY-66], [93, CY+66], [W-93, CY-66], [W-93, CY+66]].map(([ccx, ccy], i) => (
        <g key={`restraint-${i}`} stroke="#cc3333" strokeWidth="1" fill="none">
          <path d={`M ${ccx+3} ${ccy-3} L ${ccx+15} ${ccy-3} M ${ccx+3} ${ccy-3} L ${ccx+3} ${ccy-12}`}/>
          <path d={`M ${ccx+3} ${ccy+3} L ${ccx+15} ${ccy+3} M ${ccx+3} ${ccy+3} L ${ccx+3} ${ccy+12}`}/>
          <path d={`M ${ccx-3} ${ccy+3} L ${ccx-15} ${ccy+3} M ${ccx-3} ${ccy+3} L ${ccx-3} ${ccy+12}`}/>
          <path d={`M ${ccx-3} ${ccy-3} L ${ccx-15} ${ccy-3} M ${ccx-3} ${ccy-3} L ${ccx-3} ${ccy-12}`}/>
        </g>
      ))}

      {/* ── Neutral zone face-off dots (5ft inside blue lines = 15px, 22ft from centerline = 66px) ── */}
      <circle cx={CX-75+15} cy={CY-66} r="3" fill="#cc3333" opacity="0.7"/>
      <circle cx={CX-75+15} cy={CY+66} r="3" fill="#cc3333" opacity="0.7"/>
      <circle cx={CX+75-15} cy={CY-66} r="3" fill="#cc3333" opacity="0.7"/>
      <circle cx={CX+75-15} cy={CY+66} r="3" fill="#cc3333" opacity="0.7"/>

      {/* ── Zone labels (centered between where the corner radius starts, 84px from
           each end, and that side's blue line — not pinned to the corner itself) ── */}
      {!showHalf && (
        <>
          <text x="154.5" y="18" textAnchor="middle" fontSize="9" fill="#2255aa" opacity="0.6" fontFamily="sans-serif">OPP offensive zone</text>
          <text x="445.5" y="18" textAnchor="middle" fontSize="9" fill={teamColor || "var(--team-primary)"} opacity="0.7" fontFamily="sans-serif">{teamAbbr || TEAM_CONFIG.abbr} offensive zone</text>
        </>
      )}
      {showHalf && (
        <text x="445.5" y="18" textAnchor="middle" fontSize="9" fill={flipPerspective ? '#2255aa' : 'var(--team-primary)'} opacity="0.8" fontFamily="sans-serif">
          {flipPerspective ? 'OPP offensive zone' : `${teamAbbr || TEAM_CONFIG.abbr} offensive zone`}
        </text>
      )}
    </g>
  );
}
