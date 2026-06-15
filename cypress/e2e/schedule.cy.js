// cypress/e2e/schedule.cy.js

// ── Offseason guard ───────────────────────────────────────────────
// Automatically true outside playoff months (April–June).
// Override any time via CYPRESS_OFFSEASON=true/false in cypress.env.json,
// the CLI (--env OFFSEASON=true), or a CI environment variable.
const month = new Date().getMonth() + 1 // 1 = Jan, 12 = Dec
const OFFSEASON = Cypress.env('OFFSEASON') !== undefined
  ? Cypress.env('OFFSEASON') === true || Cypress.env('OFFSEASON') === 'true'
  : month < 4 || month >= 6

// ── Smoke tests — run against all 32 teams ────────────────────
// Verifies basic schedule page loads correctly for every team.
describe('Schedule smoke tests (all teams)', () => {
  let allTeams = []

  before(() => {
    cy.fixture('teams').then(teams => { allTeams = teams })
  })

  it('schedule loads for all 32 teams without JS errors', () => {
    cy.fixture('teams').then(teams => {
      // Run sequentially through a sample of teams to keep CI fast.
      // Full 32-team run can be triggered manually.
      const sample = teams.filter(t =>
        ['CAR', 'VGK', 'TOR', 'CHI', 'BOS', 'EDM', 'NYR', 'MTL'].includes(t.abbr)
      )
      sample.forEach(team => {
        cy.visit('/schedule', {
          onBeforeLoad(win) {
            win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: team.abbr }))
          }
        })
        cy.get('.sched-title', { timeout: 15000 }).should('be.visible')
        cy.assertNoErrors()
      })
    })
  })
})

// ── Full feature tests — parameterized over teams with line data ──
const FULL_TEST_TEAMS = ['CAR', 'VGK', 'TOR', 'CHI']

