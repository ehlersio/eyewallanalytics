// src/brand/__tests__/brandTokens.test.js
// index.css's --brand-* tokens duplicate RINK_PALETTES so the animated mark
// can follow a live theme toggle through CSS alone. Keep the two in sync.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RINK_PALETTES } from '../rinkMark'

const css = readFileSync(fileURLToPath(new URL('../../index.css', import.meta.url)), 'utf8')

function tokensIn(selector) {
  const blocks = [...css.matchAll(/(^|\n)([^{}\n]+)\{([^}]*)\}/g)]
    .filter(m => m[2].trim() === selector && m[3].includes('--brand-sheet'))
  expect(blocks).toHaveLength(1)
  return Object.fromEntries([...blocks[0][3].matchAll(/--brand-(\w+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
}

describe('--brand-* CSS tokens', () => {
  it.each([
    [':root', 'dark'],
    ['[data-theme="light"]', 'light'],
  ])('%s matches the %s rink palette', (selector, mode) => {
    const tokens = tokensIn(selector)
    const { sheet, red, ink } = RINK_PALETTES[mode]
    expect({ sheet: tokens.sheet, red: tokens.red, ink: tokens.ink }).toEqual({ sheet, red, ink })
  })
})
