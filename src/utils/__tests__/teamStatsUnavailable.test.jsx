// src/utils/__tests__/teamStatsUnavailable.test.jsx
// What the Team page and a game's Scouting tab show when getTeamStats()
// has nothing (null) or is missing a stat: an "unavailable" note, a "—",
// or no card at all -- never a 0-0-0 record, and never a side marked
// "better" against a stat that doesn't exist.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import i18n from '../../i18n/index.js'
import { CompareRow, TeamTotalCard, ScoutingShareCanvas } from '../../components/ScoutingTab.jsx'
import { OverviewTab } from '../../views/TeamView.jsx'

const en = i18n.getFixedT('en')

// InfoTip's useLayoutEffect warns under the server renderer; nothing here
// depends on it.
beforeAll(() => {
  const error = console.error
  vi.spyOn(console, 'error').mockImplementation((msg, ...rest) => {
    if (!String(msg).includes('useLayoutEffect does nothing on the server')) error(msg, ...rest)
  })
})
afterAll(() => vi.restoreAllMocks())

const stats = {
  gamesPlayed: 10, wins: 6, losses: 3, otLosses: 1, points: 13,
  goalsForPerGame: 3.2, goalsAgainstPerGame: 2.5,
  powerPlayPct: 0.25, penaltyKillPct: 0.8, shotsForPerGame: 31.5, shotsAgainstPerGame: 27,
}

const overview = props => renderToStaticMarkup(
  <OverviewTab standLoading={false} statsLoading={false} poLoading={false}
    playoffSummary={[]} inPlayoffs={false} liveGame={null} {...props} />,
)

describe('Team page Overview', () => {
  it('says the record is unavailable instead of showing 0-0-0', () => {
    const html = overview({ stats: null })
    expect(html).toContain(en('team.recordUnavailable').replace(/'/g, '&#x27;'))
    expect(html).not.toContain('0–0–0')
    expect(html).not.toContain(' pts')
    expect(html).not.toContain(en('team.seasonStats'))
  })

  it('shows the real record and dashes for a missing rate', () => {
    const html = overview({ stats: { ...stats, powerPlayPct: null } })
    expect(html).toContain('6–3–1')
    expect(html).toContain('13 pts')
    expect(html).toContain('80.0%')
    expect(html).not.toContain('—%')
    expect(html).not.toContain('>0.0%')
    expect(html).not.toContain(en('team.recordUnavailable'))
  })
})

describe('Scouting CompareRow', () => {
  it('renders nothing when neither team has the stat', () => {
    expect(renderToStaticMarkup(<CompareRow label="PP%" carVal={null} oppVal={undefined} />)).toBe('')
  })

  it('shows a dash and picks no winner when one side is missing', () => {
    const html = renderToStaticMarkup(<CompareRow label="GF/GP" carVal={3.1} oppVal={null} />)
    expect(html).toContain('3.10')
    expect(html).toContain('—')
    expect(html).not.toContain('var(--green)')
    expect(html).not.toContain('var(--amber)')
    expect(html).toContain('width:50%')
  })

  it('still marks the better side when both have it', () => {
    const html = renderToStaticMarkup(<CompareRow label="GF/GP" carVal={3.1} oppVal={2.9} />)
    expect(html).toContain('var(--green)')
  })
})

describe('Scouting TeamTotalCard', () => {
  it('is hidden without both teams’ goal rates', () => {
    expect(renderToStaticMarkup(<TeamTotalCard carStats={stats} oppStats={null} oppAbbr="BOS" />)).toBe('')
    expect(renderToStaticMarkup(
      <TeamTotalCard carStats={stats} oppStats={{ ...stats, goalsAgainstPerGame: null }} oppAbbr="BOS" />,
    )).toBe('')
  })

  it('projects from real rates', () => {
    const html = renderToStaticMarkup(<TeamTotalCard carStats={stats} oppStats={stats} oppAbbr="BOS" />)
    expect(html).toContain('2.9') // (3.2 + 2.5) / 2
  })
})

describe('Scouting share card', () => {
  // It used to render nothing without both teams' stats -- the share
  // button then had no canvas to capture.
  it('still renders without either team’s stats, minus the stat rows', () => {
    const html = renderToStaticMarkup(
      <ScoutingShareCanvas canvasRef={{ current: null }} carStats={null} oppStats={null} oppAbbr="BOS" />,
    )
    expect(html).not.toBe('')
    expect(html).not.toContain(en('scoutingTab.shareCanvas.stats.goalsForGp'))
  })

  it('shows a dash for the team missing stats', () => {
    const html = renderToStaticMarkup(
      <ScoutingShareCanvas canvasRef={{ current: null }} carStats={stats} oppStats={null} oppAbbr="BOS" />,
    )
    expect(html).toContain(en('scoutingTab.shareCanvas.stats.goalsForGp'))
    expect(html).toContain('3.20')
    expect(html).toContain('—')
    expect(html).not.toContain('0.00')
  })
})
