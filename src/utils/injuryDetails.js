// src/utils/injuryDetails.js
// Pure helpers for the /injuries detail fields (injury_type/injury_side/
// injury_detail/return_date -- eyewall-pipeline's injuries.py, from ESPN's
// per-entry `details` object; any of them can be null). Deliberately no
// imports: no i18n, no nhlApi module-load side effects, so the Vitest
// suite can import this file directly instead of mirroring it inline.

// Worst-first ordering for a team's injury report.
const STATUS_RANK = { 'injured-reserve': 0, out: 1, 'day-to-day': 2, suspension: 3 };

// "Left" + "Knee" + "Surgery" -> "Left Knee · Surgery". Body part/detail
// values are ESPN's raw English strings -- external data, left
// untranslated per the localization policy for API values.
export function injuryDescription(row) {
  if (!row) return null;
  const type = row.injury_type || null;
  const where = type && row.injury_side ? `${row.injury_side} ${type}` : type;
  const parts = [where, row.injury_detail || null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// ESPN's return_date is a bare "YYYY-MM-DD". `new Date('2026-09-20')`
// parses as UTC midnight, which renders as Sep 19 anywhere west of UTC --
// anchor it to local midnight instead (same fix as TransactionsFeed.jsx).
export function parseLocalDate(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return null;
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function localYmd(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

// True when ESPN's own estimated return date is already behind us -- the
// clearest signal that an entry may be stale (ESPN's feed is known to keep
// healed injuries around for months; see injuries.py's docstring). An
// entry with no return_date is never flagged.
export function isReturnPast(row, today = new Date()) {
  if (!row?.return_date) return false;
  return row.return_date.slice(0, 10) < localYmd(today);
}

export function sortInjuries(rows) {
  const rank = (r) => STATUS_RANK[r.status] ?? 4;
  return [...(rows || [])].sort((a, b) =>
    rank(a) - rank(b)
    || (a.return_date || '9999').localeCompare(b.return_date || '9999')
    || (a.player_name || '').localeCompare(b.player_name || ''),
  );
}
