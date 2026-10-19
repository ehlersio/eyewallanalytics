import { describe, it, expect, vi, afterEach } from 'vitest'
import { loopDelay, createLoopTimer, DEFAULT_LOOP_PAUSE_MS } from '../replayLoop'

describe('loopDelay', () => {
  it('does not loop unless asked', () => {
    expect(loopDelay(undefined, false)).toBeNull()
    expect(loopDelay(false, false)).toBeNull()
  })

  it('uses the default pause for loop={true}', () => {
    expect(loopDelay(true, false)).toBe(DEFAULT_LOOP_PAUSE_MS)
    expect(DEFAULT_LOOP_PAUSE_MS).toBe(4000)
  })

  it('takes a pause in ms', () => {
    expect(loopDelay(2500, false)).toBe(2500)
    expect(loopDelay(0, false)).toBe(0)
  })

  it('never loops under prefers-reduced-motion', () => {
    expect(loopDelay(true, true)).toBeNull()
    expect(loopDelay(4000, true)).toBeNull()
  })

  it('ignores a nonsense pause', () => {
    expect(loopDelay(-1, false)).toBeNull()
    expect(loopDelay('soon', false)).toBeNull()
  })
})

describe('createLoopTimer', () => {
  afterEach(() => vi.useRealTimers())

  it('plays again after the pause', () => {
    vi.useFakeTimers()
    const timer = createLoopTimer()
    const replay = vi.fn()
    timer.schedule(4000, replay)
    expect(timer.pending).toBe(true)
    vi.advanceTimersByTime(3999)
    expect(replay).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(replay).toHaveBeenCalledTimes(1)
    expect(timer.pending).toBe(false)
  })

  it('a viewer pausing or scrubbing cancels the pending restart', () => {
    vi.useFakeTimers()
    const timer = createLoopTimer()
    const replay = vi.fn()
    timer.schedule(4000, replay)
    timer.cancel()
    vi.advanceTimersByTime(10000)
    expect(replay).not.toHaveBeenCalled()
  })

  it('keeps only one restart pending', () => {
    vi.useFakeTimers()
    const timer = createLoopTimer()
    const first = vi.fn()
    const second = vi.fn()
    timer.schedule(4000, first)
    timer.schedule(4000, second)
    vi.advanceTimersByTime(4000)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('schedules nothing for a null delay (no loop)', () => {
    vi.useFakeTimers()
    const timer = createLoopTimer()
    const replay = vi.fn()
    timer.schedule(null, replay)
    expect(timer.pending).toBe(false)
    vi.advanceTimersByTime(10000)
    expect(replay).not.toHaveBeenCalled()
  })
})
