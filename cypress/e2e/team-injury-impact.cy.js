// cypress/e2e/team-injury-impact.cy.js
// "Games lost to injury" card on the Team page's Overview tab (2026-09),
// from the Worker's /injury-impact route (eyewall-pipeline's nightly
// injury_impact.py). The route is stubbed with cy.intercept, so nothing
// depends on live data -- team_injury_impact only fills once the 2026-27
// regular season starts. The route's own query/caching logic is covered by
// eyewall-poller's Vitest suite (nhl-routes.test.js, injuryImpact.test.js).

const player = (id, name, games, war_lost, injury_type, last_date = '2026-10-28') =>
  ({ player_id: id, player_name: name, games, war_lost, last_date, status: 'out', injury_type })

const IMPACT = {
  team: 'CAR',
  season: 20262027,
  impact: {
    season: 20262027, team: 'CAR', games_played: 10, man_games_lost: 24, war_lost: 0.62, players_injured: 8,
    rank_man_games: 5, rank_war_lost: 3, updated_at: '2026-10-29T12:40:00+00:00',
    players: [
      player(8478427, 'Sebastian Aho', 6, 0.41, 'Upper Body'),
      player(8480762, 'Eric Robinson', 5, 0.1, 'Knee'),
      player(8482093, 'Seth Jarvis', 4, 0.06, null),
      player(8477380, 'Jonny Brodzinski', 3, 0.05, 'Illness'),
      player(8481000, 'Player Five', 2, 0, 'Hand'),
      player(8481001, 'Player Six', 2, 0, 'Foot'),
      player(8481002, 'Player Seven', 1, 0, 'Face'),
      player(null, 'Unmatched Player', 1, 0, null),
    ],
  },
  league: { teams: 32, avgManGames: 18.4, avgWarLost: 0.45, avgGamesPlayed: 9.8 },
}

function openOverview(body) {
  cy.intercept('GET', '**/injury-impact?team=*', body).as('impact')
  cy.visit('/team')
  cy.wait('@impact')
}

describe('Team page — Overview tab, Games lost to injury card', () => {
  it('shows man-games and WAR lost with league ranks, and the league average', () => {
    openOverview(IMPACT)
    cy.get('.injury-impact').within(() => {
      cy.contains('Games lost to injury').should('exist')
      cy.get('.injury-impact-man-games').should('contain', '24').and('contain', '#5 of 32')
      cy.get('.injury-impact-war').should('contain', '0.6').and('contain', '#3 of 32')
      cy.get('.injury-impact-players').should('contain', '8').and('not.contain', '#')
      cy.get('.injury-impact-league').should('contain', 'League average: 18.4 man-games').and('contain', '0.5 WAR')
    })
  })

  it('lists injured players most games first, with WAR lost when there is any', () => {
    openOverview(IMPACT)
    cy.get('.injury-impact-player').should('have.length', 6)
    cy.get('.injury-impact-player').first()
      .should('contain', 'Sebastian Aho').and('contain', '6 games').and('contain', '0.41 WAR').and('contain', 'Upper Body')
    cy.get('.injury-impact-player').eq(2).should('contain', 'Seth Jarvis').and('contain', 'last missed')
    cy.get('.injury-impact-player').eq(4).find('.injury-impact-player-war').should('not.exist')
  })

  it('shows all players on request, with singular game counts', () => {
    openOverview(IMPACT)
    cy.get('.injury-impact-toggle').should('contain', 'Show all 8').click()
    cy.get('.injury-impact-player').should('have.length', 8)
    cy.get('.injury-impact-player').last().should('contain', 'Unmatched Player').and('contain', '1 game').and('not.contain', '1 games')
    cy.get('.injury-impact-toggle').should('contain', 'Show fewer').click()
    cy.get('.injury-impact-player').should('have.length', 6)
  })

  it('a team with no injuries yet shows zeros and no player list', () => {
    openOverview({ ...IMPACT, impact: { ...IMPACT.impact, man_games_lost: 0, war_lost: 0, players_injured: 0, rank_man_games: 32, rank_war_lost: 32, players: [] } })
    cy.get('.injury-impact-man-games').should('contain', '0').and('contain', '#32 of 32')
    cy.get('.injury-impact-player').should('not.exist')
  })

  it('shows the not-started state before the first regular-season game, and an unavailable state on failure', () => {
    openOverview({ team: 'CAR', season: null, impact: null, league: null })
    cy.get('.injury-impact').should('contain', 'Injury tracking starts with the first regular-season game.')
    openOverview({ team: 'CAR', impact: null, league: null, unavailable: true })
    cy.get('.injury-impact').should('contain', "Injury impact isn't available right now.")
    openOverview({ statusCode: 502, body: {} })
    cy.get('.injury-impact').should('contain', "Injury impact isn't available right now.")
  })
})
