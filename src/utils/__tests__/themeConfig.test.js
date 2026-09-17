// src/utils/__tests__/themeConfig.test.js
// The app follows the device's light/dark setting until the user picks a
// theme; after that the saved choice wins, including over later device flips.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSavedTheme, getSystemTheme, getTheme, setTheme, subscribeSystemTheme } from '../themeConfig'

let store
let systemLight
let listeners
let docListeners

function flipDevice(light) {
  systemLight = light
  listeners.forEach(fn => fn({ matches: light }))
}

beforeEach(() => {
  store = {}
  systemLight = false
  listeners = new Set()
  docListeners = new Set()
  vi.stubGlobal('localStorage', {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
  })
  vi.stubGlobal('document', {
    documentElement: { setAttribute: vi.fn() },
    visibilityState: 'visible',
    addEventListener: (_, fn) => docListeners.add(fn),
    removeEventListener: (_, fn) => docListeners.delete(fn),
  })
  vi.stubGlobal('window', {
    matchMedia: query => ({
      get matches() { return query === '(prefers-color-scheme: light)' && systemLight },
      addEventListener: (_, fn) => listeners.add(fn),
      removeEventListener: (_, fn) => listeners.delete(fn),
    }),
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('getTheme', () => {
  it("follows the device when nothing's saved", () => {
    expect(getSavedTheme()).toBeNull()
    expect(getTheme()).toBe('dark')
    systemLight = true
    expect(getTheme()).toBe('light')
  })

  it('prefers the saved choice over the device', () => {
    systemLight = true
    setTheme('dark')
    expect(getTheme()).toBe('dark')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
  })

  it('ignores an invalid saved value', () => {
    store['eyewall:theme'] = 'sepia'
    systemLight = true
    expect(getTheme()).toBe('light')
  })

  it('defaults to dark without matchMedia', () => {
    vi.stubGlobal('window', {})
    expect(getSystemTheme()).toBe('dark')
  })
})

describe('subscribeSystemTheme', () => {
  it('reports device flips while following the device', () => {
    const seen = []
    const unsubscribe = subscribeSystemTheme(mode => seen.push(mode))
    flipDevice(true)
    flipDevice(false)
    expect(seen).toEqual(['light', 'dark'])
    unsubscribe()
    flipDevice(true)
    expect(seen).toEqual(['light', 'dark'])
  })

  it('catches a flip missed while backgrounded when the app becomes visible', () => {
    const seen = []
    subscribeSystemTheme(mode => seen.push(mode))
    systemLight = true // changed with no change event
    docListeners.forEach(fn => fn())
    docListeners.forEach(fn => fn())
    expect(seen).toEqual(['light'])
  })

  it('stays quiet once the user has picked a theme', () => {
    const onChange = vi.fn()
    subscribeSystemTheme(onChange)
    setTheme('dark')
    flipDevice(true)
    docListeners.forEach(fn => fn())
    expect(onChange).not.toHaveBeenCalled()
  })
})
