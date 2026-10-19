// src/components/landing/LandingNav.jsx
// Sticky top bar: the mark, section links (from tablet width up) and the
// same two calls to action as the hero, small.

import { useTranslation } from 'react-i18next';
import EyeWallLogo from '../EyeWallLogo';
import { AppStoreButton, WebAppButton } from './LandingCtas';
import { METHODOLOGY_PATH } from './landingContent';
import { trackLandingCta } from './landingAnalytics';

const BAR_CLASSES = 'landing-nav sticky top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg0)_86%,transparent)] backdrop-blur-md pt-[env(safe-area-inset-top,0px)]';
const LINK_CLASSES = 'text-[13px] font-medium text-[color:var(--text-muted)] no-underline hover:text-[color:var(--text)]';

export default function LandingNav() {
  const { t } = useTranslation();
  return (
    <header className={BAR_CLASSES}>
      <nav className="mx-auto flex h-[60px] w-full max-w-[1120px] items-center gap-3 px-4 md:px-8" aria-label={t('landing.nav.aria')}>
        <a href="#top" className="flex shrink-0 items-center gap-2 no-underline">
          <EyeWallLogo alt="EyeWall Analytics" className="h-[30px] w-[30px]" width="30" height="30" />
          <span className="hidden font-[family-name:var(--font-display)] text-[17px] font-bold tracking-[0.03em] text-[color:var(--text)] min-[420px]:inline">EyeWall Analytics</span>
        </a>
        <div className="ml-6 hidden items-center gap-5 lg:flex">
          <a href="#live" className={LINK_CLASSES}>{t('landing.nav.features')}</a>
          <a href="#leagues" className={LINK_CLASSES}>{t('landing.nav.leagues')}</a>
          <a href="#ai" className={LINK_CLASSES}>{t('landing.nav.ai')}</a>
          <a href={METHODOLOGY_PATH} className={LINK_CLASSES} onClick={() => trackLandingCta('methodology', { placement: 'nav' })}>
            {t('landing.nav.howItWorks')}
          </a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <WebAppButton size="sm" short placement="nav" />
          <AppStoreButton size="sm" placement="nav" />
        </div>
      </nav>
    </header>
  );
}
