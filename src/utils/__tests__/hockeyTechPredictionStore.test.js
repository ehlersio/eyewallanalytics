// src/utils/__tests__/hockeyTechPredictionStore.test.js
// One prediction store per HockeyTech league, under the localStorage keys
// the old ahl/echl/pwhlPredictionStore.js modules used, so predictions
// saved before the move still count.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { stubBrowserGlobals } from './testHelpers/mockSupabaseAuth.js'
import { createPredictionStore, predictionStorageKey } from '../hockeyTechPredictionStore'

beforeEach(() => { stubBrowserGlobals() })
afterEach(() => { vi.unstubAllGlobals() })

describe('predictionStorageKey', () => {
  it('keeps the existing per-league keys', () => {
    expect(predictionStorageKey('ahl')).toBe('eyewall_ahl_predictions_v1')
    expect(predictionStorageKey('echl')).toBe('eyewall_echl_predictions_v1')
    expect(predictionStorageKey('pwhl')).toBe('eyewall_pwhl_predictions_v1')
  })
})

describe.each(['ahl', 'echl', 'pwhl'])('%s store', (key) => {
  const store = () => createPredictionStore(key)

  it('starts empty', () => {
    expect(store().load()).toEqual([])
    expect(store().getStats()).toEqual({ total: 0, correct: 0, pct: null, avgError: null })
  })

  it('reads predictions already saved under the league key', () => {
    localStorage.setItem(`eyewall_${key}_predictions_v1`, JSON.stringify([{ gameId: 9, predictedTeamWin: true }]))
    expect(store().load()).toEqual([{ gameId: 9, predictedTeamWin: true }])
  })

  it('saves a prediction and updates it in place by gameId', () => {
    const s = store()
    s.save({ gameId: 1, opponent: 'OPP', predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 2 })
    s.save({ gameId: 1, predictedTeamScore: 3.5 })
    const preds = s.load()
    expect(preds).toHaveLength(1)
    expect(preds[0]).toMatchObject({ gameId: 1, opponent: 'OPP', predictedTeamScore: 3.5 })
  })

  it('records outcomes and aggregates only the recorded ones', () => {
    const s = store()
    s.save({ gameId: 4, predictedTeamWin: true,  predictedTeamScore: 3, predictedOppScore: 2 })
    s.save({ gameId: 5, predictedTeamWin: false, predictedTeamScore: 2, predictedOppScore: 3 })
    s.save({ gameId: 6, predictedTeamWin: true,  predictedTeamScore: null, predictedOppScore: null })
    s.save({ gameId: 7, predictedTeamWin: true,  predictedTeamScore: 3, predictedOppScore: 2 }) // no outcome yet
    s.recordOutcome(4, 4, 1) // correct, error |3-4| + |2-1| = 2
    s.recordOutcome(5, 4, 1) // incorrect, error |2-4| + |3-1| = 4
    s.recordOutcome(6, 1, 4) // incorrect, no predicted score: error unmeasured
    s.recordOutcome(999, 1, 0) // unknown game: no-op
    const byId = Object.fromEntries(s.load().map(p => [p.gameId, p]))
    expect(byId[4]).toMatchObject({ teamWon: true, correct: true, scoreDiff: 2 })
    expect(byId[5]).toMatchObject({ teamWon: true, correct: false, scoreDiff: 4 })
    expect(byId[6]).toMatchObject({ teamWon: false, correct: false, scoreDiff: null })
    expect(byId[999]).toBeUndefined()
    expect(s.getStats()).toEqual({ total: 3, correct: 1, pct: 33, avgError: 3 })
  })
})

it('keeps the two leagues apart', () => {
  createPredictionStore('ahl').save({ gameId: 1, predictedTeamWin: true })
  expect(createPredictionStore('echl').load()).toEqual([])
  expect(JSON.parse(localStorage.getItem('eyewall_ahl_predictions_v1'))).toEqual([{ gameId: 1, predictedTeamWin: true }])
})
