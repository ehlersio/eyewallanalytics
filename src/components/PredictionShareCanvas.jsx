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
import { capture } from '../utils/analytics';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from './ShareButtons';
import './PredictionCanvas.css';

// ── Share canvas (off-screen, 1080×1080) ─────────────────────
function PredictionCanvas({
  canvasRef, carModelPct, predCarScore, predOppScore,
  carGpg, oppGpg, carGag, oppGag, carWin, oppWin, carPP, oppPK,
  factors, odds, oppAbbr, oppColor, isPlayoff, seriesEntry, aiNarrative, carLines,
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
          <img src={logoUrl(TEAM_CONFIG.abbr)} alt={TEAM_CONFIG.abbr} className="pred-canvas-team-logo"
            onError={e=>{e.target.style.display='none';}} />
          <div className="pred-canvas-team-abbr car">{TEAM_CONFIG.abbr}</div>
        </div>

        <div className="pred-canvas-center">
          {seriesEntry && (
            <div className="pred-canvas-series">
              Series: <span style={{color:'var(--team-canvas)'}}>{seriesEntry.carWins}</span>
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
            <span style={{color:'var(--team-canvas)'}}>{TEAM_CONFIG.abbr}</span>
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
            <span style={{color:'var(--team-canvas)'}}>{TEAM_CONFIG.abbr} {predCarScore}</span>
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
              <span>{f.carEdge ? TEAM_CONFIG.abbr : oppAbbr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Line 1 */}
      {carLines?.lines?.[0] && (() => {
        const line = carLines.lines[0];
        const xgf  = line.xgfPct;
        const good = xgf != null && xgf >= 50;
        const POS_LABEL = { L: 'LW', LW: 'LW', C: 'C', R: 'RW', RW: 'RW' };
        return (
          <div className="pred-canvas-line1">
            <div className="pred-canvas-line1-header">
              <span className="pred-canvas-line1-label">{TEAM_CONFIG.abbr} Line 1 · 5v5</span>
              {xgf != null && (
                <span className={`pred-canvas-line1-xgf ${good ? 'good' : 'bad'}`}>
                  {xgf.toFixed(1)}% xGF
                </span>
              )}
              {line.toiMins != null && (
                <span className="pred-canvas-line1-toi">{line.toiMins}m together</span>
              )}
            </div>
            <div className="pred-canvas-line1-players">
              {line.players.map((p, i) => (
                <span key={i} className="pred-canvas-line1-player">
                  <span className="pred-canvas-line1-pos">{POS_LABEL[p.pos] || p.pos}</span>
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Odds */}
      {odds && (
        <div className="pred-canvas-odds">
          <div className="pred-canvas-odds-item">
            <span className="pred-canvas-odds-team car">{TEAM_CONFIG.abbr}</span>
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
        <span>{TEAM_CONFIG.hashtags?.[0] || `#${TEAM_CONFIG.abbr}`}</span>
      </div>
    </div>
  );
}

// ── Public export component — renders canvas + export button ──
export default function PredictionExportSection({
  carModelPct, predCarScore, predOppScore,
  carGpg, oppGpg, carGag, oppGag, carWin, oppWin, carPP, oppPK,
  factors, odds, oppAbbr, oppColor, isPlayoff, seriesEntry, gameId, carLines,
}) {
  const canvasRef = useRef(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [aiNarrative, setAiNarrative] = useState(null);

  // DB-first: fetch pre-generated prediction narrative, fall back to Worker cache.
  useEffect(() => {
    if (!gameId) return;
    const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://mqgasjzywoibdgxjjkux.supabase.co';
    const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || 'sb_publishable_e_zwr1UA7GnHq4OuQSas5Q_kO8bQ_Ct';
    fetch(
      `${SUPABASE_URL}/rest/v1/game_predictions?game_id=eq.${gameId}&select=prediction_text&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
    )
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        if (rows?.[0]?.prediction_text) { setAiNarrative(rows[0].prediction_text); return; }
        const workerUrl = import.meta.env.VITE_WORKER_URL;
        if (!workerUrl) return;
        fetch(`${workerUrl}/cache/${encodeURIComponent(`prediction:${gameId}`)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.narrative) setAiNarrative(d.narrative); })
          .catch(() => {});
      })
      .catch(() => {});
  }, [gameId]);

  const xCaption = (carGpg != null && predCarScore != null) ? [
    `${TEAM_CONFIG.abbr} ${predCarScore}–${predOppScore} ${oppAbbr} — EyeWall Prediction`,
    `Win probability: ${TEAM_CONFIG.abbr} ${carModelPct}% · ${oppAbbr} ${100 - carModelPct}%`,
    aiNarrative || '',
    `#${TEAM_CONFIG.abbr} #EyeWallAnalytics`,
  ].filter(Boolean).join('\n') : '';

  const { saving, sharing, handleSave, handleShareX, handleNativeShare, canNativeShare } =
    useShareCard({
      canvasRef,
      filename: `EyeWall-Prediction-${TEAM_CONFIG.abbr}-vs-${oppAbbr}.png`,
      xCaption,
      mountCanvas: async () => {
        if (!canvasMounted) {
          setCanvasMounted(true);
          await new Promise(r => setTimeout(r, 120));
        }
      },
    });

  if (carGpg == null || oppGpg == null || predCarScore == null) return null;
  const handleSaveWithCapture = async () => {
    await handleSave();
    capture('prediction_card_exported', {
      opponent: oppAbbr,
      carPct:   carModelPct,
      hasOdds:  !!odds,
      hasAI:    !!aiNarrative,
    });
  };

  return (
    <>
      <ShareButtons
        onSave={handleSaveWithCapture}
        onShareX={handleShareX}
        onNativeShare={handleNativeShare}
        canNativeShare={canNativeShare}
        saving={saving}
        sharing={sharing}
        className="md-export-row"
      />
      {canvasMounted && (
        <PredictionCanvas
          canvasRef={canvasRef}
          carModelPct={carModelPct} predCarScore={predCarScore} predOppScore={predOppScore}
          carGpg={carGpg} oppGpg={oppGpg} carGag={carGag} oppGag={oppGag}
          carWin={carWin} oppWin={oppWin} carPP={carPP} oppPK={oppPK}
          factors={factors} odds={odds} oppAbbr={oppAbbr} oppColor={oppColor}
          isPlayoff={isPlayoff} seriesEntry={seriesEntry} aiNarrative={aiNarrative}
          carLines={carLines}
        />
      )}
    </>
  );
}
