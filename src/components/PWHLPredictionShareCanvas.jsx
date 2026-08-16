// ── PWHLPredictionShareCanvas.jsx ─────────────────────────────
// 1080×1080 export card for PWHLGamePreviewPopup's Prediction section.
// PWHL analogue of PredictionShareCanvas.jsx, right-sized to what
// /pwhl/prediction actually returns (win%, expected score, narrative,
// streak, shot-attempt share) -- no odds/PP-PK-edge-factors/line-combos
// section, since PWHLGamePreviewPopup doesn't fetch that data for its
// Prediction section (Season Series / Team Form / Special Teams live in
// separate sections of that popup, out of scope for this card).
//
// Colors are passed in directly (color/oppColor props) rather than reading
// --team-canvas/--team-canvas-rgb CSS vars the way NHL's canvas does --
// this repo has no PWHL equivalent of those vars, and the popup already
// resolves per-team colors itself.

import { useRef, useState, useEffect } from 'react';
import { capture } from '../utils/analytics';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from './ShareButtons';
import TeamLogo from './TeamLogo';
import {
  PRED_CANVAS_CLASSES, PRED_CANVAS_HEADER_CLASSES, PRED_CANVAS_LOGO_CLASSES,
  PRED_CANVAS_BADGE_CLASSES, PRED_CANVAS_AI_CLASSES, PRED_CANVAS_AI_LABEL_CLASSES,
  PRED_CANVAS_AI_TEXT_CLASSES, PRED_CANVAS_FOOTER_CLASSES,
} from '../utils/predCanvasClasses';

const PRED_CANVAS_TEAM_CLASSES = 'pred-canvas-team flex flex-col items-center gap-1.5 shrink-0';
const PRED_CANVAS_STAT_VAL_BASE = 'pred-canvas-stat-val w-[72px] text-[20px] font-bold';
const predCanvasStatValClasses = (isTeam) => `${PRED_CANVAS_STAT_VAL_BASE} ${isTeam ? 'text-right' : 'text-left'}`;

// ── Share canvas (off-screen, 1080×1080) ─────────────────────
function PWHLPredictionCanvas({
  canvasRef, abbr, oppAbbr, color, oppColor,
  myWinPct, oppWinPct, myExp, oppExp, myStreak, oppStreak,
  myCorsi, oppCorsi, corsiCaveat, narrative,
}) {
  if (myWinPct == null || oppWinPct == null || myExp == null || oppExp == null) {
    return <div className={PRED_CANVAS_CLASSES} ref={canvasRef} />;
  }

  const projTotal = +(myExp + oppExp).toFixed(1);

  return (
    <div className={PRED_CANVAS_CLASSES} ref={canvasRef}>
      {/* Header */}
      <div className={PRED_CANVAS_HEADER_CLASSES}>
        <img src="/eyewall-logo.svg" alt="EyeWall" className={PRED_CANVAS_LOGO_CLASSES}
          onError={e => { e.target.style.display = 'none'; }} />
        <span className={PRED_CANVAS_BADGE_CLASSES} style={{ color, background: 'rgba(255,255,255,0.08)' }}>Prediction</span>
      </div>

      {/* Teams + win probability */}
      <div className="pred-canvas-matchup flex items-center gap-5 px-[52px] pb-4 border-b-[0.5px] border-b-[rgba(255,255,255,0.07)]">
        <div className={PRED_CANVAS_TEAM_CLASSES}>
          <TeamLogo abbr={abbr} sport="pwhl" size={52} color={color} />
          <div className="pred-canvas-team-abbr text-[19px] font-extrabold" style={{ color }}>{abbr}</div>
        </div>

        <div className="pred-canvas-center flex-1 flex flex-col gap-1.5">
          <div className="pred-canvas-bar flex h-7 rounded-[6px] overflow-hidden">
            <div className="pred-canvas-bar-team flex items-center justify-center text-[16px] font-bold [transition:width_0.4s]" style={{ width: `${myWinPct}%`, background: color }}>
              {myWinPct >= 20 && <span>{myWinPct}%</span>}
            </div>
            <div className="pred-canvas-bar-opp flex items-center justify-center text-[16px] font-bold [transition:width_0.4s]" style={{ width: `${oppWinPct}%`, background: oppColor }}>
              {oppWinPct >= 20 && <span>{oppWinPct}%</span>}
            </div>
          </div>
          <div className="pred-canvas-bar-labels flex justify-between text-[13px] text-[rgba(255,255,255,0.3)] px-0.5">
            <span style={{ color }}>{abbr}</span>
            <span style={{ color: oppColor }}>{oppAbbr}</span>
          </div>
        </div>

        <div className={PRED_CANVAS_TEAM_CLASSES}>
          <TeamLogo abbr={oppAbbr} sport="pwhl" size={52} color={oppColor} />
          <div className="pred-canvas-team-abbr text-[19px] font-extrabold" style={{ color: oppColor }}>{oppAbbr}</div>
        </div>
      </div>

      {/* Predicted score + total */}
      <div className="pred-canvas-score-row flex gap-5 py-3.5 px-[52px] border-b-[0.5px] border-b-[rgba(255,255,255,0.06)]">
        <div className="pred-canvas-score flex-1 flex flex-col items-center text-center">
          <div className="pred-canvas-score-label text-[12px] font-bold tracking-[0.1em] uppercase text-[rgba(255,255,255,0.25)] mb-1.5">Expected Score</div>
          <div className="pred-canvas-score-val text-[26px] font-extrabold">
            <span style={{ color }}>{abbr} {myExp}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}> – </span>
            <span style={{ color: oppColor }}>{oppExp} {oppAbbr}</span>
          </div>
        </div>
        <div className="pred-canvas-total flex-1 flex flex-col items-center text-center">
          <div className="pred-canvas-score-label text-[12px] font-bold tracking-[0.1em] uppercase text-[rgba(255,255,255,0.25)] mb-1.5">Projected Total</div>
          <div className="pred-canvas-total-val text-[43px] font-black text-[rgba(255,255,255,0.8)]">{projTotal}</div>
        </div>
      </div>

      {/* AI narrative */}
      {narrative && (
        <div className={PRED_CANVAS_AI_CLASSES}>
          <div className={PRED_CANVAS_AI_LABEL_CLASSES} style={{ color }}>⚡ EyeWall AI</div>
          <div className={PRED_CANVAS_AI_TEXT_CLASSES}>{narrative}</div>
        </div>
      )}

      <div className="pred-canvas-stats py-3 px-[52px] flex flex-col gap-2.5">
        {[
          { label: 'Streak', teamVal: myStreak ?? '—', oppVal: oppStreak ?? '—' },
          ...(myCorsi != null || oppCorsi != null
            ? [{ label: 'Shot-attempt share', teamVal: myCorsi != null ? `${myCorsi.toFixed(1)}%` : '—', oppVal: oppCorsi != null ? `${oppCorsi.toFixed(1)}%` : '—' }]
            : []),
        ].map((row, i) => (
          <div key={i} className="pred-canvas-stat-row flex items-center gap-3">
            <span className={predCanvasStatValClasses(true)} style={{ color }}>
              {row.teamVal}
            </span>
            <span className="pred-canvas-stat-label flex-1 text-center text-[13px] text-[rgba(255,255,255,0.3)] uppercase tracking-[0.07em]">{row.label}</span>
            <span className={predCanvasStatValClasses(false)} style={{ color: oppColor }}>
              {row.oppVal}
            </span>
          </div>
        ))}
        {corsiCaveat && <div className="text-[11px] text-[rgba(255,255,255,0.25)] italic text-center mt-1">Shot-attempt share is {corsiCaveat.toLowerCase()}</div>}
      </div>

      {/* Footer */}
      <div className={PRED_CANVAS_FOOTER_CLASSES}>
        <span>eyewallanalytics.com</span>
        <span>#{abbr} #PWHL</span>
      </div>
    </div>
  );
}

