// src/i18n/__tests__/i18nLazyLocales.test.js
// French isn't in the entry bundle: i18n/index.js's backend loads it on
// demand (at start for a French user, on a switch), English comes bundled.

import { describe, it, expect } from 'vitest'
import { lazyLocales } from '../index'
import en from '../locales/en.json'
import fr from '../locales/fr.json'

const read = (lng, ns = 'translation') => new Promise((resolve, reject) =>
  lazyLocales.read(lng, ns, (err, data) => (err ? reject(err) : resolve(data))))

describe('lazyLocales', () => {
  it('loads French from its own module', async () => {
    expect(await read('fr')).toEqual(fr)
  })

  it('answers English from the bundle', async () => {
    expect(await read('en')).toBe(en)
  })

  it('answers nothing for a language or namespace it has no strings for', async () => {
    expect(await read('de')).toEqual({})
    expect(await read('fr', 'other')).toEqual({})
  })
})
