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
