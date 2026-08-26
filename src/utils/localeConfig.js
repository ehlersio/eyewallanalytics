// src/utils/localeConfig.js
// Persists the user's language preference to localStorage and drives
// i18next's active language. Storage key: 'eyewall:locale'
//
// Modeled on themeConfig.js's getTheme()/setTheme() shape (persist +
// apply immediately), NOT SportContext.jsx's reload-based switch --
// SportContext reloads because module-level constants like TEAM_CONFIG
// only re-init on a fresh load. Locale doesn't have that problem:
// i18next.changeLanguage() re-renders every component subscribed via
// useTranslation() on its own, so no reload or custom window event is
// needed here.
//
// Usage:
//   import { getLocale, setLocale } from './localeConfig';
//   getLocale()        // → 'en' | 'fr'
//   setLocale('fr')     // persists and applies immediately

import i18n from '../i18n';

const STORAGE_KEY = 'eyewall:locale';
const VALID = ['en', 'fr'];

// Only the language subtag matters here (a browser reporting 'fr-CA' or
// 'fr-FR' should still resolve to our 'fr' resource bundle).
// `navigator` itself can be entirely absent (e.g. a Node-environment unit
// test importing this module transitively), not just `.language` -- guard
// the whole reference (see i18n/index.js's initialLocale() for the same fix).
function detectBrowserLocale() {
  const lang = typeof navigator !== 'undefined'
    ? (navigator.language || '').slice(0, 2).toLowerCase()
    : '';
  return VALID.includes(lang) ? lang : 'en';
}

export function getLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID.includes(saved)) return saved;
  } catch {
    // localStorage unavailable — fall through
  }
  return detectBrowserLocale();
}

export function setLocale(locale) {
  if (!VALID.includes(locale)) {
    console.warn(`setLocale: unknown locale "${locale}"`);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    console.warn('setLocale: localStorage unavailable');
  }
  i18n.changeLanguage(locale);
}
