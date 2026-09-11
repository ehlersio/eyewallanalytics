// src/utils/__tests__/injuryIndex.test.js
// Unit tests for nhlApi.js's buildInjuryIndex()/normalizePlayerName()
// (matching /injuries rows to skaters/goalies and to line-combination
// player names). Mirrored inline rather than imported directly, same
// as staticLines.test.js — nhlApi.js has module-load side effects
// (TEAM_CONFIG/localStorage) this suite shouldn't need to touch.

import { describe, it, expect } from 'vitest'

function normalizePlayerName(name) {
  return (name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function buildInjuryIndex(rows) {
  const byId = new Map()
  const byName = new Map()
  for (const row of rows || []) {
    if (row.player_id != null) byId.set(String(row.player_id), row)
    const key = normalizePlayerName(row.player_name)
    if (key) byName.set(key, row)
  }
  return {
    forPlayer(playerId, name) {
      return (playerId != null && byId.get(String(playerId)))
        || (name && byName.get(normalizePlayerName(name)))
        || null
    },
  }
}

describe('normalizePlayerName', () => {
  it('strips diacritics', () => {
    expect(normalizePlayerName('Sebastian Aho')).toBe('sebastian aho')
    expect(normalizePlayerName('Jesperi Kotkaniemi')).toBe('jesperi kotkaniemi')
  })

  it('lowercases and collapses whitespace', () => {
    expect(normalizePlayerName('  Eric   Robinson ')).toBe('eric robinson')
  })

  it('drops punctuation', () => {
    expect(normalizePlayerName("Ryan O'Reilly")).toBe('ryan oreilly')
  })

  it('returns empty string for null/undefined', () => {
    expect(normalizePlayerName(null)).toBe('')
    expect(normalizePlayerName(undefined)).toBe('')
  })
})

describe('buildInjuryIndex', () => {
  const rows = [
    { player_id: 8480222, player_name: 'Seth Jarvis', status: 'out' },
    { player_id: null, player_name: 'Eric Robinson', status: 'day-to-day' },
  ]
  const index = buildInjuryIndex(rows)

  it('matches by playerId when present', () => {
    expect(index.forPlayer(8480222, 'Seth Jarvis')?.status).toBe('out')
  })

  it('falls back to normalized name when playerId is null/unmatched', () => {
    expect(index.forPlayer(null, 'Eric Robinson')?.status).toBe('day-to-day')
    expect(index.forPlayer(undefined, 'eric   robinson')?.status).toBe('day-to-day')
  })

  it('falls through to name matching when a given playerId is not in the index', () => {
    expect(index.forPlayer(9999999, 'Eric Robinson')?.status).toBe('day-to-day')
  })

  it('returns null for a player not in the injury report', () => {
    expect(index.forPlayer(1234567, 'Andrei Svechnikov')).toBeNull()
  })

  it('handles an empty or missing rows array', () => {
    expect(buildInjuryIndex([]).forPlayer(1, 'Anyone')).toBeNull()
    expect(buildInjuryIndex(undefined).forPlayer(1, 'Anyone')).toBeNull()
  })
})
