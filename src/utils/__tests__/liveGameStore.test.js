// src/utils/__tests__/liveGameStore.test.js
// One live-game poller per team, shared by the Topbar and the shot map
// (audit 2026-10-06 §6): the first subscriber starts it, the last one
// stops it; 10 s during a game, livePollInterval() otherwise; a push
// re-reads the schedule and checks at once; the schedule cache is no
// longer busted every tick.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import { createLiveGameStore, LIVE_POLL_MS, EMPTY_LIVE_STATE } from '../liveGameStore'
import { bustLiveGameCache } from '../nhlApi'
import { cached } from '../cache'

const CAR = { abbr: 'CAR', season: '20262027' }
const BOS = { abbr: 'BOS', season: '20262027' }
const live = { id: 2026020101, gameState: 'LIVE', homeTeam: { abbrev: 'CAR', score: 1 }, awayTeam: { abbrev: 'TBL', score: 0 } }
const pbpOf = (id, n = 1) => ({ id, plays: Array.from({ length: n }, (_, i) => ({ eventId: i })), clock: { timeRemaining: '12:00' } })

// Flush the poller's awaits.
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

function makeStore(overrides = {}) {
  let pushListeners = []
  const deps = {
    getLiveGame: vi.fn(async () => null),
    getAllGames: vi.fn(async () => []),
    getGameDetail: vi.fn(async (id) => pbpOf(id)),
    bustLiveGameCache: vi.fn(),
    bustScheduleCache: vi.fn(),
    livePollInterval: vi.fn(() => 60_000),
    onPushReceived: vi.fn((fn) => {
      pushListeners.push(fn)
      return () => { pushListeners = pushListeners.filter(f => f !== fn) }
    }),
    ...overrides,
  }
  const store = createLiveGameStore(deps)
  return { store, deps, push: () => pushListeners.forEach(fn => fn()), pushCount: () => pushListeners.length }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('liveGameStore', () => {
  it('runs one poller per team however many subscribe', async () => {
    const { store, deps } = makeStore()
    const a = vi.fn(), b = vi.fn()
    const offA = store.subscribe(CAR, a)
    const offB = store.subscribe(CAR, b)
    await settle()
    expect(deps.getLiveGame).toHaveBeenCalledTimes(1)
    expect(deps.onPushReceived).toHaveBeenCalledTimes(1)
    expect(a).toHaveBeenCalledWith({ game: null, pbp: null, checked: true })
    expect(b).toHaveBeenCalledWith({ game: null, pbp: null, checked: true })

    await vi.advanceTimersByTimeAsync(60_000)
    expect(deps.getLiveGame).toHaveBeenCalledTimes(2)

    offA()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(deps.getLiveGame).toHaveBeenCalledTimes(3) // b still subscribed
    offB()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(deps.getLiveGame).toHaveBeenCalledTimes(3) // stopped with the last one
    expect(store.activePollers()).toEqual([])
    expect(store.getSnapshot(CAR)).toBe(EMPTY_LIVE_STATE)
  })

  it('keeps each team to its own poller (a guest game view)', async () => {
    const { store, deps } = makeStore()
    store.subscribe(CAR, vi.fn())
    store.subscribe(BOS, vi.fn())
    await settle()
    expect(deps.getLiveGame.mock.calls.map(c => c[0].abbr).sort()).toEqual(['BOS', 'CAR'])
    expect(store.activePollers().sort()).toEqual(['BOS', 'CAR'])
  })

  it('during a game: busts only the game caches, fetches pbp once per tick, every 10 s', async () => {
    const { store, deps } = makeStore({ getLiveGame: vi.fn(async () => live) })
    const listener = vi.fn()
    store.subscribe(CAR, listener)
    await settle()
    expect(deps.bustLiveGameCache).toHaveBeenCalledWith(live.id, CAR)
    expect(deps.bustScheduleCache).not.toHaveBeenCalled()
    expect(listener).toHaveBeenLastCalledWith({ game: live, pbp: pbpOf(live.id), checked: true })

    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS)
    expect(deps.getLiveGame).toHaveBeenCalledTimes(2)
    expect(deps.getGameDetail).toHaveBeenCalledTimes(2)
    expect(deps.livePollInterval).not.toHaveBeenCalled()
    expect(deps.bustScheduleCache).not.toHaveBeenCalled()
  })

  it('keeps the last play-by-play of the same game when a read fails', async () => {
    const getGameDetail = vi.fn().mockResolvedValueOnce(pbpOf(live.id, 3)).mockRejectedValueOnce(new Error('502'))
    const { store } = makeStore({ getLiveGame: vi.fn(async () => live), getGameDetail })
    store.subscribe(CAR, vi.fn())
    await settle()
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS)
    expect(store.getSnapshot(CAR).pbp.plays).toHaveLength(3)
  })

  it('idle: asks livePollInterval with the schedule', async () => {
    const games = [{ id: 1, gameState: 'FUT', startTimeUTC: '2026-10-07T23:00:00Z' }]
    const { store, deps } = makeStore({ getAllGames: vi.fn(async () => games), livePollInterval: vi.fn(() => 20_000) })
    store.subscribe(CAR, vi.fn())
    await settle()
    expect(deps.livePollInterval).toHaveBeenCalledWith(games, false)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(deps.getLiveGame).toHaveBeenCalledTimes(2)
  })

  it('a push re-reads the schedule and checks at once, then the timer restarts', async () => {
    const { store, deps, push } = makeStore()
    store.subscribe(CAR, vi.fn())
    await settle()
    push()
    await settle()
    expect(deps.bustScheduleCache).toHaveBeenCalledWith(CAR)
    expect(deps.getLiveGame).toHaveBeenCalledTimes(2)
    // One timer, not two: the push's tick replaced the pending one.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(deps.getLiveGame).toHaveBeenCalledTimes(3)
  })

  it('stops listening for pushes when the last subscriber leaves', async () => {
    const { store, pushCount } = makeStore()
    const off = store.subscribe(CAR, vi.fn())
    expect(pushCount()).toBe(1)
    off()
    off() // a second call is harmless
    expect(pushCount()).toBe(0)
  })

  it('refresh({ bustSchedule }) is the app-resume check', async () => {
    const { store, deps } = makeStore()
    store.subscribe(CAR, vi.fn())
    await settle()
    store.refresh(CAR, { bustSchedule: true })
    await settle()
    expect(deps.bustScheduleCache).toHaveBeenCalledTimes(1)
    expect(deps.getLiveGame).toHaveBeenCalledTimes(2)
    store.refresh(BOS) // nobody follows BOS: nothing to do
    await settle()
    expect(deps.getLiveGame).toHaveBeenCalledTimes(2)
  })

  it('drops a tick that answers after everyone left', async () => {
    let resolve
    const { store, deps } = makeStore({ getLiveGame: vi.fn(() => new Promise(r => { resolve = r })) })
    const listener = vi.fn()
    const off = store.subscribe(CAR, listener)
    off()
    resolve(live)
    await settle()
    expect(listener).not.toHaveBeenCalled()
    expect(deps.getGameDetail).not.toHaveBeenCalled()
  })

  it('keeps polling at the last interval after an error', async () => {
    const getLiveGame = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(null)
    const { store, deps } = makeStore({ getLiveGame })
    store.subscribe(CAR, vi.fn())
    await settle()
    await vi.advanceTimersByTimeAsync(60_000) // errors
    await vi.advanceTimersByTimeAsync(60_000)
    expect(deps.getLiveGame).toHaveBeenCalledTimes(3)
  })
})

describe('bustLiveGameCache', () => {
  it('busts the play-by-play and box score, not the schedule', async () => {
    const load = vi.fn(async () => 'fresh')
    await cached('allGames:CAR:20262027', async () => 'schedule', 20_000)
    await cached(`pbp:${live.id}`, async () => 'old pbp', 120_000)
    bustLiveGameCache(live.id, CAR)
    expect(await cached('allGames:CAR:20262027', load, 20_000)).toBe('schedule')
    expect(await cached(`pbp:${live.id}`, load, 120_000)).toBe('fresh')
  })
})
