import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import EyeWallLogo from './EyeWallLogo';
import { IconInstagram, IconX, IconReddit, IconFacebook } from './SocialIcons';

// Tips inside a digital app have to go through In-App Purchase on iOS (App
// Store Guideline 3.1.1), so the Buy Me a Coffee link is web/Android only.
const SHOW_TIP_LINK = Capacitor.getPlatform() !== 'ios';
// The landing page (/welcome) is web only: it exists to send people to the
// App Store, so the iOS app has no use for it (utils/landingGate.js).
const SHOW_WELCOME_LINK = !Capacitor.isNativePlatform();

// Tailwind migration (Session 95, Phase 1) -- previously AboutPopup.css.
//
// TOPBAR_LOGOIMG/NAME/SUB_CLASSES were previously `.topbar-logoimg`/
// `.topbar-name`/`.topbar-sub` in Topbar.css -- this component is their
// only consumer (Topbar.jsx itself never renders an element with those
// classes), so they migrate here; Topbar.css drops the now-dead rules
// when it's migrated later in this phase. Includes the two responsive
// max-width rules those classes had (collapsed into one -- the original
// 400px and 480px breakpoints both just hid .topbar-sub, so only the
// wider 480px threshold has any observable effect).
//
// .about-trigger's focus-visible outline-offset (3px) is NOT reproduced --
// index.css's global `:focus-visible` rule is deliberately unlayered (see
// its own comment) so it always wins over a layered Tailwind utility
// regardless of specificity, which would make a `focus-visible:` utility
// here dead on arrival anyway. Falls back to the global rule's 2px
// offset -- same color, same width, 1px difference on a keyboard-only
// focus state, not worth fighting the layer system for.
//
// .fa-instagram/.fa-x-twitter/.fa-reddit-alien/.fa-facebook are NOT
// reproduced -- confirmed dead in the current JSX (leftover from a
// Font-Awesome-based implementation predating the inline-SVG icons this
// file's own comment describes; no element anywhere carries these class
// names, so the icons already render in inherited color today, not the
// brand colors those rules implied).
// about-trigger/about-popup/about-close are kept as literal marker strings
// alongside the Tailwind utilities -- topnav-safe-area.cy.js selects and
// asserts on these exact class names. They carry no CSS of their own
// anymore; Tailwind owns the visuals, these are pure test hooks now.
const TRIGGER_CLASSES = 'about-trigger flex items-center gap-2.5 bg-transparent border-0 cursor-pointer p-0 text-left rounded-[8px] [transition:opacity_0.15s] hover:opacity-85';
const TOPBAR_LOGOIMG_CLASSES = 'w-[36px] h-[36px] rounded-[6px] object-contain shrink-0';
const TOPBAR_NAME_CLASSES = 'font-[family-name:var(--font-display)] text-[15px] max-[480px]:text-[13px] font-bold tracking-[0.04em] leading-[1.2]';
const TOPBAR_SUB_CLASSES = 'text-[10px] text-[color:var(--text-muted)] tracking-[0.04em] max-[480px]:hidden';
const POPUP_CLASSES = 'about-popup absolute top-[calc(100%+10px)] left-0 z-[500] w-[300px] max-w-[calc(100vw-24px)] max-h-[calc(100dvh-var(--nav-height)-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-96px)] overflow-y-auto bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-[16px] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.6)] animate-[popupIn_0.18s_cubic-bezier(0.34,1.56,0.64,1)]';
const CLOSE_CLASSES = 'about-close absolute top-3 right-3.5 bg-transparent border-0 text-[14px] text-[color:var(--text-dim)] cursor-pointer py-0.5 px-[5px] rounded-[4px] hover:text-[color:var(--text)] hover:bg-[var(--bg3)]';
const LOGO_ROW_CLASSES = 'flex items-center gap-3 mb-3.5';
const TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[16px] font-bold text-[color:var(--text)]';
const SUBTITLE_CLASSES = 'text-[11px] text-[color:var(--text-muted)] mt-0.5';
const DESC_CLASSES = 'text-[12px] text-[color:var(--text-muted)] leading-[1.55] mb-3.5';
const WELCOME_LINK_CLASSES = 'block -mt-1.5 mb-3.5 text-[12px] font-semibold text-[color:var(--red-bright)] underline-offset-2 hover:underline';
const STATS_ROW_CLASSES = 'flex gap-0 bg-[var(--bg2)] rounded-[10px] overflow-hidden mb-3.5';
const STAT_CLASSES = 'flex-1 flex flex-col items-center py-2 px-1 border-r-[0.5px] border-r-[var(--border)] last:border-r-0';
const STAT_VAL_CLASSES = 'font-[family-name:var(--font-display)] text-[14px] font-bold text-[color:var(--red-bright)]';
const STAT_LABEL_CLASSES = 'text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.06em] mt-0.5';
const DIVIDER_CLASSES = 'h-[0.5px] bg-[var(--border)] my-3.5';
const SUPPORT_CLASSES = 'text-center';
const SUPPORT_TEXT_CLASSES = 'text-[12px] text-[color:var(--text-muted)] leading-[1.5] mb-3';
const BMC_BTN_CLASSES = 'inline-flex items-center gap-2 bg-[#FFDD00] text-black rounded-[10px] py-2.5 px-5 text-[14px] font-bold no-underline [transition:transform_0.1s,box-shadow_0.1s] shadow-[0_2px_12px_rgba(255,221,0,0.3)] hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(255,221,0,0.45)] active:translate-y-0';
const BMC_ICON_CLASSES = 'text-[18px]';
const FOOTER_CLASSES = 'flex justify-between items-center text-[10px] text-[color:var(--text-dim)]';
const VERSION_CLASSES = 'opacity-70';
const CONTACT_CLASSES = 'mt-2.5 text-[11px] text-[color:var(--text-dim)] text-center';
const EMAIL_CLASSES = 'text-[color:var(--text-muted)] no-underline hover:text-[color:var(--text)] hover:underline';
const SOCIAL_CLASSES = 'flex justify-center gap-4 py-1';
const SOCIAL_LINK_CLASSES = 'flex items-center justify-center w-[44px] h-[44px] rounded-[12px] bg-[var(--bg3)] no-underline text-[20px] [transition:background_0.15s,transform_0.1s] hover:bg-[var(--bg2)] hover:-translate-y-0.5';
const PRIVACY_CLASSES = 'text-[10px] text-[color:var(--text-dim)] text-center pt-2 leading-[1.5]';

