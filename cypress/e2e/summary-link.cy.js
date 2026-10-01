// cypress/e2e/summary-link.cy.js
// Tapping an End of P1 / final notification lands on
// /?summary=<period|game>&game=<id>[&team=<abbr>] (eyewall-poller's
// summaryUrl(), read by utils/summaryLink.js): the game view switches to
// that game and opens its summary.
//
// The season schedule is stubbed to one real, permanent game so this
// doesn't depend on the season on screen: CAR's 3-2 preseason win over
// FLA on 2026-09-22, which went past OT. Its play-by-play is the NHL's own.

const GAME_ID = 2026010026
const SCHEDULE = [{
  id: GAME_ID, season: 20262027, gameType: 1, gameDate: '2026-09-22', startTimeUTC: '2026-09-22T23:00:00Z',
  gameState: 'FINAL', homeTeam: { id: 12, abbrev: 'CAR', score: 3 }, awayTeam: { id: 13, abbrev: 'FLA', score: 2 },
}]

describe('Opening a summary from a notification link', () => {
  beforeEach(() => {
    cy.setTeam('CAR')
    cy.intercept('GET', '**/schedule?team=CAR*', SCHEDULE)
  })

  it('opens that period’s summary and tidies the link out of the URL', () => {
    cy.visit(`/?summary=1&game=${GAME_ID}`)
    cy.get('.ps-card', { timeout: DATA_TIMEOUT }).should('contain', 'P1').and('contain', 'FLA')
    cy.get('.score-card').should('contain', 'CAR').and('contain', 'FLA')
    cy.location('search').should('eq', '')
  })

  it('opens the game’s final summary', () => {
    cy.visit(`/?summary=game&game=${GAME_ID}`)
    cy.get('.ps-card', { timeout: DATA_TIMEOUT }).should('contain', 'FINAL').and('contain', 'FLA')
    cy.location('search').should('eq', '')
  })

  // A followed team's alert (2026-09-30: MTL's, with CAR primary) used to
  // be dropped here -- the game isn't in the favorite's schedule. It opens
  // from that team's side instead. FLA's own schedule is the real one.
  it('opens a followed team’s game from that team’s side', () => {
    cy.visit(`/?summary=1&game=${GAME_ID}&team=FLA`)
    cy.location('pathname', { timeout: DATA_TIMEOUT }).should('eq', `/game/${GAME_ID}`)
    cy.get('.ps-card', { timeout: DATA_TIMEOUT }).should('contain', 'P1')
    cy.get('.guest-game-bar').should('contain', 'FLA')
    cy.location('search').should('eq', '?as=FLA')
  })

  it('drops a link to a game it can’t show, opening nothing', () => {
    cy.visit('/?summary=1&game=2025020001')
    cy.location('search', { timeout: DATA_TIMEOUT }).should('eq', '')
    cy.get('.score-card', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('.ps-card').should('not.exist')
  })
})
