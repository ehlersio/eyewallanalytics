// src/utils/__tests__/liveClockStore.test.js
// The Topbar's live chip reads the app-wide clock and momentum. A game view
// watching someone else's game (GameTeamContext.jsx) keeps its own, so its
// clock never shows up under the favorite's score.

import { describe, it, expect } from 'vitest'
import {
  createClockStore, sharedClockStore, publishClock, getClockDisplay, getMomentum,
} from '../liveClockStore.js'

describe('createClockStore', () => {
  it('keeps a private store’s clock and momentum out of the shared one', () => {
    const guest = createClockStore()
    sharedClockStore.clearClock()
    guest.publishClock('12:34', false, false)
    guest.publishMomentum({ carPct: 70, oppPct: 30 })

    expect(guest.getClockDisplay().display).toBe('12:34')
    expect(guest.getMomentum().carPct).toBe(70)
    expect(getClockDisplay()).toBeNull()
    expect(getMomentum()?.carPct).not.toBe(70)
  })

  it('still answers the shared store through the plain exports', () => {
    publishClock('05:00', false, false)
    expect(sharedClockStore.getClockDisplay().display).toBe('05:00')
    expect(getClockDisplay().display).toBe('05:00')
  })
})