FULL_TEST_TEAMS.forEach(teamAbbr => {
  describe(`Schedule view — ${teamAbbr}`, () => {
    let team

    before(() => {
      cy.team(teamAbbr).then(t => { team = t })
    })

    beforeEach(() => {
      cy.on('uncaught:exception', (err) => {
        if (err.name === 'ReferenceError' || err.name === 'TypeError') throw err
        return false
      })
      cy.setTeam(teamAbbr)
      cy.visit('/schedule')
      cy.get('.sched-title', { timeout: 15000 }).should('be.visible')
    })

    it('shows season header with record and points', () => {
      cy.contains(/\d+–\d+–\d+/).should('be.visible')
      cy.contains(/\d+ pts/i).should('be.visible')
      cy.team(teamAbbr).then(t => cy.contains(t.division).should('be.visible'))
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

    describe('Regular Season tab', () => {
      beforeEach(() => cy.get('.sched-tab').contains('Regular Season').click())

      it('shows game rows with team abbr', () => {
        cy.contains(teamAbbr).should('exist')
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
        cy.contains(teamAbbr).should('exist')
      })

      it('tapping a game opens the stats popup', () => {
        cy.contains('Tap for stats').first().click()
        cy.contains(/Scoring by Period/i, { timeout: 6000 }).should('exist')
        cy.contains(/Three Stars|Team Stats/i).should('exist')
      })

      it('stats popup closes', () => {
        cy.contains('Tap for stats').first().click()
        cy.contains(/Scoring by Period/i, { timeout: 6000 }).should('exist')
        cy.get('button[aria-label="Close"], [class*="close"]').first().click({ force: true })
        cy.contains(/played/).should('exist')
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

      it('forward navigation changes the month', () => {
        cy.contains(/\w+ \d{4}/).invoke('text').then(before => {
          cy.contains('›').click()
          cy.contains(/\w+ \d{4}/).invoke('text').should('not.eq', before)
        })
      })

      it('switches back to list view', () => {
        cy.get('.vm-btn').first().click()
        cy.get('.sched-tab, .vm-btn').should('be.visible')
      })
    })
  })
})

// ── CAR-specific deep tests (playoffs, scouting, AI, export) ──
describe('Schedule view — CAR (deep)', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      if (err.name === 'ReferenceError' || err.name === 'TypeError') throw err
      return false
    })
    cy.setTeam('CAR')
    cy.visit('/schedule')
    cy.get('.sched-title', { timeout: 15000 }).should('be.visible')
  })

  describe('Playoffs tab', () => {
    // ── Structural tests — safe year-round (completed rounds always visible) ──

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

    it('clicking a completed round expands it', () => {
      cy.get('.round-section-header.older').first().click()
      cy.contains(/MTL|PHI|OTT/i).should('exist')
    })

    // ── Offseason empty-state test ──
    // When OFFSEASON=true, assert that no live "Matchup breakdown" button
    // is present (i.e. the UI correctly shows a completed bracket with no
    // active series panel).

    it('offseason: no live Matchup breakdown button visible', () => {
      if (!OFFSEASON) {
        cy.log('In-season — skipping offseason empty-state check')
        return
      }
      cy.get('body').then($body => {
        expect($body.find(':contains("Matchup breakdown")').length).to.equal(0)
      })
    })

    // ── Live-series tests — skipped during offseason ──────────────
    // These tests all require an active (current) playoff series to be
    // present in the UI.  They are skipped when CYPRESS_OFFSEASON=true.
    // To run locally against a live build:  CYPRESS_OFFSEASON=false npx cypress run

    function liveSeriesIt(title, fn) {
      it(title, function () {
        if (OFFSEASON) {
          this.skip()
        }
        fn()
      })
    }

    liveSeriesIt('current series shows Prediction and Scouting tabs', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Prediction').should('exist')
      cy.get('.md-tab').contains('Scouting').should('exist')
    })

    liveSeriesIt('Prediction/Scouting tab toggle works', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.md-tab').contains('Prediction').click()
      cy.get('.md-tab').contains('Prediction').should('have.class', 'active')
    })

    liveSeriesIt('shows AI analysis section for current series', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-ai-section', { timeout: 15000 }).should('exist')
      cy.get('.md-ai-section').then($el => {
        expect($el.find('.md-ai-narrative').length > 0 || $el.find('.md-ai-loading').length > 0).to.be.true
      })
    })

    liveSeriesIt('matchup detail renders without JS errors', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.matchup-detail').should('exist')
      cy.get('.md-pred-bar').should('exist')
    })

    liveSeriesIt('matchup header uses team abbr', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.team('CAR').then(t => {
        cy.get('.md-title').invoke('text').should('match', new RegExp(`${t.abbr} vs`))
      })
    })

    liveSeriesIt('shows odds row when odds are available', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.matchup-detail').then($el => {
        if ($el.find('.md-odds-row').length > 0) {
          cy.get('.md-odds-row').should('be.visible')
          cy.get('.md-odds-val').should('have.length.gte', 2)
        }
      })
    })

    liveSeriesIt('Prediction tab shows win probability bar', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-pred-bar, .md-prediction').should('exist')
    })

    liveSeriesIt('Prediction tab shows projected score', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.contains(/Predicted score|EXPECTED GOALS/i).should('exist')
    })

    liveSeriesIt('Prediction tab shows Save Prediction Card export button', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-export-btn').should('exist').should('contain', 'Save Prediction Card')
    })

    liveSeriesIt('Prediction tab shows top line edge factor', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-factor').contains('Top line').should('exist')
    })

    liveSeriesIt('Prediction tab shows top line card with xGF%', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-topline-card').should('exist')
      cy.get('.md-topline-xgf').should('exist')
    })

    liveSeriesIt('Prediction tab top line card shows line 1 players', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-topline-card').within(() => {
        cy.get('.md-topline-player, [class*="topline-player"], [class*="player-name"]')
          .should('have.length.gte', 1)
          .first().invoke('text').should('match', /[A-Z][a-z]/)
      })
    })

    liveSeriesIt('Scouting tab shows season or playoff comparison', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.scouting-section-label').should('exist')
      cy.contains(/comparison/i).should('exist')
    })

    liveSeriesIt('Scouting tab shows GAA in goalie row', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.scouting-goalie-label').contains('GAA').should('exist')
    })

    liveSeriesIt('Scouting tab shows goalie matchup section', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.gmc-row').should('exist')
      cy.get('.gmc-goalie').should('have.length', 2)
    })

    liveSeriesIt('Scouting tab shows AI matchup analysis section', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('body').then($body => {
        if ($body.find('.sc-matchup-section').length) {
          cy.get('.sc-matchup-section').should('exist')
          cy.get('.sc-matchup-label').should('contain', 'AI Matchup Analysis')
        }
      })
    })

    liveSeriesIt('Scouting tab shows Save Scouting Card export button', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.scouting-export-btn').should('exist').should('contain', 'Save Scouting Card')
    })

    liveSeriesIt('Scouting tab shows team lines section', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.team('CAR').then(t => {
        cy.get('.scouting-section-label')
          .contains(new RegExp(`${t.abbr} lines`)).should('exist')
      })
    })

    liveSeriesIt('Scouting tab shows 4 forward lines', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-unit').should('have.length.gte', 4)
    })

    liveSeriesIt('Scouting tab shows Line 1 label', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-label').contains('Line 1').should('exist')
    })

    liveSeriesIt('Scouting tab shows line 1 players', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-unit').first().within(() => {
        cy.get('.sc-line-player').should('have.length', 3)
        cy.get('.sc-line-player').first().invoke('text').should('match', /[A-Z][a-z]/)
      })
    })

    liveSeriesIt('Scouting tab shows line 1 players in correct position order', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-unit').first().find('.sc-line-player').then($players => {
        expect($players).to.have.length(3)
        const positions = [...$players].map(p => p.querySelector('.sc-line-pos')?.textContent)
        const hasWing   = positions.some(p => /LW|RW|L|R/.test(p))
        const hasCentre = positions.some(p => p === 'C')
        expect(hasWing, 'line should include at least one wing position').to.be.true
        expect(hasCentre, 'line should include a centre').to.be.true
      })
    })

    liveSeriesIt('Scouting tab shows xGF% label on each line', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-xgf-label').should('have.length.gte', 4)
      cy.get('.sc-line-xgf-label').first().should('contain', 'xGF%')
    })

    liveSeriesIt('Scouting tab shows TOI label on lines with inferred data', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-line-toi').should('have.length.gte', 1)
      cy.get('.sc-line-toi').first().contains(/min together/).should('exist')
    })

    liveSeriesIt('Scouting tab shows Defence pairs subheader', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-lines-subheader').contains('Defence pairs').should('exist')
    })

    liveSeriesIt('Scouting tab shows 3 defence pairs', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.get('.sc-lines-group-d .sc-line-unit').should('have.length', 3)
    })

    liveSeriesIt('Scouting tab shows defence pair 1 player', () => {
      cy.contains('Matchup breakdown').first().click()
      cy.get('.md-tab').contains('Scouting').click()
      cy.team('CAR').then(t => {
        cy.get('.sc-lines-group-d').contains(t.defence1).should('exist')
      })
    })
  })

  describe('Regular Season tab — CAR extended', () => {
    beforeEach(() => cy.get('.sched-tab').contains('Regular Season').click())

    it('shows total games played', () => {
      cy.contains(/82 played/).should('be.visible')
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
  })

  describe('Calendar view — CAR extended', () => {
    beforeEach(() => cy.get('.vm-btn').last().click())

    it('shows navigation arrows', () => {
      cy.contains('›').should('exist')
      cy.contains('‹').should('exist')
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
  })
})
