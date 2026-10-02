// src/utils/__tests__/goalieAreas.test.js
// A goalie's record per NHL shot area: the NHL's own numbers (EDGE) or,
// for the PWHL, our shots against the league's, plus the coloring rules.

import { describe, it, expect, vi } from 'vitest'

vi.mock('../localeConfig', () => ({ getLocale: () => 'en' }))

const {
  nhlAreaRows, pwhlAreaRows, hasAreaData, pctColor, leagueDiffColor, formatSv,
  toAttackingRight, MIN_AREA_SHOTS, PCT_COLORS, AREA_KEYS,
} = await import('../goalieAreas.js')

// A stand-in classifier: low slot within 20 ft of the net, else high slot
const classify = (x) => (x >= 69 ? 'Low Slot' : 'High Slot')

describe('nhlAreaRows', () => {
  it('maps the Worker\'s areas, gating on shots and a real save %', () => {
    const rows = nhlAreaRows({
      'Low Slot': { shots: 229, goals: 40, savePctg: 0.825, pct: 61 },
      'L Corner': { shots: 2, goals: 0, savePctg: 1, pct: 100 },
      'R Corner': { shots: 0, goals: 0, savePctg: null, pct: null },
    })
    expect(rows['Low Slot']).toEqual({ shots: 229, goals: 40, svPct: 0.825, pct: 61, enough: true })
    // 2 shots: the NHL ranks it 100th percentile, but that's a coin flip
    expect(rows['L Corner'].enough).toBe(false)
    expect(rows['R Corner']).toEqual({ shots: 0, goals: 0, svPct: null, pct: null, enough: false })
    expect(nhlAreaRows(null)).toBeNull()
  })
})

describe('pwhlAreaRows', () => {
  it('compares a goalie\'s area save % with the league\'s in that area', () => {
    const goalie = [...Array(10)].map((_, i) => [80, 0, i < 1 ? 1 : 0]) // 10 shots, 1 goal: .900
    const league = [...Array(100)].map((_, i) => [80, 0, i < 20 ? 1 : 0]) // .800
    const rows = pwhlAreaRows(goalie, league, classify)
    expect(rows['Low Slot']).toMatchObject({ shots: 10, goals: 1, enough: true })
    expect(rows['Low Slot'].svPct).toBeCloseTo(0.9)
    expect(rows['Low Slot'].leagueSvPct).toBeCloseTo(0.8)
    expect(rows['Low Slot'].diff).toBeCloseTo(0.1)
  })

  it('folds a shot at the left net onto the right one', () => {
    const rows = pwhlAreaRows([[-80, 3, 0]], [[80, 0, 0]], classify)
    expect(rows['Low Slot'].shots).toBe(1)
    expect(toAttackingRight(-80, 3)).toEqual([80, -3])
    expect(toAttackingRight(60, null)).toEqual([60, 0])
  })

  it('needs enough shots before it compares', () => {
    const rows = pwhlAreaRows([[80, 0, 0]], [[80, 0, 0]], classify)
    expect(rows['Low Slot']).toMatchObject({ enough: false, diff: null })
    expect(MIN_AREA_SHOTS).toBe(5)
    expect(hasAreaData(rows)).toBe(false)
    expect(pwhlAreaRows([], [[80, 0, 0]], classify)).toBeNull()
  })
})

describe('colors and labels', () => {
  it('uses PercentileBar\'s thresholds for NHL percentiles', () => {
    expect(pctColor(67)).toBe(PCT_COLORS.high)
    expect(pctColor(34)).toBe(PCT_COLORS.mid)
    expect(pctColor(33)).toBe(PCT_COLORS.low)
    expect(pctColor(null)).toBeNull()
  })

  it('calls a PWHL area better or worse than the league past .020', () => {
    expect(leagueDiffColor(0.025)).toBe(PCT_COLORS.high)
    expect(leagueDiffColor(0.01)).toBe(PCT_COLORS.mid)
    expect(leagueDiffColor(-0.03)).toBe(PCT_COLORS.low)
  })

  it('writes save % hockey-style', () => {
    expect(formatSv(0.9123)).toBe('.912')
    expect(formatSv(1)).toBe('1.000')
    expect(formatSv(null)).toBeNull()
  })

  it('has a label key for each of the NHL\'s 17 areas', () => {
    expect(Object.keys(AREA_KEYS)).toHaveLength(17)
  })
})
