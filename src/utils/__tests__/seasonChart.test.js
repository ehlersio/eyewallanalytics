import { describe, it, expect } from 'vitest'
import { perGameValue, seasonRampColor, CHART_DASH_PATTERNS } from '../seasonChart'

describe('perGameValue', () => {
  it('reads def.perGameKey when set, otherwise def.key, as a number', () => {
    expect(perGameValue({ key: 'pim', perGameKey: 'penalty_minutes' }, { penalty_minutes: 4 })).toBe(4)
    expect(perGameValue({ key: 'goals' }, { goals: '2' })).toBe(2)
  })

  it('returns null for a missing game or field', () => {
    expect(perGameValue({ key: 'goals' }, null)).toBeNull()
    expect(perGameValue({ key: 'goals' }, {})).toBeNull()
  })
})

describe('seasonRampColor', () => {
  it('returns the base color when only one season is shown', () => {
    expect(seasonRampColor('#cc2200', 0, 1)).toBe('#cc2200')
  })

  it('fades from full color (newest) down to 0.35 alpha (oldest)', () => {
    expect(seasonRampColor('#cc2200', 0, 3)).toBe('rgba(204,34,0,1)')
    expect(seasonRampColor('#cc2200', 1, 3)).toBe('rgba(204,34,0,0.68)')
    expect(seasonRampColor('#cc2200', 2, 3)).toBe('rgba(204,34,0,0.35)')
  })

  it('passes a non-hex color through unchanged', () => {
    expect(seasonRampColor('var(--team-primary)', 1, 2)).toBe('var(--team-primary)')
  })
})

describe('CHART_DASH_PATTERNS', () => {
  it('starts with a solid line', () => {
    expect(CHART_DASH_PATTERNS[0]).toBeUndefined()
  })
})
