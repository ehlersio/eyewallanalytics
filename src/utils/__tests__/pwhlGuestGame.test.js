// src/utils/__tests__/pwhlGuestGame.test.js
// The PWHL guest game view: which team a link opens as, and that a guest's
// popup flags never mark the followed team's as shown.

import { describe, it, expect } from 'vitest'
import { pwhlGuestTeamFor } from '../pwhlGuestGame'
import { pwhlEventKey } from '../../components/PWHLGameEvents.jsx'

describe('pwhlGuestTeamFor', () => {
  it('opens as the team ?as= names', () => {
    expect(pwhlGuestTeamFor('SEA', null)).toMatchObject({ abbr: 'SEA', teamId: 8 })
  })

  it('opens as the home team without ?as=', () => {
    expect(pwhlGuestTeamFor(null, { homeTeamId: 8, awayTeamId: 3 })).toMatchObject({ abbr: 'SEA' })
  })

  it('opens nothing for an unknown team or no game', () => {
    expect(pwhlGuestTeamFor('XYZ', null)).toBeNull()
    expect(pwhlGuestTeamFor(null, null)).toBeNull()
  })
})

describe('pwhlEventKey', () => {
  it('keeps the followed team’s keys and gives a guest its own', () => {
    expect(pwhlEventKey('win', '326')).toBe('pwhl_win_326')
    expect(pwhlEventKey('goals', '326')).toBe('pwhl_goals_326')
    expect(pwhlEventKey('win', '326', 8)).toBe('pwhl_win_326:guest:8')
  })
})
