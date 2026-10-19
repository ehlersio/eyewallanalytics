// src/components/landing/GetItSection.jsx
// The closing call to action. No Google Play badge until the Android
// listing is live in production: never offer a dead option.

import { useTranslation } from 'react-i18next';
import LandingCtas from './LandingCtas';
import { useReveal } from './useReveal';
import { EYEBROW_CLASSES } from './FeatureSection';

export default function GetItSection() {
  const { t } = useTranslation();
  const [ref, revealClasses] = useReveal();
  return (
    <section id="get" className="landing-get scroll-mt-[72px] border-t border-[var(--border)]">
      <div ref={ref} className={`mx-auto flex w-full max-w-[760px] flex-col items-center px-4 py-20 text-center md:py-28 ${revealClasses}`}>
        <p className={`m-0 ${EYEBROW_CLASSES}`}>{t('landing.get.eyebrow')}</p>
        <h2 className="m-0 mt-3 font-[family-name:var(--font-display)] text-[40px] font-extrabold leading-[1] text-[color:var(--text)] [text-wrap:balance] md:text-[56px]">
          {t('landing.get.title')}
        </h2>
        <p className="mt-4 max-w-[30em] text-[16px] leading-[1.6] text-[color:var(--text-muted)]">{t('landing.get.body')}</p>
        <LandingCtas placement="closing" className="mt-8 justify-center" />
      </div>
    </section>
  );
}
