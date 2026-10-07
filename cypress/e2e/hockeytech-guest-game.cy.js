// cypress/e2e/hockeytech-guest-game.cy.js
// Following an AHL/ECHL Scoreboard game as either team, without changing
// the followed team: a live game's team rows open /{league}/game/:gameId?as=,
// the Shot Map from that team's side (HockeyTechGuestGameView.jsx,
// useLeagueGameTeam in GameTeamContext.jsx). The NHL's is guest-game.cy.js.
//
// The Scoreboard (/today) and the live games' /live are stubbed, so there's
// always a live game to tap. The finals are real: AHL 1027785 is SYR at HER
// (2025-26), ECHL 24323 is ADK at WOR (2025-26), both with stored shots.

import { LEAGUES, visitAs } from '../support/hockeytech'

const FIXTURES = {
  ahl: {
    guestGame: { gameId: 778, home: { abbr: 'CLT', teamId: 384 }, away: { abbr: 'TEX', teamId: 380 } },
    final: { gameId: 1027785, guest: 'SYR', line: 'Final · at HER', homeIsFavorite: true },
    seasonLabels: ['2026-27', '2025-26'],
  },
  echl: {
    guestGame: { gameId: 778, home: { abbr: 'FLA', teamId: 8 }, away: { abbr: 'ORL', teamId: 61 } },
    final: { gameId: 24323, guest: 'WOR', line: 'Final · vs ADK', homeIsFavorite: false },
    seasonLabels: ['2026-27', '2025-26'],
  },
}

LEAGUES.forEach(({ key, label, team }) => {
  const { guestGame, final, seasonLabels } = FIXTURES[key]
  const { home, away } = guestGame
  const workerUrl = Cypress.expose('WORKER_URL')

  const today = [
    // The followed team's own live game.
    { gameId: 777, gameDate: '2026-10-10', homeTeamId: team.teamId, awayTeamId: 1, homeTeamCode: team.abbr, awayTeamCode: 'OPP',
      homeScore: 0, awayScore: 0, status: 'live' },
    { gameId: guestGame.gameId, gameDate: '2026-10-10', homeTeamId: home.teamId, awayTeamId: away.teamId,
      homeTeamCode: home.abbr, awayTeamCode: away.abbr, homeScore: 1, awayScore: 1, status: 'live' },
    { gameId: 779, gameDate: '2026-10-10', homeTeamId: 1, awayTeamId: 2, homeTeamCode: 'AAA', awayTeamCode: 'BBB',
      homeScore: 0, awayScore: 0, status: 'pre' },
  ]
  const live = (gameId, homeTeamId, awayTeamId, homeScore, awayScore) =>
    ({ gameId, homeTeamId, awayTeamId, homeScore, awayScore, gameStatus: 'live', events: [] })

  const stubLive = () => {
    cy.intercept('GET', `${workerUrl}/${key}/today*`, today).as('today')
    cy.intercept('GET', `${workerUrl}/${key}/live/777`, live(777, team.teamId, 1, 0, 0))
    // /live's score is newer than /today's: the guest view shows this one.
    cy.intercept('GET', `${workerUrl}/${key}/live/${guestGame.gameId}`,
      live(guestGame.gameId, home.teamId, away.teamId, 1, 2)).as('guestLive')
  }

  describe(`${label} Scoreboard → guest game view`, () => {
    beforeEach(() => {
      stubLive()
      visitAs(`/${key}/league`, key, team)
      cy.wait('@today', { timeout: DATA_TIMEOUT })
    })

    it('makes only live games’ team rows tappable, the followed team’s to its own Shot Map', () => {
      cy.get('.scoreboard-team-link', { timeout: DATA_TIMEOUT }).should('have.length', 3)
      cy.get(`.scoreboard-team-link[href="/${key}/shots"]`).should('have.length', 1)
      cy.get(`.scoreboard-team-link[href="/${key}/game/${guestGame.gameId}?as=${away.abbr}"]`).should('exist')
      cy.get(`.scoreboard-team-link[href="/${key}/game/${guestGame.gameId}?as=${home.abbr}"]`).should('exist')
    })

    it('opens the game from the tapped team’s side and leaves the followed team alone', () => {
      cy.get(`.scoreboard-team-link[href="/${key}/game/${guestGame.gameId}?as=${away.abbr}"]`, { timeout: DATA_TIMEOUT }).click()

      cy.location('pathname').should('eq', `/${key}/game/${guestGame.gameId}`)
      cy.location('search').should('eq', `?as=${away.abbr}`)
      cy.get('.guest-game-bar').should('contain', `Viewing as ${away.abbr}`)
      cy.wait('@guestLive', { timeout: DATA_TIMEOUT })
      // The live game from the guest's side: their score first, at the home team.
      cy.contains('#main-content button', '🔴 LIVE', { timeout: DATA_TIMEOUT })
        .should('contain', home.abbr).and('contain', '2–1')
      cy.get('#main-content').should('contain', `Live · at ${home.abbr}`)
      // One game, not the guest's season: no season tabs or game chips.
      seasonLabels.forEach(s => cy.contains('#main-content button', s).should('not.exist'))
      cy.get('[data-tour="rink"]', { timeout: DATA_TIMEOUT }).should('contain', "Shot data for this game isn't in yet")
      cy.window().then(win => {
        expect(JSON.parse(win.localStorage.getItem(`eyewall:${key}_team`)).abbr).to.eq(team.abbr)
      })

      // Back to the Scoreboard it was opened from.
      cy.get('.guest-game-back').should('contain', 'Back to Scoreboard').click()
      cy.location('pathname').should('eq', `/${key}/league`)
      cy.get('.scoreboard-team-link').should('have.length', 3)
      cy.get('.guest-game-bar').should('not.exist')
      cy.assertNoErrors()
    })
  })

  describe(`${label} guest game links`, () => {
    it('opens a final from the named side with its stored shots', () => {
      visitAs(`/${key}/game/${final.gameId}?as=${final.guest}`, key, team)
      cy.get('.guest-game-bar').should('contain', `Viewing as ${final.guest}`)
      cy.get('[data-tour="rink"] svg', { timeout: DATA_TIMEOUT }).should('exist')
      // An older season's game: the subtitle comes from the game itself.
      cy.get('#main-content', { timeout: DATA_TIMEOUT }).should('contain', final.line)
      cy.assertNoErrors()
    })

    it('opens as the home team when the link names no side', () => {
      stubLive()
      visitAs(`/${key}/game/${guestGame.gameId}`, key, team)
      cy.get('.guest-game-bar', { timeout: DATA_TIMEOUT }).should('contain', `Viewing as ${home.abbr}`)
      cy.contains('#main-content button', '🔴 LIVE', { timeout: DATA_TIMEOUT }).should('contain', '1–2')
    })

    it('redirects a link it can’t open, or the followed team’s own, to its Shot Map', () => {
      const paths = [
        `/${key}/game/${guestGame.gameId}?as=XYZ`,
        `/${key}/game/abc?as=${away.abbr}`,
        `/${key}/game/${guestGame.gameId}?as=${team.abbr}`,
      ]
      // AHL's final was at the followed team's rink: no side named is theirs.
      if (final.homeIsFavorite) paths.push(`/${key}/game/${final.gameId}`)
      for (const path of paths) {
        visitAs(path, key, team)
        cy.location('pathname', { timeout: DATA_TIMEOUT }).should('eq', `/${key}/shots`)
        cy.get('.guest-game-bar').should('not.exist')
      }
    })
  })
})
