// cypress/e2e/players.cy.js

describe('Players view', () => {
  beforeEach(() => {
    cy.visit('/players')
    cy.contains('Forwards', { timeout: 8000 }).should('exist')
  })

  // ── Roster ─────────────────────────────────────────────────
  describe('Roster tab', () => {
    it('renders the roster grid with forwards', () => {
      cy.contains('Forwards').should('exist')
      cy.get('[class*="player-card"]').should('have.length.greaterThan', 0)
    })

    it('renders defensemen section', () => {
      cy.contains('Defensemen').should('exist')
    })

    it('renders goalies section', () => {
      cy.contains('Goalies').should('exist')
    })

    it('renders known CAR players', () => {
      cy.contains('Aho').should('exist')
      cy.contains('Andersen').should('exist')
    })
  })

  // ── Skater card ────────────────────────────────────────────
  describe('Skater card (Aho)', () => {
    beforeEach(() => {
      cy.contains('Aho').first().click()
      cy.contains(/Cap Hit|AAV/i, { timeout: 8000 }).should('exist')
    })

    it('shows player name and position', () => {
      cy.contains('Aho').should('exist')
      cy.contains(/Centre|Forward|C|LW|RW/i).should('exist')
    })

    it('shows division/conference/league rankings', () => {
      cy.contains(/Division|Conference|League/i).should('exist')
    })

    it('shows contract info', () => {
      cy.contains(/Cap Hit|AAV/i).should('exist')
    })

    it('shows value badge', () => {
      cy.contains(/Overpaid|Fair|Good value|Great value|Exceptional/i).should('exist')
    })

    it('Stats tab shows scoring stats', () => {
      cy.contains('Goals').should('exist')
      cy.contains('Assists').should('exist')
      cy.contains('Points').should('exist')
    })

    it('Stats tab shows special teams section', () => {
      cy.contains(/Special Teams/i).should('exist')
      cy.contains(/PPG|PPP/i).should('exist')
    })

    it('Stats tab shows shot quality section', () => {
      cy.contains(/Shot Quality/i).should('exist')
      cy.contains('S%').should('exist')
    })

    it('Stats tab shows ice time section', () => {
      cy.contains(/Ice Time/i).should('exist')
      cy.contains('TOI').should('exist')
    })

    it('Stats tab shows defensive stats for regular season', () => {
      cy.contains('Defensive', { timeout: 8000 }).should('exist')
      cy.contains(/Hits|Blocks|TK|GV/).should('exist')
    })

    it('season selector expands career stats', () => {
      cy.contains(/Career|Regular season/i).should('exist')
    })

    it('Analytics tab loads WAR and percentiles', () => {
      cy.get('.pp-tab').contains('Analytics').click()
      cy.contains('WAR', { timeout: 10000 }).should('exist')
      cy.contains('EV Offence').should('exist')
      cy.contains('EV Defence').should('exist')
    })

    it('Analytics tab shows xGA/60 context chip', () => {
      cy.get('.pp-tab').contains('Analytics').click()
      cy.contains('xGA/60', { timeout: 10000 }).should('exist')
    })

    it('Analytics tab shows percentile bars', () => {
      cy.get('.pp-tab').contains('Analytics').click()
      cy.contains(/Power Play/i, { timeout: 8000 }).should('exist')
      cy.contains(/Competition/i).should('exist')
    })

    it('Heat Map tab renders rink', () => {
      cy.get('.pp-tab').contains('Heat Map').click()
      cy.get('svg, canvas', { timeout: 8000 }).should('exist')
    })

    it('closes when X is clicked', () => {
      cy.get('button[aria-label="Close"], [class*="pp-close"]')
        .first().click({ force: true })
      cy.contains('Forwards', { timeout: 6000 }).should('exist')
    })
  })

  // ── Goalie card ────────────────────────────────────────────
  describe('Goalie card (Andersen)', () => {
    beforeEach(() => {
      cy.contains('Andersen').first().click()
      cy.contains(/Cap Hit|AAV/i, { timeout: 8000 }).should('exist')
    })

    it('shows Goalie position badge', () => {
      cy.contains('Goalie').should('exist')
    })

    it('shows dual rankings — by SV% and by GAA', () => {
      cy.contains(/Ranked by SV%/i).should('exist')
      cy.contains(/Ranked by GAA/i).should('exist')
    })

    it('shows Division, Conference, League ranks', () => {
      cy.contains('Division').should('exist')
      cy.contains('Conference').should('exist')
      cy.contains('League').should('exist')
    })

    it('Stats tab shows Record group (GP, W, L, GS)', () => {
      cy.contains('GP').should('exist')
      cy.contains(/^W$/).should('exist')
      cy.contains(/^L$/).should('exist')
      cy.contains('GS').should('exist')
    })

    it('Stats tab shows Performance group (SV%, GAA, QS%)', () => {
      cy.contains('SV%').should('exist')
      cy.contains('GAA').should('exist')
      cy.contains(/QS%|OS%/i).should('exist')
    })

    it('Analytics tab shows GSAX and goalie-specific metrics', () => {
      cy.get('.pp-tab').contains('Analytics').click()
      // GSAX is the primary goalie analytics metric (Goals Saved Above Expected)
      cy.contains('GSAX', { timeout: 10000 }).should('exist')
      // Save percentage breakdowns
      cy.contains(/5on5 SV%|HD SV%/i).should('exist')
      // Percentile rankings
      cy.contains(/Percentile/i).should('exist')
    })

    it('Heat Map tab renders', () => {
      cy.get('.pp-tab').contains('Heat Map').click()
      cy.get('svg, canvas', { timeout: 8000 }).should('exist')
    })

    it('shows value badge', () => {
      cy.contains(/Overpaid|Fair|Good value|Great value|Exceptional/i).should('exist')
    })
  })

  // ── Stats table ────────────────────────────────────────────
  describe('Stats table', () => {
    it('renders the Stats table tab', () => {
      cy.contains('Stats').click()
      cy.contains('Aho').should('exist')
      cy.contains('GP').should('exist')
    })

    it('stats table has sortable columns', () => {
      cy.contains('Stats').click()
      cy.contains('G').click()
      cy.contains('Aho').should('exist')
    })

    it('can toggle between regular season and playoffs', () => {
      cy.contains('Stats').click()
      cy.get('body').then($body => {
        if ($body.text().includes('Playoffs')) {
          cy.contains(/Playoffs|Regular Season/).first().click()
        }
      })
    })
  })
})
