// cypress/e2e/topbar-live-chip.cy.js
// The Topbar's live chip on PWHL/AHL/ECHL routes: the followed team's live
// game from the shared HockeyTech poller (utils/hockeyTechLiveStore.js) --
// score from the team's side, period and time of the last event -- and the
// off-season marker back once the game is over. /today and /live are
// stubbed: a stubbed game is live whatever the real schedule says.

const LEAGUES = [
  { key: 'pwhl', label: 'PWHL', team: { abbr: 'MTL', teamId: 3 }, opp: { id: 1, code: 'BOS' } },
  { key: 'ahl',  label: 'AHL',  team: { abbr: 'HER', teamId: 319 }, opp: { id: 380, code: 'TEX' } },
  { key: 'echl', label: 'ECHL', team: { abbr: 'ADK', teamId: 74 }, opp: { id: 113, code: 'NOR' } },
]

LEAGUES.forEach(({ key, label, team, opp }) => {
  describe(`${label} Topbar live chip`, () => {
    it(`shows ${team.abbr}'s live game, then the off-season marker once it ends`, () => {
      const workerUrl = Cypress.expose('WORKER_URL')
      let status = 'live'
      // The followed team is away: the chip still reads from its side.
      cy.intercept('GET', `${workerUrl}/${key}/today*`, req => req.reply([
        { gameId: 777, gameDate: '2026-10-10', homeTeamId: opp.id, awayTeamId: team.teamId, homeTeamCode: opp.code, awayTeamCode: team.abbr, homeScore: 1, awayScore: 2, status },
      ])).as('today')
      cy.intercept('GET', `${workerUrl}/${key}/live/777`, {
        gameId: 777, homeTeamId: opp.id, awayTeamId: team.teamId, homeScore: 1, awayScore: 3, gameStatus: 'live',
        events: [{ eventType: 'goal', teamId: team.teamId, period: 2, time: '12:34', timeSeconds: 754 }],
      })
      cy.visit(`/${key}/team`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', key)
          win.localStorage.setItem(`eyewall:${key}_team`, JSON.stringify(team))
        },
      })
      cy.get('[data-testid="ht-live-chip"]', { timeout: DATA_TIMEOUT })
        .should('contain', team.abbr).and('contain', opp.code)
        .and('contain', '3').and('contain', '1')
      cy.get('[data-testid="ht-live-chip"]').invoke('text').should('match', new RegExp(`${team.abbr}3–1${opp.code}`))
      cy.get('[data-testid="ht-live-chip"]').should('contain', 'P2 · 12:34')
      cy.get('.topbar-no-live').should('not.exist')

      cy.then(() => { status = 'final' })
      cy.window().then(win => win.dispatchEvent(new win.Event('eyewall:push-received')))
      cy.get('[data-testid="ht-live-chip"]', { timeout: DATA_TIMEOUT }).should('not.exist')
      cy.get('.topbar-no-live').should('have.text', label)
      cy.assertNoErrors()
    })
  })
})
