// utils/adminApi.js
// GET /admin/health — news-feed source health, added 2026-09 (a tester
// asked whether news feeds were failing and if there was a way to know).
// Since 2026-10 it also carries the Worker pollers' `cron` records, the
// pipeline's `ops` reports and the ops-alert subscriber count. The Worker
// gates it to the app owner by verifying the caller's Supabase session
// token; this just forwards it. See eyewall-poller's shared.js
// verifyAdminUser() for the server side.
//
// POST /ops/subscribe, POST /ops/unsubscribe — this device's ops alerts
// (eyewall-poller ops.js): the same body the app sends to /push/subscribe
// (hooks/usePushNotifications.js subscriptionPayload), the same owner
// gate. Both answer { ok, count }.

const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;

function statusError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function adminFetch(path, accessToken, init = {}) {
  if (!WORKER_URL || !accessToken) return null;
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw statusError('Unauthorized', 401);
  // A Worker without the route (deployed before it) -- the page says the
  // feature isn't available rather than showing a raw error.
  if (res.status === 404) throw statusError('Unavailable', 404);
  if (!res.ok) throw statusError(`Worker ${res.status}`, res.status);
  return res.json();
}

export async function getAdminHealth(accessToken) {
  return adminFetch('/admin/health', accessToken);
}

// Whether this session is the app owner, as the Worker decides it: true
// only when /admin/health answers 200. 401 (not the owner), 404 (Worker
// without the route), network errors and a missing token all mean "no",
// so a non-owner never sees a dead Admin row in Settings.
export async function isAdminSession(accessToken) {
  if (!accessToken) return false;
  try {
    return (await getAdminHealth(accessToken)) !== null;
  } catch {
    return false;
  }
}

const jsonPost = body => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// payload: subscriptionPayload(device) -- web { endpoint, keys, ... } or
// iOS { platform: 'ios', token }.
export async function subscribeOps(payload, accessToken) {
  return adminFetch('/ops/subscribe', accessToken, jsonPost(payload));
}

// id: { endpoint } (web) or { token } (iOS), as subscribed.
export async function unsubscribeOps(id, accessToken) {
  return adminFetch('/ops/unsubscribe', accessToken, jsonPost(id));
}
