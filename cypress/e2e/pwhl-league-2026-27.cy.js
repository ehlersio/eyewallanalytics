// cypress/e2e/pwhl-league-2026-27.cy.js
// The PWHL's 2026-27 format (thepwhl.com, 2026-10-02): two six-team
// conferences, the top 4 in each make the playoffs, best-of-3
// quarterfinals. /config/seasons (season 11 current) and season 11's
// standings are stubbed -- that season has no games until Dec 5, and the
// Standings/Bracket tabs only switch format for it.

const AFTER_SWITCH = {
  seasonId: 11, seasonType: 'regular', startYear: 2026, startDate: '2026-12-04', source: 'live',
  next: null, preseason: { seasonId: 10, seasonType: 'preseason', startYear: 2026, startDate: '2026-10-01' },
}

// team_id, points after 5 games. East: BOS 1, MTL 3, NY 4, OTT 5, TOR 6,
// HAM 11. West: MIN 2, SEA 8, VAN 9, DET 10, LV 12, SJS 13.
const row = (team_id, points) => ({
  team_id, season_id: 11, gp: 5, points, reg_wins: Math.floor(points / 3), non_reg_wins: 0,
  ot_losses: 0, losses: 5 - Math.floor(points / 3), goals_for: 10, goals_against: 10,
})
const STANDINGS_11 = [
  row(1, 12), row(3, 10), row(4, 9), row(5, 7), row(6, 5), row(11, 2),
  row(2, 13), row(8, 11), row(9, 8), row(10, 6), row(12, 4), row(13, 1),
]

describe('PWHL League — 2026-27 conferences', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/config/seasons', {
      nhl: { seasonId: '20262027' },
      pwhl: AFTER_SWITCH,
      ahl: { seasonId: 94, seasonType: 'regular' },
      echl: { seasonId: 78, seasonType: 'regular' },
    }).as('seasons')
    cy.intercept('GET', '**/pwhl/standings?season=11', STANDINGS_11).as('standings11')
    cy.visit('/pwhl/league', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
      },
    })
    cy.wait('@seasons')
  })

  it('splits the standings into East and West, with the playoff line under each 4th team', () => {
    cy.contains('[role="tab"]', 'Standings').click()
    cy.wait('@standings11')
    cy.get('[data-conference="East"]').should('contain', 'Eastern Conference').find('.lv-row').should('have.length', 6)
    cy.get('[data-conference="West"]').should('contain', 'Western Conference').find('.lv-row').should('have.length', 6)
    cy.get('[data-conference="East"] .lv-row--cut').should('contain', 'OTT')
    cy.get('[data-conference="West"] .lv-row--cut').should('contain', 'DET')
  })

  it('projects the bracket: 1 v 4 and 2 v 3 per conference, later rounds open', () => {
    cy.contains('Playoff Bracket').click()
    cy.get('.bkt-projected-title', { timeout: 10000 }).should('contain', 'If the playoffs started today')
    cy.get('.bkt-round-label').first().should('contain', 'Quarterfinals')
    cy.get('.bkt-round-col').first().within(() => {
      cy.get('.bkt-card').eq(0).should('contain', 'BOS').and('contain', 'OTT')
      cy.get('.bkt-card').eq(1).should('contain', 'MTL').and('contain', 'NY')
    })
    cy.get('.bkt-round-col').last().within(() => {
      cy.get('.bkt-card').eq(0).should('contain', 'MIN').and('contain', 'DET')
      cy.get('.bkt-card').eq(1).should('contain', 'SEA').and('contain', 'VAN')
    })
    cy.get('.bkt-card--open').should('have.length', 3) // both conference finals and the Walter Cup Final
    cy.contains('Quarterfinals best-of-3').should('exist')
  })
})

// From the season flip (~Nov 20) to the first game (Dec 5) season 11 has
// no standings: the League tab opens on 2025-26 (live Worker), says so, and
// offers no empty 2026-27 chip.
describe('PWHL League — 2026-27 before its first game', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/config/seasons', {
      nhl: { seasonId: '20262027' },
      pwhl: AFTER_SWITCH,
      ahl: { seasonId: 94, seasonType: 'regular' },
      echl: { seasonId: 78, seasonType: 'regular' },
    }).as('seasons')
    cy.intercept('GET', '**/pwhl/standings?season=11', []).as('standings11')
    cy.visit('/pwhl/league', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
      },
    })
    cy.wait('@seasons')
  })

  it('opens Standings on 2025-26, labelled, with no 2026-27 chip', () => {
    cy.contains('[role="tab"]', 'Standings').click()
    cy.wait('@standings11')
    cy.get('[data-testid="pwhl-league-season-note"]', { timeout: DATA_TIMEOUT })
      .should('contain', "The 2026-27 season hasn't started yet")
      .and('contain', 'showing 2025-26')
    cy.contains('button', /^2025-26$/).should('exist')
    cy.contains('button', /^2026-27$/).should('not.exist')
    cy.get('.lv-row', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 8)
    cy.assertNoErrors()
  })
})
