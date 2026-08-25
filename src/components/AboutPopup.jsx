import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import EyeWallLogo from './EyeWallLogo';

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
const POPUP_CLASSES = 'about-popup absolute top-[calc(100%+10px)] left-0 z-[500] w-[300px] max-w-[calc(100vw-24px)] bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-[16px] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.6)] animate-[popupIn_0.18s_cubic-bezier(0.34,1.56,0.64,1)]';
const CLOSE_CLASSES = 'about-close absolute top-3 right-3.5 bg-transparent border-0 text-[14px] text-[color:var(--text-dim)] cursor-pointer py-0.5 px-[5px] rounded-[4px] hover:text-[color:var(--text)] hover:bg-[var(--bg3)]';
const LOGO_ROW_CLASSES = 'flex items-center gap-3 mb-3.5';
const TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[16px] font-bold text-[color:var(--text)]';
const SUBTITLE_CLASSES = 'text-[11px] text-[color:var(--text-muted)] mt-0.5';
const DESC_CLASSES = 'text-[12px] text-[color:var(--text-muted)] leading-[1.55] mb-3.5';
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

// Inline SVGs — replaces Font Awesome CDN (saves 19 KiB render-blocking CSS)
function IconInstagram() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9 114.9-51.3 114.9-114.9S287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8l164.9-188.5L26.8 48h145.6l100.5 132.9L389.2 48zm-24.8 373.8h39.1L151.1 88h-42l255.3 333.8z"/>
    </svg>
  );
}
function IconReddit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M440.3 203.5c-15 0-28.2 6.2-37.9 15.9-35.7-24.7-83.8-40.6-137.1-42.3L293 52.3l88.2 19.8c0 21.6 17.6 39.2 39.2 39.2 21.6 0 39.2-17.6 39.2-39.2S442 32.9 420.4 32.9c-14.4 0-28.2 9.1-34.4 23.5l-97.1-21.6c-2.6-.5-5.2.5-6.8 2.6s-2.1 4.7-1 7.3l-17.6 103c-53.9 1.6-102 17.6-137.7 42.3-9.7-9.7-22.9-15.9-37.9-15.9-54.4 0-76 71.5-23.5 96.2-1.6 7.3-2.6 15-2.6 22.9 0 63.6 74.4 115.6 166.1 115.6s166.1-52 166.1-115.6c0-7.8-1-15.6-2.6-22.9 52.5-24.7 30.9-96.2-23.5-96.2zM176.8 315.4c0-21.6 17.6-39.2 39.2-39.2 21.6 0 39.2 17.6 39.2 39.2 0 21.6-17.6 39.2-39.2 39.2-21.7 0-39.2-17.6-39.2-39.2zm215.4 93.8c-26.3 26.3-76 28.2-101.7 28.2s-75.4-1.9-101.7-28.2c-4.2-4.2-4.2-10.9 0-15.2 4.2-4.2 10.9-4.2 15.2 0 17.1 17.1 56.3 23.5 86.6 23.5s69.5-6.4 86.6-23.5c4.2-4.2 10.9-4.2 15.2 0 3.6 4.3 3.6 11-.2 15.2zm-1.6-54.6c-21.6 0-39.2-17.6-39.2-39.2 0-21.6 17.6-39.2 39.2-39.2 21.6 0 39.2 17.6 39.2 39.2 0 21.7-17.6 39.2-39.2 39.2z"/>
    </svg>
  );
}
function IconFacebook() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256c0 127.8 93.6 233.7 216 252.9V330.9h-65v-74.9h65v-57.1c0-64.1 38.2-99.6 96.7-99.6 28 0 57.3 5 57.3 5v63h-32.3c-31.8 0-41.7 19.7-41.7 39.9v48h71l-11.4 74.9H296v178c122.4-19.2 216-125.1 216-253z"/>
    </svg>
  );
}

export default function AboutPopup({ isLive = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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
        </div>
      )}
    </div>
  );
}
