// utils/tradeCandidacy.js over the Worker's /trade-candidacy payloads
// (cypress/fixtures: eyewall-pipeline trade_candidacy.py's dry run as of
// 2027-01-01, shaped by the Worker's own summarizeBoard / summarizeCandidacy).

import { describe, it, expect } from 'vitest'
import {
  BOARD_GROUPS, boardGroups, canFilterFit, filterBoard, fmtToi, hasBoard, hasCandidacy, signalKey,
} from '../tradeCandidacy'
import board from '../../../cypress/fixtures/trade-candidacy-board-2027-01-01.json'
import greenway from '../../../cypress/fixtures/trade-candidacy-greenway-2027-01-01.json'

describe('hasCandidacy / hasBoard', () => {
  it('shows only a tiered player with a signal', () => {
    expect(hasCandidacy(greenway)).toBe(true)
    expect(hasCandidacy({ ...greenway, player: { ...greenway.player, signals: [] } })).toBe(false)
    expect(hasCandidacy({ ...greenway, player: { ...greenway.player, tier: null } })).toBe(false)
    expect(hasCandidacy({ player: null })).toBe(false)
    expect(hasCandidacy({ ...greenway, unavailable: true })).toBe(false)
    expect(hasCandidacy(null)).toBe(false)
  })

  it('offers the board only with players', () => {
    expect(hasBoard(board)).toBe(true)
    expect(hasBoard({ players: [] })).toBe(false)
    expect(hasBoard({ ...board, unavailable: true })).toBe(false)
  })
})

describe('signalKey', () => {
  it('words each signal', () => {
    const [expiring, outside] = greenway.player.signals
    expect(signalKey(expiring)).toEqual({
      key: 'playerPopup.candidacy.signals.expiringUfa', params: {},
      note: { key: 'playerPopup.candidacy.signals.derived', params: {} },
    })
    expect(signalKey({ ...expiring, derived: false }).note).toBeUndefined()
    expect(signalKey({ code: 'expiring', expiry_type: null }).key).toBe('playerPopup.candidacy.signals.expiring')
    expect(signalKey(outside)).toEqual({
      key: 'playerPopup.candidacy.signals.outsidePlayoffs', params: { rank: 15, conference: 'W', line: 8 },
    })
    expect(signalKey({ code: 'toi_down', pct: -0.123, recent_toi: 1023, season_toi: 1166 })).toEqual({
      key: 'playerPopup.candidacy.signals.toiDown', params: { pct: '12%', recent: '17:03', season: '19:26' },
    })
  })

  it('uses the board labels when short, and skips unknown codes', () => {
    expect(signalKey(greenway.player.signals[0], { short: true })).toEqual({ key: 'deadlineBoard.signals.expiringUfa', params: {} })
    expect(signalKey({ code: 'rumor' })).toBeNull()
    expect(signalKey(null)).toBeNull()
  })

  it('formats ice time', () => {
    expect(fmtToi(59.6)).toBe('1:00')
    expect(fmtToi(null)).toBeNull()
  })
})

describe('board filters', () => {
  it('offers only the position groups present', () => {
    expect(boardGroups(board.players)).toEqual(BOARD_GROUPS)
    expect(boardGroups(board.players.filter(p => p.position === 'D'))).toEqual(['all'])
    expect(boardGroups(board.players.filter(p => p.position !== 'G'))).toEqual(['all', 'forwards', 'defense'])
  })

  it('filters by group and keeps the model order', () => {
    const d = filterBoard(board.players, { group: 'defense' })
    expect(d.length).toBe(board.players.filter(p => p.position === 'D').length)
    expect(d.every(p => p.position === 'D')).toBe(true)
    expect(d.map(p => p.rank)).toEqual([...d.map(p => p.rank)].sort((a, b) => a - b))
    expect(filterBoard(board.players).length).toBe(board.players.length)
  })

  it('"fits my team" needs a strong or possible fit, and is offered only when one exists', () => {
    expect(canFilterFit(board)).toBe(false) // fixture fetched without ?fit=
    const players = board.players.map((p, i) => ({ ...p, fit: ['strong', 'possible', 'long_shot', null][i % 4] }))
    const withFit = { ...board, fitTeam: 'CAR', players }
    expect(canFilterFit(withFit)).toBe(true)
    const fits = filterBoard(players, { fitOnly: true })
    expect(fits.every(p => p.fit === 'strong' || p.fit === 'possible')).toBe(true)
    expect(fits.length).toBe(players.filter(p => p.fit === 'strong' || p.fit === 'possible').length)
    expect(canFilterFit({ ...withFit, players: players.map(p => ({ ...p, fit: 'long_shot' })) })).toBe(false)
  })
})
