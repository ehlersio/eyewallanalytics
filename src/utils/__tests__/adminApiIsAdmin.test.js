// The Settings Account section shows an "Admin health" row only when the
// Worker confirms the session is the owner. Anything other than a 200 from
// /admin/health must read as "not the owner" so nobody sees a dead row.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isAdminSession } from '../adminApi';

afterEach(() => { vi.restoreAllMocks(); });

describe('isAdminSession', () => {
  it('is true when /admin/health answers 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sources: [] }) })));
    // adminFetch needs VITE_WORKER_URL (set by .env in this repo); without
    // it every admin call is a no-op null, which must still read as "no".
    expect(await isAdminSession('tok')).toBe(!!import.meta.env.VITE_WORKER_URL);
    if (import.meta.env.VITE_WORKER_URL) expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 404, 500])('is false on %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status, json: async () => ({}) })));
    expect(await isAdminSession('tok')).toBe(false);
  });

  it('is false on a network error and without a token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await isAdminSession('tok')).toBe(false);
    expect(await isAdminSession(null)).toBe(false);
  });
});
