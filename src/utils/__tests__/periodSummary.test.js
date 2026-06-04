// src/utils/__tests__/periodSummary.test.js
// Unit tests for period/game summary logic functions
// Tests the pure utility functions that don't require React or network calls

import { describe, it, expect } from 'vitest'

// ── Helpers copied from usePeriodSummary.js (pure, no imports needed) ──────

function strengthLabel(strength) {
  if (!strength) return 'ev'
  const s = String(strength).toLowerCase()
  if (s === 'pp' || s === '1451' || s === '1541') return 'pp'
  if (s === 'sh' || s === '0451' || s === '0541') return 'sh'
  return 'ev'
}

function isHighDanger(xCoord, yCoord) {
  const x = Math.abs(xCoord || 0)
  const y = yCoord || 0
  return Math.sqrt((x - 89) ** 2 + y ** 2) < 15
}

function corsiColor(pct) {
  if (pct >= 55) return 'good'
  if (pct <= 45) return 'bad'
  return ''
}

function buildRosterMap(pbp) {
  const map = {}
  const rosters = [
    ...(pbp?.homeTeam?.players || []),
    ...(pbp?.awayTeam?.players || []),
    ...(pbp?.rosterSpots || []),
  ]
  rosters.forEach(p => {
    if (p?.playerId) {
      map[p.playerId] = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim()
        || p.name?.default || null
    }
  })
  return map
}

// ── strengthLabel ────────────────────────────────────────────────────────────

describe('strengthLabel', () => {
  it('returns ev for null/undefined', () => {
    expect(strengthLabel(null)).toBe('ev')
    expect(strengthLabel(undefined)).toBe('ev')
    expect(strengthLabel('')).toBe('ev')
  })

  it('returns pp for string "pp"', () => {
    expect(strengthLabel('pp')).toBe('pp')
    expect(strengthLabel('PP')).toBe('pp')
  })

  it('returns pp for situation codes 1451 and 1541', () => {
    expect(strengthLabel('1451')).toBe('pp')
    expect(strengthLabel('1541')).toBe('pp')
  })

  it('returns sh for string "sh"', () => {
    expect(strengthLabel('sh')).toBe('sh')
    expect(strengthLabel('SH')).toBe('sh')
  })

  it('returns sh for situation codes 0451 and 0541', () => {
    expect(strengthLabel('0451')).toBe('sh')
    expect(strengthLabel('0541')).toBe('sh')
  })

  it('returns ev for all other values', () => {
    expect(strengthLabel('1551')).toBe('ev')
    expect(strengthLabel('ev')).toBe('ev')
    expect(strengthLabel('EV')).toBe('ev')
    expect(strengthLabel('random')).toBe('ev')
  })
})

// ── isHighDanger ─────────────────────────────────────────────────────────────

describe('isHighDanger', () => {
  it('returns true for slot shot (x=85, y=0) — ~4ft from goal', () => {
    expect(isHighDanger(85, 0)).toBe(true)
  })

  it('returns true for sharp angle close in (x=87, y=10)', () => {
    // dist = sqrt((87-89)^2 + 10^2) = sqrt(4+100) = ~10.2
    expect(isHighDanger(87, 10)).toBe(true)
  })

  it('returns false for long shot (x=60, y=0) — far outside', () => {
    // dist = sqrt((60-89)^2) = 29
    expect(isHighDanger(60, 0)).toBe(false)
  })

  it('returns false for exactly 15ft (boundary is strict less-than)', () => {
    // dist exactly 15: x=74, y=0 → sqrt((74-89)^2) = 15
    expect(isHighDanger(74, 0)).toBe(false)
  })

  it('returns true for goal-mouth (x=89, y=0)', () => {
    expect(isHighDanger(89, 0)).toBe(true)
  })

  it('handles negative x coordinates (other end of rink)', () => {
    // Math.abs(-85) = 85, same as x=85
    expect(isHighDanger(-85, 0)).toBe(true)
    expect(isHighDanger(-60, 0)).toBe(false)
  })

  it('returns false for null/zero coordinates', () => {
    // x=0, y=0 → dist = sqrt((0-89)^2) = 89, not high danger
    expect(isHighDanger(0, 0)).toBe(false)
    expect(isHighDanger(null, null)).toBe(false)
  })
})

// ── corsiColor ───────────────────────────────────────────────────────────────

describe('corsiColor', () => {
  it('returns good for >= 55%', () => {
    expect(corsiColor(55)).toBe('good')
    expect(corsiColor(70)).toBe('good')
    expect(corsiColor(100)).toBe('good')
  })

  it('returns bad for <= 45%', () => {
    expect(corsiColor(45)).toBe('bad')
    expect(corsiColor(30)).toBe('bad')
    expect(corsiColor(0)).toBe('bad')
  })

  it('returns empty string for neutral range 46-54%', () => {
    expect(corsiColor(50)).toBe('')
    expect(corsiColor(46)).toBe('')
    expect(corsiColor(54)).toBe('')
  })
})

