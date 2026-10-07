// src/components/__tests__/gameGoalsSections.test.jsx
// The PWHL/AHL/ECHL game-stats popups' Goals and Penalty shots sections
// (Phase 3 B8, contract C6). The goals are the Worker's real
// /pwhl/game-box?gameId=328 answer (2026-10-07: TOR 3, MTL 0); names come
// from that box score's rows.

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import '../../i18n/index.js'
import { GoalsSection, PenaltyShotsSection, playerLabeler, goalPeriodLabel } from '../GameGoalsSections.jsx'

const textOf = el => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const teams = { teamId: 5, abbr: 'TOR', oppAbbr: 'MTL', color: '#00f', oppColor: '#f00' }

const GOALS = [
  { period: 2, time: '4:08', team_id: 5, scorer_id: 240, scorer_name: 'Fanuza Kadirova', assist_ids: [115], plus_player_ids: [38, 88, 115, 219, 240], minus_player_ids: [44, 66, 67, 73, 317], strength: 'EV' },
  { period: 3, time: '19:01', team_id: 5, scorer_id: 241, scorer_name: 'Sarah Wozniewicz', assist_ids: [], plus_player_ids: [], minus_player_ids: [], strength: 'EN' },
]
const BOX = { skaters: [{ player_id: 115, jersey_number: 17 }, { player_id: 38, jersey_number: 11 }, { player_id: 66, jersey_number: 5 }], goalies: [{ player_id: 317, jersey_number: 30 }] }
const NAMES = { 115: 'Victoria Bach', 38: 'Brooke Hobson' }

describe('playerLabeler', () => {
  it('names a player from the box score, else #jersey, else —', () => {
    const label = playerLabeler(NAMES, BOX)
    expect(label(115)).toBe('Victoria Bach')
    expect(label(66)).toBe('#5')
    expect(label(999)).toBe('—')
    expect(label(null)).toBe('—')
  })
})

describe('GoalsSection', () => {
  const label = playerLabeler(NAMES, BOX)

  it('lists each goal: period and time, team, scorer, assists, strength', () => {
    const text = textOf(<GoalsSection goals={GOALS} label={label} {...teams} />)
    expect(text).toContain('Goals')
    expect(text).toContain('P2 4:08 TOR Fanuza Kadirova Assists: Victoria Bach')
    expect(text).toContain('P3 19:01 TOR Sarah Wozniewicz EN Unassisted')
    expect(text).toContain('Show who was on the ice') // only for a goal with on-ice data
    expect(text.match(/Show who was on the ice/g)).toHaveLength(1)
  })

  it('renders nothing without goals', () => {
    expect(renderToStaticMarkup(<GoalsSection goals={[]} label={label} {...teams} />)).toBe('')
    expect(renderToStaticMarkup(<GoalsSection goals={undefined} label={label} {...teams} />)).toBe('')
  })

  it('labels overtime periods', () => {
    expect(goalPeriodLabel(4)).toBe('OT')
    expect(goalPeriodLabel(5)).toBe('OT2')
  })
})

describe('PenaltyShotsSection', () => {
  const label = playerLabeler(NAMES, BOX)

  it('reads a non-goal as "No goal" (the feed can\'t tell a save from a miss)', () => {
    const text = textOf(<PenaltyShotsSection label={label} {...teams} penaltyShots={[
      { period: 2, time: '12:00', team_id: 6, shooter_id: 66, shooter_name: null, goalie_id: 317, result: 'miss' },
      { period: 3, time: '5:30', team_id: 5, shooter_id: 38, shooter_name: 'Brooke Hobson', goalie_id: null, result: 'goal' },
    ]} />)
    expect(text).toContain('Penalty shots')
    expect(text).toContain('P2 12:00 MTL #5 vs #30 No goal')
    expect(text).toContain('P3 5:30 TOR Brooke Hobson Goal')
  })

  it('renders nothing without penalty shots', () => {
    expect(renderToStaticMarkup(<PenaltyShotsSection penaltyShots={[]} label={label} {...teams} />)).toBe('')
  })
})
