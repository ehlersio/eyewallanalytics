// hooks/useHoliday.js
//
// Today's holiday theme (src/brand/introHolidays.js) for the holiday logo
// and opening animation, or null: off when the user has turned holiday
// themes off in Settings. A ?theme=<name> preview wins either way.
//
// Re-checked when the setting changes and when the app comes back to the
// foreground, so an app left open overnight picks up the new day.

import { useEffect, useState } from 'react';
import { deviceRegion, introHoliday } from '../brand/introHolidays';
import { THEMES } from '../brand/introThemes';
import { HOLIDAY_THEMES_EVENT, holidayThemesOn } from '../utils/holidayThemeConfig';

export function currentHoliday(now = new Date()) {
  if (typeof window === 'undefined') return null;
  const preview = new URLSearchParams(window.location.search).get('theme');
  if (preview && THEMES[preview]) return preview;
  if (!holidayThemesOn()) return null;
  return introHoliday(now, deviceRegion());
}

export default function useHoliday() {
  const [holiday, setHoliday] = useState(() => currentHoliday());
  useEffect(() => {
    const update = () => setHoliday(currentHoliday());
    const onVisible = () => { if (document.visibilityState === 'visible') update(); };
    window.addEventListener(HOLIDAY_THEMES_EVENT, update);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(HOLIDAY_THEMES_EVENT, update);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return holiday;
}
