// The player popup's Trade fit section over real /trade-fit payloads
// (Aho and Kochetkov, 2026-11-07, cypress/fixtures): summary, basis line,
// clause, top-5 rows with reasons, and French.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import '../../i18n/index.js'
import i18n from '../../i18n/index.js'
import { TradeFitBody } from '../TradeFitSection.jsx'
import aho from '../../../cypress/fixtures/trade-fit-aho-2026-11-07.json'
import kochetkov from '../../../cypress/fixtures/trade-fit-kochetkov-2026-11-07.json'
import ahoOff from '../../../cypress/fixtures/trade-fit-offseason-aho-2027-03-02.json'
import greenwayOff from '../../../cypress/fixtures/trade-fit-offseason-greenway-2027-03-02.json'

const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
const rowOf = (html, team) => {
  const start = html.indexOf(`data-team="${team}"`)
  const next = html.indexOf('data-team=', start + 1)
  return textOf(html.slice(start, next === -1 ? undefined : next))
}

afterEach(() => i18n.changeLanguage('en'))

describe('TradeFitBody', () => {
  it('summarizes tiers and shows the player basis and clause', () => {
    const text = textOf(renderToStaticMarkup(<TradeFitBody data={aho} />))
    expect(text).toContain('Strong fit with 11 teams · possible with 15 · long shot for 5')
    expect(text).toContain('signed through 2031-32')
    expect(text).toContain('$9.75M')
    expect(text).toContain("No-move clause: he'd have to approve any trade.")
  })

  it('lists the top five teams with tiers, reasons closed until a team is opened', () => {
    const closed = renderToStaticMarkup(<TradeFitBody data={aho} />)
    expect(closed).not.toContain('trade-fit-reasons')
    expect(textOf(closed)).toContain('Tap a team to see why.')
    const html = renderToStaticMarkup(<TradeFitBody data={aho} initialOpen="DET" />)
    expect((html.match(/trade-fit-reasons/g) || []).length).toBe(1)
    expect((html.match(/data-team="/g) || []).length).toBe(5)
    const first = aho.teams[0]
    const row = rowOf(html, first.team)
    expect(row).toContain('Strong fit')
    // DET's top-6 centers rank in the league's bottom third on 2026-11-07
    expect(row).toContain("Top-6 centers rank in the league's bottom third: he'd be +0.76 over their weakest")
    expect(row).toContain('Signed through 2031-32: fits any timeline')
    expect(row).toMatch(/Fits under the cap \(est\. \$\d+\.\d\dM space\)|Fits if the seller keeps 50%/)
    expect(textOf(html)).toContain('Show all 31 teams')
  })

  it('a rental reads the playoff-odds bar', () => {
    const first = kochetkov.teams[0].team
    const html = renderToStaticMarkup(<TradeFitBody data={kochetkov} initialOpen={first} />)
    expect(textOf(html)).toContain('expiring contract')
    expect(textOf(html)).toContain('GSAx per 60')
    expect(textOf(html)).toMatch(/\d+% playoff odds: a rental fits/)
    // his clause status for 2026-27: none (a blank cell on his CapFriendly page)
    expect(textOf(html)).toContain('No trade clause: he has no trade protection.')
    expect(textOf(html)).not.toContain('No trade clause on record')
  })

  it('words likely, ineligible and unknown "no clause" apart', () => {
    const withStatus = clauseStatus => ({ ...kochetkov, player: { ...kochetkov.player, clauseStatus } })
    const text = s => textOf(renderToStaticMarkup(<TradeFitBody data={withStatus(s)} />))
    expect(text({ status: 'none_likely', basis: 'breakdown_without_clause' })).toContain("No trade clause reported (PuckPedia's contract breakdown lists none).")
    expect(text({ status: 'none', basis: 'ineligible' })).toContain("he isn't UFA-eligible yet, so the CBA doesn't allow one")
    expect(text({ status: 'unknown', basis: null })).toContain('No trade clause on record')
    expect(text(null)).toContain('No trade clause on record')
  })

  it('renders nothing without a fit', () => {
    expect(renderToStaticMarkup(<TradeFitBody data={{ player: null, teams: [] }} />)).toBe('')
    expect(renderToStaticMarkup(<TradeFitBody data={null} />)).toBe('')
  })

  it('words a known "no clause" in French', async () => {
    await i18n.changeLanguage('fr')
    expect(textOf(renderToStaticMarkup(<TradeFitBody data={kochetkov} />))).toContain("Aucune clause d'échange : il n'a aucune protection contre un échange.")
  })

  it('renders in French', async () => {
    await i18n.changeLanguage('fr')
    const text = textOf(renderToStaticMarkup(<TradeFitBody data={aho} />))
    expect(text).toContain('Intérêt fort pour 11 équipes')
    expect(text).toContain('Clause de non-mouvement')
    expect(text).toContain('Voir les 31 équipes')
  })
})

// Phase 2b: the pipeline's dry run as of 2027-03-02 (the day after the
// deadline), shaped by the Worker's summarizeTradeFit.
describe('TradeFitBody offseason', () => {
  it('says the fit is for next season and names its cap', () => {
    const html = renderToStaticMarkup(<TradeFitBody data={ahoOff} initialOpen={ahoOff.teams[0].team} />)
    const text = textOf(html)
    expect(html).toContain('data-phase="offseason"')
    expect(text).toContain("Offseason fit for 2027-28: next season's signed rosters, cap and contenders.")
    expect(rowOf(html, ahoOff.teams[0].team)).toContain("The 2027-28 cap ceiling isn't in the cap data yet")
    expect(text).toContain('signed through')
  })

  it("a pending UFA's rights-only fit", () => {
    const html = renderToStaticMarkup(<TradeFitBody data={greenwayOff} initialOpen={greenwayOff.teams[0].team} />)
    const text = textOf(html)
    expect(text).toContain('pending UFA: rights only until June 30')
    expect(text).not.toContain('expiring contract')
    expect(rowOf(html, greenwayOff.teams[0].team)).toContain('Rights only: the new team could sign him before July 1')
    expect(greenwayOff.teams.every(t => t.tier !== 'strong')).toBe(true) // rights fits top out at possible
  })

  it('an in-season payload shows no phase note', () => {
    expect(renderToStaticMarkup(<TradeFitBody data={aho} />)).not.toContain('trade-fit-phase')
  })

  it('in French', async () => {
    await i18n.changeLanguage('fr')
    const text = textOf(renderToStaticMarkup(<TradeFitBody data={greenwayOff} />))
    expect(text).toContain('Intérêt hors saison pour 2027-28')
    expect(text).toContain("UFA imminent : droits seulement jusqu'au 30 juin")
  })
})