// Settings' "About EyeWall" row opens this popup, which lives in the top
// bar's logo button, by dispatching this on window.
export const OPEN_ABOUT_EVENT = 'eyewall:open-about';

export default function AboutPopup({ isLive = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const openAbout = () => setOpen(true);
    window.addEventListener(OPEN_ABOUT_EVENT, openAbout);
    return () => window.removeEventListener(OPEN_ABOUT_EVENT, openAbout);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className={TRIGGER_CLASSES}
        onClick={() => setOpen(o => !o)}
        aria-label={t('about.triggerAriaLabel')}
        aria-expanded={open}
      >
        <EyeWallLogo alt="" className={TOPBAR_LOGOIMG_CLASSES} width="36" height="36" />
        {!isLive && (
          <div>
            <div className={TOPBAR_NAME_CLASSES}>EyeWall Analytics</div>
            <div className={TOPBAR_SUB_CLASSES}>{t('about.tagline')}</div>
          </div>
        )}
      </button>

      {open && (
        <div className={POPUP_CLASSES} role="dialog" aria-label={t('about.triggerAriaLabel')}>
          <button className={CLOSE_CLASSES} onClick={() => setOpen(false)} aria-label={t('common.close')}>✕</button>

          <div className={LOGO_ROW_CLASSES}>
            <EyeWallLogo alt="EyeWall Analytics" width="48" height="48" />
            <div>
              <div className={TITLE_CLASSES}>EyeWall Analytics</div>
              <div className={SUBTITLE_CLASSES}>{t('about.tagline')}</div>
            </div>
          </div>

          <p className={DESC_CLASSES}>
            {t('about.description')}
          </p>

          {/* A plain link, not a router Link: the landing page renders
              outside the router, so it needs a full page load. */}
          {SHOW_WELCOME_LINK && (
            <a href="/welcome" className={`about-welcome-link ${WELCOME_LINK_CLASSES}`}>
              {t('about.whatIsEyewall')} →
            </a>
          )}

          <div className={STATS_ROW_CLASSES}>
            <div className={STAT_CLASSES}>
              <span className={STAT_VAL_CLASSES}>{t('about.statLiveValue')}</span>
              <span className={STAT_LABEL_CLASSES}>{t('about.statLiveLabel')}</span>
            </div>
            <div className={STAT_CLASSES}>
              <span className={STAT_VAL_CLASSES}>20s</span>
              <span className={STAT_LABEL_CLASSES}>{t('about.statPollLabel')}</span>
            </div>
            <div className={STAT_CLASSES}>
              <span className={STAT_VAL_CLASSES}>{t('about.statFreeValue')}</span>
              <span className={STAT_LABEL_CLASSES}>{t('about.statFreeLabel')}</span>
            </div>
          </div>

          <div className={DIVIDER_CLASSES} />

          <div className={SOCIAL_CLASSES}>
            <a href="https://www.instagram.com/eyewallanalytics" target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK_CLASSES} aria-label="Instagram">
              <IconInstagram />
            </a>
            <a href="https://x.com/eyewallstats" target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK_CLASSES} aria-label="X / Twitter">
              <IconX />
            </a>
            <a href="https://www.reddit.com/user/eyewallanalytics" target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK_CLASSES} aria-label="Reddit">
              <IconReddit />
            </a>
            <a href="https://www.facebook.com/profile.php?id=61590095322617" target="_blank" rel="noopener noreferrer" className={SOCIAL_LINK_CLASSES} aria-label="Facebook">
              <IconFacebook />
            </a>
          </div>

          <div className={DIVIDER_CLASSES} />

          {SHOW_TIP_LINK && (<>
            <div className={SUPPORT_CLASSES}>
              <p className={SUPPORT_TEXT_CLASSES}>
                {t('about.supportText')}
              </p>
              <a
                href="https://buymeacoffee.com/mattehlers"
                target="_blank"
                rel="noopener noreferrer"
                className={BMC_BTN_CLASSES}
              >
                <span className={BMC_ICON_CLASSES}>☕</span>
                {t('about.buyMeCoffee')}
              </a>
            </div>

            <div className={DIVIDER_CLASSES} />
          </>)}

          <div className={FOOTER_CLASSES}>
            <span>{t('about.builtFor')}</span>
            <span className={VERSION_CLASSES}>{t('about.dataVia')}</span>
          </div>

          <div className={CONTACT_CLASSES}>
            {t('about.contactPrefix')}{' '}
            <a href="mailto:matt@eyewallanalytics.com" className={EMAIL_CLASSES}>
              matt@eyewallanalytics.com
            </a>
          </div>

          <div className={PRIVACY_CLASSES}>
            {t('about.privacyText')}{' '}
            <a href="/privacy.html" className={EMAIL_CLASSES}>
              {t('about.privacyPolicy')}
            </a>
            .
          </div>

          <div className={`about-disclaimer ${PRIVACY_CLASSES}`}>
            {t('about.disclaimer')}
          </div>

          {/* Which build this is, for bug reports. */}
          <div className={`about-version ${PRIVACY_CLASSES}`}>
            {t('about.version', { version: __APP_VERSION__ })}
          </div>
        </div>
      )}
    </div>
  );
}
