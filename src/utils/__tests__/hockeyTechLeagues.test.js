// src/utils/__tests__/hockeyTechLeagues.test.js
// The AHL and ECHL league objects must stay interchangeable: shared
// HockeyTech* components read the same fields from either.
import { describe, it, expect, vi } from 'vitest'
import { AHL, ECHL, HOCKEYTECH_LEAGUES } from '../hockeyTechLeagues.js'
import * as ahlApi from '../ahlApi.js'
import * as echlApi from '../echlApi.js'
import * as ahlConfig from '../ahlConfig.js'
import * as echlConfig from '../echlConfig.js'
import AHLPlayerPopup from '../../components/AHLPlayerPopup.jsx'
import ECHLPlayerPopup from '../../components/ECHLPlayerPopup.jsx'

const keys = o => Object.keys(o).sort()
// Own keys plus getters (config.currentSeason is a getter).
const allKeys = o => Object.getOwnPropertyNames(o).sort()

const LEAGUES = [
  { league: AHL, api: ahlApi, config: ahlConfig, code: 'AHL', Popup: AHLPlayerPopup },
  { league: ECHL, api: echlApi, config: echlConfig, code: 'ECHL', Popup: ECHLPlayerPopup },
]

describe('league object shape', () => {
  it('AHL and ECHL expose the same keys at every level', () => {
    expect(keys(ECHL)).toEqual(keys(AHL))
    for (const part of ['api', 'predictionStore', 'stats']) {
      expect(keys(ECHL[part]), part).toEqual(keys(AHL[part]))
    }
    expect(allKeys(ECHL.config)).toEqual(allKeys(AHL.config))
    expect(keys(ECHL.config.storageKeys)).toEqual(keys(AHL.config.storageKeys))
  })

  it('matching keys hold the same kind of value', () => {
    const kind = v => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v)
    for (const part of [null, 'api', 'config', 'predictionStore', 'stats']) {
      const a = part ? AHL[part] : AHL
      const e = part ? ECHL[part] : ECHL
      for (const k of allKeys(a)) {
        // The followed team is null until one is stored; either may be unset.
        if (['team', 'teamAbbr', 'teamId'].includes(k)) continue
        expect(kind(e[k]), `${part ?? 'league'}.${k}`).toBe(kind(a[k]))
      }
    }
  })

  it('is indexed by key', () => {
    expect(HOCKEYTECH_LEAGUES).toEqual({ ahl: AHL, echl: ECHL })
    expect(AHL.key).toBe('ahl')
    expect(ECHL.key).toBe('echl')
  })
})

describe.each(LEAGUES)('$code', ({ league, api, config, code, Popup }) => {
  it('every api entry is a function', () => {
    for (const [name, fn] of Object.entries(league.api)) {
      expect(typeof fn, name).toBe('function')
    }
  })

  it('api maps every fetch the league module exports to its neutral name', () => {
    const exported = Object.keys(api).filter(n => n.startsWith('fetch')).sort()
    const mapped = Object.keys(league.api).map(n => n.replace(/^fetch/, `fetch${code}`)).sort()
    expect(mapped).toEqual(exported)
    for (const [name, fn] of Object.entries(league.api)) {
      expect(fn, name).toBe(api[name.replace(/^fetch/, `fetch${code}`)])
    }
  })

  it('every predictionStore entry is a function', () => {
    for (const [name, fn] of Object.entries(league.predictionStore)) {
      expect(typeof fn, name).toBe('function')
    }
  })

  it('currentSeason reads the live-resolved season', () => {
    expect(league.config.currentSeason).toBe(config[`${code}_CURRENT_SEASON`])
  })

  it('seasonLabel names listed seasons and falls back to the id', () => {
    const first = league.config.seasons[0]
    expect(league.config.seasonLabel(first.id)).toBe(first.label)
    expect(league.config.seasonLabel(9999)).toBe('9999')
  })

  it('keeps the existing storage keys and season event', () => {
    expect(league.config.storageKeys).toEqual({
      team: `eyewall:${league.key}_team`,
      predictions: `eyewall_${league.key}_predictions_v1`,
    })
    expect(league.config.seasonUpdatedEvent).toBe(`eyewall:${league.key}-season-updated`)
  })

  it('divisionOrder covers every current team\'s division', () => {
    const divisions = new Set(league.config.teams.map(t => t.division))
    expect([...divisions].sort()).toEqual([...league.config.divisionOrder].sort())
  })

  it('news sources are scoped to the league', () => {
    for (const id of Object.keys(league.newsSources)) expect(id.endsWith(`-${league.key}`), id).toBe(true)
  })

  it('PlayerPopup is the league\'s popup', () => {
    expect(league.PlayerPopup).toBe(Popup)
  })
})

it('loads when a popup is imported before the league module', async () => {
  vi.resetModules()
  const { default: Popup } = await import('../../components/ECHLPlayerPopup.jsx')
  const { ECHL: fresh } = await import('../hockeyTechLeagues.js')
  expect(fresh.PlayerPopup).toBe(Popup)
  expect(fresh.api.fetchSchedule).toBeTypeOf('function')
})
