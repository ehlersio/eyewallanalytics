// cypress/e2e/pwhl-shot-map.cy.js
// Smoke tests for the PWHL Shot Map view (/pwhl/shots)
// Mirrors shot-map.cy.js structure but scoped to PWHL teams and PWHL-specific UI.

const PWHL_TEAMS = [
  { abbr: 'BOS', teamId: 1 },
  { abbr: 'MIN', teamId: 2 },
  { abbr: 'MTL', teamId: 3 },
  { abbr: 'NY',  teamId: 4 },
  { abbr: 'OTT', teamId: 5 },
  { abbr: 'TOR', teamId: 6 },
  { abbr: 'SEA', teamId: 8 },
  { abbr: 'VAN', teamId: 9 },
  { abbr: 'DET', teamId: 10 },
  { abbr: 'HAM', teamId: 11 },
  { abbr: 'LV',  teamId: 12 },
  { abbr: 'SJS', teamId: 13 },
]

// ── Multi-team smoke ──────────────────────────────────────────────────────────
describe('PWHL Shot Map smoke tests (multi-team)', () => {
  PWHL_TEAMS.forEach(({ abbr, teamId }) => {
    it(`PWHL shot map loads without crashing for ${abbr}`, () => {
      cy.visit('/pwhl/shots', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'pwhl')
          win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr, teamId }))
        },
      })
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.contains(abbr).should('be.visible')
      // 2026-27 expansion teams have no shot events yet (no games played) —
      // the rink SVG is intentionally not rendered in that case, replaced by
      // an explicit "No shot data" message. Accept either so this stays a
      // true crash-smoke-test rather than assuming real data exists. Uses a
      // retrying should() (not .then()) since the fetch is still pending
      // ("Loading shots…") for a moment right after visit.
      cy.get('body', { timeout: 10000 }).should($body => {
        const hasRink       = $body.find('svg').length > 0
        const hasNoDataMsg  = /No shot data/i.test($body.text())
        expect(hasRink || hasNoDataMsg, 'expected rink SVG or explicit no-data message').to.be.true
      })
      cy.assertNoErrors()
    })
  })
})

