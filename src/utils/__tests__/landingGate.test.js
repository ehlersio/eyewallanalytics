import { describe, it, expect } from 'vitest'
import { shouldShowLanding, hasOnlyMarketingParams } from '../landingGate'

const web = { isNative: false, search: '' }

describe('shouldShowLanding', () => {
  it('shows the landing at / for a web visitor with no saved team', () => {
    expect(shouldShowLanding({ ...web, pathname: '/', hasTeam: false })).toBe(true)
  })

  it('keeps a returning web visitor (team saved) in the app at /', () => {
    expect(shouldShowLanding({ ...web, pathname: '/', hasTeam: true })).toBe(false)
  })

  it('always shows the landing at /welcome on the web, team or not', () => {
    expect(shouldShowLanding({ ...web, pathname: '/welcome', hasTeam: true })).toBe(true)
    expect(shouldShowLanding({ ...web, pathname: '/welcome', hasTeam: false })).toBe(true)
    expect(shouldShowLanding({ ...web, pathname: '/welcome/', hasTeam: true })).toBe(true)
  })

  it('never shows it in the iOS app, not even at /welcome', () => {
    expect(shouldShowLanding({ isNative: true, search: '', pathname: '/', hasTeam: false })).toBe(false)
    expect(shouldShowLanding({ isNative: true, search: '', pathname: '/welcome', hasTeam: false })).toBe(false)
  })

  it('leaves every other route to the team picker / app', () => {
    for (const pathname of ['/app', '/game/2025021237', '/pwhl/shots', '/schedule', '/methodology']) {
      expect(shouldShowLanding({ ...web, pathname, hasTeam: false })).toBe(false)
    }
  })

  it('treats / with app state in the query (notification links) as the app', () => {
    expect(shouldShowLanding({ ...web, pathname: '/', search: '?summary=2&game=2026020123', hasTeam: false })).toBe(false)
    expect(shouldShowLanding({ ...web, pathname: '/', search: '?intro=1', hasTeam: false })).toBe(false)
  })

  it('still shows the landing for campaign links from social posts', () => {
    expect(shouldShowLanding({ ...web, pathname: '/', search: '?utm_source=instagram&utm_medium=bio', hasTeam: false })).toBe(true)
    expect(shouldShowLanding({ ...web, pathname: '/', search: '?fbclid=abc123', hasTeam: false })).toBe(true)
  })

  it('copes with a missing pathname', () => {
    expect(shouldShowLanding({ ...web, pathname: '', hasTeam: false })).toBe(true)
  })
})

describe('hasOnlyMarketingParams', () => {
  it('is true for an empty query', () => {
    expect(hasOnlyMarketingParams('')).toBe(true)
    expect(hasOnlyMarketingParams(undefined)).toBe(true)
  })

  it('is false as soon as one app parameter is present', () => {
    expect(hasOnlyMarketingParams('?utm_source=x&game=1')).toBe(false)
  })
})
