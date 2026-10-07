// src/hooks/__tests__/useEndedGameSnapshot.test.jsx
// The ended live game's data for the popup hooks: the last live data at
// once, then fetched answers until one is final (winPopupReplay.test.jsx
// plays whole games through it).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '../../utils/__tests__/testHelpers/renderHook.jsx'
import { useEndedGameSnapshot } from '../useEndedGameSnapshot.js'

const isFinal = d => d?.status === 'final'
const view = fetchGame => ({ isLive, id, data }) =>
  useEndedGameSnapshot(isLive ? id : null, isLive, data, fetchGame, isFinal)

afterEach(() => vi.useRealTimers())

describe('useEndedGameSnapshot', () => {
  it('is null while live and before any game was live', async () => {
    const fetchGame = vi.fn(async () => ({ status: 'final' }))
    const h = renderHook(view(fetchGame), { isLive: false, id: null, data: null })
    await h.flush()
    expect(h.result.current).toBeNull()
    expect(fetchGame).not.toHaveBeenCalled()
    h.rerender({ isLive: true, id: 7, data: { status: 'live' } })
    expect(h.result.current).toBeNull()
  })

  it('returns the last live data at once, then the final answer', async () => {
    let resolve
    const fetchGame = vi.fn(() => new Promise(r => { resolve = r }))
    const h = renderHook(view(fetchGame), { isLive: true, id: 7, data: { status: 'live', n: 1 } })
    h.rerender({ isLive: true, id: 7, data: { status: 'live', n: 2 } })
    h.rerender({ isLive: false, id: null, data: null })
    expect(h.result.current).toEqual({ status: 'live', n: 2 })
    await h.flush()
    expect(fetchGame).toHaveBeenCalledWith(7)
    expect(h.result.current).toEqual({ status: 'live', n: 2 })
    resolve({ status: 'final', n: 3 })
    await h.flush()
    expect(h.result.current).toEqual({ status: 'final', n: 3 })
  })

  it('gives up after maxTries answers that are not final', async () => {
    vi.useFakeTimers()
    const fetchGame = vi.fn(async () => ({ status: 'live' }))
    const h = renderHook(({ isLive }) => useEndedGameSnapshot(isLive ? 7 : null, isLive, null, fetchGame, isFinal, { intervalMs: 1000, maxTries: 3 }), { isLive: true })
    h.rerender({ isLive: false })
    await h.flush()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchGame).toHaveBeenCalledTimes(3)
  })

  it('keeps trying after a failed fetch', async () => {
    vi.useFakeTimers()
    const fetchGame = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ status: 'final' })
    const h = renderHook(view(fetchGame), { isLive: true, id: 7, data: null })
    h.rerender({ isLive: false, id: null, data: null })
    await h.flush()
    expect(h.result.current).toBeNull()
    await vi.advanceTimersByTimeAsync(30_000)
    await h.flush()
    expect(h.result.current).toEqual({ status: 'final' })
  })

  it('a new live game drops the old snapshot and stops its fetches', async () => {
    vi.useFakeTimers()
    const fetchGame = vi.fn(async id => ({ status: 'live', id }))
    const h = renderHook(view(fetchGame), { isLive: true, id: 7, data: { status: 'live', id: 7 } })
    h.rerender({ isLive: false, id: null, data: null })
    await h.flush()
    h.rerender({ isLive: true, id: 8, data: { status: 'live', id: 8 } })
    expect(h.result.current).toBeNull()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetchGame).toHaveBeenCalledTimes(1)
    h.rerender({ isLive: false, id: null, data: null })
    expect(h.result.current).toEqual({ status: 'live', id: 8 })
  })
})
