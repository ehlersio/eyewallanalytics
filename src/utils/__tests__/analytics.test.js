// src/utils/__tests__/analytics.test.js
// Feature-usage events (utils/analytics.js): feature_viewed fires once, only
// when the element is actually on screen; feature_interacted carries the
// feature + action. PostHog itself is mocked; capture() only sends in
// production builds, so MODE is stubbed.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('posthog-js', () => ({ default: { capture: vi.fn(), identify: vi.fn() } }))

import posthog from 'posthog-js'
import { observeFeatureView, trackFeature, capture } from '../analytics'

let observers
class FakeObserver {
  constructor(cb, opts) { this.cb = cb; this.opts = opts; this.disconnected = false; observers.push(this) }
  observe(el) { this.el = el }
  disconnect() { this.disconnected = true }
  fire(isIntersecting) { this.cb([{ isIntersecting, target: this.el }]) }
}

beforeEach(() => {
  observers = []
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.stubEnv('MODE', 'production')
  posthog.capture.mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('observeFeatureView', () => {
  it('fires feature_viewed once, when at least half on screen', () => {
    const el = { dataset: {} }
    observeFeatureView(el, 'playoff_odds', { gameId: 7 })
    expect(observers[0].opts.threshold).toBe(0.5)
    observers[0].fire(false)
    expect(posthog.capture).not.toHaveBeenCalled()
    observers[0].fire(true)
    observers[0].fire(true)
    expect(posthog.capture).toHaveBeenCalledTimes(1)
    expect(posthog.capture).toHaveBeenCalledWith('feature_viewed', { feature: 'playoff_odds', gameId: 7 })
    expect(observers[0].disconnected).toBe(true)
  })

  it('does not observe an element that was already counted, or a null ref', () => {
    const el = { dataset: {} }
    observeFeatureView(el, 'scorecard')
    observers[0].fire(true)
    expect(observeFeatureView(el, 'scorecard')).toBeNull()
    expect(observeFeatureView(null, 'scorecard')).toBeNull()
    expect(observers).toHaveLength(1)
  })

  it('does nothing where IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    expect(observeFeatureView({ dataset: {} }, 'scorecard')).toBeNull()
  })
})

describe('trackFeature / capture', () => {
  it('sends feature_interacted with the feature and action', () => {
    trackFeature('trade_tree', 'open', { depth: 3 })
    expect(posthog.capture).toHaveBeenCalledWith('feature_interacted', { feature: 'trade_tree', action: 'open', depth: 3 })
  })

  it('sends nothing outside production builds', () => {
    vi.stubEnv('MODE', 'development')
    capture('anything')
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})
