// src/utils/__tests__/edgeFormat.test.js
// NHL EDGE values read in the user's units, and only metrics with data are
// shown.

import { describe, it, expect, vi } from 'vitest'

vi.mock('../localeConfig', () => ({ getLocale: () => 'en' }))

const { formatEdgeMetric, presentEdgeMetrics } = await import('../edgeFormat.js')

const t = (key, { value }) => ({
  'units.mph': `${value} mph`, 'units.kph': `${value} km/h`, 'units.mi': `${value} mi`, 'units.km': `${value} km`,
}[key])

const speed = { imperial: 24.6119, metric: 39.6089, pct: 100, avg: { imperial: 22.1684, metric: 35.6765 } }

describe('formatEdgeMetric', () => {
  it('reads a speed in the chosen units, value and league average alike', () => {
    expect(formatEdgeMetric('speed', speed, 'imperial', t)).toEqual({ value: '24.6 mph', avg: '22.2 mph' })
    expect(formatEdgeMetric('speed', speed, 'metric', t)).toEqual({ value: '39.6 km/h', avg: '35.7 km/h' })
  })

  it('reads a distance', () => {
    const d = { imperial: 10.5136, metric: 16.9192, pct: 99, avg: { imperial: 9.6011, metric: 15.4507 } }
    expect(formatEdgeMetric('distance', d, 'metric', t)).toEqual({ value: '16.9 km', avg: '15.5 km' })
  })

  it('reads counts and shares the same in either system', () => {
    expect(formatEdgeMetric('count', { value: 681, pct: 100, avg: 75.2 }, 'metric', t)).toEqual({ value: '681', avg: '75.2' })
    expect(formatEdgeMetric('share', { value: 0.4527, pct: 97, avg: 0.4202 }, 'imperial', t)).toEqual({ value: '45.3%', avg: '42.0%' })
  })

  it('has no average when the NHL gave none', () => {
    expect(formatEdgeMetric('count', { value: 5, pct: 50, avg: null }, 'imperial', t)).toEqual({ value: '5', avg: null })
  })
})

describe('presentEdgeMetrics', () => {
  it('keeps the display order and drops metrics without data', () => {
    const rows = presentEdgeMetrics('skater', { topShotSpeed: speed, topSpeed: speed, avgShotSpeed: null })
    expect(rows).toEqual([['topSpeed', 'speed'], ['topShotSpeed', 'speed']])
    expect(presentEdgeMetrics('goalie', null)).toEqual([])
  })
})
