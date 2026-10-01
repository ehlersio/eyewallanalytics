// src/utils/unitsConfig.js
// Imperial or metric, for speeds and distances (NHL EDGE skating and shot
// speed, distance skated). Storage key: 'eyewall:units'
//
// Until the user picks one in Settings, units follow the app language:
// metric in French, imperial in English -- so switching language switches
// units too. Once they pick, the saved choice wins over the language.
// Same shape as themeConfig.js's "follow the device until chosen".
//
// Usage:
//   import { getUnits, setUnits } from './unitsConfig';
//   getUnits(i18n.language)   // → 'imperial' | 'metric'
//   setUnits('metric')        // persists; useUnits() re-renders
// Components read it through hooks/useUnits.js, which re-renders on a
// change here and on a language change.

const STORAGE_KEY = 'eyewall:units';
const VALID = ['imperial', 'metric'];
export const UNITS_CHANGED_EVENT = 'eyewall:units-changed';

export function getSavedUnits() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID.includes(saved)) return saved;
  } catch {
    // localStorage unavailable — fall through
  }
  return null;
}

export function defaultUnits(locale) {
  return String(locale || '').slice(0, 2).toLowerCase() === 'fr' ? 'metric' : 'imperial';
}

export function getUnits(locale) {
  return getSavedUnits() ?? defaultUnits(locale);
}

export function setUnits(units) {
  if (!VALID.includes(units)) {
    console.warn(`setUnits: unknown units "${units}"`);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, units);
  } catch {
    console.warn('setUnits: localStorage unavailable');
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new window.Event(UNITS_CHANGED_EVENT));
}
