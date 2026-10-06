// src/utils/__tests__/narrativeCache.test.js
// The summary popups read a narrative the Worker already generated from
// KV before asking for one. The key has to be the one the Worker writes --
// eyewall-poller's nhl.js /summary/narrative and pwhl.js
// /pwhl/summary/narrative, one per game, period and team:
//   narrative:${period}:${gameId}:${carAbbr}
//   pwhl:narrative:${period}:${gameId}:${carAbbr}
// The NHL lookup used to leave the team off, so it never hit.
//
// fixtures/narrative-cache/narrative-1-2026020018-CAR.json is the live
// Worker's /cache/narrative%3A1%3A2026020018%3ACAR response (WSH @ CAR,
// 2026-10-02, 1st period, as Carolina saw it), fetched 2026-10-06.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import cachedP1 from './fixtures/narrative-cache/narrative-1-2026020018-CAR.json'

// VITE_WORKER_URL is read once, at import; CI's unit-test step doesn't set it.
let nhlNarrativeCacheKey, pwhlNarrativeCacheKey, fetchCachedNarrative
beforeAll(async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
  ;({ nhlNarrativeCacheKey, pwhlNarrativeCacheKey, fetchCachedNarrative } = await import('../narrativeCache.js'))
})

const requested = () => globalThis.fetch.mock.calls.map(([url]) => String(url))
const respond = (status, body) => {
  globalThis.fetch = vi.fn(async () => ({ ok: status === 200, status, json: async () => body }))
}

beforeEach(() => respond(200, cachedP1))

describe('narrative cache keys', () => {
  it('NHL: period, game and the viewing team, as the Worker writes them', () => {
    expect(nhlNarrativeCacheKey(1, 2026020018, 'CAR')).toBe('narrative:1:2026020018:CAR')
    expect(nhlNarrativeCacheKey('game', 2026020018, 'CAR')).toBe('narrative:game:2026020018:CAR')
    // A guest view of the same game reads Washington's, not Carolina's.
    expect(nhlNarrativeCacheKey(1, 2026020018, 'WSH')).toBe('narrative:1:2026020018:WSH')
  })

  it('PWHL: the pwhl: prefix, same shape', () => {
    expect(pwhlNarrativeCacheKey('2', 233, 'OTT')).toBe('pwhl:narrative:2:233:OTT')
    expect(pwhlNarrativeCacheKey('game', 233, 'BOS')).toBe('pwhl:narrative:game:233:BOS')
  })

  it('upper-cases the abbr, as the Worker does', () => {
    expect(nhlNarrativeCacheKey(2, 2026020018, 'car')).toBe('narrative:2:2026020018:CAR')
    expect(pwhlNarrativeCacheKey(1, 212, 'ny')).toBe('pwhl:narrative:1:212:NY')
  })

  it('no key without a team, game or period', () => {
    expect(nhlNarrativeCacheKey(1, 2026020018, null)).toBeNull()
    expect(nhlNarrativeCacheKey(1, null, 'CAR')).toBeNull()
    expect(pwhlNarrativeCacheKey(null, 233, 'OTT')).toBeNull()
  })
})

describe('fetchCachedNarrative', () => {
  it('reads the key through /cache/, encoded', async () => {
    const got = await fetchCachedNarrative('narrative:1:2026020018:CAR')
    expect(requested()).toEqual(['https://worker.test/cache/narrative%3A1%3A2026020018%3ACAR'])
    expect(got).toEqual({ narrative: cachedP1.narrative, cardNarrative: null })
  })

  it('keeps a card narrative when there is one', async () => {
    respond(200, { narrative: 'Long text.', cardNarrative: 'Short.' })
    expect(await fetchCachedNarrative('narrative:game:2026020018:CAR'))
      .toEqual({ narrative: 'Long text.', cardNarrative: 'Short.' })
  })

  it('null when nothing is cached, or nothing to read', async () => {
    respond(404, null)
    expect(await fetchCachedNarrative('narrative:1:2026020018:CAR')).toBeNull()
    respond(200, { narrative: '' })
    expect(await fetchCachedNarrative('narrative:1:2026020018:CAR')).toBeNull()
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') })
    expect(await fetchCachedNarrative('narrative:1:2026020018:CAR')).toBeNull()
  })

  it('no request without a key', async () => {
    expect(await fetchCachedNarrative(null)).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
