// src/views/__tests__/newsRefreshHandler.test.js
// The News views' Refresh and Try-again buttons must call
// fetchArticles(false, true): not a retry (isRetry false), but fresh, so the
// browser revalidates with the Worker instead of reusing its cached copy
// (workerCache.js; requests no longer send no-store). `onClick={fetchArticles}` handed it the MouseEvent as
// `isRetry`, which is truthy: the click skipped the in-flight guard, the
// loading state and the cold-cache retry, so a manual refresh on a cold
// Worker cache showed "0 articles" and never retried (audit 2026-10-06).
// The views only render under a DOM, so this checks the source directly.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// AHL/ECHL share hockeytech/HockeyTechNewsView.jsx (their own files are wrappers).
const views = ['NewsView', 'PWHLNewsView', 'hockeytech/HockeyTechNewsView']
const here = dirname(fileURLToPath(import.meta.url))

describe.each(views)('%s refresh buttons', (view) => {
  const src = readFileSync(join(here, '..', `${view}.jsx`), 'utf8')

  it('never pass the click event to fetchArticles', () => {
    expect(src).not.toMatch(/onClick=\{fetchArticles\}/)
  })

  it('call fetchArticles(false, true) -- not a retry, fresh -- on both buttons', () => {
    expect(src.match(/onClick=\{\(\) => fetchArticles\(false, true\)\}/g)).toHaveLength(2)
  })

  it('fetch the news through workerFetchInit, fresh on a refresh or retry', () => {
    expect(src).not.toMatch(/no-store/)
    expect(src).toMatch(/fetchArticles = useCallback\(async \(isRetry = false, fresh = isRetry\)/)
    expect(src).toMatch(/workerFetchInit\(\{ fresh \}\)/)
  })
})