// ── Full feature tests (BOS as default) ──────────────────────────────────────
describe('PWHL Shot Map', () => {
  beforeEach(() => {
    // Use onBeforeLoad so PWHL keys are set before React initialises
    // (avoids TeamPicker appearing and e2e.js CAR beforeEach being the only key)
    cy.visit('/pwhl/shots', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport',     'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
  })

  describe('Score bar', () => {
    it('shows team abbreviation', () => {
      cy.contains('BOS').should('be.visible')
    })

    it('shows season picker buttons', () => {
      cy.contains('2025-26').should('exist')
      cy.contains('2024-25').should('exist')
      cy.contains('2023-24').should('exist')
    })

    it('switches seasons without crashing', () => {
      cy.contains('2024-25').click()
      cy.get('svg').should('exist')
      cy.assertNoErrors()
      cy.contains('2025-26').click()
    })
  })

  describe('Game chips', () => {
    it('shows an All games chip', () => {
      cy.contains(/^All \d+$/).should('exist')
    })

    it('game chips are clickable and filter shots', () => {
      // Click the first non-All chip (a real game)
      cy.get('.game-chip').not('.game-chip-all').first().click()
      cy.get('.game-chip-active').should('exist')
      // Click All to deselect
      cy.get('.game-chip-all').click()
      cy.get('.game-chip-all').should('have.class', 'game-chip-active')
    })
  })

  describe('MetCards — row 1', () => {
    it('shows Shots on Goal card', () => {
      cy.contains('Shots on Goal').should('exist')
    })

    it('shows Blocks card', () => {
      cy.contains('Blocks').should('exist')
    })

    it('Shots on Goal card is clickable and opens drill-down', () => {
      cy.get('.met-card-clickable').contains('Shots on Goal').click()
      cy.get('.drill-overlay').should('exist')
      cy.get('.drill-popup').should('be.visible')
      cy.get('.drill-close').click()
      cy.get('.drill-overlay').should('not.exist')
    })
  })

  describe('MetCards — row 2 (game view)', () => {
    beforeEach(() => {
      // Select a game to activate PBP MetCards
      cy.get('.game-chip').not('.game-chip-all').first().click()
      cy.get('.game-chip-active').not('.game-chip-all').should('exist')
    })

    it('shows Hits card', () => {
      cy.contains('Hits').should('exist')
    })

    it('shows Penalties card', () => {
      cy.contains('Penalties').should('exist')
    })

    it('shows Faceoff % card', () => {
      cy.contains('Faceoff %').should('exist')
    })

    it('shows PP % card', () => {
      cy.contains('PP %').should('exist')
    })

    it('shows PK % card', () => {
      cy.contains('PK %').should('exist')
    })
  })

  describe('Shot Attempts panel (game view)', () => {
    beforeEach(() => {
      cy.get('.game-chip').not('.game-chip-all').first().click()
    })

    it('shows Shot Attempts section header', () => {
      cy.contains('Shot Attempts').should('exist')
    })

    it('shows Corsi and Fenwick rows', () => {
      cy.contains(/Corsi|CF/i).should('exist')
      cy.contains(/Fenwick|FF/i).should('exist')
    })

    it('shows Shots on Goal and Blocked Shots rows', () => {
      cy.contains(/Shots on Goal/i).should('exist')
      cy.contains(/Blocked/i).should('exist')
    })

    it('does NOT show Missed Shots row', () => {
      cy.contains(/Missed Shots/i).should('not.exist')
    })

    it('shows CF%, FF%, PDO, and Luck chips', () => {
      cy.contains('CF%').should('exist')
      cy.contains('FF%').should('exist')
      cy.contains('PDO').should('exist')
      cy.contains('Luck').should('exist')
    })
  })

  describe('Shot quality section', () => {
    it('shows BOS Shot Quality header', () => {
      cy.contains(/BOS Shot Quality/i).should('exist')
    })

    it('shows High danger, Medium, Low buckets', () => {
      cy.contains(/High danger/i).should('exist')
      cy.contains(/Medium/i).should('exist')
      cy.contains(/Low/i).should('exist')
    })

    it('danger cells are clickable and open drill-down', () => {
      cy.get('.danger-cell').first().click()
      cy.get('.drill-overlay').should('exist')
      cy.get('.drill-close').click()
      cy.get('.drill-overlay').should('not.exist')
    })
  })

  describe('Shot map rink', () => {
    it('shows BOS Shot Locations header', () => {
      cy.contains(/BOS Shot Locations/i).should('exist')
    })

    it('renders the rink SVG', () => {
      cy.get('svg').should('exist')
    })

    it('shows period filter buttons', () => {
      cy.get('.rink-btn').contains('All').should('exist')
      cy.get('.rink-btn').contains('P1').should('exist')
      cy.get('.rink-btn').contains('P2').should('exist')
      cy.get('.rink-btn').contains('P3').should('exist')
    })

    it('period filter buttons are clickable', () => {
      cy.get('.rink-btn').contains('P1').click()
      cy.get('.rink-btn').contains('P1').should('have.class', 'on')
      cy.get('.rink-btn').contains('All').click()
      cy.get('.rink-btn').contains('All').should('have.class', 'on')
    })

    it('shows shot legend with team abbr', () => {
      cy.contains(/BOS shot|BOS goal/i).should('exist')
      cy.contains(/Opp shot|Opp goal/i).should('exist')
    })

    it('shows zoom controls', () => {
      cy.get('.zoom-btn').contains('−').should('exist')
      cy.get('.zoom-btn').contains('+').should('exist')
    })
  })

  describe('Game view sidebar (scoring + team stats)', () => {
    beforeEach(() => {
      cy.get('.game-chip').not('.game-chip-all').first().click()
    })

    it('shows scoring section with team abbr', () => {
      cy.contains(/BOS scoring/i).should('exist')
    })

    it('shows goalies section', () => {
      cy.contains('Goalies').should('exist')
    })

    it('shows team stats section', () => {
      cy.contains(/Team stats/i).should('exist')
    })
  })

  describe('Bottom nav', () => {
    it('shows PWHL nav tabs', () => {
      cy.contains('Shot Map').should('exist')
      cy.contains('Schedule').should('exist')
      cy.contains('Players').should('exist')
    })

    it('navigates to PWHL Schedule without crashing', () => {
      cy.contains('Schedule').click()
      cy.url().should('include', '/pwhl/schedule')
      cy.assertNoErrors()
    })

    it('navigates back to PWHL Shot Map', () => {
      cy.contains('Shot Map').click()
      cy.url().should('include', '/pwhl/shots')
      cy.get('svg').should('exist')
    })
  })
})
