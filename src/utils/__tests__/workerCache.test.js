// src/utils/__tests__/workerCache.test.js
// Worker GETs use the browser's HTTP cache (the Worker's Cache-Control and
// ETag decide), and a user's refresh revalidates instead of reusing a copy.
// Every request used to send cache: 'no-store' (audit 2026-10-06 §14).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { workerFetchInit } from '../workerCache.js'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('workerFetchInit', () => {
  it('leaves the cache mode to the browser by default', () => {
    expect(workerFetchInit()).toEqual({})
    expect(workerFetchInit({ fresh: false })).toEqual({})
  })

  it('revalidates (never no-store) when fresh data is asked for', () => {
    expect(workerFetchInit({ fresh: true })).toEqual({ cache: 'no-cache' })
  })
})

describe('pwhlApi', () => {
  it('no longer sends no-store', async () => {
    vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
    vi.doMock('../seasonClient', () => ({ fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline'))), fetchComparisonSeasons: vi.fn(() => Promise.reject(new Error('offline'))) }))
    const fetchWithRetry = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ gameId: 1 }) }))
    vi.doMock('../retryFetch', async (orig) => ({ ...(await orig()), fetchWithRetry }))
    const { fetchPWHLLive } = await import('../pwhlApi.js')
    await fetchPWHLLive(1)
    expect(fetchWithRetry).toHaveBeenCalledWith('https://worker.test/pwhl/live/1', { init: {} })
  })
})
