// src/components/__tests__/localPredictionScorecard.test.jsx
// The PWHL/AHL/ECHL League page's Scorecard tab (Phase 3 B5): this
// device's graded predictions (hockeyTechPredictionStore getStats/load),
// the NHL scorecard's empty state when nothing is graded; and the PWHL
// prediction share card, now drawn for the AHL/ECHL too.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchComparisonSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import i18n from '../../i18n/index.js'
import LocalPredictionScorecard from '../LocalPredictionScorecard.jsx'
import { PWHLPredictionCanvas } from '../PWHLPredictionShareCanvas.jsx'
import { createPredictionStore } from '../../utils/hockeyTechPredictionStore.js'

const textOf = el => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

let mem
beforeEach(async () => {
  mem = new Map()
  globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }
  await i18n.changeLanguage('en')
})

describe('LocalPredictionScorecard', () => {
  it('shows the NHL scorecard\'s empty state when nothing is graded', () => {
    const store = createPredictionStore('ahl')
    store.save({ gameId: 1, gameDate: '2026-10-10', opponent: 'TEX', predictedTeamWin: true, predictedTeamScore: 3.1, predictedOppScore: 2.4 })
    const text = textOf(<LocalPredictionScorecard store={store} />)
    expect(text).toContain('Your prediction record')
    expect(text).toContain(i18n.t('scorecard.empty'))
  })

  it('shows the record, goals off and the latest graded games', () => {
    const store = createPredictionStore('ahl')
    store.save({ gameId: 1, gameDate: '2026-10-10', opponent: 'TEX', predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 2 })
    store.save({ gameId: 2, gameDate: '2026-10-12', opponent: 'CLT', predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 3 })
    store.save({ gameId: 3, gameDate: '2026-10-15', opponent: 'ROC', predictedTeamWin: false, predictedTeamScore: 2, predictedOppScore: 3 })
    store.recordOutcome(1, 4, 2) // right, off by 1
    store.recordOutcome(2, 1, 2) // wrong, off by 3
    const text = textOf(<LocalPredictionScorecard store={store} />)
    expect(text).toContain('Picked right 50%')
    expect(text).toContain('Goals off 2')
    expect(text).toContain('2 graded')
    expect(text).toContain('vs CLT: predicted a win, final 1–2')
    expect(text).toContain('vs TEX: predicted a win, final 4–2')
    expect(text).not.toContain('ROC') // not graded yet
    expect(text.indexOf('CLT')).toBeLessThan(text.indexOf('TEX')) // newest first
  })
})

describe('prediction share card', () => {
  const props = { canvasRef: { current: null }, abbr: 'HER', oppAbbr: 'TEX', color: '#ac7374', oppColor: '#ccc', myWinPct: 58, oppWinPct: 42, myExp: 3.2, oppExp: 2.6, myStreak: 'W2', oppStreak: 'L1', narrative: 'x' }

  it('names the league and uses its logos', () => {
    const html = renderToStaticMarkup(<PWHLPredictionCanvas {...props} sport="ahl" leagueLabel="AHL" />)
    expect(html).toContain('AHL · ')
    expect(html).not.toContain('PWHL')
  })

  it('is the PWHL card by default', () => {
    expect(renderToStaticMarkup(<PWHLPredictionCanvas {...props} abbr="MTL" oppAbbr="BOS" />)).toContain('PWHL · ')
  })
})
