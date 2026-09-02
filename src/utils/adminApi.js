// utils/adminApi.js
// GET /admin/health — news-feed source health, added 2026-09 (a tester
// asked whether news feeds were failing and if there was a way to know).
// The Worker gates this to the app owner by verifying the caller's
// Supabase session token; this just forwards it. See eyewall-poller's
// shared.js verifyAdminUser() for the server side.

const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;

export async function getAdminHealth(accessToken) {
  if (!WORKER_URL || !accessToken) return null;
  const res = await fetch(`${WORKER_URL}/admin/health`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error(`Worker ${res.status}`);
  return res.json();
}
