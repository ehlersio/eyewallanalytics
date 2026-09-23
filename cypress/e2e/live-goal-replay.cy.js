// cypress/e2e/live-goal-replay.cy.js
// The live rink's second mode: the most recent goal redrawn from the NHL's
// player-and-puck tracking, offered only once that tracking exists.
//
// ?mockGame= (DEV only, nhlApi.getLiveGame) drives the live path from a
// completed game, so these don't need an actual game in progress. The game
// is a finished one from last season -- its play-by-play will never change,
// which makes it a far steadier fixture than whatever is live tonight.
//
// The Worker's /nhl/goal-replay is stubbed in both directions on purpose:
// whether a real goal's tracking is published is the NHL's business and not
// something a test should wait on, but "published" vs "not yet" is exactly
// the distinction this feature turns on.

const MOCK_GAME = 2025020500
const CAR = { abbr: 'CAR', teamId: 12 }

function visitLiveGame() {
  cy.visit(`/?mockGame=${MOCK_GAME}`, {
    onBeforeLoad(win) {
      win.localStorage.setItem('eyewall:sport', 'nhl')
      win.localStorage.setItem('eyewall:team', JSON.stringify(CAR))
    },
  })
  cy.get('.topbar', { timeout: 10000 }).should('exist')
}

describe('Live rink — goal replay', () => {
  it('offers the replay, plays it on the rink, and comes back to live', () => {
    cy.intercept('GET', '**/nhl/goal-replay/**', { fixture: 'goal-replay.json' }).as('replay')

    visitLiveGame()

    // The live rink itself is the control's home -- it is not a separate card.
    cy.get('.live-rink-replay-cta', { timeout: DATA_TIMEOUT }).should('be.visible').click()

    cy.get('.goal-tracking-replay', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('.live-rink-back-to-live').should('be.visible').click()

    cy.get('.goal-tracking-replay').should('not.exist')
    // ...and the offer is still there, so watching it once doesn't consume it.
    cy.get('.live-rink-replay-cta').should('be.visible')
    cy.assertNoErrors()
  })

  it('offers nothing while the NHL has not published the tracking yet', () => {
    // The Worker's real answer for a goal with no replay: 404 { available: false }.
    // A control here would be a button that returns nothing.
    cy.intercept('GET', '**/nhl/goal-replay/**', {
      statusCode: 404,
      body: { available: false },
    }).as('noReplay')

    visitLiveGame()

    // The live rink is up -- this is the "no replay" case, not "no rink".
    cy.contains('.sec-label', /Live rink/i, { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('.live-rink-replay-cta').should('not.exist')
    cy.get('.goal-tracking-replay').should('not.exist')
  })
})
