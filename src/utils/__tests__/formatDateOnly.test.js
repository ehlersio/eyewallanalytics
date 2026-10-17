// src/utils/__tests__/formatDateOnly.test.js
// formatDateOnly (formatters.js): a date-only game_date like "2026-10-16"
// must keep its calendar date in every time zone. The AHL/ECHL schedule
// used a bare new Date('2026-10-16'), which is UTC midnight -- the evening
// before in the US -- so Greensboro's Friday game read "Thu". Each case
// runs under several TZs (Node re-reads process.env.TZ on change), US ones
// included, where that bare parse lands on the previous day.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let locale = 'en'
vi.mock('../localeConfig', () => ({ getLocale: () => locale }))

import { formatDateOnly } from '../formatters'

const ZONES = ['America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu', 'UTC', 'Europe/Paris', 'Pacific/Kiritimati']
const originalTZ = process.env.TZ

beforeEach(() => { locale = 'en' })
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ
  else process.env.TZ = originalTZ
})

describe('formatDateOnly', () => {
  it('a bare parse really does shift the day in New York (the bug this guards)', () => {
    process.env.TZ = 'America/New_York'
    expect(new Date('2026-10-16').getDay()).toBe(4) // Thursday
  })

  it.each(ZONES)('keeps 2026-10-16 a Friday, Oct 16, in %s', tz => {
    process.env.TZ = tz
    expect(formatDateOnly('2026-10-16', { weekday: 'short' })).toBe('Fri')
    expect(formatDateOnly('2026-10-16')).toBe('Oct 16')
    expect(formatDateOnly('2026-10-17', { weekday: 'short', month: 'short', day: 'numeric' })).toBe('Sat, Oct 17')
  })

  it('matches the UTC calendar date of the same day', () => {
    process.env.TZ = 'America/Los_Angeles'
    const utc = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 16)))
    expect(formatDateOnly('2026-10-16', { weekday: 'short' })).toBe(utc)
  })

  it('formats in French through Intl', () => {
    process.env.TZ = 'America/Toronto'
    locale = 'fr'
    expect(formatDateOnly('2026-10-16', { weekday: 'short' })).toBe('ven.')
    expect(formatDateOnly('2026-10-16')).toBe('16 oct.')
  })

  it('reads the date part of a full ISO datetime', () => {
    process.env.TZ = 'America/New_York'
    expect(formatDateOnly('2026-10-16T19:00:00-04:00', { weekday: 'short' })).toBe('Fri')
  })

  it('returns an empty string when there is no usable date', () => {
    expect(formatDateOnly(null)).toBe('')
    expect(formatDateOnly(undefined)).toBe('')
    expect(formatDateOnly('')).toBe('')
    expect(formatDateOnly('Fri, Oct 16')).toBe('')
    expect(formatDateOnly('2026-13-45')).toBe('')
  })
})
