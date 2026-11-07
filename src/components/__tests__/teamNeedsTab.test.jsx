// The Team view's Needs tab over real /team-needs payloads (STL and CAR,
// 2026-11-06, cypress/fixtures): need flags, unrated players, last-season
// labels, right shots, and both languages.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import '../../i18n/index.js'
import i18n from '../../i18n/index.js'
import TeamNeedsTab from '../TeamNeedsTab.jsx'
import stl from '../../../cypress/fixtures/team-needs-stl-2026-11-06.json'
import car from '../../../cypress/fixtures/team-needs-car-2026-11-06.json'
import carNext from '../../../cypress/fixtures/team-needs-car-next-season-2027-28.json'

const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
const slotHtml = (html, slot) => {
  const start = html.indexOf(`data-slot="${slot}"`)
  const next = html.indexOf('data-slot=', start + 1)
  return html.slice(start, next === -1 ? undefined : next)
}

afterEach(() => i18n.changeLanguage('en'))

describe('TeamNeedsTab', () => {
  it('flags the bottom-third slots, worst first, with their ranks', () => {
    const html = renderToStaticMarkup(<TeamNeedsTab data={stl} />)
    const text = textOf(html)
    expect(text).toContain('Weakest against the league: Top-4 defense, Backup goalie, Bottom-6 wingers, Top-6 wingers')
    expect(textOf(slotHtml(html, 'D_TOP4'))).toContain('Rank 32 of 32 · bottom third')
    expect(textOf(slotHtml(html, 'D_TOP4'))).toContain('3 right shots')
    expect(textOf(slotHtml(html, 'F_TOP6_C'))).toContain('Rank 10 of 31')
    expect(textOf(slotHtml(html, 'F_TOP6_C'))).not.toContain('bottom third')
    expect(text).toContain('Lineup from the projected lines for the next game · as of Nov 6, 2026')
  })

  it('shows unrated players as unrated and an unranked slot as not ranked', () => {
    const html = renderToStaticMarkup(<TeamNeedsTab data={car} />)
    const pair = textOf(slotHtml(html, 'D_BOT2'))
    expect(pair).toContain('not ranked')
    expect(pair).toContain('Too few rated players to rank (1 of 2)')
    expect(pair).toContain('unrated')
    expect(textOf(html)).toContain("No slot ranks in the league's bottom third.")
  })

  it('labels last season ratings and signs every rating', () => {
    const html = renderToStaticMarkup(<TeamNeedsTab data={car} />)
    const d = textOf(slotHtml(html, 'D_TOP4'))
    expect(d).toContain('Jaccob Slavin')
    expect(d).toContain('+0.50 last season')
    expect(d).toContain('shoots L')
    const g = textOf(slotHtml(html, 'G_1B'))
    expect(g).toContain('−0.04')
    expect(g).toContain('GSAx per 60: −0.04')
    expect(g).not.toContain('shoots')
  })

  it('renders in French', async () => {
    await i18n.changeLanguage('fr')
    const text = textOf(renderToStaticMarkup(<TeamNeedsTab data={stl} />))
    expect(text).toContain('Rang 32 sur 32 · tiers inférieur')
    expect(text).toContain('Les plus faibles de la ligue : Top 4 en défense')
    expect(text).toContain('saison dernière')
  })
})

describe('TeamNeedsTab offseason (Phase 2b)', () => {
  it("names next season's signed roster as the basis", () => {
    const text = textOf(renderToStaticMarkup(<TeamNeedsTab data={carNext} />))
    expect(text).toContain("2027-28 signed roster, slotted by last season's ice time")
    expect(text).not.toContain('projected lines')
  })

  it('in French', async () => {
    await i18n.changeLanguage('fr')
    expect(textOf(renderToStaticMarkup(<TeamNeedsTab data={carNext} />))).toContain('Effectif 2027-28 sous contrat')
  })
})
