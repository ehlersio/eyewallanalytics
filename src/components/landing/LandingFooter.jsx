// src/components/landing/LandingFooter.jsx

import { useTranslation } from 'react-i18next';
import { IconInstagram, IconX, IconFacebook } from '../SocialIcons';
import { setLocale } from '../../utils/localeConfig';
import { SOCIAL_LINKS, METHODOLOGY_PATH, PRIVACY_PATH, DELETE_ACCOUNT_PATH } from './landingContent';
import { trackLandingCta } from './landingAnalytics';

const ICONS = { instagram: IconInstagram, x: IconX, facebook: IconFacebook };
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const LINK_CLASSES = 'text-[13.5px] text-[color:var(--text-muted)] no-underline hover:text-[color:var(--text)] hover:underline';
const SOCIAL_CLASSES = 'flex h-[40px] w-[40px] items-center justify-center rounded-[10px] bg-[var(--bg2)] text-[18px] text-[color:var(--text-muted)] no-underline [transition:background_0.15s,color_0.15s] hover:bg-[var(--bg3)] hover:text-[color:var(--text)]';

export default function LandingFooter() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2);
  return (
    <footer className="landing-footer border-t border-[var(--border)] bg-[var(--bg1)]">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-7 px-4 pb-[calc(40px+env(safe-area-inset-bottom,0px))] pt-10 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="EyeWall Analytics">
            <a href={METHODOLOGY_PATH} className={LINK_CLASSES} onClick={() => trackLandingCta('methodology', { placement: 'footer' })}>
              {t('landing.footer.howItWorks')}
            </a>
            <a href={PRIVACY_PATH} className={LINK_CLASSES}>{t('landing.footer.privacy')}</a>
            <a href={DELETE_ACCOUNT_PATH} className={LINK_CLASSES}>{t('landing.footer.deleteAccount')}</a>
          </nav>
          <div className="flex flex-wrap items-center gap-5">
            <ul className="m-0 flex list-none gap-2 p-0" aria-label={t('landing.footer.social')}>
              {SOCIAL_LINKS.map(({ key, label, href }) => {
                const Icon = ICONS[key];
                return (
                  <li key={key}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={SOCIAL_CLASSES}
                      aria-label={label}
                      onClick={() => trackLandingCta('social', { network: key })}
                    >
                      <Icon />
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="landing-language flex rounded-[10px] border border-[var(--border-2)] p-[3px]" role="group" aria-label={t('landing.footer.language')}>
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  lang={code}
                  aria-pressed={current === code}
                  aria-label={label}
                  onClick={() => setLocale(code)}
                  className={`min-h-0 rounded-[7px] px-3 py-1.5 font-[family-name:var(--font-mono)] text-[12px] uppercase ${current === code ? 'bg-[var(--bg3)] text-[color:var(--text)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)]'}`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="m-0 max-w-[60em] text-[12px] leading-[1.6] text-[color:var(--text-dim)]">
          {t('landing.footer.disclaimer')}
        </p>
      </div>
    </footer>
  );
}
