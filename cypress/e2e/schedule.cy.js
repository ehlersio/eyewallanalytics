// cypress/e2e/schedule.cy.js

describe('Schedule view', () => {
  beforeEach(() => {
    cy.visit('/schedule')
    cy.get('.sched-title', { timeout: 15000 }).should('be.visible')
  })

  // ── Page header ────────────────────────────────────────────
  it('shows season header with record and points', () => {
    cy.contains(/\d+–\d+–\d+/).should('be.visible')
    cy.contains(/\d+ pts/i).should('be.visible')
    cy.contains('Metropolitan').should('be.visible')
  })

  it('renders both Playoffs and Regular Season tab buttons', () => {
    cy.get('.sched-tab').should('have.length', 2)
    cy.get('.sched-tab').first().should('contain', 'Playoffs')
    cy.get('.sched-tab').last().should('contain', 'Regular Season')
  })

  it('renders list and calendar view toggle buttons', () => {
    cy.get('.vm-btn').should('have.length', 2)
    cy.get('.vm-btn').first().should('contain', '≡')
    cy.get('.vm-btn').last().should('contain', '📅')
  })

  // ── Playoffs tab ───────────────────────────────────────────
  describe('Playoffs tab', () => {
    it('shows all four playoff rounds', () => {
      cy.get('.round-section-header').should('have.length.greaterThan', 0)
      cy.contains(/Stanley Cup Final/i).should('exist')
      cy.contains(/First Round/i).should('exist')
    })

    it('shows series results with opponent abbreviations', () => {
      cy.contains(/VGK|MTL|PHI|OTT/i).should('exist')
    })

    it('completed rounds show win/loss record', () => {
      cy.contains(/4–\d|4-\d/).should('exist')
    })

    it('current series shows Prediction and Scouting tabs', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Prediction').should('exist')
      cy.get('.md-tab').contains('Scouting').should('exist')
    })

    it('Prediction/Scouting tab toggle works', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.md-tab').contains('Prediction').click()
      cy.get('.md-tab').contains('Prediction').should('have.class', 'active')
    })

    it('shows AI analysis button for current series', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.contains('Get AI analysis').should('exist')
    })

    it('Prediction tab shows win probability bar', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-pred-bar, .md-prediction').should('exist')
    })

    it('Prediction tab shows projected score', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.contains(/Predicted score|EXPECTED GOALS/i).should('exist')
    })

    it('Prediction tab shows Save Prediction Card export button', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-export-btn').should('exist')
      cy.get('.md-export-btn').should('contain', 'Save Prediction Card')
    })

    it('Scouting tab shows season or playoff comparison', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.scouting-section-label').should('exist')
      cy.contains(/comparison/i).should('exist')
    })

    it('Scouting tab shows GAA in goalie row', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.scouting-goalie-label').contains('GAA').should('exist')
    })

    it('Scouting tab shows goalie matchup section', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.gmc-row').should('exist')
      cy.get('.gmc-goalie').should('have.length', 2)
    })

    it('Scouting tab shows team total projection', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.contains(/Projected total goals/i).should('exist')
      cy.get('.ttc-wrap').should('exist')
    })

    it('Scouting tab shows Save Scouting Card export button', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.scouting-export-btn').should('exist')
      cy.get('.scouting-export-btn').should('contain', 'Save Scouting Card')
    })

    it('clicking a completed round expands it', () => {
      cy.get('.round-section-header.older').first().click()
      // Should reveal game-level detail
      cy.contains(/MTL|PHI|OTT/i).should('exist')
    })
  })

  // ── Regular Season tab ─────────────────────────────────────
  describe('Regular Season tab', () => {
    beforeEach(() => cy.get('.sched-tab').contains('Regular Season').click())

    it('shows total games played', () => {
      cy.contains(/82 played/).should('be.visible')
    })

    it('shows game rows with CAR scores', () => {
      cy.contains('CAR').should('exist')
    })

    it('shows W/L result badges', () => {
      cy.get('body').contains(/^W$|^L$/).should('exist')
    })

    it('shows Home and Away labels', () => {
      cy.contains(/Home|Away/).should('exist')
    })

    it('Newest first / Oldest first sort works', () => {
      cy.contains('Newest first').should('be.visible').click()
      cy.contains('Oldest first').should('be.visible').click()
      cy.contains('Newest first').click()
      cy.contains('CAR').should('exist')
    })

    it('tapping a game opens the stats popup', () => {
      cy.contains('Tap for stats').first().click()
      cy.contains(/Scoring by Period/i, { timeout: 6000 }).should('exist')
      cy.contains(/Three Stars|Team Stats/i).should('exist')
    })

    it('stats popup shows period-by-period breakdown', () => {
      cy.contains('Tap for stats').first().click()
      cy.contains(/P1|P2|P3/i, { timeout: 6000 }).should('exist')
    })

    it('stats popup shows team stats bars', () => {
      cy.contains('Tap for stats').first().click()
      cy.contains(/Shots on Goal/i, { timeout: 6000 }).should('exist')
      cy.contains(/Power Play/i).should('exist')
    })

    it('stats popup closes', () => {
      cy.contains('Tap for stats').first().click()
      cy.contains(/Scoring by Period/i, { timeout: 6000 }).should('exist')
      cy.get('button[aria-label="Close"], [class*="close"]').first().click({ force: true })
      cy.contains(/82 played/).should('exist')
    })
  })

  // ── Calendar view ──────────────────────────────────────────
  describe('Calendar view', () => {
    beforeEach(() => cy.get('.vm-btn').last().click())

    it('shows current month and year', () => {
      cy.contains(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i)
        .should('exist')
    })

    it('shows day-of-week headers', () => {
      cy.contains('Sun').should('exist')
      cy.contains('Mon').should('exist')
    })

    it('shows navigation arrows', () => {
      cy.contains('›').should('exist')
      cy.contains('‹').should('exist')
    })

    it('forward navigation changes the month', () => {
      cy.contains(/\w+ \d{4}/).invoke('text').then(before => {
        cy.contains('›').click()
        cy.contains(/\w+ \d{4}/).invoke('text').should('not.eq', before)
      })
    })

    it('backward navigation changes the month', () => {
      cy.contains(/\w+ \d{4}/).invoke('text').then(before => {
        cy.contains('‹').click()
        cy.contains(/\w+ \d{4}/).invoke('text').should('not.eq', before)
      })
    })

    it('shows game legend', () => {
      cy.contains(/Win/i).should('exist')
      cy.contains(/Loss/i).should('exist')
      cy.contains(/Upcoming/i).should('exist')
    })

    it('switches back to list view', () => {
      cy.get('.vm-btn').first().click()
      cy.contains(/played|Tap for stats/i).should('exist')
    })
  })
})
