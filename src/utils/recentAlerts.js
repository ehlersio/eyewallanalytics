// utils/recentAlerts.js -- the notifications bell's Recent alerts
// (Settings redesign step 7, 2026-09): what eyewall-poller sent for the
// teams you follow in the last 3 days (GET /alerts/recent), whether or not
// push is on here.

import { withAlertTeam } from './summaryLink';

const SEEN_KEY = 'eyewall:alerts-seen-at';

// One entry per event for a fan of both teams in a game, from the side of
// the team first in `order` (alert keys, primary first) -- as push does.
export function dedupeAlerts(alerts, order) {
  const rank = key => { const i = order.indexOf(key); return i < 0 ? Infinity : i; };
  return alerts.filter(a => !(a.vs && order.includes(a.vs) && rank(a.vs) < rank(a.team)));
}

export const ALERT_ICONS = {
  goal: '🚨', oppGoal: '😬', hatTrick: '🎩', gameStart: '🏒', periodStart: '🔔', periodEnd: '📋',
  penalty: '⚡', goaliePulled: '🥅', win: '🏆', loss: '📉',
};

// "now", "8m", "3h", then a weekday -- short enough for a row's corner.
export function alertAge(at, now = Date.now(), locale = 'en') {
  const mins = Math.floor((now - at) / 60000);
  if (mins < 1) return locale === 'fr' ? 'à l’instant' : 'now';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return new Date(at).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'short' });
}

// Where tapping an alert goes: an in-app path other than the home page
// (a summary link, with the alert's team on it), or nowhere -- the row is
// just information.
export const alertLink = a => (typeof a.url === 'string' && a.url.startsWith('/') && !a.url.startsWith('//') && a.url !== '/'
  ? withAlertTeam(a.url, a.team) : null);

// The newest alert time this device has already seen in the bell. The
// first time there's none: whatever is there now counts as seen, so a new
// user isn't greeted by three days of dots.
export function loadAlertsSeenAt() {
  try { const v = Number(localStorage.getItem(SEEN_KEY)); return v > 0 ? v : null; } catch { return null; }
}
export function saveAlertsSeenAt(at) {
  try { localStorage.setItem(SEEN_KEY, String(at)); } catch { /* private mode etc. */ }
}
export const hasNewAlerts = (alerts, seenAt) => seenAt != null && alerts.some(a => a.at > seenAt);

// ── Clearing ────────────────────────────────────────────────────
// Alerts are one shared log per team on the poller, so clearing only hides
// them on this device: one by one (their ids), or everything up to a time
// (Clear all). Ids older than the log's 3 days can't come back, so they're
// pruned rather than kept forever.
const DISMISSED_KEY = 'eyewall:alerts-dismissed';
const CLEARED_AT_KEY = 'eyewall:alerts-cleared-at';
const LOG_MS = 3 * 24 * 60 * 60 * 1000;

// No id from the poller: team + time + type is unique in its log, and is
// what the bell has always keyed rows on.
export const alertId = a => `${a.team}:${a.at}:${a.type}`;

export function loadCleared() {
  try {
    const ids = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    const at = Number(localStorage.getItem(CLEARED_AT_KEY));
    return { ids: new Set(Array.isArray(ids) ? ids : []), at: at > 0 ? at : 0 };
  } catch { return { ids: new Set(), at: 0 }; }
}

function saveCleared({ ids, at }) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
    localStorage.setItem(CLEARED_AT_KEY, String(at));
  } catch { /* private mode etc. */ }
  return { ids, at };
}

export function dismissAlert(cleared, alert, now = Date.now()) {
  const keep = [...cleared.ids].filter(id => Number(id.split(':').at(-2)) > now - LOG_MS);
  return saveCleared({ ids: new Set([...keep, alertId(alert)]), at: cleared.at });
}

export function clearAllAlerts(alerts) {
  const newest = alerts.reduce((max, a) => Math.max(max, a.at), 0);
  return saveCleared({ ids: new Set(), at: newest || Date.now() });
}

export const visibleAlerts = (alerts, cleared) =>
  alerts.filter(a => a.at > cleared.at && !cleared.ids.has(alertId(a)));
