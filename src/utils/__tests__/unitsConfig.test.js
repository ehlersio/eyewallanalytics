// src/utils/__tests__/unitsConfig.test.js
// Units follow the language (metric in French, imperial in English) until
// the user picks; after that the saved choice wins over the language.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSavedUnits, defaultUnits, getUnits, setUnits, UNITS_CHANGED_EVENT } from '../unitsConfig'

let store
let dispatched

beforeEach(() => {
  store = {}
  dispatched = []
  vi.stubGlobal('localStorage', {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
  })
  vi.stubGlobal('window', { Event: globalThis.Event, dispatchEvent: e => dispatched.push(e.type) })
})

describe('unitsConfig', () => {
  it('defaults to metric in French and imperial otherwise', () => {
    expect(defaultUnits('fr')).toBe('metric')
    expect(defaultUnits('fr-CA')).toBe('metric')
    expect(defaultUnits('en')).toBe('imperial')
    expect(defaultUnits(undefined)).toBe('imperial')
  })

  it('follows the language until a choice is saved', () => {
    expect(getSavedUnits()).toBeNull()
    expect(getUnits('fr')).toBe('metric')
    expect(getUnits('en')).toBe('imperial')
  })

  it('a saved choice wins over the language, and announces the change', () => {
    setUnits('imperial')
    expect(getUnits('fr')).toBe('imperial')
    setUnits('metric')
    expect(getUnits('en')).toBe('metric')
    expect(dispatched).toEqual([UNITS_CHANGED_EVENT, UNITS_CHANGED_EVENT])
  })

  it('ignores an unknown value', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    setUnits('furlongs')
    expect(getSavedUnits()).toBeNull()
    expect(dispatched).toEqual([])
  })

  it('treats a stray stored value as no choice', () => {
    store['eyewall:units'] = 'cubits'
    expect(getUnits('fr')).toBe('metric')
  })
})
