// src/components/landing/FeatureMedia.jsx
// The right-hand (or left-hand) side of each feature section.

import { useTranslation } from 'react-i18next';
import PhoneFrame from './PhoneFrame';
import LandingMedia from './LandingMedia';
import { EYEBROW_CLASSES } from './FeatureSection';

// One phone at ~60% of a phone's width, or two side by side, the second
// set lower.
export function Phones({ media }) {
  if (media.length === 1) {
    return (
      <PhoneFrame className="w-[60vw] max-w-[300px]">
        <LandingMedia media={media[0]} />
      </PhoneFrame>
    );
  }
  return (
    <div className="flex items-start justify-center gap-4 md:gap-6">
      {media.map((m, i) => (
        <PhoneFrame key={m.src} className={`w-[42vw] max-w-[250px] ${i % 2 ? 'mt-12' : ''}`}>
          <LandingMedia media={m} />
        </PhoneFrame>
      ))}
    </div>
  );
}

// The bell, with the Lock Screen Live Activity laid over its top like a
// notification.
export function LockScreenMedia({ media, liveActivity }) {
  return (
    <div className="relative">
      <PhoneFrame className="w-[60vw] max-w-[300px]">
        <LandingMedia media={media[0]} />
      </PhoneFrame>
      <div className="absolute left-1/2 top-[9%] w-[96%] -translate-x-1/2 overflow-hidden rounded-[20px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.1)] md:w-[112%]">
        <LandingMedia media={liveActivity} />
      </div>
    </div>
  );
}

// Goal replays, two ways: the app's Video | Tracking switch, and what each
// side shows. A recorded clip of the switch replaces this in the asset PR.
export function TwoWaysMedia() {
  const { t } = useTranslation();
  const panel = (titleKey, bodyKey, on) => (
    <div className={`rounded-[var(--radius)] border p-4 ${on ? 'border-[var(--red-border)] bg-[var(--red-dim)]' : 'border-[var(--border-2)] bg-[var(--bg2)]'}`}>
      <p className={`m-0 ${EYEBROW_CLASSES} ${on ? '' : '!text-[color:var(--text-muted)]'}`}>{t(titleKey)}</p>
      <p className="m-0 mt-1.5 text-[14.5px] leading-[1.55] text-[color:var(--text)]">{t(bodyKey)}</p>
    </div>
  );
  return (
    <div className="landing-two-ways w-full max-w-[440px]">
      <div className="mx-auto mb-4 flex w-max rounded-[20px] border border-[var(--border-2)] bg-[var(--bg2)] p-1 text-[13px] font-semibold" aria-hidden="true">
        <span className="rounded-[16px] px-4 py-1.5 text-[color:var(--text-muted)]">{t('landing.replays.videoTitle')}</span>
        <span className="rounded-[16px] bg-[var(--red-dim)] px-4 py-1.5 text-[color:var(--red-bright)]">{t('landing.replays.trackingTitle')}</span>
      </div>
      <div className="flex flex-col gap-3">
        {panel('landing.replays.videoTitle', 'landing.replays.videoBody', false)}
        {panel('landing.replays.trackingTitle', 'landing.replays.trackingBody', true)}
      </div>
      <a href="#hero" className="mt-4 inline-block text-[14px] font-semibold text-[color:var(--red-bright)] no-underline hover:underline">
        ↑ {t('landing.replays.watchHero')}
      </a>
    </div>
  );
}
