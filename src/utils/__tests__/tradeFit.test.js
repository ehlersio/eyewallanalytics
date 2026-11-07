// utils/tradeFit.js: the section gate, money format, reason and clause keys,
// the top-5 cut and the tier counts.

import { describe, it, expect } from 'vitest'
import { hasTradeFit, fmtMoney, reasonKey, clauseKey, visibleTeams, tierCounts, TOP_N, seasonLabel, isOffseason } from '../tradeFit'

const K = 'playerPopup.tradeFit.reasons.'

describe('hasTradeFit', () => {
  it('needs the player and teams, and no unavailable flag', () => {
    expect(hasTradeFit({ player: { id: 1 }, teams: [{ team: 'DET' }] })).toBe(true)
    expect(hasTradeFit({ player: null, teams: [] })).toBe(false)
    expect(hasTradeFit({ player: { id: 1 }, teams: [] })).toBe(false)
    expect(hasTradeFit({ player: { id: 1 }, teams: [{}], unavailable: true })).toBe(false)
    expect(hasTradeFit(null)).toBe(false)
  })
})

describe('fmtMoney', () => {
  it('formats millions with a real minus sign', () => {
    expect(fmtMoney(3_000_000)).toBe('$3.00M')
    expect(fmtMoney(-5_213_214)).toBe('−$5.21M')
    expect(fmtMoney(null)).toBeNull()
  })
})

describe('reasonKey', () => {
  const label = s => `<${s}>`
  it('maps every pipeline code to a key with params', () => {
    expect(reasonKey({ code: 'need_upgrade', slot: 'D_TOP4', gap: 0.3, slot_need: true }, label)).toEqual({ key: K + 'needSlotNeed', params: { slot: '<D_TOP4>', gap: '+0.30' } })
    expect(reasonKey({ code: 'need_upgrade', slot: 'F_TOP6_C', gap: 1.416, slot_need: false }, label).key).toBe(K + 'needAboveAverage')
    expect(reasonKey({ code: 'need_depth', slot: 'F_BOT6_W', gap: 0.05 }, label).params).toEqual({ slot: '<F_BOT6_W>', gap: '+0.05' })
    expect(reasonKey({ code: 'need_none', slot: 'G_1B' }).key).toBe(K + 'needNone')
    expect(reasonKey({ code: 'need_unrated' }).key).toBe(K + 'needUnrated')
    expect(reasonKey({ code: 'window_term', expires_after: '2031-32' }).params).toEqual({ season: '2031-32' })
    expect(reasonKey({ code: 'window_rental_contender', pct: 0.6132 }).params).toEqual({ pct: '61%' })
    expect(reasonKey({ code: 'window_rental_not', pct: 0.3 }).key).toBe(K + 'windowNotContender')
    expect(reasonKey({ code: 'window_odds_unknown' }).key).toBe(K + 'windowOddsUnknown')
    expect(reasonKey({ code: 'cap_fits', space: 12_500_000 }).params).toEqual({ space: '$12.50M' })
    expect(reasonKey({ code: 'cap_fits_retained', space: 2_000_000 }).key).toBe(K + 'capFitsRetained')
    expect(reasonKey({ code: 'cap_needs_salary', space: -1_000_000 }).params).toEqual({ space: '−$1.00M' })
    expect(reasonKey({ code: 'cap_unknown' }).key).toBe(K + 'capUnknown')
    expect(reasonKey({ code: 'hand_right_shot', right_shots: 1 })).toEqual({ key: K + 'handRightShot', params: { count: 1 } })
  })

  it("notes when a team's roster cap hits aren't all public", () => {
    expect(reasonKey({ code: 'cap_fits', space: 22_620_000, known: 19, roster: 24 }).note).toEqual({ key: K + 'capMissing', params: { count: 5 } })
    expect(reasonKey({ code: 'cap_needs_salary', space: 1, known: 24, roster: 24 }).note).toBeUndefined()
    expect(reasonKey({ code: 'cap_fits', space: 1 }).note).toBeUndefined()
  })

  it('skips unknown or malformed reasons instead of showing raw codes', () => {
    expect(reasonKey({ code: 'something_new' })).toBeNull()
    expect(reasonKey(null)).toBeNull()
    expect(reasonKey({})).toBeNull()
  })
})

