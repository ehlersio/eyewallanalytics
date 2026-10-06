// src/components/__tests__/topbarLiveGate.test.js
// The Topbar's NHL live-score poll runs on NHL routes only. It used to be
// gated on `isPWHL || isAHL`, so ECHL routes kept polling the NHL favourite's
// schedule and could show its live chip above ECHL pages (audit 2026-10-06).

import { describe, it, expect } from 'vitest'
import { pollsNhlLive, noLiveLabel } from '../Topbar.jsx'

describe('pollsNhlLive', () => {
  it('polls only on NHL routes', () => {
    expect(pollsNhlLive('nhl')).toBe(true)
    expect(pollsNhlLive('pwhl')).toBe(false)
    expect(pollsNhlLive('ahl')).toBe(false)
    expect(pollsNhlLive('echl')).toBe(false)
  })
})

describe('noLiveLabel', () => {
  it('names the league on non-NHL routes, including the ECHL', () => {
    expect(noLiveLabel('pwhl')).toBe('PWHL')
    expect(noLiveLabel('ahl')).toBe('AHL')
    expect(noLiveLabel('echl')).toBe('ECHL')
  })

  it('leaves the NHL label to the translated off-season text', () => {
    expect(noLiveLabel('nhl')).toBeNull()
  })
})
