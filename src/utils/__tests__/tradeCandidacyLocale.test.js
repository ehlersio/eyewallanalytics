// src/utils/__tests__/tradeCandidacyLocale.test.js
// getTradeCandidacy() asks the Worker for the EyeWall AI paragraph in the
// app's language (?locale=), like the other AI fetches (predictionLocale.test.js).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import i18n from '../../i18n'

// nhlApi reads VITE_WORKER_URL once, at import; CI's unit-test step doesn't set it.
let getTradeCandidacy
beforeAll(async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
  ;({ getTradeCandidacy } = await import('../nhlApi.js'))
})

const requested = () => globalThis.fetch.mock.calls.map(([url]) => String(url))

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ player: null, ai: null }) }))
})

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('getTradeCandidacy', () => {
  it('sends the current language', async () => {
    await getTradeCandidacy(8478413)
    await i18n.changeLanguage('fr')
    await getTradeCandidacy(8478414)
    const urls = requested()
    expect(urls.some(u => u.endsWith('/trade-candidacy?player=8478413&locale=en'))).toBe(true)
    expect(urls.some(u => u.endsWith('/trade-candidacy?player=8478414&locale=fr'))).toBe(true)
  })

  it('an explicit locale wins, and anything else is English', async () => {
    await i18n.changeLanguage('fr')
    await getTradeCandidacy(1, 'en')
    await getTradeCandidacy(2, 'de')
    const urls = requested()
    expect(urls.some(u => u.endsWith('/trade-candidacy?player=1&locale=en'))).toBe(true)
    expect(urls.some(u => u.endsWith('/trade-candidacy?player=2&locale=en'))).toBe(true)
  })
})
