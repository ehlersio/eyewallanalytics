// Holiday intros are picked from the device's local date and region.

import { describe, it, expect } from 'vitest'
import { HOLIDAYS, deviceRegion, introHoliday, lastWeekday, nextHolidayDate, nthWeekday } from '../introHolidays'

const d = (y, m, day) => new Date(y, m - 1, day, 12)

describe('weekday rules', () => {
  it('finds the nth and last weekday of a month', () => {
    expect(nthWeekday(2026, 9, 1, 2)).toBe(12) // 2nd Monday of Oct 2026
    expect(nthWeekday(2026, 10, 4, 4)).toBe(26) // 4th Thursday of Nov 2026
    expect(nthWeekday(2027, 10, 4, 4)).toBe(25)
    expect(lastWeekday(2027, 4, 1)).toBe(31) // last Monday of May 2027
    expect(lastWeekday(2028, 4, 1)).toBe(29)
  })
})

describe('introHoliday', () => {
  it.each([
    [d(2026, 12, 31), 'US', 'new-year'],
    [d(2027, 1, 1), 'CA', 'new-year'],
    [d(2027, 1, 1), null, 'new-year'],
    [d(2027, 2, 14), 'US', 'valentines'],
    [d(2027, 3, 17), 'CA', 'st-patricks'],
    [d(2027, 5, 31), 'US', 'memorial-day'],
    [d(2027, 7, 1), 'CA', 'canada-day'],
    [d(2027, 7, 4), 'US', 'independence-day'],
    [d(2026, 10, 12), 'CA', 'thanksgiving'],
    [d(2026, 10, 31), 'US', 'halloween'],
    [d(2026, 11, 11), 'US', 'veterans-day'],
    [d(2026, 11, 26), 'US', 'thanksgiving-us'],
    [d(2026, 12, 24), 'US', 'christmas'],
    [d(2026, 12, 25), 'CA', 'christmas'],
    [d(2026, 12, 26), 'CA', 'boxing-day'],
  ])('%s in %s → %s', (date, region, theme) => {
    expect(introHoliday(date, region)).toBe(theme)
  })

  it.each([
    [d(2027, 5, 31), 'CA'], // Memorial Day is US only
    [d(2027, 5, 24), 'US'], // not the last Monday
    [d(2027, 7, 1), 'US'], // Canada Day is Canada only
    [d(2027, 7, 4), 'CA'],
    [d(2026, 10, 12), 'US'], // Canadian Thanksgiving
    [d(2026, 11, 26), 'CA'], // US Thanksgiving
    [d(2026, 11, 11), 'CA'], // Remembrance Day gets no themed intro
    [d(2026, 11, 11), null],
    [d(2026, 12, 26), 'US'],
    [d(2026, 11, 5), 'US'],
  ])('%s in %s → none', (date, region) => {
    expect(introHoliday(date, region)).toBeNull()
  })

  it('covers the whole local day', () => {
    expect(introHoliday(new Date(2026, 10, 11, 0, 1), 'US')).toBe('veterans-day')
    expect(introHoliday(new Date(2026, 10, 11, 23, 59), 'US')).toBe('veterans-day')
    expect(introHoliday(new Date(2026, 10, 10, 23, 59), 'US')).toBeNull()
  })

  it('finds a next date for every holiday within a year', () => {
    for (const h of HOLIDAYS) expect(nextHolidayDate(h, d(2026, 11, 5))).not.toBeNull()
    expect(nextHolidayDate(HOLIDAYS.find(h => h.theme === 'memorial-day'), d(2026, 11, 5))).toEqual(d(2027, 5, 31))
  })
})

describe('deviceRegion', () => {
  it('reads the region from the first language tag that has one', () => {
    expect(deviceRegion({ languages: ['en-US'], language: 'en-US' })).toBe('US')
    expect(deviceRegion({ languages: ['fr', 'fr-CA'], language: 'fr' })).toBe('CA')
    expect(deviceRegion({ language: 'en-CA' })).toBe('CA')
  })

  it('returns null rather than guessing when no tag names a region', () => {
    expect(deviceRegion({ languages: ['en'], language: 'en' })).toBeNull()
    expect(deviceRegion({ languages: ['not a tag'], language: 'x' })).toBeNull()
    expect(deviceRegion(null)).toBeNull()
  })
})
