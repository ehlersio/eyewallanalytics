// cypress/e2e/hockeytech-shots-live.cy.js
// AHL/ECHL Shot Map: a live game's shots and goals on the rink, from its
// /live play-by-play (utils/hockeyTechLiveShots.js), on the followed team's
// page and in a guest game view; the stored shots win once the nightly has
// them.
//
// /today and /live are stubbed with real saved /live payloads (AHL 1029081
// CLT at HER, ECHL 24296 REA at TR; the unit tests' fixtures) replayed as
// live, and /game-shots with nothing stored yet (or, for the last test, a
// few stored rows), so the rink has exactly one source.

import { LEAGUES, visitAs } from '../support/hockeytech'

const FIXTURES = {
  ahl: { path: 'src/utils/__tests__/fixtures/ahl-game-1029081/live.json', home: 'HER', away: 'CLT' },
  echl: { path: 'src/utils/__tests__/fixtures/game-events-replay/echl-24296-live.json', home: 'TR', away: 'REA' },
}

// The rink's dots (react-hockey-rink draws each event as a clickable circle;
// it opens on the page's own team's events).
const DOTS = '[data-tour="rink"] .rhr-svg circle[style*="cursor: pointer"]'

// A team's shots and goals the rink can place: each goal once (the feed
// sends it as a shot and a goal), shots without coordinates left out.
const plottable = (live, teamId) => live.events.filter(e => e.teamId === teamId &&
  (e.eventType === 'goal' || (e.eventType === 'shot' && !e.isGoal)) && e.x != null && e.y != null).length

LEAGUES.forEach(({ key, label, team }) => {
  const fixture = FIXTURES[key]
  const workerUrl = Cypress.expose('WORKER_URL')

  // The saved final replayed as live, its home team swapped for `homeId`.
  const asLive = (live, homeId) => ({
    ...live,
    gameStatus: 'live',
    homeTeamId: homeId,
    events: live.events.map(e => (e.teamId === live.homeTeamId ? { ...e, teamId: homeId } : e)),
  })

  const stub = (live, homeCode, awayCode, stored = []) => {
    cy.intercept('GET', `${workerUrl}/${key}/today*`, [{
      gameId: live.gameId, gameDate: '2026-10-10', homeTeamId: live.homeTeamId, awayTeamId: live.awayTeamId,
      homeTeamCode: homeCode, awayTeamCode: awayCode, homeScore: live.homeScore, awayScore: live.awayScore, status: 'live',
    }]).as('today')
    cy.intercept('GET', `${workerUrl}/${key}/live/${live.gameId}`, live).as('live')
    cy.intercept('GET', `${workerUrl}/${key}/game-shots?gameId=${live.gameId}`, stored).as('gameShots')
  }

  describe(`${label} Shot Map, live game on the rink`, () => {
    it(`plots ${team.abbr}'s live game on its own Shot Map`, () => {
      cy.readFile(fixture.path).then(saved => {
        const live = asLive(saved, team.teamId)
        stub(live, team.abbr, fixture.away)
        visitAs(`/${key}/shots`, key, team)
        cy.wait('@live', { timeout: DATA_TIMEOUT })

        // The live chip is picked and the page is on its game.
        cy.contains('#main-content button', '🔴 LIVE', { timeout: DATA_TIMEOUT }).should('exist')
        cy.get('#main-content').should('contain', `Live · vs ${fixture.away}`)
        cy.get(DOTS, { timeout: DATA_TIMEOUT }).should('have.length', plottable(live, team.teamId))
        // The cards count the followed team's goals from the same rows.
        const ourGoals = live.events.filter(e => e.eventType === 'goal' && e.teamId === team.teamId).length
        cy.contains('#main-content div', /^Goals$/).next().should('have.text', String(ourGoals))
        cy.get('[data-tour="rink"]').should('not.contain', "Shot data for this game isn't in yet")
        cy.assertNoErrors()
      })
    })

    it('plots a guest game view’s live game', () => {
      cy.readFile(fixture.path).then(saved => {
        const live = asLive(saved, saved.homeTeamId)
        stub(live, fixture.home, fixture.away)
        visitAs(`/${key}/game/${live.gameId}?as=${fixture.away}`, key, team)
        cy.get('.guest-game-bar', { timeout: DATA_TIMEOUT }).should('contain', `Viewing as ${fixture.away}`)
        cy.wait('@live', { timeout: DATA_TIMEOUT })
        cy.get('#main-content', { timeout: DATA_TIMEOUT }).should('contain', `Live · at ${fixture.home}`)
        cy.get(DOTS, { timeout: DATA_TIMEOUT }).should('have.length', plottable(live, live.awayTeamId))
        // A shot's popup names its shooter (from the feed: the guest's own
        // roster may not have a call-up yet).
        const names = live.events.filter(e => e.teamId === live.awayTeamId)
          .map(e => e.shooter || e.scoredBy).filter(Boolean).map(p => `${p.firstName} ${p.lastName}`)
        cy.get(DOTS).first().click({ force: true })
        cy.get('.rhr-popup').should($p => {
          expect(names.some(n => $p.text().includes(n)), 'a guest shooter named').to.equal(true)
        })
        cy.assertNoErrors()
      })
    })

    it('prefers the stored shots once the nightly has them', () => {
      cy.readFile(fixture.path).then(saved => {
        const live = asLive(saved, saved.homeTeamId)
        const row = (id, teamId, x) => ({
          id, game_id: live.gameId, event_type: 'shot', period_id: 1, time_seconds: id * 60,
          team_id: teamId, shooter_id: null, shot_type: '', x_norm: x, y_norm: 5,
        })
        stub(live, fixture.home, fixture.away, [row(1, live.homeTeamId, 60), row(2, live.awayTeamId, -70), row(3, live.awayTeamId, 75), row(4, live.awayTeamId, 80)])
        visitAs(`/${key}/game/${live.gameId}?as=${fixture.away}`, key, team)
        cy.wait('@gameShots', { timeout: DATA_TIMEOUT })
        cy.wait('@live', { timeout: DATA_TIMEOUT })
        cy.get(DOTS, { timeout: DATA_TIMEOUT }).should('have.length', 3)
      })
    })
  })
})
