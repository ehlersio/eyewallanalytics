// utils/opsHealth.js
// The Admin › Health page's ops panels (AdminHealthView): the Worker's
// per-league cron records and the ops reports from /admin/health, and
// which device on this browser/app gets the owner's ops alerts.
// Shapes are eyewall-poller ops.js's:
//   cron: { nhl: { lastPollAt, lastOkAt, lastError, failingSince? } | null, pwhl, ahl, echl }
//   ops:  { <source>: { status: 'failure'|'warn'|'ok', title, body, url, at } }

export const CRON_LEAGUES = ['nhl', 'pwhl', 'ahl', 'echl'];

// The cron runs every minute; a record this old means the ticks stopped
// (or the Worker stopped writing it), not one slow poll.
export const CRON_STALE_MS = 5 * 60 * 1000;

// One row per league, in a fixed order. state: 'ok' | 'failing' (the last
// tick threw) | 'stale' (no tick for CRON_STALE_MS) | 'none' (no record).
export function cronRows(cron, now = Date.now()) {
  if (!cron || typeof cron !== 'object') return [];
  return CRON_LEAGUES.map(league => {
    const rec = cron[league] || null;
    if (!rec) return { league, state: 'none' };
    const lastPoll = Date.parse(rec.lastPollAt || '');
    const state = rec.lastError ? 'failing'
      : !Number.isFinite(lastPoll) || now - lastPoll > CRON_STALE_MS ? 'stale'
      : 'ok';
    return { league, state, ...rec };
  });
}

// Every ops report, newest first.
export function opsRows(ops) {
  if (!ops || typeof ops !== 'object') return [];
  return Object.entries(ops)
    .filter(([, r]) => r && typeof r === 'object')
    .map(([source, r]) => ({ source, ...r }))
    .sort((a, b) => (Date.parse(b.at || '') || 0) - (Date.parse(a.at || '') || 0));
}

// What /ops/unsubscribe needs to drop this device: its iOS token or its
// web push endpoint.
export function opsDeviceId(device) {
  if (device?.platform === 'ios' && device.token) return { token: device.token };
  if (device?.endpoint) return { endpoint: device.endpoint };
  return null;
}

// This device's ops-alert subscription, remembered so the page can say
// it's on and Stop knows what to remove (the team-alerts toggle in
// Settings keeps its own state; turning that off doesn't touch this).
const OPS_DEVICE_KEY = 'eyewall:ops-alerts';

export function loadOpsDevice(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage?.getItem(OPS_DEVICE_KEY) || 'null');
    return raw && (raw.token || raw.endpoint) ? raw : null;
  } catch {
    return null;
  }
}

export function saveOpsDevice(id, storage = globalThis.localStorage) {
  try {
    if (id) storage?.setItem(OPS_DEVICE_KEY, JSON.stringify(id));
    else storage?.removeItem(OPS_DEVICE_KEY);
  } catch { /* private mode etc. */ }
}
