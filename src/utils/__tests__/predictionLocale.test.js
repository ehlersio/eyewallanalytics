// src/utils/__tests__/predictionLocale.test.js
// AI predictions follow the app language: every prediction fetch sends
// ?locale=, and the Worker cache key for French gets a ':fr' suffix while
// English keeps its original key.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import i18n from '../../i18n'

// The API modules read VITE_WORKER_URL once, at import, and skip the fetch
// entirely without it -- CI's unit-test step doesn't set it (local runs get
// it from .env). Stub it, then import them.
let getGamePrediction, getGameMatchup, predictionCacheKey
let fetchPWHLPrediction, fetchAHLPrediction, fetchECHLPrediction
beforeAll(async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.test')
  ;({ getGamePrediction, getGameMatchup, predictionCacheKey } = await import('../supabaseClient.js'))
  ;({ fetchPWHLPrediction } = await import('../pwhlApi.js'))
  ;({ fetchAHLPrediction } = await import('../ahlApi.js'))
  ;({ fetchECHLPrediction } = await import('../echlApi.js'))
})

const requested = () => globalThis.fetch.mock.calls.map(([url]) => String(url))

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => [{ prediction_text: 'texte', matchup_text: 'trios', generated_at: 'x' }],
  }))
})

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('predictionCacheKey', () => {
  it('keeps the English key unchanged and suffixes French', () => {
    expect(predictionCacheKey(2026020001, 'CAR', 'en')).toBe('prediction:2026020001:CAR')
    expect(predictionCacheKey(2026020001, 'CAR', 'fr')).toBe('prediction:2026020001:CAR:fr')
  })
})

describe('prediction fetches send the current language', () => {
  it('NHL prediction and matchup default to i18n.language', async () => {
    await i18n.changeLanguage('fr')
    expect((await getGamePrediction(11)).text).toBe('texte')
    expect((await getGameMatchup(12)).text).toBe('trios')
    const urls = requested()
    expect(urls.some(u => u.includes('/game-predictions?gameId=11&locale=fr'))).toBe(true)
    expect(urls.some(u => u.includes('/game-predictions?gameId=12&locale=fr'))).toBe(true)
  })

  it('an explicit locale wins', async () => {
    await i18n.changeLanguage('fr')
    await getGamePrediction(13, 'en')
    expect(requested().some(u => u.includes('/game-predictions?gameId=13&locale=en'))).toBe(true)
  })

  it.each([
    ['pwhl', () => fetchPWHLPrediction],
    ['ahl', () => fetchAHLPrediction],
    ['echl', () => fetchECHLPrediction],
  ])('%s prediction', async (league, getFetcher) => {
    await i18n.changeLanguage('fr')
    await getFetcher()(210)
    expect(requested().some(u => u.includes(`/${league}/prediction?gameId=210&locale=fr`))).toBe(true)
  })
})
