// src/components/landing/ScorecardSection.jsx
// "Predictions, graded in public": live tiles from /scorecard
// (scorecardTiles.js), with /methodology one click away. The whole section
// is left out when the fetch fails or nothing is graded yet.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getScorecard } from '../../utils/nhlApi';
import { scorecardTiles } from './scorecardTiles';
import { METHODOLOGY_PATH } from './landingContent';
import { trackLandingCta } from './landingAnalytics';
import { useReveal } from './useReveal';
import { EYEBROW_CLASSES, H2_CLASSES, BODY_CLASSES } from './FeatureSection';

export default function ScorecardSection() {
  const [tiles, setTiles] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getScorecard()
      .then(data => { if (!cancelled) setTiles(scorecardTiles(data)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return tiles.length ? <ScorecardBody tiles={tiles} /> : null;
}

function ScorecardBody({ tiles }) {
  const { t } = useTranslation();
  const [ref, revealClasses] = useReveal();
  return (
    <section id="scorecard" className="landing-scorecard scroll-mt-[72px] border-t border-[var(--border)]">
      <div ref={ref} className={`mx-auto w-full max-w-[1120px] px-4 py-16 md:px-8 md:py-24 ${revealClasses}`}>
        <p className={`m-0 ${EYEBROW_CLASSES}`}>{t('landing.scorecard.eyebrow')}</p>
        <h2 className={H2_CLASSES}>{t('landing.scorecard.title')}</h2>
        <p className={BODY_CLASSES}>{t('landing.scorecard.body')}</p>
        <ul className="m-0 mt-8 grid list-none gap-3 p-0 md:grid-cols-3">
          {tiles.map(tile => (
            <li key={tile.model} className="landing-scorecard-tile rounded-[var(--radius-lg)] border border-[var(--border-2)] bg-[var(--bg2)] p-5">
              <p className="m-0 text-[14px] font-semibold text-[color:var(--text)]">{t(`scorecard.models.${tile.model}.title`)}</p>
              <p className="m-0 mt-3 font-[family-name:var(--font-mono)] text-[40px] font-medium leading-none text-[color:var(--text)]">{tile.value}</p>
              <p className="m-0 mt-1.5 text-[12.5px] text-[color:var(--text-muted)]">
                {t(tile.metric === 'brier' ? 'landing.scorecard.brier' : 'landing.scorecard.accuracy')}
              </p>
              <p className="m-0 mt-4 font-[family-name:var(--font-mono)] text-[11.5px] leading-[1.5] text-[color:var(--text-dim)]">
                {t(tile.kind === 'live' ? 'landing.scorecard.liveSample' : 'landing.scorecard.backtestSample', {
                  count: tile.n, n: tile.n.toLocaleString(), period: tile.period,
                })}
              </p>
              {tile.baseline && (
                <p className="m-0 mt-1 text-[12.5px] leading-[1.5] text-[color:var(--text-muted)]">
                  {t('landing.scorecard.baseline', {
                    name: t(`scorecard.baselines.${tile.baseline.name}`, { defaultValue: tile.baseline.name }),
                    value: tile.baseline.value,
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
        <a
          href={METHODOLOGY_PATH}
          className="mt-6 inline-block text-[14px] font-semibold text-[color:var(--red-bright)] no-underline hover:underline"
          onClick={() => trackLandingCta('methodology', { placement: 'scorecard' })}
        >
          {t('landing.scorecard.link')} →
        </a>
      </div>
    </section>
  );
}
