// src/utils/holidayThemeConfig.js
// Holiday themes preference (Settings › App): the holiday versions of the
// opening animation and the top bar logo. On unless the user turns it off.
// Storage key: 'eyewall:holiday-themes' ('off' when turned off).
//
// Usage:
//   holidayThemesOn()          // → true | false
//   setHolidayThemesOn(false)  // persists; fires HOLIDAY_THEMES_EVENT

const STORAGE_KEY = 'eyewall:holiday-themes';
export const HOLIDAY_THEMES_EVENT = 'eyewall:holiday-themes-changed';

export function holidayThemesOn() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setHolidayThemesOn(on) {
  try {
    if (on) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, 'off');
  } catch {
    // localStorage unavailable -- the choice lasts for this page only
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new window.Event(HOLIDAY_THEMES_EVENT));
}
