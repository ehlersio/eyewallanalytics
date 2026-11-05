// Every holiday has a theme that starts and ends on the plain mark (it hands
// off from the launch splash and to the header logo) and a translated line.

import { describe, it, expect } from 'vitest'
import en from '../../i18n/locales/en.json'
import fr from '../../i18n/locales/fr.json'
import { HOLIDAYS } from '../introHolidays'
import { SEASON_THEMES, THEMES } from '../introThemes'

const ALL_THEMES = Object.values({ ...THEMES, ...SEASON_THEMES }).map(t => [t.name, t])
import { DECOR_SHAPES, PARTICLE_POOL, PHONE_BOUNDS, markAccents, rand, screenBounds } from '../holidayDecor'
import { MARK } from '../rinkMark'

const FULL_LETTER = { spine: 1, top: 1, bottom: 1, middle: 1 }
const SCREENS = {
  phone: PHONE_BOUNDS,
  iPad: screenBounds(1024, 1366, 190),
  landscape: screenBounds(812, 375, 190),
}
const lookup = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj)

describe('introThemes', () => {
  it('has a theme for every holiday', () => {
    for (const h of HOLIDAYS) expect(THEMES[h.theme], h.theme).toBeDefined()
  })

  it.each(Object.values(THEMES).map(t => [t.name, t]))('%s has its line in English and French', (_, theme) => {
    expect(typeof lookup(en, theme.tagline)).toBe('string')
    expect(typeof lookup(fr, theme.tagline)).toBe('string')
  })

  it.each(Object.values(SEASON_THEMES).map(t => [t.name, t]))('season %s has no greeting and no extra hold', (_, theme) => {
    expect(theme.tagline).toBeNull()
    expect(theme.holdMs).toBe(250)
    expect(theme.durationMs).toBeLessThanOrEqual(2800)
  })

  it.each(ALL_THEMES)('%s starts and ends on the plain mark', (_, theme) => {
    // It starts on exactly the launch splash's mark; a holiday's dot overlay
    // (poppy, maple leaf...) stays on the finished mark until it fades out.
    expect(theme.frameAt(0).decor?.dot?.s ?? 0).toBe(0)
    for (const ms of [0, theme.durationMs]) {
      const f = theme.frameAt(ms)
      expect(f.letter).toEqual(FULL_LETTER)
      expect(f.puck).toMatchObject({ r: MARK.dot.r, isDot: true })
      expect(f.home.x).toBeLessThan(0)
      expect(f.away.x).toBeGreaterThan(100)
      // No full-screen effects left at either end, on any screen.
      for (const bounds of Object.values(SCREENS)) {
        for (const p of theme.particlesAt?.(ms, bounds) ?? []) expect(p.opacity).toBe(0)
      }
    }
  })

  it.each(ALL_THEMES)('%s fits the particle pool and draws known shapes', (_, theme) => {
    for (let ms = 0; ms <= theme.durationMs; ms += 50) {
      for (const bounds of Object.values(SCREENS)) {
        const particles = theme.particlesAt?.(ms, bounds) ?? []
        expect(particles.length).toBeLessThanOrEqual(PARTICLE_POOL)
        for (const p of particles) expect(DECOR_SHAPES[p.kind], p.kind).toBeDefined()
      }
      const d = theme.frameAt(ms).decor
      if (d?.dot) expect(DECOR_SHAPES[d.dot.kind]).toBeDefined()
      if (d?.puck) expect(DECOR_SHAPES[d.puck]).toBeDefined()
    }
  })

  it('spreads falling effects over the whole screen, not just around the mark', () => {
    for (const bounds of Object.values(SCREENS)) {
      const snow = THEMES.christmas.particlesAt(1500, bounds)
      const xs = snow.map(p => p.x)
      const ys = snow.map(p => p.y)
      const w = bounds.x1 - bounds.x0
      const h = bounds.y1 - bounds.y0
      expect(Math.min(...xs)).toBeLessThan(bounds.x0 + w * 0.15)
      expect(Math.max(...xs)).toBeGreaterThan(bounds.x1 - w * 0.15)
      expect(Math.min(...ys)).toBeLessThan(bounds.y0 + h * 0.15)
      expect(Math.max(...ys)).toBeGreaterThan(bounds.y1 - h * 0.15)
    }
  })

  it('gives a bigger screen more snow, up to the pool', () => {
    const phone = THEMES.christmas.particlesAt(1500, SCREENS.phone).length
    const iPad = THEMES.christmas.particlesAt(1500, SCREENS.iPad).length
    expect(iPad).toBeGreaterThan(phone)
    expect(iPad).toBeLessThanOrEqual(PARTICLE_POOL)
  })

  it('sets off fireworks across the sky above the mark', () => {
    const sparks = [700, 1500, 2300].flatMap(ms => THEMES['independence-day'].particlesAt(ms, SCREENS.iPad))
    expect(sparks.length).toBeGreaterThan(30)
    for (const p of sparks) expect(p.y).toBeLessThan(MARK.center)
  })

  it('brings the wordmark in as the E rebuilds', () => {
    expect(THEMES.christmas.letterAtMs).toBe(1932)
    expect(THEMES['veterans-day'].letterAtMs).toBe(2782)
  })

  it('blooms the poppy and maple leaf only at the end', () => {
    const memorial = THEMES['memorial-day']
    expect(memorial.frameAt(1500).decor.dot.s).toBe(0)
    expect(memorial.frameAt(memorial.durationMs * 0.95).decor.dot.s).toBeGreaterThan(8)
    expect(THEMES['canada-day'].frameAt(500).decor.dot.s).toBe(0)
  })
})

describe('markAccents', () => {
  it('gives every holiday a logo accent drawn from known shapes', () => {
    for (const name of [...Object.keys(THEMES), ...Object.keys(SEASON_THEMES)]) {
      const accents = markAccents(name)
      expect(accents.length, name).toBeGreaterThan(0)
      for (const a of accents) expect(DECOR_SHAPES[a.kind], `${name}: ${a.kind}`).toBeDefined()
    }
    expect(markAccents('default')).toEqual([])
  })

  it('ends the intro on the logo the top bar shows', () => {
    // A holiday whose intro blooms something on the dot keeps it in the logo.
    for (const name of ['memorial-day', 'canada-day', 'thanksgiving-us', 'halloween']) {
      const theme = THEMES[name]
      const last = theme.frameAt(theme.durationMs).decor.dot
      const accent = markAccents(name).find(a => a.onDot)
      expect(accent.kind).toBe(last.kind)
      expect(accent.s).toBeCloseTo(last.s, 6)
    }
  })
})

describe('screenBounds', () => {
  it('centers the mark on the screen, in its own 100-unit grid', () => {
    const b = screenBounds(375, 812, 190)
    expect((b.x0 + b.x1) / 2).toBeCloseTo(50, 6)
    expect((b.y0 + b.y1) / 2).toBeCloseTo(50, 6)
    expect(b.x1 - b.x0).toBeCloseTo(375 / 1.9, 6)
    expect(b.y1 - b.y0).toBeCloseTo(812 / 1.9, 6)
  })
})

describe('holidayDecor rand', () => {
  it('is fixed per particle, so every run looks the same', () => {
    expect(rand(3, 1)).toBe(rand(3, 1))
    expect(rand(3, 1)).not.toBe(rand(4, 1))
    for (let i = 0; i < 100; i++) {
      expect(rand(i, 0)).toBeGreaterThanOrEqual(0)
      expect(rand(i, 0)).toBeLessThan(1)
    }
  })
})
