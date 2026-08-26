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
import { useTranslation } from 'react-i18next';
import { capture } from '../utils/analytics';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from './ShareButtons';
// PredictionCanvas.css import removed (Phase 6) -- migrated to Tailwind.
// Shell classes (.pred-canvas/-header/-logo/-badge/-ai*/-footer) live in
// utils/predCanvasClasses.js since LeagueView.jsx's PowerRankingsCanvas also
// renders them without importing this component's CSS itself.
import {
  PRED_CANVAS_CLASSES, PRED_CANVAS_HEADER_CLASSES, PRED_CANVAS_LOGO_CLASSES,
  PRED_CANVAS_BADGE_CLASSES, PRED_CANVAS_AI_CLASSES, PRED_CANVAS_AI_LABEL_CLASSES,
  PRED_CANVAS_AI_TEXT_CLASSES, PRED_CANVAS_FOOTER_CLASSES,
} from '../utils/predCanvasClasses';

const PRED_CANVAS_TEAM_CLASSES = 'pred-canvas-team flex flex-col items-center gap-1.5 shrink-0';
const PRED_CANVAS_TEAM_LOGO_CLASSES = 'pred-canvas-team-logo w-[52px] h-[52px] object-contain';
const PRED_CANVAS_STAT_VAL_BASE = 'pred-canvas-stat-val w-[72px] text-[20px] font-bold';

// .pred-canvas-stat-val:first-child/:last-child set text-align only, in the
// structural position sense -- since the JSX always renders exactly car
// first then opp last per row, applied directly rather than via a pseudo-
// class utility.
function predCanvasStatValClasses({ isCar, good }) {
  const align = isCar ? 'text-right' : 'text-left';
  if (!good) return `${PRED_CANVAS_STAT_VAL_BASE} muted ${align} text-[rgba(255,255,255,0.35)]`;
  return isCar
    ? `${PRED_CANVAS_STAT_VAL_BASE} good ${align} text-[#4ade80]`
    : `${PRED_CANVAS_STAT_VAL_BASE} good-opp ${align} text-[#fb923c]`;
}

