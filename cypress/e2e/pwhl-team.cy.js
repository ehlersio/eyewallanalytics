// cypress/e2e/pwhl-team.cy.js

const WORKER_URL = Cypress.env('VITE_WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev'

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
      ['Overview', 'Advanced', 'Splits', 'Trends', 'Salaries', 'History'].forEach(tab =>
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

    describe('History tab (Phase 2 — all 12 PWHL teams)', () => {
      beforeEach(() => cy.contains('History').click())

      it('renders the Founded and Home Arena sections', () => {
        cy.contains('Founded', { timeout: 8000 }).should('exist')
        cy.contains('Home Arena').should('exist')
      })

      it('renders a Current Franchise Info section with the single-entity owner', () => {
        cy.contains('Current Franchise Info', { timeout: 8000 }).should('exist')
        cy.contains('Owner').should('exist')
        cy.contains(/Mark & Kimbra Walter/i).should('exist')
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

    describe('Compare Teams (Session 86)', () => {
      beforeEach(() => {
        cy.contains('🆚 Compare Seasons').click()
        cy.get('[aria-label="Compare vs team"]').click()
        cy.contains('Full Stat Comparison').should('be.visible')
      })

      it('opponent picker excludes the current team', () => {
        cy.get('select[aria-label="Choose opponent team"]').find('option').then($opts => {
          const values = [...$opts].map(o => o.value).filter(Boolean)
          expect(values).not.to.include(String(teamId))
        })
      })

      it('renders one comparison card per team once an opponent and season are picked', () => {
        cy.get('select[aria-label="Choose opponent team"]').then($sel => {
          const opponent = [...$sel[0].options].map(o => o.value).find(v => v && v !== String(teamId))
          cy.wrap($sel).select(opponent)
        })
        cy.get('.season-chip', { timeout: 8000 }).first().click()
        cy.get('.stat-section', { timeout: 15000 }).should('have.length', 2)
        cy.contains('GP').scrollIntoView().should('be.visible')
      })

      it('renders all-time record, or the no-meetings state, once an opponent is picked (Session 88)', () => {
        cy.get('select[aria-label="Choose opponent team"]').then($sel => {
          const opponent = [...$sel[0].options].map(o => o.value).find(v => v && v !== String(teamId))
          cy.wrap($sel).select(opponent)
        })
        cy.contains('Head-to-Head').click()
        cy.contains(/Since 2023-24|No meetings on record/i, { timeout: 15000 }).should('be.visible')
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
    ['Overview', 'Advanced', 'Splits', 'Trends', 'Salaries', 'History'].forEach(tab =>
      cy.contains(tab).should('exist')
    )
    cy.assertNoErrors()
  })

  // Unlike every other data-driven tab in this describe block, History is
  // NOT gated on games-played -- it's static reference data (founding,
  // arena, current GM/coach), so an expansion team with zero games shows
  // real content here instead of an empty state. Confirms teamHistory.js's
  // DET entry (founded 2026, no championships/records yet) renders cleanly.
  describe('History tab', () => {
    beforeEach(() => cy.contains('History').click())

    it('renders real content instead of an empty state', () => {
      cy.contains('Founded', { timeout: 8000 }).should('exist')
      cy.contains('2026').should('exist')
      cy.contains('Little Caesars Arena').should('exist')
      cy.assertNoErrors()
    })

    it('does not render Championships or Franchise Records sections (none exist yet)', () => {
      cy.contains('Championships').should('not.exist')
      cy.contains('Franchise Records').should('not.exist')
    })
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

  describe('Compare Teams (Session 86)', () => {
    beforeEach(() => {
      cy.contains('🆚 Compare Seasons').click()
      cy.get('[aria-label="Compare vs team"]').click()
    })

    it('shows "Not yet available" for an expansion team with no prior-season row', () => {
      cy.get('select[aria-label="Choose opponent team"]').select('2') // Minnesota Frost
      cy.get('.season-chip', { timeout: 8000 }).contains('2025-26').click()
      cy.contains('Not yet available for this season', { timeout: 15000 }).should('be.visible')
    })

    // DET has never played a game in this pipeline's history (2026-27
    // expansion) -- unlike the "either/or" assertion used for established
    // teams elsewhere, this pair is guaranteed zero real meetings, so this
    // can assert the exact empty state deterministically (Session 88).
    it('Head-to-Head shows the zero-meetings empty state for an expansion team', () => {
      cy.get('select[aria-label="Choose opponent team"]').select('2') // Minnesota Frost
      cy.contains('Head-to-Head').click()
      cy.contains('No meetings on record between these teams yet', { timeout: 15000 }).should('be.visible')
    })
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
// (/config/seasons) rather than a value baked into the test itself. Was
// literally a hardcoded "2025-26 season" string here until this session --
// see PWHLTeamView.jsx.
describe('Season correctness — rendered label matches live /config/seasons', () => {
  it('team page season label matches the season the Worker currently resolves as current', () => {
    cy.request(`${WORKER_URL}/config/seasons`).then((res) => {
      const { startYear } = res.body.pwhl
      const expectedBase = `${startYear}-${String(startYear + 1).slice(2)}`
      cy.visit('/pwhl/team', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'pwhl')
          win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
        },
      })
      cy.get('.view-sub', { timeout: 15000 }).should('contain', expectedBase)
    })
  })
})
