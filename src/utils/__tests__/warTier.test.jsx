// src/utils/__tests__/warTier.test.jsx
// The player popup's WAR tier. WAR adds up with games played (the
// replacement term scales with GP since eyewall-pipeline#191), so the tier
// reads WAR per 82 games, and there's no tier under 10 GP -- an October WAR
// of +0.349 at 3 GP isn't rated against full-season cut-offs. The WAR
// number itself stays the real season-to-date value.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import i18n from '../../i18n/index.js'
import { warPer82, warTier, WAR_TIER_MIN_GP } from '../warTier'
import { contractValue, WAR_SCALE } from '../carContracts'
import { SkaterWarCard } from '../../components/PlayerPopup.jsx'

const en = i18n.getFixedT('en')
const fr = i18n.getFixedT('fr')

// InfoTip's useLayoutEffect warns under the server renderer; nothing here
// depends on it.
beforeAll(() => {
  const error = console.error
  vi.spyOn(console, 'error').mockImplementation((msg, ...rest) => {
    if (!String(msg).includes('useLayoutEffect does nothing on the server')) error(msg, ...rest)
  })
})
afterAll(() => vi.restoreAllMocks())

describe('warPer82', () => {
  it('uses the same 10 GP minimum as the percentile pools', () => {
    expect(WAR_TIER_MIN_GP).toBe(10)
    expect(warPer82(0.349, 3)).toBeNull()
    expect(warPer82(0.349, 9)).toBeNull()
    expect(warPer82(0.2, 10)).toBeCloseTo(1.64)
  })

  it('projects to 82 games below a full season, and keeps the WAR at 82+', () => {
    expect(warPer82(0.5, 41)).toBeCloseTo(1)
    expect(warPer82(1.559, 82)).toBe(1.559)
    expect(warPer82(1.2, 84)).toBe(1.2)
  })

  it('is null without a WAR', () => {
    expect(warPer82(null, 50)).toBeNull()
    expect(warPer82(undefined, 50)).toBeNull()
  })
})

describe('warTier', () => {
  it('has no tier under 10 GP', () => {
    expect(warTier(0.349, 3)).toBeNull()
    expect(warTier(-0.3, 1)).toBeNull()
  })

  it('tiers by WAR per 82 games and reports that pace', () => {
    // 0.25 WAR in 20 GP = +1.025 per 82: Top player, where the raw 0.25
    // would read only "Solid contributor" against the full-season cut-offs.
    const t = warTier(0.25, 20)
    expect(t.key).toBe('tierTop')
    expect(t.pace).toBeCloseTo(1.025)
    expect(warTier(0.3, 20).key).toBe('tierMvp')                // 1.23 per 82
    expect(warTier(0.05, 20).key).toBe('tierSolid')             // 0.205 per 82
    expect(warTier(0.02, 20).key).toBe('tierReplacement')       // 0.082 per 82
    expect(warTier(-0.2, 20).key).toBe('tierBelowReplacement')  // -0.82 per 82
  })

  it('reads a full season as is, with no pace', () => {
    // A real 2025-26 row from the Worker: 1.046 WAR in 82 GP.
    expect(warTier(1.046, 82)).toEqual({ key: 'tierTop', color: '#4ade80', pace: null })
    expect(warTier(0.3, 84).key).toBe('tierSolid')
  })

  it('has replacement level at 0 and the cut-offs at 0.2, 0.7 and 1.2', () => {
    expect(warTier(-0.001, 82).key).toBe('tierBelowReplacement')
    expect(warTier(0, 82).key).toBe('tierReplacement')
    expect(warTier(0.199, 82).key).toBe('tierReplacement')
    expect(warTier(0.2, 82).key).toBe('tierSolid')
    expect(warTier(0.699, 82).key).toBe('tierSolid')
    expect(warTier(0.7, 82).key).toBe('tierTop')
    expect(warTier(1.199, 82).key).toBe('tierTop')
    expect(warTier(1.2, 82).key).toBe('tierMvp')
  })
})

describe('contract value WAR', () => {
  it('is points only under 10 GP, and blends WAR per 82 from there', () => {
    expect(contractValue(3, 3, 5_000_000, false, warPer82(0.349, 3)).method).toBe('points')
    const blended = contractValue(10, 20, 5_000_000, false, warPer82(0.25, 20))
    expect(blended.method).toBe('blended')
    // 41 pts per 82 / $5M = 8.2; 1.025 WAR per 82 / $5M x 18 = 3.69
    expect(WAR_SCALE).toBe(18)
    expect(blended.score).toBeCloseTo(8.2 * 0.6 + 3.69 * 0.4, 1)
  })
})

describe('SkaterWarCard', () => {
  const card = props => renderToStaticMarkup(<SkaterWarCard gameScore={1.2} {...props} />)

  it('shows the real WAR and no tier at 3 GP', () => {
    const html = card({ war: 0.349, gp: 3 })
    expect(html).toContain('+0.349')
    expect(html).not.toContain(en('playerPopup.analytics.skater.tierReplacement'))
    expect(html).toContain(en('playerPopup.analytics.skater.tierSmallSample', { count: 10 }))
    expect(html).not.toContain('pa-war-pace')
  })

  it('shows the tier and the per-82 pace once rated', () => {
    const html = card({ war: 0.25, gp: 20 })
    expect(html).toContain('+0.25')
    expect(html).toContain(en('playerPopup.analytics.skater.tierTop'))
    expect(html).toContain(en('playerPopup.analytics.skater.warPace', { value: '+1.03' }))
  })

  it('shows no pace for a full season', () => {
    const html = card({ war: 1.046, gp: 82 })
    expect(html).toContain(en('playerPopup.analytics.skater.tierTop'))
    expect(html).not.toContain('pa-war-pace')
  })

  it('shows a dash and no label without a WAR', () => {
    const html = card({ war: null, gp: 30 })
    expect(html).toContain('—')
    expect(html).not.toContain('pa-war-tier')
  })

  it('has the new strings in French', () => {
    expect(fr('playerPopup.analytics.skater.tierSmallSample', { count: 10 })).toContain('10')
    expect(fr('playerPopup.analytics.skater.warPace', { value: '+1.03' })).toContain('+1.03')
    expect(fr('playerPopup.contract.valueTooltipPointsOnlySmallSample', { count: 10 })).toContain('10')
    expect(fr('playerPopup.analytics.skater.tierSmallSample')).not.toBe(en('playerPopup.analytics.skater.tierSmallSample'))
  })
})