// ── Public export component — renders canvas + export button ──
export default function PWHLPredictionExportSection({
  abbr, oppAbbr, color, oppColor,
  myWinPct, oppWinPct, myExp, oppExp, myStreak, oppStreak,
  myCorsi, oppCorsi, corsiCaveat, narrative, gameId,
}) {
  const canvasRef = useRef(null);
  const [canvasMounted, setCanvasMounted] = useState(false);

  useEffect(() => {
    if (canvasMounted) capture('pwhl_prediction_card_mounted', { gameId, opponent: oppAbbr });
  }, [canvasMounted, gameId, oppAbbr]);

  const xCaption = (myWinPct != null && myExp != null) ? [
    `${abbr} ${myExp}–${oppExp} ${oppAbbr} — EyeWall Prediction`,
    `Win probability: ${abbr} ${myWinPct}% · ${oppAbbr} ${oppWinPct}%`,
    narrative || '',
    `#${abbr} #PWHL #EyeWallAnalytics`,
  ].filter(Boolean).join('\n') : '';

  const { saving, sharing, handleSave, handleShareX, handleNativeShare, canNativeShare } =
    useShareCard({
      canvasRef,
      filename: `EyeWall-PWHL-Prediction-${abbr}-vs-${oppAbbr}.png`,
      xCaption,
      mountCanvas: async () => {
        if (!canvasMounted) {
          setCanvasMounted(true);
          await new Promise(r => setTimeout(r, 120));
        }
      },
    });

  if (myWinPct == null || myExp == null) return null;

  const handleSaveWithCapture = async () => {
    await handleSave();
    capture('pwhl_prediction_card_exported', { opponent: oppAbbr, myWinPct, hasAI: !!narrative });
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
        className="pgp-export-row mt-3"
      />
      {canvasMounted && (
        <PWHLPredictionCanvas
          canvasRef={canvasRef}
          abbr={abbr} oppAbbr={oppAbbr} color={color} oppColor={oppColor}
          myWinPct={myWinPct} oppWinPct={oppWinPct} myExp={myExp} oppExp={oppExp}
          myStreak={myStreak} oppStreak={oppStreak}
          myCorsi={myCorsi} oppCorsi={oppCorsi} corsiCaveat={corsiCaveat}
          narrative={narrative}
        />
      )}
    </>
  );
}
