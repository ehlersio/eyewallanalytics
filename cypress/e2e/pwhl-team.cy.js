// cypress/e2e/pwhl-team.cy.js

const PWHL_TEST_TEAMS = ['BOS', 'MIN', 'MTL', 'TOR']

PWHL_TEST_TEAMS.forEach(abbr => {
  const teamId = { BOS: 1, MIN: 2, MTL: 3, TOR: 6 }[abbr]

  describe(`PWHL Team view — ${abbr}`, () => {
    beforeEach(() => {
      cy.visit('/pwhl/team', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'pwhl')
          win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr, teamId }))
        },
      })
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.contains(abbr, { timeout: 8000 }).should('exist')
    })

    it('renders all tab buttons', () => {
      ['Overview', 'Advanced', 'Splits', 'Trends', 'Salaries'].forEach(tab =>
        cy.contains(tab).should('exist')
      )
    })

    describe('Overview tab', () => {
      it('shows team record in W–OTW–OTL–L format', () => {
        cy.get('.record-big', { timeout: 8000 }).should('exist')
      })

      it('shows points', () => {
        cy.contains(/pts/i, { timeout: 8000 }).should('exist')
      })

      it('shows season stats grid', () => {
        cy.contains(/GF\/GP|GA\/GP/i, { timeout: 8000 }).should('exist')
      })

      it('shows PP% and PK%', () => {
        cy.contains('PP%', { timeout: 8000 }).should('exist')
        cy.contains('PK%').should('exist')
      })

      it('shows top scorers', () => {
        cy.contains(/Top scorers|Points leaders/i, { timeout: 8000 }).should('exist')
      })

      it('shows starting goalie card', () => {
        cy.contains(/Starting goalie|Goalie/i, { timeout: 8000 }).should('exist')
      })
    })

    describe('Advanced tab', () => {
      beforeEach(() => cy.contains('Advanced').click())

      it('renders shot volume section', () => {
        cy.contains(/Shot Volume|CF%|Corsi/i, { timeout: 8000 }).should('exist')
      })

      it('renders PDO section', () => {
        cy.contains('PDO', { timeout: 8000 }).should('exist')
      })

      it('renders special teams section', () => {
        cy.contains(/Special Teams/i, { timeout: 8000 }).should('exist')
      })

      it('renders league context section', () => {
        cy.contains(/League Context/i, { timeout: 8000 }).should('exist')
      })

      it('playoff toggle is clickable when in playoffs', () => {
        cy.get('body').then($body => {
          if ($body.text().includes('Playoffs')) {
            cy.contains('Playoffs').click()
            cy.assertNoErrors()
            cy.contains('Regular Season').click()
          }
        })
      })
    })

    describe('Splits tab', () => {
      beforeEach(() => cy.contains('Splits').click())

      it('shows Home vs Away section', () => {
        cy.contains(/Home vs Away/i, { timeout: 8000 }).should('exist')
      })

      it('shows W–OTW–OTL–L records', () => {
        cy.contains(/W–OTW–OTL–L/i, { timeout: 8000 }).should('exist')
      })

      it('shows Pts% comparison', () => {
        cy.contains(/Pts%/i, { timeout: 8000 }).should('exist')
      })

      it('playoff toggle shows when in playoffs', () => {
        cy.get('body').then($body => {
          if ($body.text().includes('Playoffs')) {
            cy.contains('Playoffs').click()
            cy.assertNoErrors()
          }
        })
      })
    })

    describe('Trends tab', () => {
      beforeEach(() => cy.contains('Trends').click())

      it('shows current streak', () => {
        cy.contains(/Current streak/i, { timeout: 8000 }).should('exist')
      })

      it('shows Last 10 games', () => {
        cy.contains('Last 10 games', { timeout: 8000 }).should('exist')
      })

      it('shows result dots', () => {
        cy.get('[class*="result-dot"]', { timeout: 8000 }).should('have.length.greaterThan', 0)
      })

      it('shows rolling win% chart', () => {
        cy.contains(/Win%|Rolling.*win/i, { timeout: 8000 }).should('exist')
      })

      it('shows goal differential chart', () => {
        cy.contains(/Goal differential/i, { timeout: 8000 }).should('exist')
      })
    })

    describe('Salaries tab', () => {
      beforeEach(() => cy.contains('Salaries').click())

      it('shows salary summary card', () => {
        cy.contains(/Total Payroll|Salary/i, { timeout: 8000 }).should('exist')
      })

      it('shows cap ceiling', () => {
        cy.contains(/Cap Ceiling|\$1,300,000/i, { timeout: 8000 }).should('exist')
      })

      it('shows CBA target', () => {
        cy.contains(/CBA Target/i, { timeout: 8000 }).should('exist')
      })
    })
  })
})
