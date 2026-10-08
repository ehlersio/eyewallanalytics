// cypress/e2e/pwhl-guest-game.cy.js
// Following a PWHL Scoreboard game as either team, without changing the
// followed team: a live game's team rows open /pwhl/game/:gameId?as=, the
// Shot Map from that team's side (PWHLGuestGameView.jsx, useLeagueGameTeam
// in GameTeamContext.jsx). The AHL/ECHL twin is hockeytech-guest-game.cy.js.
//
// The Scoreboard (/pwhl/today) and the live games' /pwhl/live are stubbed:
// the guest game is the saved real PWHL 212 (NY 4 at OTT 0, 2025-26)
// replayed as live. The finals are real: 112 (NY at BOS 4-2, 2024-25, an
// older season than the current one) and 326 (MTL 2 at SEA 1, SO).

const FOLLOWED = { abbr: 'MTL', teamId: 3 }
const LIVE_FIXTURE = 'src/utils/__tests__/fixtures/pwhl-game-212/live.json'
const DOTS = '.rhr-svg circle[style*="cursor: pointer"]'

const visitAs = path => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('eyewall:sport', 'pwhl')
      win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify(FOLLOWED))
    },
  })
  cy.get('.topbar', { timeout: 10000 }).should('exist')
}

const stubLive = () => {
  const workerUrl = Cypress.expose('WORKER_URL')
  cy.readFile(LIVE_FIXTURE).then(live => {
    cy.intercept('GET', `${workerUrl}/pwhl/today*`, [
      // The followed team's own live game.
      { gameId: 777, gameDate: '2026-10-10', homeTeamId: FOLLOWED.teamId, awayTeamId: 99, homeTeamCode: FOLLOWED.abbr, awayTeamCode: 'OPP',
        homeScore: 0, awayScore: 0, status: 'live' },
      { gameId: 212, gameDate: '2026-10-10', homeTeamId: 5, awayTeamId: 4, homeTeamCode: 'OTT', awayTeamCode: 'NY',
        homeScore: 0, awayScore: 3, status: 'live' },
      { gameId: 779, gameDate: '2026-10-10', homeTeamId: 1, awayTeamId: 2, homeTeamCode: 'BOS', awayTeamCode: 'MIN',
        homeScore: 0, awayScore: 0, status: 'pre' },
    ]).as('today')
    cy.intercept('GET', `${workerUrl}/pwhl/live/777`, { gameId: 777, homeTeamId: FOLLOWED.teamId, awayTeamId: 99, homeScore: 0, awayScore: 0, gameStatus: 'live', events: [] })
    cy.intercept('GET', `${workerUrl}/pwhl/live/212`, { ...live, gameStatus: 'live' }).as('guestLive')
  })
}

describe('PWHL Scoreboard → guest game view', () => {
  beforeEach(() => {
    stubLive()
    visitAs('/pwhl/league')
    cy.wait('@today', { timeout: DATA_TIMEOUT })
  })

  it('makes only live games’ team rows tappable, the followed team’s to its own Shot Map', () => {
    cy.get('.scoreboard-team-link', { timeout: DATA_TIMEOUT }).should('have.length', 3)
    cy.get('.scoreboard-team-link[href="/pwhl/shots"]').should('have.length', 1)
    cy.get('.scoreboard-team-link[href="/pwhl/game/212?as=NY"]').should('exist')
    cy.get('.scoreboard-team-link[href="/pwhl/game/212?as=OTT"]').should('exist')
  })

  it('opens the game from the tapped team’s side, plots it live, and leaves the followed team alone', () => {
    cy.get('.scoreboard-team-link[href="/pwhl/game/212?as=NY"]', { timeout: DATA_TIMEOUT }).click()

    cy.location('pathname').should('eq', '/pwhl/game/212')
    cy.location('search').should('eq', '?as=NY')
    cy.get('.guest-game-bar').should('contain', 'Viewing as NY')
    cy.wait('@guestLive', { timeout: DATA_TIMEOUT })
    // The live game from the guest's side: their score first.
    cy.contains('#main-content button', '🔴 LIVE', { timeout: DATA_TIMEOUT })
      .should('contain', 'OTT').and('contain', '4–0')
    cy.get('.score-card').should('contain', 'NY').and('contain', 'LIVE')
    // One game, not the guest's season: no season chips or game chips.
    cy.contains('#main-content button', '2025-26').should('not.exist')
    cy.contains('#main-content button', /^All\s*\d/).should('not.exist')
    // The live play-by-play's shots on the rink.
    cy.get(DOTS, { timeout: DATA_TIMEOUT }).should('have.length.greaterThan', 0)
    cy.window().then(win => {
      expect(JSON.parse(win.localStorage.getItem('eyewall:pwhl_team')).abbr).to.eq(FOLLOWED.abbr)
    })

    // Back to the Scoreboard it was opened from.
    cy.get('.guest-game-back').should('contain', 'Back to Scoreboard').click()
    cy.location('pathname').should('eq', '/pwhl/league')
    cy.get('.scoreboard-team-link').should('have.length', 3)
    cy.get('.guest-game-bar').should('not.exist')
    cy.assertNoErrors()
  })
})

describe('PWHL guest game links', () => {
  it('opens an older season’s final from the named side, on that season', () => {
    visitAs('/pwhl/game/112?as=BOS')
    cy.get('.guest-game-bar').should('contain', 'Viewing as BOS')
    cy.get('.score-card', { timeout: DATA_TIMEOUT }).should('contain', 'BOS').and('contain', 'NY')
      .and('contain', 'Final').and('contain', '4').and('contain', '2')
    cy.get(DOTS, { timeout: DATA_TIMEOUT }).should('have.length.greaterThan', 0)
    cy.assertNoErrors()
  })

  it('opens a shootout final with its official score', () => {
    visitAs('/pwhl/game/326?as=SEA')
    cy.get('.score-card', { timeout: DATA_TIMEOUT }).should('contain', 'SEA').and('contain', 'MTL').and('contain', 'SO')
    cy.get('.score-card').should('not.contain', 'OT4')
  })

  it('opens as the home team when the link names no side', () => {
    stubLive()
    visitAs('/pwhl/game/212')
    cy.get('.guest-game-bar', { timeout: DATA_TIMEOUT }).should('contain', 'Viewing as OTT')
    cy.contains('#main-content button', '🔴 LIVE', { timeout: DATA_TIMEOUT }).should('contain', '0–4')
  })

  it('redirects a link it can’t open, or the followed team’s own, to its Shot Map', () => {
    for (const path of ['/pwhl/game/212?as=XYZ', '/pwhl/game/abc?as=NY', `/pwhl/game/326?as=${FOLLOWED.abbr}`]) {
      visitAs(path)
      cy.location('pathname', { timeout: DATA_TIMEOUT }).should('eq', '/pwhl/shots')
      cy.get('.guest-game-bar').should('not.exist')
    }
  })
})
