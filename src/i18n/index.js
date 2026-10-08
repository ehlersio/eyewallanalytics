// src/i18n/index.js
// Initializes i18next as an ambient singleton, imported once by main.jsx
// before the first render (same IIFE-at-import-time style as
// teamConfig.js's live-season fetch). localeConfig.js imports the `i18n`
// instance exported here to drive changeLanguage() -- this module reads
// localStorage directly (rather than importing localeConfig.js) to avoid
// a circular import between the two.

//
// English is bundled; French (another ~150 kB of strings) is loaded on
// demand by the small backend below -- at start when the saved or browser
// language is French (main.jsx waits for `i18nReady` before the first
// render, so French users never see English flash), and on a switch
// (i18n.changeLanguage('fr') resolves once it's loaded).

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

const STORAGE_KEY = 'eyewall:locale';
const VALID = ['en', 'fr'];

function initialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID.includes(saved)) return saved;
  } catch {
    // localStorage unavailable — fall through
  }
  // `navigator` itself (not just `.language`) is missing entirely in a
  // plain Node environment (e.g. vitest's `environment: 'node'` test
  // runner, or any non-browser import of a module that transitively
  // pulls this file in) -- guard the whole reference, not just the
  // property access, or this throws before the try/catch above even
  // gets a chance to matter.
  const browserLang = typeof navigator !== 'undefined'
    ? (navigator.language || '').slice(0, 2).toLowerCase()
    : '';
  return VALID.includes(browserLang) ? browserLang : 'en';
}

// Each language's strings: English from the bundle, French from its own
// chunk.
const LOADERS = {
  en: () => Promise.resolve(en),
  fr: () => import('./locales/fr.json').then(m => m.default),
};

export const lazyLocales = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const load = LOADERS[language];
    if (!load || namespace !== 'translation') { callback(null, {}); return; }
    load().then(data => callback(null, data), err => callback(err, null));
  },
};

export const i18nReady = i18n
  .use(lazyLocales)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    // English is bundled above; anything else comes through lazyLocales.
    partialBundledLanguages: true,
    lng: initialLocale(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes output
    },
  });

export default i18n;
