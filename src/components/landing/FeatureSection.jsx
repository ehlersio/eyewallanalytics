// src/components/landing/FeatureSection.jsx
// One feature: copy on one side, media on the other (alternating from
// tablet width up), stacked on a phone with the copy first.

import { useTranslation } from 'react-i18next';
import { useReveal } from './useReveal';

export const EYEBROW_CLASSES = 'font-[family-name:var(--font-mono)] text-[11.5px] font-medium uppercase tracking-[0.1em] text-[color:var(--red-bright)]';
export const H2_CLASSES = 'm-0 mt-2 font-[family-name:var(--font-display)] text-[34px] font-extrabold leading-[1.02] text-[color:var(--text)] [text-wrap:balance] md:text-[44px]';
export const BODY_CLASSES = 'mt-4 max-w-[32em] text-[16px] leading-[1.6] text-[color:var(--text-muted)]';

export default function FeatureSection({ id, sectionKey, flip = false, bodyValues, children, media }) {
  const { t } = useTranslation();
  const [ref, revealClasses] = useReveal();
  return (
    <section id={id} className={`landing-feature landing-feature-${id} scroll-mt-[72px] border-t border-[var(--border)]`}>
      <div
        ref={ref}
        className={`mx-auto grid w-full max-w-[1120px] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-24 ${revealClasses}`}
      >
        <div className={`min-w-0 ${flip ? 'md:order-2' : ''}`}>
          <p className={`m-0 ${EYEBROW_CLASSES}`}>{t(`landing.${sectionKey}.eyebrow`)}</p>
          <h2 className={H2_CLASSES}>{t(`landing.${sectionKey}.title`)}</h2>
          <p className={BODY_CLASSES}>{t(`landing.${sectionKey}.body`, bodyValues)}</p>
          {children}
        </div>
        <div className={`flex min-w-0 justify-center ${flip ? 'md:order-1' : ''}`}>
          {media}
        </div>
      </div>
    </section>
  );
}
