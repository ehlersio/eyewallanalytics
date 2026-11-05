// hooks/useDayTheme.js
//
// Today's theme for the opening animation and the top bar logo: a theme
// name from src/brand/introThemes.js (ALL_THEMES), or null for the plain
// ones. Settings › App decides how (utils/holidayThemeConfig.js):
//
//   1. a ?theme=<name> preview wins, any day
//   2. themes off → none
//   3. today's holiday (introHolidays.js introHoliday)
//   4. the theme the user pinned, if any
//   5. today's season (introSeason), when seasons are on
//
// Re-checked when a setting changes and when the app comes back to the
// foreground, so an app left open overnight picks up the new day.

import { useEffect, useState } from 'react';
import { deviceRegion, introHoliday, introSeason } from '../brand/introHolidays';
import { ALL_THEMES } from '../brand/introThemes';
import { HOLIDAY_THEMES_EVENT, pinnedTheme, themeMode } from '../utils/holidayThemeConfig';

export function currentDayTheme(now = new Date()) {
  if (typeof window === 'undefined') return null;
  const preview = new URLSearchParams(window.location.search).get('theme');
  if (preview && ALL_THEMES[preview]) return preview;
  const mode = themeMode();
  if (mode === 'off') return null;
  return introHoliday(now, deviceRegion())
    ?? pinnedTheme()
    ?? (mode === 'all' ? introSeason(now) : null);
}

export default function useDayTheme() {
  const [theme, setTheme] = useState(() => currentDayTheme());
  useEffect(() => {
    const update = () => setTheme(currentDayTheme());
    const onVisible = () => { if (document.visibilityState === 'visible') update(); };
    window.addEventListener(HOLIDAY_THEMES_EVENT, update);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(HOLIDAY_THEMES_EVENT, update);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return theme;
}
