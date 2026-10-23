// src/components/__tests__/shootoutCard.test.jsx
// The NHL shootout card, from the game team's side, over the CAR@EDM
// shootout of 2026020163 (testHelpers/nhlShootoutFixtures.js): finished,
// mid-shootout, and with an attempt selected.

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import '../../i18n/index.js'
import i18n from '../../i18n/index.js'
import ShootoutCard, { ShootoutCardBody, nextSelection, attemptDetail } from '../ShootoutCard.jsx'
import { shootoutAttempts } from '../../utils/nhlShootout.js'
import { EDM, CAR, carAtEdm, quinnNoShot, regulationGoal } from '../../utils/__tests__/testHelpers/nhlShootoutFixtures.js'

const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const asCar = { teamId: CAR, teamAbbr: 'CAR', oppAbbr: 'EDM', oppColor: '#ff4c00' }
const asEdm = { teamId: EDM, teamAbbr: 'EDM', oppAbbr: 'CAR', oppColor: '#ce1126' }
const render = props => renderToStaticMarkup(<ShootoutCardBody {...props} />)
// The markup of one team's row.
const rowOf = (html, abbr) => {
  const start = html.indexOf(`data-team="${abbr}"`)
  const next = html.indexOf('data-team=', start + 1)
  return html.slice(html.indexOf('>', start) + 1, next === -1 ? undefined : html.lastIndexOf('<div', next))
}

describe('ShootoutCard', () => {
  it('renders nothing without a shootout', () => {
    expect(render({ pbp: { plays: [regulationGoal] }, ...asCar, isLive: false })).toBe('')
    expect(render({ pbp: undefined, ...asCar, isLive: true })).toBe('')
  })

  it('shows a finished shootout from the game team’s side', () => {
    const html = render({ pbp: carAtEdm(), ...asCar, isLive: false })
    const text = textOf(html)
    expect(html).toContain('data-testid="shootout-card"')
    expect(text).toMatch(/^Shootout EDM wins 1–0 CAR · Devon Levi in net/)
    expect(text).toContain('EDM · Brandon Bussi in net')
    // The game team's row first.
    expect(html.indexOf('data-team="CAR"')).toBeLessThan(html.indexOf('data-team="EDM"'))
    expect(textOf(rowOf(html, 'CAR'))).toBe('CAR · Devon Levi in net Save Miss Wide L SJ Miss Wide R')
    expect(textOf(rowOf(html, 'EDM'))).toBe('EDM · Brandon Bussi in net Save Save ✓ Goal GWG')
    expect(html.match(/GWG/g)).toHaveLength(1)
    expect(html.match(/✓/g)).toHaveLength(1)
    // No slot for a next shooter once it's over.
    expect(html).not.toContain('shootout-next')
  })

  it('shows headshots, and initials where there is none', () => {
    const html = render({ pbp: carAtEdm(), ...asCar, isLive: false })
    expect(html).toMatch(/<img src="https:\/\/assets\.nhle\.com\/mugs\/nhl\/8478402\.png" alt="Connor McDavid" loading="lazy"/)
    // Jarvis has no headshot in the roster.
    expect(rowOf(html, 'CAR')).toContain('>SJ<')
  })

  it('rings each result its own way', () => {
    const html = render({ pbp: quinnNoShot(), teamId: 7, teamAbbr: 'BUF', oppAbbr: 'OPP', isLive: false })
    expect(textOf(rowOf(html, 'BUF'))).toBe('BUF Save No shot Save')
    expect(html).toContain('border-dashed border-[color:var(--amber)]')
    expect(html).toContain('border-solid border-[color:var(--green)]')
    // Nobody named in net: the roster doesn't have them, so no goalie line.
    expect(html).not.toContain('in net')
  })

  it('reads mid-shootout: the tally, the round, and a slot for who shoots next', () => {
    // EDM has shot twice, CAR once: CAR is up.
    let html = render({ pbp: carAtEdm({ through: 3, complete: false }), ...asCar, isLive: true })
    expect(textOf(html)).toMatch(/^Shootout SO 0–0 · Rd 2/)
    expect(rowOf(html, 'CAR')).toContain('shootout-next')
    expect(rowOf(html, 'EDM')).not.toContain('shootout-next')
    // After EDM's goal, from EDM's side: 1-0 up, CAR still to shoot, no winner yet.
    html = render({ pbp: carAtEdm({ through: 5, complete: false }), ...asEdm, isLive: true })
    expect(textOf(html)).toMatch(/^Shootout SO 1–0 · Rd 3/)
    expect(html.indexOf('data-team="EDM"')).toBeLessThan(html.indexOf('data-team="CAR"'))
    expect(rowOf(html, 'CAR')).toContain('shootout-next')
    expect(html).not.toContain('GWG')
    // Not live (an ended game read back): no slot.
    html = render({ pbp: carAtEdm({ through: 5, complete: false }), ...asEdm, isLive: false })
    expect(html).not.toContain('shootout-next')
  })

  it('shows the selected attempt’s detail line', () => {
    const pbp = carAtEdm()
    const [mcdavid, , , svechnikov] = shootoutAttempts(pbp)
    expect(render({ pbp, ...asCar, isLive: false })).not.toContain('aria-pressed="true"')
    let html = render({ pbp, ...asCar, isLive: false, selectedId: mcdavid.eventId })
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(textOf(html)).toMatch(/Connor McDavid · wrist · Save · vs Brandon Bussi$/)
    html = render({ pbp, ...asCar, isLive: false, selectedId: svechnikov.eventId })
    expect(textOf(html)).toMatch(/Andrei Svechnikov · snap · Miss · Wide left · vs Devon Levi$/)
  })

  it('toggles the selection, and leaves out what the feed doesn’t have', () => {
    expect(nextSelection(null, 901)).toBe(901)
    expect(nextSelection(901, 902)).toBe(902)
    expect(nextSelection(901, 901)).toBeNull()
    const t = i18n.getFixedT('en')
    const quinn = shootoutAttempts(quinnNoShot())[3]
    expect(attemptDetail(quinn, t)).toBe('Jack Quinn · No shot')
    expect(attemptDetail(null, t)).toBeNull()
  })

  it('starts with nothing selected', () => {
    const html = renderToStaticMarkup(<ShootoutCard pbp={carAtEdm()} {...asCar} isLive={false} />)
    expect(html).toContain('data-testid="shootout-card"')
    expect(html).not.toContain('aria-pressed="true"')
  })
})
