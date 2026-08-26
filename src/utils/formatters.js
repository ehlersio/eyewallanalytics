// src/utils/formatters.js
// Locale-aware number/date formatting, for views to adopt as they migrate
// off manual .toFixed()/string-slicing formatting during the localization
// rollout. French formats as fr-CA (Canadian French) rather than fr-FR --
// the NHL/PWHL audience is predominantly Canadian, and fr-CA's date/number
// conventions (e.g. YYYY-MM-DD-leaning short dates) fit a hockey-stats site
// better than fr-FR's.
//
// Not wired into any view yet -- this is the shared utility later
// extraction phases will import as each view's manual formatting is
// replaced.

import { getLocale } from './localeConfig';

const INTL_LOCALE = { en: 'en-US', fr: 'fr-CA' };

function intlLocale() {
  return INTL_LOCALE[getLocale()] || 'en-US';
}

export function formatNumber(value, options) {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat(intlLocale(), options).format(value);
}

export function formatPercent(value, fractionDigits = 1) {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat(intlLocale(), {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(date, options = { month: 'short', day: 'numeric' }) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(intlLocale(), options).format(d);
}

// French ordinals don't follow English's st/nd/rd/th pattern -- every
// number but 1 just takes "e" (2e, 3e, 21e, 100e), with 1er/1re for one.
// Intl.PluralRules' ordinal categories collapse to exactly that one/other
// split for French, so a locale-keyed suffix table on top of it covers
// both languages without hand-rolling French's simpler rule separately.
const ORDINAL_SUFFIXES = {
  en: { one: 'st', two: 'nd', few: 'rd', other: 'th' },
  fr: { one: 'er', other: 'e' },
};

export function formatOrdinal(value) {
  const v = Math.round(value);
  const locale = getLocale();
  const category = new Intl.PluralRules(intlLocale(), { type: 'ordinal' }).select(v);
  const suffixes = ORDINAL_SUFFIXES[locale] || ORDINAL_SUFFIXES.en;
  return `${v}${suffixes[category] ?? suffixes.other}`;
}
