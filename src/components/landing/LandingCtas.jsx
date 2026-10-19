// src/components/landing/LandingCtas.jsx
// The landing page's two calls to action, always as a pair and always in
// this order: the App Store (push alerts and the Lock Screen only exist in
// the app) and the web app at /app.
//
// The App Store button is text only. Apple's official "Download on the App
// Store" badge SVG can replace AppStoreButton's contents later.

import { useTranslation } from 'react-i18next';
import { APP_STORE_URL, WEB_APP_PATH } from './landingContent';
import { trackLandingCta } from './landingAnalytics';

const STORE_CLASSES = 'landing-cta-store inline-flex flex-col items-start justify-center rounded-[12px] bg-black text-white no-underline leading-none shadow-[0_0_0_1px_rgba(255,255,255,0.14)] [transition:transform_0.12s,box-shadow_0.12s] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_6px_18px_-6px_rgba(0,0,0,0.5)]';
const WEB_CLASSES = 'landing-cta-web inline-flex items-center justify-center rounded-[12px] border border-[var(--border-2)] bg-[var(--btn-fill)] font-semibold text-[color:var(--text)] no-underline [transition:background_0.12s,border-color_0.12s] hover:bg-[var(--btn-fill-hover)] hover:border-[var(--text-dim)]';

const SIZES = {
  lg: { store: 'h-[54px] px-5 gap-[3px]', small: 'text-[11px]', big: 'text-[22px]', web: 'h-[54px] px-5 text-[15px]' },
  sm: { store: 'h-[36px] px-3 gap-[1px]', small: 'text-[8px]', big: 'text-[14px]', web: 'h-[36px] px-3 text-[13px]' },
};

export function AppStoreButton({ size = 'lg', placement }) {
  const { t } = useTranslation();
  const s = SIZES[size];
  return (
    <a
      href={APP_STORE_URL}
      className={`${STORE_CLASSES} ${s.store}`}
      aria-label={t('landing.cta.appStoreAria')}
      onClick={() => trackLandingCta('app_store', { placement })}
    >
      <span className={`${s.small} font-medium tracking-[0.02em] opacity-90`}>{t('landing.cta.appStoreSmall')}</span>
      <span className={`${s.big} font-[family-name:var(--font-display)] font-bold tracking-[0.01em]`}>{t('landing.cta.appStoreBig')}</span>
    </a>
  );
}

export function WebAppButton({ size = 'lg', short = false, placement }) {
  const { t } = useTranslation();
  return (
    <a
      href={WEB_APP_PATH}
      className={`${WEB_CLASSES} ${SIZES[size].web}`}
      onClick={() => trackLandingCta('web', { placement })}
    >
      {short ? t('landing.cta.webShort') : t('landing.cta.web')}
    </a>
  );
}

export default function LandingCtas({ placement, className = '' }) {
  return (
    <div className={`landing-ctas flex flex-wrap items-center gap-3 ${className}`}>
      <AppStoreButton placement={placement} />
      <WebAppButton placement={placement} />
    </div>
  );
}
