// src/i18n/testSetup.js
// Vitest setup (vite.config.js test.setupFiles): the app loads French on
// demand (i18n/index.js's lazyLocales backend), but unit tests read French
// strings synchronously (i18n.getFixedT('fr') at module load), so every
// test file starts with both bundles in. i18nLazyLocales.test.js covers
// the on-demand path itself.
import i18n from './index';
import fr from './locales/fr.json';

i18n.addResourceBundle('fr', 'translation', fr, true, true);
