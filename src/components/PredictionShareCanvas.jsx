// ── PredictionShareCanvas.jsx ─────────────────────────────────
// 1080×1080 export card for the Prediction tab.
// Import this in ScheduleView.jsx and render at the bottom of MatchupDetail.
//
// Usage in MatchupDetail:
//   import PredictionShareCanvas from '../components/PredictionShareCanvas';
//   const predCanvasRef = useRef(null);
//   // Inside JSX, after md-factors closing div, before </>)}:
//   <PredictionExportSection ... />

import { useRef, useState, useEffect } from 'react';
import './PredictionCanvas.css';

const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ── Share canvas (off-screen, 1080×1080) ─────────────────────
function PredictionCanvas({
  canvasRef, carModelPct, predCarScore, predOppScore,
  carGpg, oppGpg, carGag, oppGag, carWin, oppWin, carPP, oppPK,
  factors, odds, oppAbbr, oppColor, isPlayoff, seriesEntry, aiNarrative,
}) {
  // Don't render until all required numeric props are available
  if (carGpg == null || oppGpg == null || carGag == null || oppGag == null ||
      carWin == null || oppWin == null || carPP == null || oppPK == null ||
      predCarScore == null || predOppScore == null) {
    return <div className="pred-canvas" ref={canvasRef} />;
  }

  const logoUrl = (abbr) => `/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`;
  const projTotal = +(predCarScore + predOppScore).toFixed(1);

  return (
    <div className="pred-canvas" ref={canvasRef}>

      {/* Header */}
      <div className="pred-canvas-header">
        <img src="/eyewall-logo.svg" alt="EyeWall" className="pred-canvas-logo"
          onError={e => { e.target.style.display='none'; }} />
        <span className="pred-canvas-badge">
          {isPlayoff ? 'Playoff ' : ''}Prediction
        </span>
      </div>

      {/* Teams + win probability */}
      <div className="pred-canvas-matchup">
        <div className="pred-canvas-team">
          <img src={logoUrl('CAR')} alt="CAR" className="pred-canvas-team-logo"
            onError={e=>{e.target.style.display='none';}} />
          <div className="pred-canvas-team-abbr car">CAR</div>
        </div>

        <div className="pred-canvas-center">
          {seriesEntry && (
            <div className="pred-canvas-series">
              Series: <span style={{color:'#ce1126'}}>{seriesEntry.carWins}</span>
              {' – '}
              <span style={{color: oppColor}}>{seriesEntry.oppWins}</span>
            </div>
          )}
          <div className="pred-canvas-bar">
            <div className="pred-canvas-bar-car" style={{width:`${carModelPct}%`}}>
              {carModelPct >= 20 && <span>{carModelPct}%</span>}
            </div>
            <div className="pred-canvas-bar-opp" style={{width:`${100-carModelPct}%`}}>
              {(100-carModelPct) >= 20 && <span>{100-carModelPct}%</span>}
            </div>
          </div>
          <div className="pred-canvas-bar-labels">
            <span style={{color:'#ce1126'}}>CAR</span>
            <span style={{color: oppColor}}>{oppAbbr}</span>
          </div>
        </div>

        <div className="pred-canvas-team">
          <img src={logoUrl(oppAbbr)} alt={oppAbbr} className="pred-canvas-team-logo"
            onError={e=>{e.target.style.display='none';}} />
          <div className="pred-canvas-team-abbr" style={{color: oppColor}}>{oppAbbr}</div>
        </div>
      </div>

      {/* Predicted score + total */}
      <div className="pred-canvas-score-row">
        <div className="pred-canvas-score">
          <div className="pred-canvas-score-label">Projected Score</div>
          <div className="pred-canvas-score-val">
            <span style={{color:'#ce1126'}}>CAR {predCarScore}</span>
            <span style={{color:'rgba(255,255,255,0.2)'}}> – </span>
            <span style={{color: oppColor}}>{predOppScore} {oppAbbr}</span>
          </div>
        </div>
        <div className="pred-canvas-total">
          <div className="pred-canvas-score-label">Projected Total</div>
          <div className="pred-canvas-total-val">{projTotal}</div>
          {odds?.total && (
            <div className="pred-canvas-ou-line">
              O/U line: {odds.total}
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis — between score and stats */}
      {aiNarrative && (
        <div className="pred-canvas-ai">
          <div className="pred-canvas-ai-label">⚡ EyeWall AI</div>
          <div className="pred-canvas-ai-text">{aiNarrative}</div>
        </div>
      )}
      <div className="pred-canvas-stats">
        {[
          { label: 'Goals For/GP',     carVal: carGpg.toFixed(2),  oppVal: oppGpg.toFixed(2),  carBetter: carGpg >= oppGpg },
          { label: 'Goals Against/GP', carVal: carGag.toFixed(2),  oppVal: oppGag.toFixed(2),  carBetter: carGag <= oppGag },
          { label: 'Win Rate',         carVal: `${(carWin*100).toFixed(0)}%`, oppVal: `${(oppWin*100).toFixed(0)}%`, carBetter: carWin >= oppWin },
          { label: 'PP% vs PK%',       carVal: `${carPP.toFixed(1)}%`, oppVal: `${oppPK.toFixed(1)}%`, carBetter: carPP >= (100-oppPK) },
        ].map((row, i) => (
          <div key={i} className="pred-canvas-stat-row">
            <span className={`pred-canvas-stat-val ${row.carBetter ? 'good' : 'muted'}`}>
              {row.carVal}
            </span>
            <span className="pred-canvas-stat-label">{row.label}</span>
            <span className={`pred-canvas-stat-val ${!row.carBetter ? 'good-opp' : 'muted'}`}>
              {row.oppVal}
            </span>
          </div>
        ))}
      </div>

      {/* Edge factors — compact two-column */}
      <div className="pred-canvas-factors">
        <div className="pred-canvas-factors-label">Edge Analysis</div>
        <div className="pred-canvas-factors-grid">
          {factors.slice(0, 6).map((f, i) => (
            <div key={i} className={`pred-canvas-factor ${f.carEdge ? 'car' : 'opp'}`}>
              <span>{f.carEdge ? '✓' : '✗'}</span>
              <span>{f.label}</span>
              <span>{f.carEdge ? 'CAR' : oppAbbr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Odds */}
      {odds && (
        <div className="pred-canvas-odds">
          <div className="pred-canvas-odds-item">
            <span className="pred-canvas-odds-team car">CAR</span>
            <span className="pred-canvas-odds-val">{odds.carOdds > 0 ? `+${odds.carOdds}` : odds.carOdds}</span>
          </div>
          <div className="pred-canvas-odds-book">{odds.book}</div>
          <div className="pred-canvas-odds-item">
            <span className="pred-canvas-odds-team" style={{color: oppColor}}>{oppAbbr}</span>
            <span className="pred-canvas-odds-val">{odds.oppOdds > 0 ? `+${odds.oppOdds}` : odds.oppOdds}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pred-canvas-footer">
        <span>eyewallanalytics.com</span>
        <span>#LetsGoCanes</span>
      </div>
    </div>
  );
}

// ── Public export component — renders canvas + export button ──
export default function PredictionExportSection({
  carModelPct, predCarScore, predOppScore,
  carGpg, oppGpg, carGag, oppGag, carWin, oppWin, carPP, oppPK,
  factors, odds, oppAbbr, oppColor, isPlayoff, seriesEntry, gameId,
}) {
  const canvasRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [aiNarrative, setAiNarrative] = useState(null);

  // Load cached AI narrative from Worker — same cache-first fetch as PredictionAnalysis
  useEffect(() => {
    if (!gameId) return;
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    if (!workerUrl) return;
    fetch(`${workerUrl}/cache/${encodeURIComponent(`prediction:${gameId}`)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.narrative) setAiNarrative(d.narrative); })
      .catch(() => {});
  }, [gameId]);

  // Don't render until standings-derived props are available
  if (carGpg == null || oppGpg == null || predCarScore == null) return null;

  const handleExport = async () => {
    setExporting(true);
    // Mount the canvas if not already mounted, wait a frame for React to render it
    if (!canvasMounted) {
      setCanvasMounted(true);
      await new Promise(r => setTimeout(r, 100));
    }
    try {
      const { toPng } = await import('html-to-image');
      const node = canvasRef.current;
      if (!node) return;
      const dataUrl = await toPng(node, {
        width: 1080, height: 1080, skipFonts: true,
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        style: { position: 'static', left: '0', top: '0' },
      });
      const link = document.createElement('a');
      link.download = `EyeWall-Prediction-CAR-vs-${oppAbbr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Prediction export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button className="md-export-btn" onClick={handleExport} disabled={exporting}>
        {exporting ? '⏳ Saving…' : '📸 Save Prediction Card'}
      </button>
      {canvasMounted && (
        <PredictionCanvas
          canvasRef={canvasRef}
          carModelPct={carModelPct} predCarScore={predCarScore} predOppScore={predOppScore}
          carGpg={carGpg} oppGpg={oppGpg} carGag={carGag} oppGag={oppGag}
          carWin={carWin} oppWin={oppWin} carPP={carPP} oppPK={oppPK}
          factors={factors} odds={odds} oppAbbr={oppAbbr} oppColor={oppColor}
          isPlayoff={isPlayoff} seriesEntry={seriesEntry} aiNarrative={aiNarrative}
        />
      )}
    </>
  );
}
