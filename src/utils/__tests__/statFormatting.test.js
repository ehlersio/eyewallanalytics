// src/utils/__tests__/statFormatting.test.js
// Tests for stat grouping and formatting logic used in PlayersView.
// groupStats is extracted here to test independently of React.

import { describe, it, expect } from 'vitest'

// ── groupStats (mirrors PlayersView.jsx) ──────────────────────
function groupStats(defs, stats, isGoalie = false) {
  const groups = {}
  defs.forEach(def => {
    const raw = stats?.[def.key]
    if (raw == null) return
    let fmt
    if (def.key === 'shootingPctg' || def.key === 'faceoffWinningPctg') {
      const n = parseFloat(raw)
      fmt = isNaN(n) ? '—' : (n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`)
    } else if (def.key === 'savePctg') {
      const n = parseFloat(raw)
      fmt = isNaN(n) ? '—' : (n <= 1 ? n.toFixed(3) : (n / 100).toFixed(3))
    } else if (def.key === 'goalsAgainstAvg' || def.key === 'gaa') {
      fmt = parseFloat(raw).toFixed(2)
    } else if (def.key === 'qualityStartPct') {
      const n = parseFloat(raw)
      fmt = isNaN(n) ? '—' : `${(n * 100).toFixed(1)}%`
    } else if (def.key === 'plusMinus') {
      const n = parseInt(raw)
      fmt = isNaN(n) ? '—' : (n >= 0 ? `+${n}` : `${n}`)
    } else if (def.key === 'avgToi' || def.key === 'toi') {
      if (typeof raw === 'string' && raw.includes(':')) fmt = raw
      else { const m = Math.floor(raw/60); const s = String(raw%60).padStart(2,'0'); fmt = `${m}:${s}` }
    } else {
      fmt = raw
    }
    if (!groups[def.group]) groups[def.group] = []
    groups[def.group].push({ def, value: raw, fmt })
  })
  return Object.entries(groups).map(([group, items]) => ({ group, items }))
}

// ── Test data ─────────────────────────────────────────────────
const SKATER_DEFS = [
  { key: 'goals',            label: 'Goals',   group: 'Scoring' },
  { key: 'assists',          label: 'Assists',  group: 'Scoring' },
  { key: 'plusMinus',        label: '+/−',      group: 'Scoring' },
  { key: 'shootingPctg',    label: 'S%',       group: 'Shot Quality' },
  { key: 'avgToi',           label: 'TOI/G',    group: 'Ice Time' },
  { key: 'hits',             label: 'Hits',     group: 'Defensive' },
  { key: 'giveaways',        label: 'GV',       group: 'Defensive' },
]

const GOALIE_DEFS = [
  { key: 'wins',             label: 'W',        group: 'Record' },
  { key: 'savePctg',        label: 'SV%',      group: 'Performance' },
  { key: 'goalsAgainstAvg', label: 'GAA',      group: 'Performance' },
  { key: 'qualityStartPct', label: 'QS%',      group: 'Performance' },
]

// ── groupStats tests ──────────────────────────────────────────
describe('groupStats', () => {
  it('groups stats by their group property', () => {
    const stats = { goals: 30, assists: 50, hits: 80, giveaways: 40 }
    const groups = groupStats(SKATER_DEFS, stats)
    const names = groups.map(g => g.group)
    expect(names).toContain('Scoring')
    expect(names).toContain('Defensive')
  })

  it('skips stats with null/undefined values', () => {
    const stats = { goals: 30, assists: null }
    const groups = groupStats(SKATER_DEFS, stats)
    const scoring = groups.find(g => g.group === 'Scoring')
    // Only goals should appear, assists is null
    expect(scoring.items).toHaveLength(1)
    expect(scoring.items[0].def.key).toBe('goals')
  })

  it('formats shootingPctg as percentage (0-1 scale)', () => {
    const stats = { shootingPctg: 0.125 }
    const groups = groupStats(SKATER_DEFS, stats)
    const item = groups.find(g => g.group === 'Shot Quality')?.items[0]
    expect(item?.fmt).toBe('12.5%')
  })

  it('formats shootingPctg already in percent scale', () => {
    const stats = { shootingPctg: 12.5 }
    const groups = groupStats(SKATER_DEFS, stats)
    const item = groups.find(g => g.group === 'Shot Quality')?.items[0]
    expect(item?.fmt).toBe('12.5%')
  })

  it('formats plusMinus with + prefix for positive', () => {
    const stats = { plusMinus: 15 }
    const groups = groupStats(SKATER_DEFS, stats)
    const item = groups.find(g => g.group === 'Scoring')?.items
      .find(i => i.def.key === 'plusMinus')
    expect(item?.fmt).toBe('+15')
  })

  it('formats plusMinus with - prefix for negative', () => {
    const stats = { plusMinus: -8 }
    const groups = groupStats(SKATER_DEFS, stats)
    const item = groups.find(g => g.group === 'Scoring')?.items
      .find(i => i.def.key === 'plusMinus')
    expect(item?.fmt).toBe('-8')
  })

  it('formats avgToi from seconds to MM:SS', () => {
    const stats = { avgToi: 1230 }  // 1230s = 20:30
    const groups = groupStats(SKATER_DEFS, stats)
    const item = groups.find(g => g.group === 'Ice Time')?.items[0]
    expect(item?.fmt).toBe('20:30')
  })

  it('formats avgToi from MM:SS string passthrough', () => {
    const stats = { avgToi: '20:30' }
    const groups = groupStats(SKATER_DEFS, stats)
    const item = groups.find(g => g.group === 'Ice Time')?.items[0]
    expect(item?.fmt).toBe('20:30')
  })

  it('formats savePctg as 3-decimal (0-1 scale)', () => {
    const stats = { savePctg: 0.921 }
    const groups = groupStats(GOALIE_DEFS, stats, true)
    const item = groups.find(g => g.group === 'Performance')?.items
      .find(i => i.def.key === 'savePctg')
    expect(item?.fmt).toBe('0.921')
  })

  it('formats GAA to 2 decimal places', () => {
    const stats = { goalsAgainstAvg: 2.456 }
    const groups = groupStats(GOALIE_DEFS, stats, true)
    const item = groups.find(g => g.group === 'Performance')?.items
      .find(i => i.def.key === 'goalsAgainstAvg')
    expect(item?.fmt).toBe('2.46')
  })

  it('formats qualityStartPct as percentage', () => {
    const stats = { qualityStartPct: 0.65 }
    const groups = groupStats(GOALIE_DEFS, stats, true)
    const item = groups.find(g => g.group === 'Performance')?.items
      .find(i => i.def.key === 'qualityStartPct')
    expect(item?.fmt).toBe('65.0%')
  })

  it('returns empty array for empty stats', () => {
    const groups = groupStats(SKATER_DEFS, {})
    expect(groups).toHaveLength(0)
  })

  it('returns empty array for null stats', () => {
    const groups = groupStats(SKATER_DEFS, null)
    expect(groups).toHaveLength(0)
  })

  it('defensive stats group appears when hits/giveaways are present', () => {
    const stats = { goals: 10, hits: 120, giveaways: 30 }
    const groups = groupStats(SKATER_DEFS, stats)
    const defensive = groups.find(g => g.group === 'Defensive')
    expect(defensive).toBeDefined()
    expect(defensive.items).toHaveLength(2)
  })
})
