// src/utils/__tests__/situationCode.test.js
import { describe, it, expect } from 'vitest'
import { isValidSituationCode } from '../situationCode.js'

describe('isValidSituationCode', () => {
  it('accepts every real strength', () => {
    for (const sc of ['1551', '1541', '1451', '1531', '1441', '1331', '0651', '1560', '0660']) {
      expect(isValidSituationCode(sc), sc).toBe(true)
    }
  })

  it('rejects codes no game can be in', () => {
    // '1020' is the one CAR-NSH's 2026-09-24 feed carried on a goal.
    for (const sc of ['1020', '0000', '1251', '1571', '2551', '1552', '155', '15511', '', null, undefined, 1551]) {
      expect(isValidSituationCode(sc), String(sc)).toBe(false)
    }
  })
})
