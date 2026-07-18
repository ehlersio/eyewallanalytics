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

    describe('Compare Seasons', () => {
      beforeEach(() => cy.contains('🆚 Compare Seasons').click())

      it('opens the picker with multiple season options', () => {
        cy.contains('Compare Seasons').should('be.visible')
        cy.get('.season-chip', { timeout: 8000 }).should('have.length.greaterThan', 1)
      })

      it('renders one comparison card per selected season', () => {
        cy.get('.season-chip', { timeout: 8000 }).eq(0).click()
        cy.get('.season-chip').eq(1).click()
        cy.get('.stat-section').should('have.length', 2)
        cy.contains('GP').should('be.visible')
        cy.contains('PTS').should('be.visible')
      })
    })
  })
})

// ── Expansion team (DET) — 2026-27 season hasn't started for these teams yet:
// real roster exists in HockeyTech, but no games/standings/salary rows exist,
// so every data-driven tab should show its graceful empty state, not crash
// and not show real stats. Verified against the live Worker before writing
// these assertions (see Session 38 investigation).
describe('PWHL Team view — DET (expansion, no games played yet)', () => {
  beforeEach(() => {
    cy.visit('/pwhl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'DET', teamId: 10 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    // No "{abbr} ..." headings render for this team (season stat grid, points
    // leaders, etc. are all data-driven and absent — that's the point of this
    // suite), so confirm the right team loaded via the logo's alt text instead.
    cy.get('[alt="DET"]', { timeout: 8000 }).should('exist')
  })

  it('renders all tab buttons', () => {
    ['Overview', 'Advanced', 'Splits', 'Trends', 'Salaries'].forEach(tab =>
      cy.contains(tab).should('exist')
    )
    cy.assertNoErrors()
  })

  describe('Overview tab', () => {
    it('shows a 0–0–0 record instead of crashing', () => {
      cy.contains(/^0–0–0$/, { timeout: 8000 }).should('exist')
      cy.contains('0 pts').should('exist')
    })

    it('does not show season stats, top scorers, or starting goalie sections', () => {
      cy.contains(/Top scorers|Points leaders/i).should('not.exist')
      cy.contains(/Starting goalie/i).should('not.exist')
      cy.assertNoErrors()
    })
  })

  describe('Advanced tab', () => {
    beforeEach(() => cy.contains('Advanced').click())

    // Session 39 fix: this used to get stuck on "Loading advanced stats…"
    // forever, because the loading guard couldn't tell "still fetching"
    // apart from "fetched, but this team has no standings row yet" (DET
    // never appears in /pwhl/standings until it plays a game). Now asserts
    // the real, distinct empty-state message instead of tolerating the
    // misleading loading text.
    it('shows the no-data empty state instead of a permanent loading message', () => {
      cy.contains(/No advanced stats yet/i, { timeout: 8000 }).should('exist')
      cy.contains(/hasn.t played a game yet this season/i).should('exist')
      cy.contains(/Loading advanced stats/i).should('not.exist')
      cy.contains(/Shot Volume|CF%|Corsi/i).should('not.exist')
    })
  })

  describe('Splits tab', () => {
    beforeEach(() => cy.contains('Splits').click())

    it('shows the no-data empty state', () => {
      cy.contains(/No regular season data yet/i, { timeout: 8000 }).should('exist')
      cy.contains(/Home vs Away/i).should('not.exist')
    })
  })

  describe('Trends tab', () => {
    beforeEach(() => cy.contains('Trends').click())

    it('shows the no-data empty state', () => {
      cy.contains(/No game data yet/i, { timeout: 8000 }).should('exist')
      cy.contains(/Current streak/i).should('not.exist')
    })
  })

  describe('Salaries tab', () => {
    beforeEach(() => cy.contains('Salaries').click())

    it('shows the no-data empty state instead of real payroll numbers', () => {
      cy.contains(/No salary data/i, { timeout: 8000 }).should('exist')
      cy.contains('Total Payroll').should('not.exist')
    })
  })

  it('never surfaces an error boundary while tabbing through', () => {
    ['Advanced', 'Splits', 'Trends', 'Salaries', 'Overview'].forEach(tab => {
      cy.contains(tab).click()
      cy.assertNoErrors()
    })
  })

  // The durable case for SESSION_64_BUILD's "team has no row at all for a
  // selected season" requirement -- unlike the NHL current-season null-field
  // case in team.cy.js (which will stop being true once real games are
  // played), DET never having existed as a franchise before the 2026-27
  // expansion is a permanent historical fact, not a transient data gap. Safe
  // to assert this indefinitely.
  describe('Compare Seasons', () => {
    beforeEach(() => cy.contains('🆚 Compare Seasons').click())

    it('shows "Not yet available" instead of zeroed stats for a pre-expansion season', () => {
      cy.get('.season-chip', { timeout: 8000 }).contains('2025-26').click()
      cy.get('.stat-section').should('have.length', 1)
      cy.contains('Not yet available for this season').should('be.visible')
      // No metric rows at all for this card -- confirms the empty state
      // replaces the stat list rather than rendering it zeroed-out.
      cy.get('.stat-section').find('.stat-row').should('not.exist')
    })
  })
})
