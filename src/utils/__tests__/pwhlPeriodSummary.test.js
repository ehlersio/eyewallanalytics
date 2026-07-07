// src/utils/__tests__/pwhlPeriodSummary.test.js
// Regression coverage for Session 43's PWHL shootout-mislabeling fix.
// Mirrors periodSummary.test.js's convention: pure functions copied locally
// (no React/hook imports needed) rather than importing usePWHLPeriodSummary.js
// directly, which would trigger pwhlConfig.js's module-load-time Worker fetch.

import { describe, it, expect } from 'vitest'

// ── Copied from usePWHLPeriodSummary.js ─────────────────────────────────────

function periodLabel(p, isPlayoff = false) {
  if (p <= 3) return `Period ${p}`
  if (p === 4) return 'OT'
  if (isPlayoff) return `${p - 3}OT`
  return p === 5 ? 'SO' : `${p - 3}OT`
}

function periodShort(p, isPlayoff = false) {
  if (p <= 3) return `P${p}`
  if (p === 4) return 'OT'
  if (isPlayoff) return `${p - 3}OT`
  return p === 5 ? 'SO' : `${p - 3}OT`
}

// ── Copied from PWHLGameEvents.jsx / PWHLShotMapView.jsx's pLabel closure ──
// Same branching, different display format (OT2 not 2OT) — both call sites
// need their own coverage since the format differs, not just a re-test of
// the same function.

function pLabelShort(n, isPlayoff = false) {
  if (!n) return '—'
  if (n <= 3) return `P${n}`
  if (n === 4) return 'OT'
  if (isPlayoff) return `OT${n - 3}`
  return n === 5 ? 'SO' : `OT${n - 3}`
}

describe('PWHL periodLabel/periodShort (usePWHLPeriodSummary.js)', () => {
  it('labels regulation periods 1-3 normally regardless of playoff status', () => {
    expect(periodLabel(1, false)).toBe('Period 1')
    expect(periodLabel(3, true)).toBe('Period 3')
    expect(periodShort(2, false)).toBe('P2')
  })

  it('labels period 4 as OT regardless of playoff status', () => {
    expect(periodLabel(4, false)).toBe('OT')
    expect(periodLabel(4, true)).toBe('OT')
    expect(periodShort(4, false)).toBe('OT')
  })

  it('regular season: period 5 is a shootout (SO), not 2OT', () => {
    expect(periodLabel(5, false)).toBe('SO')
    expect(periodShort(5, false)).toBe('SO')
  })

  it('playoffs: period 5 is a second overtime (2OT), never a shootout', () => {
    expect(periodLabel(5, true)).toBe('2OT')
    expect(periodShort(5, true)).toBe('2OT')
  })

  it('playoffs: period 6+ continues counting OT periods', () => {
    expect(periodLabel(6, true)).toBe('3OT')
    expect(periodLabel(7, true)).toBe('4OT')
  })

  it('defaults isPlayoff to false when omitted', () => {
    expect(periodLabel(5)).toBe('SO')
  })
})

describe('PWHL pLabel (PWHLGameEvents.jsx / PWHLShotMapView.jsx format)', () => {
  it('regular season: period 5 is SO', () => {
    expect(pLabelShort(5, false)).toBe('SO')
  })

  it('playoffs: period 5 is OT2 (not SO)', () => {
    expect(pLabelShort(5, true)).toBe('OT2')
  })

  it('period 4 is always OT', () => {
    expect(pLabelShort(4, false)).toBe('OT')
    expect(pLabelShort(4, true)).toBe('OT')
  })

  it('returns em-dash for falsy period (no data yet)', () => {
    expect(pLabelShort(0)).toBe('—')
    expect(pLabelShort(null)).toBe('—')
  })
})
