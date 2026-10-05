// src/utils/__tests__/captureMode.test.js
// ?nologos=1 / ?nologos=0 turn the dev-only logo hiding on and off for the session.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initCaptureMode, logosHidden } from '../captureMode.js'

let store
let classes

function open(search) {
  vi.stubGlobal('window', { location: { search } })
  initCaptureMode()
}

beforeEach(() => {
  store = {}
  classes = new Set()
  vi.stubGlobal('sessionStorage', {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: k => { delete store[k] },
  })
  vi.stubGlobal('document', {
    documentElement: {
      classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('captureMode', () => {
  it('is off by default', () => {
    open('')
    expect(logosHidden()).toBe(false)
    expect(classes.has('capture-no-logos')).toBe(false)
  })

  it('?nologos=1 hides logos and tags the root element', () => {
    open('?nologos=1')
    expect(logosHidden()).toBe(true)
    expect(classes.has('capture-no-logos')).toBe(true)
  })

  it('stays on for later pages in the session', () => {
    open('?nologos=1')
    open('?game=2025020800')
    expect(logosHidden()).toBe(true)
    expect(classes.has('capture-no-logos')).toBe(true)
  })

  it('?nologos=0 turns it off', () => {
    open('?nologos=1')
    open('?nologos=0')
    expect(logosHidden()).toBe(false)
    expect(classes.has('capture-no-logos')).toBe(false)
  })

  it('stays off when sessionStorage throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })
    open('?nologos=1')
    expect(logosHidden()).toBe(false)
  })
})