// ── buildRosterMap ────────────────────────────────────────────────────────────

describe('buildRosterMap', () => {
  it('builds map from homeTeam.players', () => {
    const pbp = {
      homeTeam: {
        players: [
          { playerId: 1, firstName: { default: 'Sebastian' }, lastName: { default: 'Aho' } },
          { playerId: 2, firstName: { default: 'Jaccob' }, lastName: { default: 'Slavin' } },
        ]
      }
    }
    const map = buildRosterMap(pbp)
    expect(map[1]).toBe('Sebastian Aho')
    expect(map[2]).toBe('Jaccob Slavin')
  })

  it('merges homeTeam and awayTeam players', () => {
    const pbp = {
      homeTeam: { players: [{ playerId: 1, firstName: { default: 'A' }, lastName: { default: 'B' } }] },
      awayTeam: { players: [{ playerId: 2, firstName: { default: 'C' }, lastName: { default: 'D' } }] },
    }
    const map = buildRosterMap(pbp)
    expect(map[1]).toBe('A B')
    expect(map[2]).toBe('C D')
  })

  it('falls back to name.default when firstName/lastName missing', () => {
    const pbp = {
      homeTeam: { players: [{ playerId: 5, name: { default: 'N. Ehlers' } }] }
    }
    const map = buildRosterMap(pbp)
    expect(map[5]).toBe('N. Ehlers')
  })

  it('handles empty/null pbp gracefully', () => {
    expect(buildRosterMap(null)).toEqual({})
    expect(buildRosterMap({})).toEqual({})
    expect(buildRosterMap({ homeTeam: {}, awayTeam: {} })).toEqual({})
  })

  it('ignores entries without playerId', () => {
    const pbp = {
      homeTeam: { players: [{ firstName: { default: 'No' }, lastName: { default: 'ID' } }] }
    }
    const map = buildRosterMap(pbp)
    expect(Object.keys(map).length).toBe(0)
  })
})

// ── HDC counting integration ──────────────────────────────────────────────────
// Verifies the full HDC counting logic matches the Shot Map formula

describe('HDC counting (matches Shot Map formula)', () => {
  const CAR_TEAM_ID = 12

  const makePlays = (events) => events.map(e => ({
    typeDescKey: e.type,
    details: {
      eventOwnerTeamId: e.team,
      xCoord: e.x,
      yCoord: e.y,
    }
  }))

  const shotTypes = new Set(['goal', 'shot-on-goal', 'missed-shot', 'blocked-shot'])

  function countHDC(plays, teamId) {
    return plays.filter(p =>
      shotTypes.has(p.typeDescKey) &&
      p.details?.eventOwnerTeamId === teamId &&
      isHighDanger(p.details?.xCoord, p.details?.yCoord)
    ).length
  }

  it('counts slot goal as high danger', () => {
    const plays = makePlays([{ type: 'goal', team: CAR_TEAM_ID, x: 85, y: 0 }])
    expect(countHDC(plays, CAR_TEAM_ID)).toBe(1)
  })

  it('counts blocked shot in the slot as high danger', () => {
    const plays = makePlays([{ type: 'blocked-shot', team: CAR_TEAM_ID, x: 80, y: 5 }])
    expect(countHDC(plays, CAR_TEAM_ID)).toBe(1)
  })

  it('does NOT count long missed shot as high danger', () => {
    const plays = makePlays([{ type: 'missed-shot', team: CAR_TEAM_ID, x: 55, y: 0 }])
    expect(countHDC(plays, CAR_TEAM_ID)).toBe(0)
  })

  it('separates CAR and OPP correctly', () => {
    const plays = makePlays([
      { type: 'shot-on-goal', team: CAR_TEAM_ID, x: 85, y: 0 },
      { type: 'shot-on-goal', team: 99, x: 85, y: 0 },
      { type: 'shot-on-goal', team: 99, x: 85, y: 0 },
    ])
    expect(countHDC(plays, CAR_TEAM_ID)).toBe(1)
    expect(countHDC(plays, 99)).toBe(2)
  })

  it('15ft boundary is strict less-than (not <=)', () => {
    // dist = exactly 15: x=74, y=0
    const atBoundary = makePlays([{ type: 'shot-on-goal', team: CAR_TEAM_ID, x: 74, y: 0 }])
    expect(countHDC(atBoundary, CAR_TEAM_ID)).toBe(0)

    // dist = 14.9: x=74.1, y=0 → sqrt((74.1-89)^2) ≈ 14.9
    const justInside = makePlays([{ type: 'shot-on-goal', team: CAR_TEAM_ID, x: 74.1, y: 0 }])
    expect(countHDC(justInside, CAR_TEAM_ID)).toBe(1)
  })
})
