// ── PredictionShareCanvas.jsx ─────────────────────────────────
// 1080×1350 export card for the Prediction tab, drawn in ShareCardFrame
// (same look as the pipeline's Instagram/Facebook cards).
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
import { getGamePrediction, predictionCacheKey } from '../utils/supabaseClient';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from './ShareButtons';
import { NATIVE_ORIGIN } from '../utils/nativeOrigin';
import ShareCardFrame, {
  ShareMatchupHero, ShareTiles, ShareAiBlock, ShareCompareRow, ShareSection, ShareRow,
} from './ShareCardFrame';
import { SHARE, FONT_LABEL } from '../utils/shareCardTheme';

const OPP_BAR_FALLBACK = '#3a4559';

// ── Share canvas (off-screen, 1080×1350, ShareCardFrame) ─────
export function PredictionCanvas({
  canvasRef, carModelPct, predCarScore, predOppScore,
  carGpg, oppGpg, carGag, oppGag, carWin, oppWin, carPP, oppPK,
  factors, oppAbbr, oppColor, isPlayoff, seriesEntry, aiNarrative,
}) {
  const { t } = useTranslation();
  const car = TEAM_CONFIG.abbr;
  const carColor = TEAM_CONFIG.displayColor;
  const oppCol = oppColor || OPP_BAR_FALLBACK;
  // Don't render until all required numeric props are available
  if (carGpg == null || oppGpg == null || carGag == null || oppGag == null ||
      carWin == null || oppWin == null || carPP == null || oppPK == null ||
      predCarScore == null || predOppScore == null) {
    return <div ref={canvasRef} style={{ position: 'fixed', left: -9999 }} />;
  }

  const logo = (abbr) => (
    <img src={`${NATIVE_ORIGIN}/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`} alt={abbr}
      style={{ width: 76, height: 76, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
  );
  const projTotal = (predCarScore + predOppScore).toFixed(1);
  const side = (carBetter) => (carBetter ? 'left' : 'right');

  return (
    <ShareCardFrame
      canvasRef={canvasRef}
      accent={carColor}
      kicker={isPlayoff ? t('predictionShareCanvas.badge.playoffPrediction') : t('pwhlGamePreview.prediction.sectionLabel')}
      title={t('shareCard.matchupTitle', { team: car, opp: oppAbbr })}
      subtitle={seriesEntry
        ? t('shareCard.seriesSubtitle', { team: car, teamWins: seriesEntry.carWins, oppWins: seriesEntry.oppWins, opp: oppAbbr })
        : t('shareCard.predictionSubtitle')}
      note={t('shareCard.probabilityNote')}
    >
      <ShareMatchupHero
        left={{ abbr: car, color: carColor, logo: logo(car), pct: carModelPct }}
        right={{ abbr: oppAbbr, color: oppCol, logo: logo(oppAbbr) }}
      />

      <ShareTiles tiles={[
        { label: t('predictionShareCanvas.scoreLabel.projected'), flex: 2, value: (
          <>
            <span style={{ color: carColor }}>{car} {predCarScore}</span>
            <span style={{ color: SHARE.muted }}> – </span>
            <span style={{ color: oppCol }}>{predOppScore} {oppAbbr}</span>
          </>
        ) },
        { label: t('predictionShareCanvas.scoreLabel.projectedTotal'), value: projTotal },
      ]} />

      <ShareAiBlock text={aiNarrative} lines={3} />

      <div>
        {[
          { label: t('predictionShareCanvas.stats.goalsForPerGp'),     l: carGpg.toFixed(2), r: oppGpg.toFixed(2), better: side(carGpg >= oppGpg) },
          { label: t('predictionShareCanvas.stats.goalsAgainstPerGp'), l: carGag.toFixed(2), r: oppGag.toFixed(2), better: side(carGag <= oppGag) },
          { label: t('predictionShareCanvas.stats.winRate'),           l: `${(carWin * 100).toFixed(0)}%`, r: `${(oppWin * 100).toFixed(0)}%`, better: side(carWin >= oppWin) },
          { label: t('predictionShareCanvas.stats.ppVsPk'),            l: `${carPP.toFixed(1)}%`, r: `${oppPK.toFixed(1)}%`, better: side(carPP >= (100 - oppPK)) },
        ].map(row => (
          <ShareCompareRow key={row.label} label={row.label} left={row.l} right={row.r}
            better={row.better} leftColor={carColor} rightColor={oppCol} />
        ))}
      </div>

      {factors?.length > 0 && (
        <ShareSection label={t('predictionShareCanvas.edgeAnalysis')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {factors.slice(0, 4).map((f, i) => (
              <ShareRow key={i} accent={f.carEdge ? carColor : oppCol} style={{ padding: '12px 18px 12px 26px' }}>
                <span style={{ flex: 1, fontSize: 24, color: 'rgba(228,232,240,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>
                <span style={{ fontFamily: FONT_LABEL, fontSize: 26, color: f.carEdge ? carColor : oppCol }}>{f.carEdge ? car : oppAbbr}</span>
              </ShareRow>
            ))}
          </div>
        </ShareSection>
      )}
    </ShareCardFrame>
  );
}

// ── Public export component — renders canvas + export button ──
export default function PredictionExportSection({
  carModelPct, predCarScore, predOppScore,
  carGpg, oppGpg, carGag, oppGag, carWin, oppWin, carPP, oppPK,
  factors, oppAbbr, oppColor, isPlayoff, seriesEntry, gameId,
}) {
  const { t, i18n } = useTranslation();
  const canvasRef = useRef(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [aiNarrative, setAiNarrative] = useState(null);

  // DB-first: fetch pre-generated prediction narrative, fall back to Worker
  // cache. Goes through supabaseClient.js's getGamePrediction() (Worker's
  // /game-predictions route) rather than hitting Supabase directly -- this
  // used to have its own inline fetch with an embedded anon key, the same
  // pattern MatchupDetail.jsx's AI section already avoided by using
  // getGamePrediction() for the exact same DB-first tier.
  // Per-language, like MatchupDetail's AI section. The cache key includes
  // the team -- the Worker hasn't written a bare `prediction:{gameId}` key
  // since it went multi-team, so this fallback never used to hit.
  const lang = i18n.language;
  useEffect(() => {
    if (!gameId) return;
    let stale = false;
    setAiNarrative(null);
    getGamePrediction(gameId, lang)
      .then(data => {
        if (data?.text) { if (!stale) setAiNarrative(data.text); return; }
        const workerUrl = import.meta.env.VITE_WORKER_URL;
        if (!workerUrl) return;
        fetch(`${workerUrl}/cache/${encodeURIComponent(predictionCacheKey(gameId, TEAM_CONFIG.abbr, lang))}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.narrative && !stale) setAiNarrative(d.narrative); })
          .catch(() => {});
      })
      .catch(() => {});
    return () => { stale = true; };
  }, [gameId, lang]);

  const xCaption = (carGpg != null && predCarScore != null) ? [
    t('predictionShareCanvas.xCaption.headline', { abbr: TEAM_CONFIG.abbr, car: predCarScore, opp: predOppScore, oppAbbr }),
    t('predictionShareCanvas.xCaption.winProbability', { abbr: TEAM_CONFIG.abbr, pct: carModelPct, oppAbbr, oppPct: 100 - carModelPct }),
    aiNarrative || '',
    `#${TEAM_CONFIG.abbr} #EyeWallAnalytics`,
  ].filter(Boolean).join('\n') : '';

  const { saving, sharing, handleNativeShare } =
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
  const handleShareWithCapture = async () => {
    await handleNativeShare();
    capture('prediction_card_exported', {
      opponent: oppAbbr,
      carPct:   carModelPct,
      hasAI:    !!aiNarrative,
    });
  };

  return (
    <>
      <ShareButtons
        onNativeShare={handleShareWithCapture}
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
          factors={factors} oppAbbr={oppAbbr} oppColor={oppColor}
          isPlayoff={isPlayoff} seriesEntry={seriesEntry} aiNarrative={aiNarrative}
        />
      )}
    </>
  );
}
