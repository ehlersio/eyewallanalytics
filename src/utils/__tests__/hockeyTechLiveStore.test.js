// src/utils/__tests__/hockeyTechLiveStore.test.js
// The PWHL/AHL/ECHL Topbar live chip's shared poller: one poll per league
// and team; /today every 60 s until the team's game is live, then /today
// and that game's /live every 30 s; a push checks at once; the last
// subscriber stops it. The clock is /today's scorebar snapshot, or the last
// /live event's from an older Worker.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createHockeyTechLiveStore, EMPTY_HT_LIVE_STATE, liveGameFor, lastEventClock, chipScore, periodLabel,
  scorebarClock, clockPeriodNumber, chipClock,
} from '../hockeyTechLiveStore'

const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

const HER = 319
const pre  = { gameId: 7, homeTeamId: HER, awayTeamId: 380, homeTeamCode: 'HER', awayTeamCode: 'TEX', homeScore: 0, awayScore: 0, status: 'pre' }
const live = { ...pre, status: 'live', homeScore: 1, awayScore: 0 }
const other = { gameId: 8, homeTeamId: 1, awayTeamId: 2, homeTeamCode: 'A', awayTeamCode: 'B', status: 'live' }
const liveData = { gameId: 7, homeScore: 2, awayScore: 1, events: [{ eventType: 'shot', period: 1, time: '4:00' }, { eventType: 'goal', period: 2, time: '12:34' }] }

