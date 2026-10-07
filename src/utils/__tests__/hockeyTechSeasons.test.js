// src/utils/__tests__/hockeyTechSeasons.test.js
// AHL/ECHL season lists from the Worker (contract C7), from its real
// /config/seasons/{ahl,echl}-seasons answers saved 2026-10-07
// (fixtures/hockeytech-seasons/). Today's answer must rebuild exactly the
// hand-written lists the app shipped with; a new season must appear, and
// pair with its regular season, without an app release (the April 2027
// break, audit 2026-10-06 §2).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { seasonsFromWorker, hockeyTechSeasonLabel, reverseSeasonMap } from '../hockeyTechSeasons.js'
import ahlRows from './fixtures/hockeytech-seasons/ahl-seasons.json'
import echlRows from './fixtures/hockeytech-seasons/echl-seasons.json'

vi.mock('../seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
  fetchLeagueSeasons: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

const AHL_2027_PLAYOFFS = { seasonId: 96, seasonName: '2027 Calder Cup Playoffs', seasonType: 'playoffs', startYear: 2027, startDate: '2027-04-19', endDate: '2027-06-20' }
const AHL_2027_28 = { seasonId: 98, seasonName: '2027-28 Regular Season', seasonType: 'regular', startYear: 2027, startDate: '2027-10-08', endDate: '2028-04-16' }

describe('seasonsFromWorker', () => {
  it('rebuilds the AHL list the app shipped with, labels from HockeyTech', () => {
    expect(seasonsFromWorker(ahlRows, { minId: 90 })).toEqual({
      seasons: [
        { id: 94, label: '2026-27', type: 'regular' },
        { id: 90, label: '2025-26', type: 'regular' },
        { id: 92, label: '2026 Calder Cup Playoffs', type: 'playoffs' },
      ],
      playoffSeasonMap: { 90: 92 },
    })
  })

  it('rebuilds the ECHL list, leaving out preseason and the All-Star Game', () => {
    expect(seasonsFromWorker(echlRows, { minId: 73 })).toEqual({
      seasons: [
        { id: 78, label: '2026-27', type: 'regular' },
        { id: 73, label: '2025-26', type: 'regular' },
        { id: 76, label: '2026 Kelly Cup Playoffs', type: 'playoffs' },
      ],
      playoffSeasonMap: { 73: 76 },
    })
  })

  it('picks up the 2027 playoffs and 2027-28 with no app change', () => {
    const built = seasonsFromWorker([AHL_2027_28, AHL_2027_PLAYOFFS, ...ahlRows], { minId: 90 })
    expect(built.seasons.map(s => s.id)).toEqual([98, 94, 90, 96, 92])
    expect(built.seasons.find(s => s.id === 96).label).toBe('2027 Calder Cup Playoffs')
    expect(built.playoffSeasonMap).toEqual({ 90: 92, 94: 96 })
    expect(reverseSeasonMap(built.playoffSeasonMap)).toEqual({ 92: 90, 96: 94 })
  })

  it('keeps the seed (null) for an unusable answer', () => {
    expect(seasonsFromWorker(null)).toBeNull()
    expect(seasonsFromWorker([])).toBeNull()
    expect(seasonsFromWorker([{ seasonId: 92, seasonType: 'playoffs', seasonName: 'x', startYear: 2026 }])).toBeNull()
  })
})

describe('hockeyTechSeasonLabel', () => {
  it('labels regular seasons by their years, playoffs by HockeyTech\'s name', () => {
    expect(hockeyTechSeasonLabel({ seasonId: 94, seasonName: '2026-27 Regular Season', seasonType: 'regular', startYear: 2026 })).toBe('2026-27')
    expect(hockeyTechSeasonLabel({ seasonId: 94, seasonName: '', seasonType: 'regular', startYear: 2026 })).toBe('2026-27')
    expect(hockeyTechSeasonLabel({ seasonId: 76, seasonName: '2026 Kelly Cup Playoffs', seasonType: 'playoffs', startYear: 2026 })).toBe('2026 Kelly Cup Playoffs')
  })
})

describe('ahlConfig: applyAHLSeasons', () => {
  let events
  beforeEach(() => {
    events = []
    globalThis.window = { dispatchEvent: e => events.push(e.type), CustomEvent: class { constructor(type) { this.type = type } } }
    vi.resetModules()
  })

  it('swaps the live lists and maps, and tells mounted pickers', async () => {
    const ahl = await import('../ahlConfig.js')
    expect(ahl.AHL_SEASONS.map(s => s.id)).toEqual([94, 90, 92]) // the seed
    expect(ahl.applyAHLSeasons([AHL_2027_PLAYOFFS, ...ahlRows])).toBe(true)
    expect(ahl.AHL_SEASONS.map(s => s.id)).toEqual([94, 90, 96, 92])
    expect(ahl.AHL_PLAYOFF_SEASONS.map(s => s.id)).toEqual([96, 92])
    expect(ahl.AHL_PLAYOFF_SEASON_MAP).toEqual({ 90: 92, 94: 96 })
    expect(ahl.AHL_REGULAR_SEASON_MAP).toEqual({ 92: 90, 96: 94 })
    expect(ahl.isAHLPlayoffSeason(96)).toBe(true)
    expect(events).toContain('eyewall:ahl-seasons-updated')

    // The league object reads them live.
    const { AHL } = await import('../hockeyTechLeagues.js')
    expect(AHL.config.seasons.map(s => s.id)).toEqual([94, 90, 96, 92])
    expect(AHL.config.seasonLabel(96)).toBe('2027 Calder Cup Playoffs')
  })

  it('keeps the seed when the answer is unusable', async () => {
    const ahl = await import('../ahlConfig.js')
    expect(ahl.applyAHLSeasons({ error: 'x' })).toBe(false)
    expect(ahl.AHL_SEASONS.map(s => s.id)).toEqual([94, 90, 92])
    expect(events).not.toContain('eyewall:ahl-seasons-updated')
  })
})
