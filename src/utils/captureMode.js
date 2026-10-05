/**
 * Dev-only capture mode, for App Store previews and screenshots.
 *
 * `?nologos=1` on any URL hides team logos, league logos and player
 * headshots for the rest of the session; `?nologos=0` turns it off. App
 * Review rejected the app once (4.1(a), Sept 2026) for team branding in its
 * metadata, and previews and screenshots count as metadata.
 *
 * TeamLogo renders its initials fallback instead of the logo. Logos and
 * headshots drawn with a plain <img> are hidden by the `.capture-no-logos`
 * rule in index.css.
 *
 * Never active in production builds.
 */
const NO_LOGOS_KEY = 'eyewall:capture-no-logos';

export function initCaptureMode() {
  if (!import.meta.env.DEV) return;
  try {
    const param = new URLSearchParams(window.location.search).get('nologos');
    if (param === '1') sessionStorage.setItem(NO_LOGOS_KEY, '1');
    else if (param === '0') sessionStorage.removeItem(NO_LOGOS_KEY);
  } catch {
    // sessionStorage unavailable -- capture mode just stays off
  }
  document.documentElement.classList.toggle('capture-no-logos', logosHidden());
}

export function logosHidden() {
  if (!import.meta.env.DEV) return false;
  try {
    return sessionStorage.getItem(NO_LOGOS_KEY) === '1';
  } catch {
    return false;
  }
}
