// src/utils/holidayThemeConfig.js
// Holiday & seasonal themes preferences (Settings › App): the themed
// versions of the opening animation and the top bar logo.
//
//   mode   'all' (default): holidays and seasons follow the date
//          'holidays':      holidays only
//          'off':           neither, and no pinned theme either
//   pinned a season theme to use every day (PINNABLE_THEMES), or null to
//          follow the date. Holidays still take over on their day. The
//          solemn days (Memorial Day, Veterans Day) are never pinnable.
//
// Storage: 'eyewall:holiday-themes' ('off' | 'holidays'; absent = 'all'),
// 'eyewall:pinned-theme'. Every change fires HOLIDAY_THEMES_EVENT.

const MODE_KEY = 'eyewall:holiday-themes';
const PINNED_KEY = 'eyewall:pinned-theme';
export const HOLIDAY_THEMES_EVENT = 'eyewall:holiday-themes-changed';

export const THEME_MODES = ['off', 'holidays', 'all'];
export const PINNABLE_THEMES = ['fall', 'spooky', 'winter', 'christmas-season', 'off-season'];

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable -- the choice lasts for this page only
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new window.Event(HOLIDAY_THEMES_EVENT));
}

export function themeMode() {
  const saved = read(MODE_KEY);
  return saved === 'off' || saved === 'holidays' ? saved : 'all';
}

export function setThemeMode(mode) {
  write(MODE_KEY, mode === 'off' || mode === 'holidays' ? mode : null);
}

export function pinnedTheme() {
  const saved = read(PINNED_KEY);
  return PINNABLE_THEMES.includes(saved) ? saved : null;
}

export function setPinnedTheme(name) {
  write(PINNED_KEY, PINNABLE_THEMES.includes(name) ? name : null);
}
