// cypress/e2e/probable-starters.cy.js
// "Probable starters" block in the game preview (MatchupDetail's Prediction
// tab, 2026-09), from the Worker's /probable-starters route
// (eyewall-pipeline's nightly starting_goalie.py). Both the team schedule
// and /probable-starters are stubbed, so nothing depends on the season
// calendar or live data: the schedule is the real 2026-27 CAR schedule
// (cypress/fixtures/schedule-car-2026-27.json) cut to its opener,
// 2026020001 CAR-FLA on 2026-09-29, so "the first Matchup breakdown" is
// unambiguous. The route's own query/caching logic is covered by
// eyewall-poller's Vitest suite (nhl-routes.test.js,
// probableStarters.test.js).

const OPENER = 2026020001

const goalie = (goalie_id, goalie_name, start_prob, factors = {}) => ({
  goalie_id,
  goalie_name,
  start_prob,
  factors: { share_last10: 0.5, started_last: false, back_to_back: false, days_rest: 2, no_recent: false, injury_status: null, ...factors },
})

const STARTERS = {
  gameId: OPENER,
  gameDate: '2026-09-29',
  runDate: '2026-09-28',
  teams: {
    CAR: [
      goalie(8483548, 'Brandon Bussi', 0.62, { share_last10: 0.6, started_last: true }),
      goalie(8480051, 'Cayden Primeau', 0.38, { share_last10: 0.4 }),
    ],
    FLA: [
      goalie(8475683, 'Sergei Bobrovsky', 0.81, { share_last10: 0.8, back_to_back: true }),
      goalie(8479361, 'Daniil Tarasov', 0.19, { share_last10: 0.2 }),
    ],
  },
}

function openOpener(startersReply) {
  cy.fixture('schedule-car-2026-27.json').then(schedule => {
    cy.intercept('GET', '**/club-schedule-season/CAR/**', { ...schedule, games: schedule.games.slice(0, 1) }).as('schedule')
  })
  cy.intercept('GET', '**/probable-starters?game=*', req => {
    const game = Number((req.url.match(/[?&]game=(\d+)/) || [])[1])
    if (typeof startersReply === 'function') return startersReply(req, game)
    req.reply(game === OPENER ? startersReply : { gameId: game, gameDate: null, runDate: null, teams: {} })
  }).as('starters')
  cy.setTeam('CAR')
  cy.visit('/schedule')
  cy.contains('Matchup breakdown', { timeout: 15000 }).first().click()
  cy.wait('@starters')
}

describe('Game preview — Probable starters', () => {
  it("shows both teams, the selected team first, with each starter's chance and context", () => {
    openOpener(STARTERS)
    cy.get('.md-starters').within(() => {
      cy.contains('Probable starters').should('exist')
      cy.get('.md-starters-team').should('have.length', 2)
      cy.get('.md-starters-team').first().should('have.attr', 'data-team', 'CAR')
      cy.get('.md-starters-team').first().within(() => {
        cy.get('.md-starter-top').should('contain', 'Brandon Bussi').and('contain', '62%')
        cy.contains('60% of last 10 starts').should('exist')
        cy.get('.md-starter-chip').should('contain', 'Started last game')
        cy.get('.md-starter-other').should('have.length', 1).and('contain', 'Cayden Primeau').and('contain', '38%')
      })
      cy.get('.md-starters-team').eq(1).should('have.attr', 'data-team', 'FLA').within(() => {
        cy.get('.md-starter-top').should('contain', 'Sergei Bobrovsky').and('contain', '81%')
        cy.get('.md-starter-chip').should('contain', 'Back-to-back')
      })
      cy.contains('Updated').should('exist')
    })
  })

  it('tags a day-to-day starter', () => {
    const body = {
      ...STARTERS,
      teams: { ...STARTERS.teams, CAR: [goalie(8483548, 'Brandon Bussi', 0.55, { injury_status: 'day-to-day' }), ...STARTERS.teams.CAR.slice(1)] },
    }
    openOpener(body)
    cy.get('.md-starters-team').first().find('.md-starter-chip').should('contain', 'Day-to-day')
  })

  it('a team the pipeline skipped shows "not posted yet" beside the other', () => {
    openOpener({ ...STARTERS, teams: { FLA: STARTERS.teams.FLA } })
    cy.get('.md-starters-team').first().should('have.attr', 'data-team', 'CAR').and('contain', 'posted two days before the game')
    cy.get('.md-starters-team').eq(1).should('contain', 'Sergei Bobrovsky')
  })

  it('outside the 2-day window says when starters are posted', () => {
    openOpener({ gameId: OPENER, gameDate: null, runDate: null, teams: {} })
    cy.get('.md-starters-not-yet').should('contain', 'Probable starters are posted two days before the game.')
    cy.get('.md-starters-team').should('not.exist')
  })

  it('shows an unavailable state when the Worker fails', () => {
    openOpener((req) => req.reply({ statusCode: 502, body: {} }))
    cy.get('.md-starters').should('contain', "Probable starters aren't available right now.")
  })
})
