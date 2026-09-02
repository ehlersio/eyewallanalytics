// cypress/e2e/ahl-team.cy.js
//
// NOTE: no ahl-team.cy.js spec existed before this file -- AHLTeamView.jsx's
// Overview/Stats/Splits/Trends tabs have zero Cypress coverage at all,
// mirroring the PWHL-expansion-team gap already called out in this repo's
// CLAUDE.md ("Known gaps"). That's a pre-existing hole, out of scope for
// this change. This file covers ONLY the new History tab (Phase 3), the
// actual feature this PR ships -- it is not an attempt to backfill AHL's
// broader test-coverage gap.

const AHL_TEST_TEAMS = { HER: 319, CV: 445 } // oldest/richest history vs. a young franchise with thin history

Object.entries(AHL_TEST_TEAMS).forEach(([abbr, teamId]) => {
  describe(`AHL Team view — ${abbr} — History tab (Phase 3)`, () => {
    beforeEach(() => {
      cy.visit('/ahl/team', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'ahl')
          win.localStorage.setItem('eyewall:ahl_team', JSON.stringify({ abbr, teamId }))
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

    it('renders an Affiliations section with the NHL parent club', () => {
      cy.contains('Affiliations', { timeout: 8000 }).should('exist')
      cy.contains('NHL').should('exist')
    })

    it('renders a Current Franchise Info section', () => {
      cy.contains('Current Franchise Info').should('exist')
      cy.contains('Head Coach').should('exist')
    })
  })
})

describe('AHL Team view — HER — History tab content (deep, well-documented franchise)', () => {
  beforeEach(() => {
    cy.visit('/ahl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'ahl')
        win.localStorage.setItem('eyewall:ahl_team', JSON.stringify({ abbr: 'HER', teamId: 319 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.contains('History', { timeout: 8000 }).should('exist').click()
  })

  it('renders Calder Cup championships', () => {
    cy.contains('Championships', { timeout: 8000 }).should('exist')
    cy.contains(/Calder Cup 19\d\d|Calder Cup 20\d\d/).should('exist')
  })

  it('renders retired numbers', () => {
    cy.contains('Retired Numbers', { timeout: 8000 }).should('exist')
  })
})

describe('AHL Team view — a team without History data shows no History tab', () => {
  it('does not render a History tab for a team with no teamHistory.js entry', () => {
    // Every AHL team was populated in Phase 3, so this asserts the GATING
    // mechanism itself still works correctly (same pattern proven by CAR-only
    // Phase 0 and DET-expansion Phase 2 tests) by pointing at a bogus abbr
    // that getTeamHistory('ahl', ...) can't find -- rather than asserting
    // against a real team, which will stop being a valid "no data" example
    // the moment any future AHL roster change adds one.
    cy.visit('/ahl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'ahl')
        win.localStorage.setItem('eyewall:ahl_team', JSON.stringify({ abbr: 'ZZZ', teamId: 999999 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.contains('History').should('not.exist')
  })
})
