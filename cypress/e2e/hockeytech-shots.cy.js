// cypress/e2e/hockeytech-shots.cy.js
// AHL/ECHL Shot Map tab: the shot map, live-game care (wake lock, re-check on resume and push), the win popup on a real game's end, and the dev debug panel's popups.
// Split from hockeytech-routes.cy.js (Phase 3); fixtures and helpers are in
// ../support/hockeytech.js.

import { LEAGUES, visitAs, leagueLogo, assertNoLoadFailure } from '../support/hockeytech'

LEAGUES.forEach(({ key, label, team }) => {
  describe(`${label} Shot Map`, () => {
    it(`/${key}/shots renders the ${team.abbr} shot map`, () => {
      visitAs(`/${key}/shots`, key, team)
      cy.contains('h2', 'Shot Map', { timeout: DATA_TIMEOUT })
        .find(leagueLogo(key, team.abbr)).should('exist')
      cy.get('[data-tour="rink"]', { timeout: DATA_TIMEOUT }).should($rink => {
        const hasRink = $rink.find('svg').length > 0
        const noData = /No shot data|Shot data for this game isn't in yet/.test($rink.text())
        expect(hasRink || noData, 'the rink or its no-data message').to.equal(true)
      })
      assertNoLoadFailure()
    })

    // Live-game care brought over from the NHL ShotMapView (Phase 2 #9):
    // a live game holds a screen wake lock, and returning to the app or a
    // push re-checks today's games at once instead of on the next poll.
    it(`/${key}/shots keeps the screen on and re-checks on resume and push`, () => {
      const workerUrl = Cypress.expose('WORKER_URL')
      let todayCalls = 0
      cy.intercept('GET', `${workerUrl}/${key}/today*`, req => {
        todayCalls++
        req.reply([{ gameId: 777, gameDate: '2026-10-10', homeTeamId: team.teamId, awayTeamId: 1, homeTeamCode: team.abbr, awayTeamCode: 'OPP', homeScore: 1, awayScore: 0, status: 'live' }])
      }).as('today')
      cy.intercept('GET', `${workerUrl}/${key}/live/777`, { body: { gameId: 777, homeTeamId: team.teamId, awayTeamId: 1, homeScore: 1, awayScore: 0, gameStatus: 'live', events: [] } })
      cy.visit(`/${key}/shots`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', key)
          win.localStorage.setItem(`eyewall:${key}_team`, JSON.stringify(team))
          const request = cy.stub().resolves({ released: false, release: () => Promise.resolve(), addEventListener() {} }).as('wakeLock')
          Object.defineProperty(win.navigator, 'wakeLock', { value: { request }, configurable: true })
        },
      })
      cy.wait('@today', { timeout: DATA_TIMEOUT })
      cy.get('@wakeLock', { timeout: DATA_TIMEOUT }).should('have.been.calledWith', 'screen')

      // Settle (StrictMode double-mounts on the dev server), then count.
      cy.wait(1000).then(() => {
        const before = todayCalls
        cy.document().then(doc => doc.dispatchEvent(new Event('visibilitychange')))
        cy.wrap(null, { timeout: 5000 }).should(() => expect(todayCalls).to.be.greaterThan(before))
      })
      cy.wait(500).then(() => {
        const before = todayCalls
        cy.window().then(win => win.dispatchEvent(new win.Event('eyewall:push-received')))
        cy.wrap(null, { timeout: 5000 }).should(() => expect(todayCalls).to.be.greaterThan(before))
      })
    })

    // The win popup on a real game's end (audit 2026-10-06 §14: it never
    // fired). /today says live, then final; once final the page stops
    // polling /live but fetches the ended game once more, and the win
    // pops up exactly once.
    it(`/${key}/shots shows the win popup once when the followed team's live game ends in a win`, () => {
      const workerUrl = Cypress.expose('WORKER_URL')
      let status = 'live'
      const game = () => ({ gameId: 777, gameDate: '2026-10-10', homeTeamId: team.teamId, awayTeamId: 1, homeTeamCode: team.abbr, awayTeamCode: 'OPP', homeScore: status === 'final' ? 2 : 1, awayScore: 1, status })
      cy.intercept('GET', `${workerUrl}/${key}/today*`, req => req.reply([game()])).as('today')
      cy.intercept('GET', `${workerUrl}/${key}/live/777`, req => req.reply({
        gameId: 777, homeTeamId: team.teamId, awayTeamId: 1,
        homeScore: status === 'final' ? 2 : 1, awayScore: 1,
        gameStatus: status, events: [],
      })).as('live')
      visitAs(`/${key}/shots`, key, team)
      cy.wait('@live', { timeout: DATA_TIMEOUT })
      cy.get('.win-popup').should('not.exist')

      cy.wait(1000).then(() => { status = 'final' })
      cy.window().then(win => win.dispatchEvent(new win.Event('eyewall:push-received')))
      cy.get('.win-popup', { timeout: DATA_TIMEOUT }).should('contain', `${team.abbr} 2 – `)
      cy.get('.win-popup').click({ force: true })
      cy.get('.win-popup').should('not.exist')

      // Another re-check of a game already celebrated stays quiet.
      cy.window().then(win => win.dispatchEvent(new win.Event('eyewall:push-received')))
      cy.wait('@today')
      cy.wait(1500)
      cy.get('.win-popup').should('not.exist')
      cy.assertNoErrors()
    })

    // HockeyTechGameEvents' popups, fired from the dev-only debug panel
    // (5 taps on the header), the way pwhl-shots-live.cy.js does for PWHL.
    it(`/${key}/shots debug panel fires the ${label} event popups`, () => {
      visitAs(`/${key}/shots`, key, team)
      cy.contains('h2', 'Shot Map', { timeout: DATA_TIMEOUT })
      Cypress._.times(5, () => cy.contains('h2', 'Shot Map').click())
      cy.contains(`${label} Event Debug`, { timeout: 4000 }).should('exist')
      cy.contains('⚡ PP Goal').click()
      cy.get('.goal-popup').should('contain', 'Power Play').click({ force: true })
      cy.contains('🟠 Major').click()
      cy.get('.penalty-popup').should('contain', 'POWER').and('contain', 'Major').click({ force: true })
      cy.contains('🏒 Puck Drop').click()
      cy.get('.puck-drop-popup').should('contain', "Let's go!").click({ force: true })
      cy.contains('🏆 Win').click()
      cy.get('.win-popup').should('contain', team.abbr)
      cy.assertNoErrors()
    })
  })
})