// ── Share canvas (off-screen, 1080×1080) ─────────────────────
function PredictionCanvas({
  canvasRef, carModelPct, predCarScore, predOppScore,
  carGpg, oppGpg, carGag, oppGag, carWin, oppWin, carPP, oppPK,
  factors, odds, oppAbbr, oppColor, isPlayoff, seriesEntry, aiNarrative, carLines,
}) {
  const { t } = useTranslation();
  // Don't render until all required numeric props are available
  if (carGpg == null || oppGpg == null || carGag == null || oppGag == null ||
      carWin == null || oppWin == null || carPP == null || oppPK == null ||
      predCarScore == null || predOppScore == null) {
    return <div className={PRED_CANVAS_CLASSES} ref={canvasRef} />;
  }

  const logoUrl = (abbr) => `/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`;
  const projTotal = +(predCarScore + predOppScore).toFixed(1);

  return (
    <div className={PRED_CANVAS_CLASSES} ref={canvasRef}>

      {/* Header */}
      <div className={PRED_CANVAS_HEADER_CLASSES}>
        <img src="/eyewall-logo.svg" alt="EyeWall" className={PRED_CANVAS_LOGO_CLASSES}
          onError={e => { e.target.style.display='none'; }} />
        <span className={PRED_CANVAS_BADGE_CLASSES}>
          {isPlayoff ? t('predictionShareCanvas.badge.playoffPrediction') : t('pwhlGamePreview.prediction.sectionLabel')}
        </span>
      </div>

      {/* Teams + win probability */}
      <div className="pred-canvas-matchup flex items-center gap-5 px-[52px] pb-4 border-b-[0.5px] border-b-[rgba(255,255,255,0.07)]">
        <div className={PRED_CANVAS_TEAM_CLASSES}>
          <img src={logoUrl(TEAM_CONFIG.abbr)} alt={TEAM_CONFIG.abbr} className={PRED_CANVAS_TEAM_LOGO_CLASSES}
            onError={e=>{e.target.style.display='none';}} />
          <div className="pred-canvas-team-abbr car text-[19px] font-extrabold text-[color:var(--team-canvas)]">{TEAM_CONFIG.abbr}</div>
        </div>

        <div className="pred-canvas-center flex-1 flex flex-col gap-1.5">
          {seriesEntry && (
            <div className="pred-canvas-series text-[13px] text-[rgba(255,255,255,0.35)] text-center mb-0.5">
              {t('predictionShareCanvas.seriesLabel')}<span style={{color:'var(--team-canvas)'}}>{seriesEntry.carWins}</span>
              {' – '}
              <span style={{color: oppColor}}>{seriesEntry.oppWins}</span>
            </div>
          )}
          <div className="pred-canvas-bar flex h-7 rounded-[6px] overflow-hidden">
            <div className="pred-canvas-bar-car bg-[var(--team-canvas)] flex items-center justify-center text-[16px] font-bold [transition:width_0.4s]" style={{width:`${carModelPct}%`}}>
              {carModelPct >= 20 && <span>{carModelPct}%</span>}
            </div>
            <div className="pred-canvas-bar-opp bg-[#3a4559] flex items-center justify-center text-[16px] font-bold [transition:width_0.4s]" style={{width:`${100-carModelPct}%`}}>
              {(100-carModelPct) >= 20 && <span>{100-carModelPct}%</span>}
            </div>
          </div>
          <div className="pred-canvas-bar-labels flex justify-between text-[13px] text-[rgba(255,255,255,0.3)] px-0.5">
            <span style={{color:'var(--team-canvas)'}}>{TEAM_CONFIG.abbr}</span>
            <span style={{color: oppColor}}>{oppAbbr}</span>
          </div>
        </div>

        <div className={PRED_CANVAS_TEAM_CLASSES}>
          <img src={logoUrl(oppAbbr)} alt={oppAbbr} className={PRED_CANVAS_TEAM_LOGO_CLASSES}
            onError={e=>{e.target.style.display='none';}} />
          <div className="pred-canvas-team-abbr text-[19px] font-extrabold text-[rgba(255,255,255,0.6)]" style={{color: oppColor}}>{oppAbbr}</div>
        </div>
      </div>

      {/* Predicted score + total */}
      <div className="pred-canvas-score-row flex gap-5 py-3.5 px-[52px] border-b-[0.5px] border-b-[rgba(255,255,255,0.06)]">
        <div className="pred-canvas-score flex-1 flex flex-col items-center text-center">
          <div className="pred-canvas-score-label text-[12px] font-bold tracking-[0.1em] uppercase text-[rgba(255,255,255,0.25)] mb-1.5">{t('predictionShareCanvas.scoreLabel.projected')}</div>
          <div className="pred-canvas-score-val text-[26px] font-extrabold">
            <span style={{color:'var(--team-canvas)'}}>{TEAM_CONFIG.abbr} {predCarScore}</span>
            <span style={{color:'rgba(255,255,255,0.2)'}}> – </span>
            <span style={{color: oppColor}}>{predOppScore} {oppAbbr}</span>
          </div>
        </div>
        <div className="pred-canvas-total flex-1 flex flex-col items-center text-center">
          <div className="pred-canvas-score-label text-[12px] font-bold tracking-[0.1em] uppercase text-[rgba(255,255,255,0.25)] mb-1.5">{t('predictionShareCanvas.scoreLabel.projectedTotal')}</div>
          <div className="pred-canvas-total-val text-[43px] font-black text-[rgba(255,255,255,0.8)]">{projTotal}</div>
          {odds?.total && (
            <div className="pred-canvas-ou-line text-[14px] text-[rgba(255,255,255,0.35)] mt-0.5">
              {t('predictionShareCanvas.ouLine', { line: odds.total })}
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis — between score and stats */}
      {aiNarrative && (
        <div className={PRED_CANVAS_AI_CLASSES}>
          <div className={PRED_CANVAS_AI_LABEL_CLASSES}>{t('gameStatsPopup.summary.badge')}</div>
          <div className={PRED_CANVAS_AI_TEXT_CLASSES}>{aiNarrative}</div>
        </div>
      )}
      <div className="pred-canvas-stats py-3 px-[52px] flex flex-col gap-2.5">
        {[
          { label: t('predictionShareCanvas.stats.goalsForPerGp'),     carVal: carGpg.toFixed(2),  oppVal: oppGpg.toFixed(2),  carBetter: carGpg >= oppGpg },
          { label: t('predictionShareCanvas.stats.goalsAgainstPerGp'), carVal: carGag.toFixed(2),  oppVal: oppGag.toFixed(2),  carBetter: carGag <= oppGag },
          { label: t('predictionShareCanvas.stats.winRate'),         carVal: `${(carWin*100).toFixed(0)}%`, oppVal: `${(oppWin*100).toFixed(0)}%`, carBetter: carWin >= oppWin },
          { label: t('predictionShareCanvas.stats.ppVsPk'),       carVal: `${carPP.toFixed(1)}%`, oppVal: `${oppPK.toFixed(1)}%`, carBetter: carPP >= (100-oppPK) },
        ].map((row, i) => (
          <div key={i} className="pred-canvas-stat-row flex items-center gap-3">
            <span className={predCanvasStatValClasses({ isCar: true, good: row.carBetter })}>
              {row.carVal}
            </span>
            <span className="pred-canvas-stat-label flex-1 text-center text-[13px] text-[rgba(255,255,255,0.3)] uppercase tracking-[0.07em]">{row.label}</span>
            <span className={predCanvasStatValClasses({ isCar: false, good: !row.carBetter })}>
              {row.oppVal}
            </span>
          </div>
        ))}
      </div>

      {/* Edge factors — compact two-column */}
      <div className="pred-canvas-factors px-[52px] pb-3">
        <div className="pred-canvas-factors-label text-[12px] font-bold tracking-[0.12em] uppercase text-[rgba(255,255,255,0.2)] mb-2">{t('predictionShareCanvas.edgeAnalysis')}</div>
        <div className="pred-canvas-factors-grid grid [grid-template-columns:1fr_1fr] gap-1.5">
          {factors.slice(0, 6).map((f, i) => (
            <div key={i} className={`pred-canvas-factor ${f.carEdge ? 'car' : 'opp'} flex gap-2 items-center text-[14px] py-[7px] px-2.5 rounded-[7px] bg-[rgba(255,255,255,0.03)] border-[0.5px] border-[rgba(255,255,255,0.06)]`}>
              <span className={`shrink-0 ${f.carEdge ? 'text-[#4ade80]' : 'text-[rgba(255,255,255,0.3)]'}`}>{f.carEdge ? '✓' : '✗'}</span>
              <span className="flex-1 text-[rgba(255,255,255,0.45)]">{f.label}</span>
              <span className={`font-bold text-[13px] ${f.carEdge ? 'text-[color:var(--team-canvas)]' : 'text-[rgba(255,255,255,0.4)]'}`}>{f.carEdge ? TEAM_CONFIG.abbr : oppAbbr}</span>
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
          <div className="pred-canvas-line1 mx-[52px] mb-2.5 py-2.5 px-3.5 bg-[rgba(255,255,255,0.04)] border-[0.5px] border-[rgba(255,255,255,0.08)] rounded-[10px]">
            <div className="pred-canvas-line1-header flex items-center gap-3 mb-[7px]">
              <span className="pred-canvas-line1-label text-[11px] font-bold uppercase tracking-[0.08em] text-[rgba(255,255,255,0.25)] flex-1">{t('predictionShareCanvas.line1Header', { abbr: TEAM_CONFIG.abbr })}</span>
              {xgf != null && (
                <span className={`pred-canvas-line1-xgf ${good ? 'good text-[#4ade80]' : 'bad text-[#ce1126]'} text-[15px] font-extrabold [font-variant-numeric:tabular-nums]`}>
                  {xgf.toFixed(1)}% xGF
                </span>
              )}
              {line.toiMins != null && (
                <span className="pred-canvas-line1-toi text-[11px] text-[rgba(255,255,255,0.3)]">{t('predictionShareCanvas.toiTogether', { mins: line.toiMins })}</span>
              )}
            </div>
            <div className="pred-canvas-line1-players flex gap-[18px] flex-wrap">
              {line.players.map((p, i) => (
                <span key={i} className="pred-canvas-line1-player text-[14px] font-semibold text-[rgba(255,255,255,0.8)] flex items-baseline gap-[5px]">
                  <span className="pred-canvas-line1-pos text-[10px] font-bold text-[rgba(255,255,255,0.3)] uppercase tracking-[0.04em]">{POS_LABEL[p.pos] || p.pos}</span>
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Odds */}
      {odds && (
        <div className="pred-canvas-odds flex items-center justify-between py-2.5 px-[52px] border-t-[0.5px] border-t-[rgba(255,255,255,0.06)]">
          <div className="pred-canvas-odds-item flex flex-col items-center gap-[3px]">
            <span className="pred-canvas-odds-team car text-[14px] font-bold text-[color:var(--team-canvas)]">{TEAM_CONFIG.abbr}</span>
            <span className="pred-canvas-odds-val text-[26px] font-extrabold text-[rgba(255,255,255,0.7)]">{odds.carOdds > 0 ? `+${odds.carOdds}` : odds.carOdds}</span>
          </div>
          <div className="pred-canvas-odds-book text-[13px] text-[rgba(255,255,255,0.2)]">{odds.book}</div>
          <div className="pred-canvas-odds-item flex flex-col items-center gap-[3px]">
            <span className="pred-canvas-odds-team text-[14px] font-bold text-[rgba(255,255,255,0.4)]" style={{color: oppColor}}>{oppAbbr}</span>
            <span className="pred-canvas-odds-val text-[26px] font-extrabold text-[rgba(255,255,255,0.7)]">{odds.oppOdds > 0 ? `+${odds.oppOdds}` : odds.oppOdds}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={PRED_CANVAS_FOOTER_CLASSES}>
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
  const { t } = useTranslation();
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
    t('predictionShareCanvas.xCaption.headline', { abbr: TEAM_CONFIG.abbr, car: predCarScore, opp: predOppScore, oppAbbr }),
    t('predictionShareCanvas.xCaption.winProbability', { abbr: TEAM_CONFIG.abbr, pct: carModelPct, oppAbbr, oppPct: 100 - carModelPct }),
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
