// src/views/__tests__/newsRefreshHandler.test.js
// The News views' Refresh and Try-again buttons must call fetchArticles()
// with no argument. `onClick={fetchArticles}` handed it the MouseEvent as
// `isRetry`, which is truthy: the click skipped the in-flight guard, the
// loading state and the cold-cache retry, so a manual refresh on a cold
// Worker cache showed "0 articles" and never retried (audit 2026-10-06).
// The views only render under a DOM, so this checks the source directly.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const views = ['NewsView', 'PWHLNewsView', 'AHLNewsView', 'ECHLNewsView']
const here = dirname(fileURLToPath(import.meta.url))

describe.each(views)('%s refresh buttons', (view) => {
  const src = readFileSync(join(here, '..', `${view}.jsx`), 'utf8')

  it('never pass the click event to fetchArticles', () => {
    expect(src).not.toMatch(/onClick=\{fetchArticles\}/)
  })

  it('call fetchArticles() as a fresh request on both buttons', () => {
    expect(src.match(/onClick=\{\(\) => fetchArticles\(\)\}/g)).toHaveLength(2)
  })
})
