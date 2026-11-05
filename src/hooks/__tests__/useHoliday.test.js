// Today's holiday for the logo and intro: the date and region pick it, the
// Settings switch turns it off, and a ?theme= preview wins.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { currentHoliday } from '../useHoliday'
import { HOLIDAY_THEMES_EVENT, holidayThemesOn, setHolidayThemesOn } from '../../utils/holidayThemeConfig'

const HALLOWEEN = new Date(2026, 9, 31, 12)
const VETERANS_DAY = new Date(2026, 10, 11, 12)
const ORDINARY_DAY = new Date(2026, 10, 5, 12)

function stubBrowser({ search = '', languages = ['en-US'] } = {}) {
  const store = new Map()
  const dispatched = []
  vi.stubGlobal('localStorage', {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  })
  vi.stubGlobal('window', {
    location: { search },
    Event: class { constructor(type) { this.type = type } },
    dispatchEvent: e => dispatched.push(e.type),
  })
  vi.stubGlobal('navigator', { languages, language: languages[0] })
  return { store, dispatched }
}

describe('holiday themes preference', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is on until turned off, and announces changes', () => {
    const { store, dispatched } = stubBrowser()
    expect(holidayThemesOn()).toBe(true)
    setHolidayThemesOn(false)
    expect(store.get('eyewall:holiday-themes')).toBe('off')
    expect(holidayThemesOn()).toBe(false)
    setHolidayThemesOn(true)
    expect(store.has('eyewall:holiday-themes')).toBe(false)
    expect(holidayThemesOn()).toBe(true)
    expect(dispatched).toEqual([HOLIDAY_THEMES_EVENT, HOLIDAY_THEMES_EVENT])
  })
})

describe('currentHoliday', () => {
  beforeEach(() => stubBrowser())
  afterEach(() => vi.unstubAllGlobals())

  it("picks today's holiday for the device's region", () => {
    expect(currentHoliday(HALLOWEEN)).toBe('halloween')
    expect(currentHoliday(VETERANS_DAY)).toBe('veterans-day')
    expect(currentHoliday(ORDINARY_DAY)).toBeNull()
  })

  it('has none for a Canadian device on Nov 11', () => {
    stubBrowser({ languages: ['fr-CA'] })
    expect(currentHoliday(VETERANS_DAY)).toBeNull()
  })

  it('has none when holiday themes are off', () => {
    setHolidayThemesOn(false)
    expect(currentHoliday(HALLOWEEN)).toBeNull()
  })

  it('lets a ?theme= preview win any day, but not an unknown name', () => {
    stubBrowser({ search: '?intro=1&theme=christmas' })
    expect(currentHoliday(ORDINARY_DAY)).toBe('christmas')
    stubBrowser({ search: '?theme=nope' })
    expect(currentHoliday(ORDINARY_DAY)).toBeNull()
  })
})
