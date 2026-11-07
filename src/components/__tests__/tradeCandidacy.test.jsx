// The player popup's Candidate signals section and League › Cap's Deadline
// board over real /trade-candidacy payloads (cypress/fixtures, the pipeline's
// dry run as of 2027-01-01): tier, signals, clause, never the model's number,
// position groups and French.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../utils/seasonClient', () => ({
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}))

import '../../i18n/index.js'
import i18n from '../../i18n/index.js'
import { TradeCandidacyBody } from '../TradeCandidacySection.jsx'
import DeadlineBoard from '../DeadlineBoard.jsx'
import board from '../../../cypress/fixtures/trade-candidacy-board-2027-01-01.json'
import greenway from '../../../cypress/fixtures/trade-candidacy-greenway-2027-01-01.json'
import rakell from '../../../cypress/fixtures/trade-candidacy-rakell-2027-01-01.json'

const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

afterEach(() => i18n.changeLanguage('en'))

describe('TradeCandidacyBody', () => {
  it('shows the tier, the signals and the clause, and no percentage for the player', () => {
    const text = textOf(renderToStaticMarkup(<TradeCandidacyBody data={greenway} />))
    expect(text).toContain('Candidate signals')
    expect(text).toContain('Several signals')
    expect(text).toContain('As of Jan 1 · trade deadline Mar 1')
    expect(text).toContain('Contract ends this season (UFA) · UFA/RFA estimated from age')
    expect(text).toContain('Team is 15th in the West, outside a playoff spot (top 8 by points %)')
    expect(text).toContain('Modified no-trade clause: up to 5 teams may be blocked')
    expect(text).not.toMatch(/\d+(\.\d+)?%(?! by points)/) // the backtest rates live in the InfoTip only
  })

  it('a "some" player with one signal', () => {
    const html = renderToStaticMarkup(<TradeCandidacyBody data={rakell} />)
    expect(html).toContain('data-tier="some"')
    expect(textOf(html)).toContain('Some signals')
    expect(html.match(/trade-candidacy-signal /g)).toHaveLength(1)
  })

  it('words the ice-time signal', () => {
    const data = { ...greenway, player: { ...greenway.player, signals: [{ code: 'toi_down', pct: -0.123, recent_toi: 1023, season_toi: 1166 }] } }
    expect(textOf(renderToStaticMarkup(<TradeCandidacyBody data={data} />)))
      .toContain('Ice time down 12%: 17:03 a game over his last 10, 19:26 on the season')
  })

  it('renders nothing for an untiered player or outside the window', () => {
    expect(renderToStaticMarkup(<TradeCandidacyBody data={{ player: null }} />)).toBe('')
    expect(renderToStaticMarkup(<TradeCandidacyBody data={null} />)).toBe('')
  })

  it('in French', async () => {
    await i18n.changeLanguage('fr')
    const text = textOf(renderToStaticMarkup(<TradeCandidacyBody data={greenway} />))
    expect(text).toContain('Signaux de transaction')
    expect(text).toContain('Plusieurs signaux')
    expect(text).toContain("Équipe 15e dans l'Ouest, hors des séries")
  })
})

describe('DeadlineBoard', () => {
  it('lists the top 25 by the model, with tiers, short signals and cap hits', () => {
    const html = renderToStaticMarkup(<DeadlineBoard board={board} />)
    const text = textOf(html)
    expect(text).toContain(`${board.players.length} players with candidate signals · as of Jan 1 · deadline Mar 1`)
    expect(html.match(/deadline-board-row /g)).toHaveLength(25)
    // name, then the phone line of signals, tier, the wide-screen signals column, cap hit
    expect(text).toContain('Jordan Greenway CHI · L Expiring UFA · Outside playoffs Several signals Expiring UFA · Outside playoffs $4.00M')
    expect(html.match(/deadline-board-signals-inline/g)).toHaveLength(25)
    expect(text).toContain(`Show all ${board.players.length}`)
    expect(html).toContain('data-group="goalies"')
    expect(html).not.toContain('data-group="fit"') // fixture has no fit team
  })

  it('offers the fit filter when the selected team fits someone', () => {
    const players = board.players.map((p, i) => ({ ...p, fit: i === 3 ? 'strong' : null }))
    const html = renderToStaticMarkup(<DeadlineBoard board={{ ...board, fitTeam: 'CAR', players }} />)
    expect(textOf(html)).toContain('Fits CAR')
  })

  it('renders nothing outside the window', () => {
    expect(renderToStaticMarkup(<DeadlineBoard board={{ players: [], asOf: null }} />)).toBe('')
    expect(renderToStaticMarkup(<DeadlineBoard board={null} />)).toBe('')
  })
})