describe('clauseKey', () => {
  const C = 'playerPopup.tradeFit.clause.'
  it('names the clause, and "none on record" when there is none', () => {
    expect(clauseKey(null).key).toBe(C + 'none')
    expect(clauseKey({ kind: 'NMC' }).key).toBe(C + 'nmc')
    expect(clauseKey({ kind: 'M-NMC' }).key).toBe(C + 'nmc')
    expect(clauseKey({ kind: 'NTC' }).key).toBe(C + 'ntc')
    expect(clauseKey({ kind: 'M-NTC', listSize: 10 })).toEqual({ key: C + 'mntcSized', params: { count: 10 } })
    expect(clauseKey({ kind: 'M-NTC', listSize: null }).key).toBe(C + 'mntc')
  })
})

describe('visibleTeams / tierCounts', () => {
  const teams = Array.from({ length: 8 }, (_, i) => ({ team: `T${i}`, rank: 8 - i, tier: i < 2 ? 'long_shot' : i < 5 ? 'possible' : 'strong' }))
  it('shows the top five by rank, or all', () => {
    expect(visibleTeams(teams, false).map(t => t.rank)).toEqual([1, 2, 3, 4, 5])
    expect(visibleTeams(teams, true)).toHaveLength(8)
    expect(TOP_N).toBe(5)
  })
  it('counts tiers', () => {
    expect(tierCounts(teams)).toEqual({ strong: 3, possible: 3, long_shot: 2 })
    expect(tierCounts(null)).toEqual({ strong: 0, possible: 0, long_shot: 0 })
  })
})

describe('offseason (Phase 2b)', () => {
  it('labels seasons and reads the phase', () => {
    expect(seasonLabel(20272028)).toBe('2027-28')
    expect(seasonLabel(null)).toBeNull()
    expect(isOffseason({ player: { phase: 'offseason' } })).toBe(true)
    expect(isOffseason({ player: { phase: 'in_season' } })).toBe(false)
    expect(isOffseason(null)).toBe(false)
  })

  it('words Elo contenders, rights and next season\'s cap', () => {
    expect(reasonKey({ code: 'window_rental_contender', basis: 'elo', elo_rank: 4 }, s => s, '2027-28'))
      .toEqual({ key: K + 'windowContenderElo', params: { rank: 4, season: '2027-28' } })
    expect(reasonKey({ code: 'window_rental_not', basis: 'elo', elo_rank: 20 }, s => s, '2027-28').key).toBe(K + 'windowNotContenderElo')
    expect(reasonKey({ code: 'window_rental_contender', pct: 0.7 }).key).toBe(K + 'windowContender') // odds still word as odds
    expect(reasonKey({ code: 'window_rights', expiry_type: 'UFA' })).toEqual({ key: K + 'windowRights', params: {} })
    expect(reasonKey({ code: 'cap_unannounced', season: '2027-28' })).toEqual({ key: K + 'capUnannounced', params: { season: '2027-28' } })
    expect(reasonKey({ code: 'cap_fits', space: 5e6, season: '2027-28' }))
      .toEqual({ key: K + 'capFitsSeason', params: { space: '$5.00M', season: '2027-28' } })
    expect(reasonKey({ code: 'cap_needs_salary', space: -1e6, season: '2027-28', known: 18, roster: 20 }))
      .toMatchObject({ key: K + 'capNeedsSalarySeason', note: { key: K + 'capMissing', params: { count: 2 } } })
    expect(reasonKey({ code: 'cap_rights', space: 4e6, season: '2027-28' }).key).toBe(K + 'capRights')
    expect(reasonKey({ code: 'cap_fits', space: 5e6 }).key).toBe(K + 'capFits') // in season, unchanged
  })
})
