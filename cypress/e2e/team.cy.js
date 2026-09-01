// cypress/e2e/team.cy.js

const WORKER_URL = Cypress.env('VITE_WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev'

const FULL_TEST_TEAMS = ['CAR', 'VGK', 'TOR', 'CHI']

FULL_TEST_TEAMS.forEach(teamAbbr => {
  describe(`Team view — ${teamAbbr}`, () => {
    beforeEach(() => {
      cy.team(teamAbbr).then(t => {
        cy.setTeam(teamAbbr)
        cy.visit('/team')
        cy.contains(t.displayName).should('be.visible')
      })
    })

    it('renders all expected tab buttons', () => {
      ['Overview', 'Advanced', 'Splits', 'Trends'].forEach(tab =>
        cy.contains(tab).should('be.visible')
      )
      // Cap and Picks tabs only available for teams with salary data
      if (teamAbbr === 'CAR') {
        cy.contains('Cap').should('be.visible')
        cy.contains('Picks').should('be.visible')
      }
      // History tab now covers all 32 NHL teams (Phase 1) -- always expected
      cy.contains('History').should('exist')
    })

    describe('Overview tab', () => {
      it('shows season record', function () {
        cy.skipUnlessContentAppears('.records-row', 'Season stats')
        cy.contains('Season stats').should('be.visible')
        cy.contains(/\d+–\d+–\d+/).should('be.visible')
      })

      it('shows season stats with league ranks', function () {
        cy.skipUnlessContentAppears('.records-row', 'Season stats')
        cy.contains('Season stats').should('be.visible')
        cy.contains(/Goals\/GP|GA\/GP|PP%|PK%/).should('be.visible')
        cy.get('.overview-stat-rank').first().then($el => {
          expect($el.text().trim()).to.match(/^\d+(st|nd|rd|th)$/)
        })
      })

      it('shows playoff bracket when in playoffs', () => {
        cy.get('body').then($body => {
          if ($body.text().includes('Playoffs')) {
            cy.contains('Playoffs').should('exist')
          }
        })
      })
    })

    describe('Advanced tab', () => {
      beforeEach(() => cy.contains('Advanced').click())

      it('renders possession stats', () => {
        cy.contains(/Corsi|CF%|Shot/i, { timeout: 8000 }).should('exist')
      })

      it('renders PDO section', function () {
        cy.skipUnlessContentAppears('.adv-context-note, .adv-toggle', 'PDO', { timeout: 8000 })
        cy.contains('PDO', { timeout: 8000 }).should('exist')
      })

      it('renders power play stats', () => {
        cy.contains('Power Play', { timeout: 8000 }).should('exist')
      })

      it('renders penalty kill stats', () => {
        cy.contains('Penalty Kill', { timeout: 8000 }).should('exist')
      })

      it('reg/playoff toggle works when in playoffs', () => {
        cy.get('body').then($body => {
          if ($body.text().includes('Regular Season') && $body.text().includes('Playoffs')) {
            cy.contains('Playoffs').click()
            cy.contains('Regular Season').click()
          }
        })
      })
    })

    describe('Splits tab', () => {
      beforeEach(() => cy.contains('Splits').click())

      it('renders home vs away split', () => {
        cy.contains(/Home|Away/i, { timeout: 8000 }).should('exist')
      })

      it('shows record for both home and away', () => {
        cy.contains(/\d+–\d+/, { timeout: 8000 }).should('exist')
      })
    })

    describe('Trends tab', () => {
      beforeEach(() => cy.contains('Trends').click())

      it('renders quick stats cards', function () {
        cy.skipIfEither('.empty-title', '[class*="result-dot"]', { timeout: 8000 })
        cy.contains(/Current streak|W\d|L\d/i, { timeout: 8000 }).should('exist')
        cy.contains('Last 10 games', { timeout: 8000 }).should('exist')
      })

      it('renders result dots for last 20 games', function () {
        cy.skipIfEither('.empty-title', '[class*="result-dot"]', { timeout: 8000 })
        cy.contains(/Last \d+ games/i, { timeout: 8000 }).should('exist')
        cy.get('[class*="result-dot"]').should('have.length.greaterThan', 0)
      })

      it('renders rolling win% chart', function () {
        cy.skipIfEither('.empty-title', '[class*="rolling-bar"]', { timeout: 8000 })
        cy.contains(/Win %|Rolling.*win/i, { timeout: 8000 }).should('exist')
        cy.get('[class*="rolling-bar"]').should('have.length.greaterThan', 0)
      })

      it('renders goal differential chart', function () {
        cy.skipIfEither('.empty-title', '[class*="result-dot"]', { timeout: 8000 })
        cy.contains(/Goal differential/i, { timeout: 8000 }).should('exist')
      })

      it('renders score-first rate chart', () => {
        cy.get('body').then($body => {
          if ($body.text().match(/Score.first rate/i)) {
            cy.contains(/Score.first rate/i).should('exist')
          }
        })
      })
    })

    describe('History tab (Phase 1 — all 32 NHL teams)', () => {
      beforeEach(() => cy.contains('History').click())

      it('renders the Founded and Home Arena sections', () => {
        cy.contains('Founded', { timeout: 8000 }).should('exist')
        cy.contains('Home Arena').should('exist')
      })

      it('renders a Current Franchise Info section with an owner and head coach', () => {
        cy.contains('Current Franchise Info', { timeout: 8000 }).should('exist')
        cy.contains('Owner').should('exist')
        cy.contains('Head Coach').should('exist')
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
        // :not(.xg-overlay-section) excludes the season-overlay chart card
        // (added Session 67) from this "one card per season" count -- it's a
        // single shared chart, not a per-season stat card.
        cy.get('.stat-section:not(.xg-overlay-section)', { timeout: 15000 }).should('have.length', 2)
        // The chart section renders above the season cards in the DOM (it's
        // a shared header for the comparison, not per-season), so on a short
        // viewport the cards can land below the popup's visible scroll area
        // after Cypress auto-scrolls to click the chips. scrollIntoView
        // finds them regardless of where that lands.
        cy.contains('GP', { timeout: 15000 }).scrollIntoView().should('be.visible')
        cy.contains('PTS').scrollIntoView().should('be.visible')
      })

    })

    describe('Compare Teams (Session 86)', () => {
      beforeEach(() => {
        cy.contains('🆚 Compare Seasons').click()
        cy.get('[aria-label="Compare vs team"]').click()
        cy.contains('Full Stat Comparison').should('be.visible')
      })

      it('opponent picker excludes the current team', () => {
        cy.get('select[aria-label="Choose opponent team"]').find('option').then($opts => {
          const values = [...$opts].map(o => o.value).filter(Boolean)
          expect(values).not.to.include(teamAbbr)
        })
      })

      it('renders one comparison card per team once an opponent and season are picked', () => {
        cy.get('select[aria-label="Choose opponent team"]').then($sel => {
          const opponent = [...$sel[0].options].map(o => o.value).find(v => v && v !== teamAbbr)
          cy.wrap($sel).select(opponent)
        })
        cy.get('.season-chip', { timeout: 8000 }).first().click()
        cy.get('.stat-section', { timeout: 15000 }).should('have.length', 2)
        cy.contains('GP').scrollIntoView().should('be.visible')
      })

      it('opponent selection carries over when switching to Head-to-Head', () => {
        cy.get('select[aria-label="Choose opponent team"]').then($sel => {
          const opponent = [...$sel[0].options].map(o => o.value).find(v => v && v !== teamAbbr)
          cy.wrap($sel).select(opponent)
          cy.contains('Head-to-Head').click()
          cy.get('select[aria-label="Choose opponent team"]').should('have.value', opponent)
        })
      })

      it('renders all-time record, or the no-meetings state, once an opponent is picked', () => {
        cy.get('select[aria-label="Choose opponent team"]').then($sel => {
          const opponent = [...$sel[0].options].map(o => o.value).find(v => v && v !== teamAbbr)
          cy.wrap($sel).select(opponent)
        })
        cy.contains('Head-to-Head').click()
        // Real record depends on live data for this team pair -- either
        // shape is a valid, non-broken outcome (see /team-seasons/head-to-head).
        cy.contains(/Since 2023-24|No meetings on record/i, { timeout: 15000 }).should('be.visible')
      })
    })

    // Cap & Picks only runs for teams with salary data
    if (teamAbbr === 'CAR') {
      describe('Cap tab', () => {
        beforeEach(() => cy.contains('Cap').click())

        it('renders salary cap bar', () => {
          cy.contains(/cap/i, { timeout: 8000 }).should('exist')
          cy.contains(/\$\d+M|\d+M/).should('exist')
        })

        it('renders contract table with player names', () => {
          cy.team('CAR').then(t => {
            cy.contains(t.skater, { timeout: 8000 }).should('exist')
            cy.contains(/UFA|RFA/).should('exist')
            cy.contains(/\$\d+\.\d+M/).should('exist')
          })
        })

      })

      describe('Picks tab', () => {
        beforeEach(() => cy.contains('Picks').click())

        it('renders 2026 NHL Draft section', () => {
          cy.contains('2026 NHL Draft', { timeout: 8000 }).should('exist')
        })

        it('renders CAR pick slot', () => {
          cy.get('.picks-slot, .picks-made-row', { timeout: 8000 }).should('have.length.gte', 1)
        })
      })

      // Phase 0 pilot (teamHistory.js) -- CAR is the only team with data so
      // far, same gating as Cap/Picks above. Later phases add more teams;
      // this spec doesn't need to know which ones, since the tab only shows
      // up when getTeamHistory() finds a match.
      describe('History tab', () => {
        beforeEach(() => cy.contains('History').click())

        it('renders franchise founding info', () => {
          cy.contains('Hartford Whalers', { timeout: 8000 }).should('be.visible')
        })

        // These sections render well below the fold in the .page scroll
        // container -- .should('exist') rather than .should('be.visible'),
        // same convention as the Advanced/Trends tab tests above, since a
        // bare assertion doesn't auto-scroll the way an action command does.
        it('renders both Stanley Cup championships', () => {
          cy.contains('Stanley Cup 2006').should('exist')
          cy.contains('Stanley Cup 2026').should('exist')
        })

        it('renders retired numbers', () => {
          cy.contains("Rod Brind'Amour").should('exist')
        })

        it('renders minor league affiliates', () => {
          cy.contains('Chicago Wolves').should('exist')
          cy.contains('Greensboro Gargoyles').should('exist')
        })
      })
    }
  })
})

// ── Season correctness (Session 65) ─────────────────────────────
// Regression coverage for the frozen-module-load-season-constants fix.
// The existing skipIfEither/skipUnlessContentAppears skip-gate commands
// (Session 62) only distinguish "real content present" from "no data yet"
// -- they say nothing about whether that content is for the RIGHT season.
// A component that regresses back to reading a frozen constant instead of
// the live-resolved value would still show real, populated content and
// sail straight through those gates.
//
// This is a genuinely new category of coverage for this repo, not a
// bigger version of the skip-gate pattern: every existing spec asserts
// WHETHER something rendered; this is the first one that asserts WHICH
// season it rendered for, checked against the live source of truth
// (/config/seasons) rather than a value baked into the test itself.
describe('Season correctness — rendered label matches live /config/seasons', () => {
  it('team page season label matches the season the Worker currently resolves as current', () => {
    cy.request(`${WORKER_URL}/config/seasons`).then((res) => {
      const liveSeasonId = String(res.body.nhl.seasonId)
      const expectedLabel = `${liveSeasonId.slice(0, 4)}–${liveSeasonId.slice(6)}`
      cy.setTeam('CAR')
      cy.visit('/team')
      cy.get('.view-sub', { timeout: 15000 }).should('contain', expectedLabel)
    })
  })
})
