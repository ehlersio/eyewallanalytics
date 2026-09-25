// src/utils/__tests__/gamePlays.test.js
import { describe, it, expect } from 'vitest'
import { isShootoutPlay, withoutShootout, formatElapsed } from '../gamePlays.js'

const play = (periodType, typeDescKey = 'goal') => ({ typeDescKey, periodDescriptor: { number: periodType === 'SO' ? 5 : 3, periodType } })

describe('withoutShootout', () => {
  it('drops shootout attempts and keeps regulation and overtime', () => {
    const plays = [play('REG'), play('OT'), play('SO'), play('SO', 'shot-on-goal')]
    expect(withoutShootout(plays).map(p => p.periodDescriptor.periodType)).toEqual(['REG', 'OT'])
    expect(isShootoutPlay(play('SO'))).toBe(true)
    expect(withoutShootout(undefined)).toEqual([])
  })
})

describe('formatElapsed', () => {
  it('reads like a game clock', () => {
    expect(formatElapsed(81)).toBe('1:21')
    expect(formatElapsed(45)).toBe('0:45')
    expect(formatElapsed(180)).toBe('3:00')
    expect(formatElapsed(0)).toBe('0:00')
  })
})
