// src/utils/__tests__/injuryDetails.test.js
// Unit tests for injuryDetails.js -- imported directly (the module has no
// imports/side effects, unlike nhlApi.js, which injuryIndex.test.js has to
// mirror inline instead).

import { describe, it, expect } from 'vitest'
import { injuryDescription, parseLocalDate, isReturnPast, sortInjuries } from '../injuryDetails'

describe('injuryDescription', () => {
  it('joins side, body part and detail', () => {
    expect(injuryDescription({ injury_type: 'Knee', injury_side: 'Left', injury_detail: 'Surgery' }))
      .toBe('Left Knee · Surgery')
  })

  it('omits missing pieces', () => {
    expect(injuryDescription({ injury_type: 'Shoulder', injury_side: null, injury_detail: 'Surgery' })).toBe('Shoulder · Surgery')
    expect(injuryDescription({ injury_type: 'Upper Body' })).toBe('Upper Body')
  })

  it('ignores a side with no body part', () => {
    expect(injuryDescription({ injury_side: 'Left', injury_detail: 'Fracture' })).toBe('Fracture')
  })

  it('returns null when there is nothing to describe', () => {
    expect(injuryDescription({ status: 'out' })).toBeNull()
    expect(injuryDescription(null)).toBeNull()
  })
})

describe('parseLocalDate', () => {
  it('anchors a bare YYYY-MM-DD to local midnight (not UTC, which shifts a day west of UTC)', () => {
    const d = parseLocalDate('2026-09-20')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 20])
  })

  it('returns null for missing or non-ISO input', () => {
    expect(parseLocalDate(null)).toBeNull()
    expect(parseLocalDate('mid-November')).toBeNull()
  })
})

describe('isReturnPast', () => {
  const today = new Date(2026, 8, 12) // Sep 12 2026, local

  it('flags a return date before today', () => {
    expect(isReturnPast({ return_date: '2026-09-11' }, today)).toBe(true)
  })

  it('does not flag today or a future date', () => {
    expect(isReturnPast({ return_date: '2026-09-12' }, today)).toBe(false)
    expect(isReturnPast({ return_date: '2026-12-26' }, today)).toBe(false)
  })

  it('never flags an entry with no return date', () => {
    expect(isReturnPast({ return_date: null }, today)).toBe(false)
    expect(isReturnPast(null, today)).toBe(false)
  })
})

describe('sortInjuries', () => {
  it('orders worst-first, then by soonest return, then by name', () => {
    const rows = [
      { player_name: 'Dee', status: 'day-to-day', return_date: '2026-09-14' },
      { player_name: 'Ira', status: 'injured-reserve', return_date: '2026-12-01' },
      { player_name: 'Oz',  status: 'out', return_date: '2026-10-01' },
      { player_name: 'Al',  status: 'out', return_date: '2026-09-20' },
      { player_name: 'Sam', status: 'suspension', return_date: null },
      { player_name: 'Zed', status: 'something-new', return_date: null },
    ]
    expect(sortInjuries(rows).map(r => r.player_name)).toEqual(['Ira', 'Al', 'Oz', 'Dee', 'Sam', 'Zed'])
  })

  it('does not mutate its input and tolerates null', () => {
    const rows = [{ player_name: 'B', status: 'out' }, { player_name: 'A', status: 'out' }]
    sortInjuries(rows)
    expect(rows[0].player_name).toBe('B')
    expect(sortInjuries(null)).toEqual([])
  })
})
