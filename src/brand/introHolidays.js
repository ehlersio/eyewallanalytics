// src/brand/introHolidays.js
//
// Which holiday version of the faceoff intro (FaceoffIntro.jsx) plays, if
// any, for a device's local date and region. Pure functions so the dates can
// be unit-tested; deviceRegion() is the only part that reads the browser.
//
// Holidays that move each year are computed from their rule (the 2nd Monday
// of October, the last Monday of May...), never listed by year.

// The device's region (e.g. "US", "CA") from its preferred languages, which
// on iOS carry the region set in Settings ("en-US", "fr-CA"). Null when no
// language tag names a region -- then only holidays for everyone play.
export function deviceRegion(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  if (!nav) return null;
  const tags = nav.languages?.length ? nav.languages : [nav.language];
  for (const tag of tags) {
    try {
      const region = tag && new Intl.Locale(tag).region;
      if (region) return region;
    } catch {
      // malformed tag -- try the next one
    }
  }
  return null;
}

const MON = 1;
const THU = 4;

// Day of the month of the nth `weekday` (0 = Sunday) in `month` (0-based).
export function nthWeekday(year, month, weekday, n) {
  const first = new Date(year, month, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

// Day of the month of the last `weekday` in `month`.
export function lastWeekday(year, month, weekday) {
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.getDate() - ((lastDay.getDay() - weekday + 7) % 7);
}

const on = (month, day) => d => d.getMonth() === month && d.getDate() === day;

// In calendar order. `regions` null = everyone, including devices with no
// region. `theme` is the key in src/brand/introThemes.js.
export const HOLIDAYS = [
  { theme: 'new-year', regions: null, label: "New Year's Day",
    matches: d => on(0, 1)(d) || on(11, 31)(d) },
  { theme: 'valentines', regions: null, label: "Valentine's Day", matches: on(1, 14) },
  { theme: 'st-patricks', regions: null, label: "St. Patrick's Day", matches: on(2, 17) },
  { theme: 'memorial-day', regions: ['US'], label: 'Memorial Day',
    matches: d => on(4, lastWeekday(d.getFullYear(), 4, MON))(d) },
  { theme: 'canada-day', regions: ['CA'], label: 'Canada Day', matches: on(6, 1) },
  { theme: 'independence-day', regions: ['US'], label: 'Independence Day', matches: on(6, 4) },
  { theme: 'thanksgiving', regions: ['CA'], label: 'Thanksgiving (Canada)',
    matches: d => on(9, nthWeekday(d.getFullYear(), 9, MON, 2))(d) },
  { theme: 'halloween', regions: null, label: 'Halloween', matches: on(9, 31) },
  // Canada marks Remembrance Day on Nov 11, which gets no themed intro.
  { theme: 'veterans-day', regions: ['US'], label: 'Veterans Day', matches: on(10, 11) },
  { theme: 'thanksgiving-us', regions: ['US'], label: 'Thanksgiving (US)',
    matches: d => on(10, nthWeekday(d.getFullYear(), 10, THU, 4))(d) },
  { theme: 'christmas', regions: null, label: 'Christmas Eve and Day',
    matches: d => on(11, 24)(d) || on(11, 25)(d) },
  { theme: 'boxing-day', regions: ['CA'], label: 'Boxing Day', matches: on(11, 26) },
];

// Holiday theme name for this local date and region, or null.
export function introHoliday(date, region) {
  const hit = HOLIDAYS.find(h => (!h.regions || h.regions.includes(region)) && h.matches(date));
  return hit ? hit.theme : null;
}

// The next local date (from `from`, inclusive) each holiday plays in its
// region -- for the dev gallery and tests.
export function nextHolidayDate(holiday, from = new Date()) {
  const region = holiday.regions ? holiday.regions[0] : null;
  for (let i = 0; i < 400; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, 12);
    if (holiday.matches(d) && introHoliday(d, region) === holiday.theme) return d;
  }
  return null;
}

// --- Seasons --------------------------------------------------------------
//
// Longer windows with a quieter version of the intro (no greeting) and a
// logo accent (hooks/useDayTheme.js).
// A holiday on the same day wins; a short season (Halloween week, the run-up
// to Christmas) wins over a long one (fall, winter). In first-match order.

const monthDay = d => d.getMonth() * 100 + d.getDate();
const between = (m1, d1, m2, d2) => d => monthDay(d) >= m1 * 100 + d1 && monthDay(d) <= m2 * 100 + d2;

export const SEASONS = [
  { theme: 'spooky', label: 'Halloween week', window: 'Oct 24–30', matches: between(9, 24, 9, 30) },
  { theme: 'christmas-season', label: 'Christmas season', window: 'Dec 18–23', matches: between(11, 18, 11, 23) },
  { theme: 'fall', label: 'Fall', window: 'Sep 22–Nov 30', matches: between(8, 22, 10, 30) },
  // From free agency (Jul 1) until fall: no hockey to face off in.
  { theme: 'off-season', label: 'Off-season', window: 'Jul 1–Sep 21', matches: between(6, 1, 8, 21) },
  { theme: 'winter', label: 'Winter', window: 'Dec 1–Feb 28/29',
    matches: d => between(11, 1, 11, 31)(d) || between(0, 1, 1, 29)(d) },
];

// Season theme name for this local date, or null.
export function introSeason(date) {
  return SEASONS.find(s => s.matches(date))?.theme ?? null;
}
