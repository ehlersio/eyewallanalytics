// src/utils/__tests__/teamConfig.test.js
// The ids the game view compares play-by-play against (eventOwnerTeamId)
// and the stats endpoints filter on (franchiseId).

import { describe, it, expect } from 'vitest'
import { ALL_TEAMS, getTeamByAbbr } from '../teamConfig.js'

describe('ALL_TEAMS ids', () => {
  it('gives every team its own team and franchise id', () => {
    expect(new Set(ALL_TEAMS.map(t => t.teamId)).size).toBe(ALL_TEAMS.length)
    expect(new Set(ALL_TEAMS.map(t => t.franchiseId)).size).toBe(ALL_TEAMS.length)
  })

  it('has Utah on the Mammoth ids, not Utah HC (59) or Arizona (franchise 28)', () => {
    expect(getTeamByAbbr('UTA')).toMatchObject({ teamId: 68, franchiseId: 40 })
  })
})
