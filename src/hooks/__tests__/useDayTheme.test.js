// Today's theme for the logo and intro: holidays, then a pinned theme, then
// the season -- as the Settings mode allows. A ?theme= preview wins.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { currentDayTheme } from '../useDayTheme'
import {
  HOLIDAY_THEMES_EVENT, PINNABLE_THEMES, pinnedTheme, setPinnedTheme, setThemeMode, themeMode,
} from '../../utils/holidayThemeConfig'
import { ALL_THEMES } from '../../brand/introThemes'

const HALLOWEEN = new Date(2026, 9, 31, 12)
const VETERANS_DAY = new Date(2026, 10, 11, 12)
const FALL_DAY = new Date(2026, 10, 5, 12)
const QUIET_DAY = new Date(2027, 2, 10, 12) // no holiday, no season

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

describe('holiday themes preferences', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to holidays and seasons, nothing pinned', () => {
    stubBrowser()
    expect(themeMode()).toBe('all')
    expect(pinnedTheme()).toBeNull()
  })

  it('saves the mode and announces each change', () => {
    const { store, dispatched } = stubBrowser()
    setThemeMode('holidays')
    expect(store.get('eyewall:holiday-themes')).toBe('holidays')
    setThemeMode('off')
    expect(themeMode()).toBe('off')
    setThemeMode('all')
    expect(store.has('eyewall:holiday-themes')).toBe(false)
    expect(dispatched).toEqual([HOLIDAY_THEMES_EVENT, HOLIDAY_THEMES_EVENT, HOLIDAY_THEMES_EVENT])
  })

  it('only pins season themes -- never a solemn day', () => {
    const { store } = stubBrowser()
    setPinnedTheme('winter')
    expect(pinnedTheme()).toBe('winter')
    setPinnedTheme('memorial-day')
    expect(pinnedTheme()).toBeNull()
    store.set('eyewall:pinned-theme', 'veterans-day')
    expect(pinnedTheme()).toBeNull()
    for (const name of PINNABLE_THEMES) expect(ALL_THEMES[name], name).toBeDefined()
  })
})

describe('currentDayTheme', () => {
  beforeEach(() => stubBrowser())
  afterEach(() => vi.unstubAllGlobals())

  it("picks today's holiday, else the season", () => {
    expect(currentDayTheme(HALLOWEEN)).toBe('halloween')
    expect(currentDayTheme(VETERANS_DAY)).toBe('veterans-day')
    expect(currentDayTheme(FALL_DAY)).toBe('fall')
    expect(currentDayTheme(QUIET_DAY)).toBeNull()
  })

  it('has no Veterans Day for a Canadian device -- the fall season instead', () => {
    stubBrowser({ languages: ['fr-CA'] })
    expect(currentDayTheme(VETERANS_DAY)).toBe('fall')
  })

  it('skips seasons in holidays-only mode', () => {
    setThemeMode('holidays')
    expect(currentDayTheme(HALLOWEEN)).toBe('halloween')
    expect(currentDayTheme(FALL_DAY)).toBeNull()
  })

  it('uses a pinned theme every day, but a holiday still wins', () => {
    setPinnedTheme('winter')
    expect(currentDayTheme(QUIET_DAY)).toBe('winter')
    expect(currentDayTheme(FALL_DAY)).toBe('winter')
    expect(currentDayTheme(HALLOWEEN)).toBe('halloween')
    setThemeMode('holidays')
    expect(currentDayTheme(QUIET_DAY)).toBe('winter')
  })

  it('has nothing when themes are off, pinned or not', () => {
    setPinnedTheme('fall')
    setThemeMode('off')
    expect(currentDayTheme(HALLOWEEN)).toBeNull()
    expect(currentDayTheme(QUIET_DAY)).toBeNull()
  })

  it('lets a ?theme= preview win any day, seasons included, but not an unknown name', () => {
    stubBrowser({ search: '?intro=1&theme=christmas' })
    expect(currentDayTheme(QUIET_DAY)).toBe('christmas')
    stubBrowser({ search: '?theme=off-season' })
    expect(currentDayTheme(QUIET_DAY)).toBe('off-season')
    stubBrowser({ search: '?theme=nope' })
    expect(currentDayTheme(QUIET_DAY)).toBeNull()
  })
})
