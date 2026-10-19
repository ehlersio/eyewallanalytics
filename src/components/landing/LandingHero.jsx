// src/components/landing/LandingHero.jsx

import { useTranslation } from 'react-i18next';
import LandingCtas from './LandingCtas';
import HeroReplay from './HeroReplay';

export default function LandingHero() {
  const { t } = useTranslation();
  return (
    <section id="hero" className="landing-hero relative scroll-mt-[72px]">
      <div className="mx-auto grid w-full max-w-[1120px] items-center gap-10 px-4 pb-14 pt-10 md:grid-cols-[1fr_1.05fr] md:gap-12 md:px-8 md:pb-24 md:pt-20">
        <div className="min-w-0">
          {/* One sentence per line ("Every shot. / Every goal. / Every league
              you follow."): balanced wrapping broke the last sentence across
              lines on wide screens. The trailing space keeps the text content
              readable as one sentence run (tests, screen readers). */}
          <h1 className="landing-headline m-0 font-[family-name:var(--font-display)] text-[44px] font-extrabold leading-[0.98] tracking-[-0.005em] text-[color:var(--text)] sm:text-[56px] lg:text-[68px]">
            {t('landing.hero.title').split(/(?<=\.)\s+/).map((line) => (
              <span key={line} className="block">{line}{' '}</span>
            ))}
          </h1>
          <p className="mt-5 max-w-[34em] text-[16px] leading-[1.6] text-[color:var(--text-muted)] md:text-[17px]">
            {t('landing.hero.lede')}
          </p>
          <LandingCtas placement="hero" className="mt-7" />
        </div>
        <div className="min-w-0">
          <HeroReplay />
        </div>
      </div>
    </section>
  );
}
