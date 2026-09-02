// cypress/e2e/echl-team.cy.js
//
// NOTE: no echl-team.cy.js spec existed before this file -- ECHLTeamView.jsx's
// Overview/Stats/Splits/Trends tabs have zero Cypress coverage at all,
// mirroring the same pre-existing gap already called out for AHL in
// ahl-team.cy.js. That's out of scope for this change. This file covers
// ONLY the new History tab (Phase 4), the actual feature this PR ships.

const ECHL_TEST_TEAMS = { FW: 60, SAV: 102 } // deep, well-documented franchise vs. a young expansion team with thin history

Object.entries(ECHL_TEST_TEAMS).forEach(([abbr, teamId]) => {
  describe(`ECHL Team view — ${abbr} — History tab (Phase 4)`, () => {
    beforeEach(() => {
      cy.visit('/echl/team', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'echl')
          win.localStorage.setItem('eyewall:echl_team', JSON.stringify({ abbr, teamId }))
        },
      })
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.contains('History', { timeout: 8000 }).should('exist').click()
    })

    it('renders the Founded and Home Arena sections', () => {
      cy.contains('Founded').should('exist')
      cy.contains('Home Arena').should('exist')
      cy.assertNoErrors()
    })

    it('renders a Current Franchise Info section', () => {
      cy.contains('Current Franchise Info').should('exist')
      cy.contains('Head Coach').should('exist')
    })
  })
})

describe('ECHL Team view — FW — History tab content (deep, well-documented franchise)', () => {
  beforeEach(() => {
    cy.visit('/echl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'echl')
        win.localStorage.setItem('eyewall:echl_team', JSON.stringify({ abbr: 'FW', teamId: 60 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.contains('History', { timeout: 8000 }).should('exist').click()
  })

  it('renders Kelly Cup championships', () => {
    cy.contains('Championships', { timeout: 8000 }).should('exist')
    cy.contains(/Kelly Cup 20\d\d/).should('exist')
  })

  it('renders an Affiliations section with both NHL and AHL parents', () => {
    cy.contains('Affiliations', { timeout: 8000 }).should('exist')
    cy.contains('NHL').should('exist')
    cy.contains('AHL').should('exist')
  })
})

describe('ECHL Team view — NOR — a team with genuinely no current affiliate', () => {
  beforeEach(() => {
    cy.visit('/echl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'echl')
        win.localStorage.setItem('eyewall:echl_team', JSON.stringify({ abbr: 'NOR', teamId: 76 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.contains('History', { timeout: 8000 }).should('exist').click()
  })

  it('renders History content without an Affiliations section', () => {
    cy.contains('Founded', { timeout: 8000 }).should('exist')
    cy.contains('Affiliations').should('not.exist')
    cy.assertNoErrors()
  })
})

describe('ECHL Team view — a team without History data shows no History tab', () => {
  it('does not render a History tab for a team with no teamHistory.js entry', () => {
    cy.visit('/echl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'echl')
        win.localStorage.setItem('eyewall:echl_team', JSON.stringify({ abbr: 'ZZZ', teamId: 999999 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.contains('History').should('not.exist')
  })
})