function makeStore() {
  let push = []
  const api = { fetchToday: vi.fn(async () => [pre, other]), fetchLive: vi.fn(async () => liveData) }
  const store = createHockeyTechLiveStore({
    apis: { ahl: api },
    onPushReceived: fn => { push.push(fn); return () => { push = push.filter(f => f !== fn) } },
  })
  return { store, api, push: () => push.forEach(fn => fn()), pushCount: () => push.length }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('helpers', () => {
  it('finds only the team\'s live game', () => {
    expect(liveGameFor([pre, other], HER)).toBeNull()
    expect(liveGameFor([live, other], HER)).toBe(live)
    expect(liveGameFor(null, HER)).toBeNull()
  })

  it('reads the period and time of the last event', () => {
    expect(lastEventClock(liveData)).toEqual({ period: 2, time: '12:34', shootout: false })
    expect(lastEventClock({ events: [] })).toBeNull()
  })

  it('labels periods, overtime and the shootout', () => {
    expect(periodLabel({ period: 2 })).toBe('P2')
    expect(periodLabel({ period: 4 })).toBe('OT')
    expect(periodLabel({ period: 5 })).toBe('2OT')
    expect(periodLabel({ period: 5, shootout: true })).toBe('SO')
    expect(periodLabel(null)).toBeNull()
  })

  it('labels from the Worker\'s periodLabel when the number is missing', () => {
    expect(periodLabel({ period: null, label: '2nd' })).toBe('P2')
    expect(periodLabel({ period: null, label: 'OT' })).toBe('OT')
    expect(periodLabel({ period: null, label: '2OT' })).toBe('2OT')
    expect(periodLabel({ period: null, label: 'SO', shootout: true })).toBe('SO')
    expect(clockPeriodNumber({ period: null, label: '3rd' })).toBe(3)
    expect(clockPeriodNumber({ period: null, label: '2OT' })).toBe(5)
    expect(clockPeriodNumber({ period: null, label: 'SO', shootout: true })).toBeNull()
  })

  it('reads the scorebar clock off a /today row', () => {
    expect(scorebarClock({ ...live, period: 2, periodType: 'REG', periodLabel: '2nd', clock: '07:58', inIntermission: false }))
      .toEqual({ period: 2, time: '07:58', shootout: false, label: '2nd', inIntermission: false })
    expect(scorebarClock({ ...live, period: 5, periodType: 'OT', periodLabel: '2OT', clock: '00:00', inIntermission: true }))
      .toEqual({ period: 5, time: '00:00', shootout: false, label: '2OT', inIntermission: true })
    expect(scorebarClock({ ...live, period: null, periodType: 'SO', periodLabel: 'SO', clock: null, inIntermission: false }))
      .toEqual({ period: null, time: null, shootout: true, label: 'SO', inIntermission: false })
  })

  it('has no scorebar clock from an older Worker or an empty scorebar', () => {
    expect(scorebarClock(live)).toBeNull()       // none of the keys
    expect(scorebarClock(null)).toBeNull()
    expect(scorebarClock({ ...live, period: null, periodType: null, periodLabel: null, clock: null, inIntermission: false })).toBeNull()
  })

  it('gives the chip the period and clock in play', () => {
    expect(chipClock({ period: 2, time: '07:58', shootout: false, label: '2nd', inIntermission: false }))
      .toEqual({ period: 'P2', time: '07:58' })
    expect(chipClock({ period: 4, time: '03:12', shootout: false })).toEqual({ period: 'OT', time: '03:12' })
    expect(chipClock(lastEventClock(liveData))).toEqual({ period: 'P2', time: '12:34' })
    expect(chipClock(null)).toEqual({ period: null, time: null })
  })

  it('gives the chip the intermission and no clock', () => {
    const int = period => ({ period, time: '00:00', shootout: false, inIntermission: true })
    expect(chipClock(int(1))).toEqual({ period: '1st INT', time: null })
    expect(chipClock(int(2))).toEqual({ period: '2nd INT', time: null })
    expect(chipClock(int(3))).toEqual({ period: '3rd INT', time: null })
    expect(chipClock(int(4))).toEqual({ period: 'OT INT', time: null })
    expect(chipClock(int(5))).toEqual({ period: '2OT INT', time: null })
    expect(chipClock({ ...int(null), label: '2nd' })).toEqual({ period: '2nd INT', time: null })
    // No period at all: nothing rather than a stopped clock.
    expect(chipClock(int(null))).toEqual({ period: null, time: null })
  })

  it('gives the chip SO and no clock in a shootout', () => {
    expect(chipClock({ period: null, time: null, shootout: true, label: 'SO', inIntermission: false }))
      .toEqual({ period: 'SO', time: null })
    expect(chipClock({ period: 5, time: '0:00', shootout: true })).toEqual({ period: 'SO', time: null })
  })

  it('puts the followed team first, home or away', () => {
    expect(chipScore(live, HER)).toEqual({ myAbbr: 'HER', oppAbbr: 'TEX', myScore: 1, oppScore: 0 })
    expect(chipScore(live, 380)).toEqual({ myAbbr: 'TEX', oppAbbr: 'HER', myScore: 0, oppScore: 1 })
  })
})

describe('createHockeyTechLiveStore', () => {
  it('polls /today every 60 s while nothing is live, without reading /live', async () => {
    const { store, api } = makeStore()
    const states = []
    store.subscribe('ahl', HER, s => states.push(s))
    await settle()
    expect(states.at(-1)).toEqual({ game: null, clock: null, live: null, checked: true })
    expect(api.fetchLive).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(59_000)
    expect(api.fetchToday).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(api.fetchToday).toHaveBeenCalledTimes(2)
  })

  it('once live: the game with /live\'s newer score and clock, every 30 s', async () => {
    const { store, api } = makeStore()
    api.fetchToday.mockImplementation(async () => [live, other])
    const states = []
    store.subscribe('ahl', HER, s => states.push(s))
    await settle()
    expect(api.fetchLive).toHaveBeenCalledWith(7)
    expect(states.at(-1).game).toMatchObject({ gameId: 7, homeScore: 2, awayScore: 1 })
    expect(states.at(-1).clock).toEqual({ period: 2, time: '12:34', shootout: false })
    // The play-by-play itself, for the Shot Map's event popups.
    expect(states.at(-1).live).toBe(liveData)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(api.fetchToday).toHaveBeenCalledTimes(2)
  })

  it('prefers /today\'s scorebar clock over the last event', async () => {
    const { store, api } = makeStore()
    const scorebar = { period: 2, periodType: 'REG', periodLabel: '2nd', clock: '07:58', inIntermission: false }
    api.fetchToday.mockImplementation(async () => [{ ...live, ...scorebar }])
    const states = []
    store.subscribe('ahl', HER, s => states.push(s))
    await settle()
    expect(states.at(-1).clock).toEqual({ period: 2, time: '07:58', shootout: false, label: '2nd', inIntermission: false })
    // The play-by-play is still read, for the score and the event popups.
    expect(states.at(-1).live).toBe(liveData)
    expect(states.at(-1).game.homeScore).toBe(2)
    // The intermission, on the next tick.
    api.fetchToday.mockImplementation(async () => [{ ...live, ...scorebar, clock: '00:00', inIntermission: true }])
    await vi.advanceTimersByTimeAsync(30_000)
    expect(states.at(-1).clock).toMatchObject({ period: 2, time: '00:00', inIntermission: true })
  })

  it('falls back to the last event when the scorebar is empty or absent (older Worker)', async () => {
    const { store, api } = makeStore()
    api.fetchToday.mockImplementation(async () => [{ ...live, period: null, periodType: null, periodLabel: null, clock: null, inIntermission: false }])
    const states = []
    store.subscribe('ahl', HER, s => states.push(s))
    await settle()
    expect(states.at(-1).clock).toEqual({ period: 2, time: '12:34', shootout: false })
  })

  it('keeps the scorebar clock when a /live read fails', async () => {
    const { store, api } = makeStore()
    api.fetchToday.mockImplementation(async () => [{ ...live, period: 3, periodType: 'REG', periodLabel: '3rd', clock: '01:02', inIntermission: false }])
    store.subscribe('ahl', HER, () => {})
    await settle()
    api.fetchLive.mockRejectedValueOnce(new Error('offline'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(store.getSnapshot('ahl', HER).clock).toMatchObject({ period: 3, time: '01:02' })
  })

  it('keeps the last clock when a /live read fails', async () => {
    const { store, api } = makeStore()
    api.fetchToday.mockImplementation(async () => [live])
    const states = []
    store.subscribe('ahl', HER, s => states.push(s))
    await settle()
    api.fetchLive.mockRejectedValueOnce(new Error('offline'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(states.at(-1).clock).toEqual({ period: 2, time: '12:34', shootout: false })
    expect(states.at(-1).game.homeScore).toBe(1) // /today's, without /live
    expect(states.at(-1).live).toBe(liveData)     // and the last play-by-play
  })

  it('drops the play-by-play once the game is no longer live', async () => {
    const { store, api } = makeStore()
    api.fetchToday.mockImplementation(async () => [live])
    const states = []
    store.subscribe('ahl', HER, s => states.push(s))
    await settle()
    api.fetchToday.mockImplementation(async () => [{ ...live, status: 'final' }])
    await vi.advanceTimersByTimeAsync(30_000)
    expect(states.at(-1)).toEqual({ game: null, clock: null, live: null, checked: true })
  })

  it('polls each team on its own: a guest team beside the followed one', async () => {
    const { store, api } = makeStore()
    api.fetchToday.mockImplementation(async () => [live])
    const her = [], tex = []
    store.subscribe('ahl', HER, s => her.push(s))
    store.subscribe('ahl', 380, s => tex.push(s))
    await settle()
    expect(api.fetchToday).toHaveBeenCalledTimes(2)
    expect(chipScore(her.at(-1).game, HER).myAbbr).toBe('HER')
    expect(chipScore(tex.at(-1).game, 380).myAbbr).toBe('TEX')
  })

  it('shares one poll between subscribers and stops with the last', async () => {
    const { store, api, pushCount } = makeStore()
    const off1 = store.subscribe('ahl', HER, () => {})
    const off2 = store.subscribe('ahl', HER, () => {})
    await settle()
    expect(api.fetchToday).toHaveBeenCalledTimes(1)
    off1()
    expect(pushCount()).toBe(1)
    off2()
    expect(pushCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(api.fetchToday).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot('ahl', HER)).toBe(EMPTY_HT_LIVE_STATE)
  })

  it('checks at once on a push', async () => {
    const { store, api, push } = makeStore()
    store.subscribe('ahl', HER, () => {})
    await settle()
    push()
    await settle()
    expect(api.fetchToday).toHaveBeenCalledTimes(2)
  })

  it('checks at once on refresh(), only while someone is subscribed', async () => {
    const { store, api } = makeStore()
    store.refresh('ahl', HER)
    await settle()
    expect(api.fetchToday).not.toHaveBeenCalled()
    const off = store.subscribe('ahl', HER, () => {})
    await settle()
    store.refresh('ahl', HER)
    await settle()
    expect(api.fetchToday).toHaveBeenCalledTimes(2)
    off()
    store.refresh('ahl', HER)
    await settle()
    expect(api.fetchToday).toHaveBeenCalledTimes(2)
  })

  it('subscribes to nothing for an unknown league or no team', () => {
    const { store, api } = makeStore()
    store.subscribe('nhl', HER, () => {})()
    store.subscribe('ahl', null, () => {})()
    expect(api.fetchToday).not.toHaveBeenCalled()
  })
})
