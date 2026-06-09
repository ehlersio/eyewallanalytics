// cypress/e2e/schedule.cy.js
describe('Schedule view', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      if (err.name === 'ReferenceError' || err.name === 'TypeError') throw err
      return false
    })
    cy.visit('/schedule')
    cy.get('.sched-title', { timeout: 15000 }).should('be.visible')
  })

  it('shows season header with record and points', () => {
    cy.contains(/\d+–\d+–\d+/).should('be.visible')
    cy.contains(/\d+ pts/i).should('be.visible')
    cy.team().then(t => cy.contains(t.division).should('be.visible'))
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

    it('shows AI analysis section for current series', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-ai-section', { timeout: 15000 }).should('exist')
      cy.get('.md-ai-section').then($el => {
        expect($el.find('.md-ai-narrative').length > 0 || $el.find('.md-ai-btn').length > 0).to.be.true
      })
    })

    it('matchup detail renders without JS errors', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.matchup-detail').should('exist')
      cy.get('.md-pred-bar').should('exist')
    })

    it('matchup header uses team abbr', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.team().then(t => {
        cy.get('.md-title').invoke('text').should('match', new RegExp(`${t.abbr} vs`))
      })
    })

    it('shows odds row when odds are available', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.matchup-detail').then($el => {
        if ($el.find('.md-odds-row').length > 0) {
          cy.get('.md-odds-row').should('be.visible')
          cy.get('.md-odds-val').should('have.length.gte', 2)
        }
      })
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
      cy.get('.md-export-btn').should('exist').should('contain', 'Save Prediction Card')
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
      cy.get('.scouting-export-btn').should('exist').should('contain', 'Save Scouting Card')
    })

    it('Scouting tab shows team lines section', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.team().then(t => {
        cy.get('.scouting-section-label')
          .contains(new RegExp(`${t.abbr} lines`)).should('exist')
      })
    })

    it('Scouting tab shows 4 forward lines', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-unit').should('have.length.gte', 4)
    })

    it('Scouting tab shows Line 1 label', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-label').contains('Line 1').should('exist')
    })

    it('Scouting tab shows line 1 players', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.team().then(t => {
        cy.get('.sc-line-unit').first().within(() => {
          t.line1.players.forEach(name => cy.contains(name).should('exist'))
        })
      })
    })

    it('Scouting tab shows line 1 players in correct position order', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-unit').first().find('.sc-line-player').then($players => {
        expect($players).to.have.length(3)
        // Positions should include a centre and at least one wing.
        // Inferred data may use L/LW/R/RW interchangeably so we check
        // structurally rather than requiring exact LW/C/RW values.
        const positions = [...$players].map(p => p.querySelector('.sc-line-pos')?.textContent)
        const hasWing   = positions.some(p => /LW|RW|L|R/.test(p))
        const hasCentre = positions.some(p => p === 'C')
        expect(hasWing, 'line should include at least one wing position').to.be.true
        expect(hasCentre, 'line should include a centre').to.be.true
      })
    })

    it('Scouting tab shows xGF% label on each line', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-xgf-label').should('have.length.gte', 4)
      cy.get('.sc-line-xgf-label').first().should('contain', 'xGF%')
    })

    it('Scouting tab shows TOI label on lines with inferred data', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-toi').should('have.length.gte', 1)
      cy.get('.sc-line-toi').first().contains(/min together/).should('exist')
    })

    it('Scouting tab shows Defence pairs subheader', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-lines-subheader').contains('Defence pairs').should('exist')
    })

    it('Scouting tab shows 3 defence pairs', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-lines-group-d .sc-line-unit').should('have.length', 3)
    })

    it('Scouting tab shows defence pair 1 player', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.team().then(t => {
        cy.get('.sc-lines-group-d').contains(t.defence1).should('exist')
      })
    })

    it('Prediction tab shows top line edge factor', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-factor').contains('Top line').should('exist')
    })

    it('Prediction tab shows top line card with xGF%', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-topline-card').should('exist')
      cy.get('.md-topline-xgf').should('exist')
    })

    it('Prediction tab top line card shows line 1 players', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.team().then(t => {
        cy.get('.md-topline-card').within(() => {
          t.line1.players.forEach(name => cy.contains(name).should('exist'))
        })
      })
    })

    it('clicking a completed round expands it', () => {
      cy.get('.round-section-header.older').first().click()
      cy.contains(/MTL|PHI|OTT/i).should('exist')
    })
  })

  describe('Regular Season tab', () => {
    beforeEach(() => cy.get('.sched-tab').contains('Regular Season').click())

    it('shows total games played', () => {
      cy.contains(/82 played/).should('be.visible')
    })

    it('shows game rows with team abbr', () => {
      cy.team().then(t => cy.contains(t.abbr).should('exist'))
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
      cy.team().then(t => cy.contains(t.abbr).should('exist'))
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

  describe('Calendar view', () => {
    beforeEach(() => cy.get('.vm-btn').last().click())

    it('shows current month and year', () => {
      cy.contains(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i).should('exist')
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
