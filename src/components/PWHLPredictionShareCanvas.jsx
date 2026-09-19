// ── PWHLPredictionShareCanvas.jsx ─────────────────────────────
// 1080×1350 export card for PWHLGamePreviewPopup's Prediction section,
// drawn in ShareCardFrame like every other share card.
// PWHL analogue of PredictionShareCanvas.jsx, right-sized to what
// /pwhl/prediction actually returns (win%, expected score, narrative,
// streak, shot-attempt share) -- no odds/PP-PK-edge-factors/line-combos
// section, since PWHLGamePreviewPopup doesn't fetch that data for its
// Prediction section (Season Series / Team Form / Special Teams live in
// separate sections of that popup, out of scope for this card).
//
// Colors are passed in directly (color/oppColor props) -- the popup already
// resolves per-team colors itself; ShareCardFrame exposes `color` to the
// content as --team-canvas.

import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { capture } from '../utils/analytics';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from './ShareButtons';
import TeamLogo from './TeamLogo';
import ShareCardFrame, { ShareMatchupHero, ShareTiles, ShareAiBlock, ShareCompareRow } from './ShareCardFrame';
import { SHARE, FONT_BODY } from '../utils/shareCardTheme';

// ── Share canvas (off-screen, 1080×1350, ShareCardFrame) ─────
export function PWHLPredictionCanvas({
  canvasRef, abbr, oppAbbr, color, oppColor,
  myWinPct, oppWinPct, myExp, oppExp, myStreak, oppStreak,
  myCorsi, oppCorsi, corsiCaveat, narrative,
}) {
  const { t } = useTranslation();
  if (myWinPct == null || oppWinPct == null || myExp == null || oppExp == null) {
    return <div ref={canvasRef} style={{ position: 'fixed', left: -9999 }} />;
  }

  const projTotal = (myExp + oppExp).toFixed(1);
  const rows = [
    { label: t('pwhlGamePreview.prediction.streakLabel'), l: myStreak ?? '—', r: oppStreak ?? '—' },
    ...(myCorsi != null || oppCorsi != null
      ? [{ label: t('pwhlGamePreview.prediction.shotAttemptShareLabel'), l: myCorsi != null ? `${myCorsi.toFixed(1)}%` : '—', r: oppCorsi != null ? `${oppCorsi.toFixed(1)}%` : '—' }]
      : []),
  ];

  return (
    <ShareCardFrame
      canvasRef={canvasRef}
      accent={color}
      kicker={`PWHL · ${t('pwhlGamePreview.prediction.sectionLabel')}`}
      title={t('shareCard.matchupTitle', { team: abbr, opp: oppAbbr })}
      subtitle={t('shareCard.predictionSubtitle')}
      note={t('shareCard.probabilityNote')}
    >
      <ShareMatchupHero
        left={{ abbr, color, pct: myWinPct, logo: <TeamLogo abbr={abbr} sport="pwhl" size={76} color={color} /> }}
        right={{ abbr: oppAbbr, color: oppColor, logo: <TeamLogo abbr={oppAbbr} sport="pwhl" size={76} color={oppColor} /> }}
      />

      <ShareTiles tiles={[
        { label: t('predictionShareCanvas.scoreLabel.expected'), flex: 2, value: (
          <>
            <span style={{ color }}>{abbr} {myExp}</span>
            <span style={{ color: SHARE.muted }}> – </span>
            <span style={{ color: oppColor }}>{oppExp} {oppAbbr}</span>
          </>
        ) },
        { label: t('predictionShareCanvas.scoreLabel.projectedTotal'), value: projTotal },
      ]} />

      <ShareAiBlock text={narrative} lines={6} />

      <div>
        {rows.map(row => (
          <ShareCompareRow key={row.label} label={row.label} left={row.l} right={row.r}
            leftColor={color} rightColor={oppColor} />
        ))}
        {corsiCaveat && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 22, color: SHARE.muted, fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>
            {t('pwhlGamePreview.prediction.shotAttemptCaveatPrefix', { caveat: corsiCaveat.toLowerCase() })}
          </div>
        )}
      </div>
    </ShareCardFrame>
  );
}

// ── Public export component — renders canvas + export button ──
export default function PWHLPredictionExportSection({
  abbr, oppAbbr, color, oppColor,
  myWinPct, oppWinPct, myExp, oppExp, myStreak, oppStreak,
  myCorsi, oppCorsi, corsiCaveat, narrative, gameId,
}) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [canvasMounted, setCanvasMounted] = useState(false);

  useEffect(() => {
    if (canvasMounted) capture('pwhl_prediction_card_mounted', { gameId, opponent: oppAbbr });
  }, [canvasMounted, gameId, oppAbbr]);

  const xCaption = (myWinPct != null && myExp != null) ? [
    t('predictionShareCanvas.xCaption.headline', { abbr, car: myExp, opp: oppExp, oppAbbr }),
    t('predictionShareCanvas.xCaption.winProbability', { abbr, pct: myWinPct, oppAbbr, oppPct: oppWinPct }),
    narrative || '',
    `#${abbr} #PWHL #EyeWallAnalytics`,
  ].filter(Boolean).join('\n') : '';

  const { saving, sharing, handleNativeShare } =
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

  const handleShareWithCapture = async () => {
    await handleNativeShare();
    capture('pwhl_prediction_card_exported', { opponent: oppAbbr, myWinPct, hasAI: !!narrative });
  };

  return (
    <>
      <ShareButtons
        onNativeShare={handleShareWithCapture}
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
