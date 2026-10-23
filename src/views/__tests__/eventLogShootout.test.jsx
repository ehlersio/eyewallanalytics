// src/views/__tests__/eventLogShootout.test.jsx
// The game view's event log reads shootout attempts by round and result:
// every attempt is at 0:00, so it used to show "SO 00:00 SHOT" for a save,
// "SO 00:00 GOAL" for a shootout goal, and no misses or lost pucks at all.
// CAR@EDM 2026020163 (testHelpers/nhlShootoutFixtures.js).

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchComparisonSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchLeagueSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import '../../i18n/index.js'
import { EventLog } from '../ShotMapView.jsx'
import { buildPlayerMap } from '../../utils/nhlApi'
import { shootoutSummary } from '../../utils/nhlShootout.js'
import { carAtEdm, quinnNoShot } from '../../utils/__tests__/testHelpers/nhlShootoutFixtures.js'

// One string per row, newest first.
const rowsOf = pbp => {
  const html = renderToStaticMarkup(
    <EventLog plays={pbp.plays} playerMap={buildPlayerMap(pbp)} shootout={shootoutSummary(pbp)} />)
  return html.split('<div class="flex items-start').slice(1)
    .map(r => r.replace(/<[^>]+>/g, ' ').replace(/^[^>]*>/, '').replace(/\s+/g, ' ').trim())
}

describe('EventLog in a shootout', () => {
  it('labels each attempt by round and result', () => {
    expect(rowsOf(carAtEdm())).toEqual([
      'SO R3 MISS Seth Jarvis Wide right',
      'SO R3 SO GOAL Ryan Nugent-Hopkins wrist · vs Brandon Bussi',
      'SO R2 MISS Andrei Svechnikov Wide left',
      'SO R2 SAVE Leon Draisaitl backhand · vs Brandon Bussi',
      'SO R1 SAVE Shayne Gostisbehere wrist · vs Devon Levi',
      'SO R1 SAVE Connor McDavid wrist · vs Brandon Bussi',
      // Regulation rows unchanged.
      'P2 05:12 GOAL Connor McDavid Unassisted',
    ])
  })

  it('shows a lost puck as no shot', () => {
    const rows = rowsOf(quinnNoShot())
    expect(rows).toContain('SO R2 NO SHOT Jack Quinn')
  })
})
