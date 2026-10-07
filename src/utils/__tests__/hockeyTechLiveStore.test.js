// src/utils/__tests__/hockeyTechLiveStore.test.js
// The PWHL/AHL/ECHL Topbar live chip's shared poller: one poll per league
// and team; /today every 60 s until the team's game is live, then /today
// and that game's /live every 30 s; a push checks at once; the last
// subscriber stops it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createHockeyTechLiveStore, EMPTY_HT_LIVE_STATE, liveGameFor, lastEventClock, chipScore, periodLabel,
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
