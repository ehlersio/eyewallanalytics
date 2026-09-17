// src/utils/themeConfig.js
// Light/dark mode preference. Storage key: 'eyewall:theme'
//
// Until the user picks a theme in Settings, the app follows the device's
// light/dark setting, live -- so it matches the iOS launch splash, which can
// only follow the device. Once they pick one, that choice is saved and wins.
//
// Usage:
//   import { getTheme, setTheme, subscribeSystemTheme } from './themeConfig';
//   getTheme()         // → 'dark' | 'light' (saved choice, else the device's)
//   setTheme('light')  // persists and applies immediately
//   subscribeSystemTheme(mode => ...)  // device changes, only while nothing is saved

const STORAGE_KEY = 'eyewall:theme';
const VALID = ['dark', 'light'];
const LIGHT_QUERY = '(prefers-color-scheme: light)';

export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID.includes(saved)) return saved;
  } catch {
    // localStorage unavailable — fall through
  }
  return null;
}

// Dark when the device doesn't say, matching the app's original default.
export function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

export function getTheme() {
  return getSavedTheme() ?? getSystemTheme();
}

export function setTheme(theme) {
  if (!VALID.includes(theme)) {
    console.warn(`setTheme: unknown theme "${theme}"`);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    console.warn('setTheme: localStorage unavailable');
  }
  document.documentElement.setAttribute('data-theme', theme);
}

// Calls onChange('light' | 'dark') when the device's setting flips, but only
// while the user hasn't saved a choice. Returns an unsubscribe function.
//
// Also re-checks when the page becomes visible again (e.g. back from Control
// Center), in case a change event was missed while the app was backgrounded.
export function subscribeSystemTheme(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(LIGHT_QUERY);
  let last = getSystemTheme();
  const report = (mode) => {
    if (getSavedTheme() !== null || mode === last) return;
    last = mode;
    onChange(mode);
  };
  const onMediaChange = (e) => report(e.matches ? 'light' : 'dark');
  const onVisible = () => {
    if (document.visibilityState === 'visible') report(getSystemTheme());
  };
  mql.addEventListener?.('change', onMediaChange);
  document.addEventListener?.('visibilitychange', onVisible);
  return () => {
    mql.removeEventListener?.('change', onMediaChange);
    document.removeEventListener?.('visibilitychange', onVisible);
  };
}
