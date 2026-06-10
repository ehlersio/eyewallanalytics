// src/utils/themeConfig.js
// Persists the user's light/dark mode preference to localStorage.
// Storage key: 'eyewall:theme'
//
// Usage:
//   import { getTheme, setTheme } from './themeConfig';
//   getTheme()         // → 'dark' | 'light'
//   setTheme('light')  // persists and applies immediately

const STORAGE_KEY = 'eyewall:theme';
const VALID = ['dark', 'light'];

export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID.includes(saved)) return saved;
  } catch {
    // localStorage unavailable — fall through
  }
  return 'dark';
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
