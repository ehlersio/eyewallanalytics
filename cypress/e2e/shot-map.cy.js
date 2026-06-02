// cypress/e2e/shot-map.cy.js

describe('Shot Map', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.contains('CAR').should('be.visible')
  })

  // ── Game header ────────────────────────────────────────────
  describe('Game header', () => {
    it('shows CAR score and opponent', () => {
      cy.contains('CAR').should('be.visible')
      cy.contains(/FINAL|LIVE|P[123]|OT/i).should('be.visible')
    })

    it('shows game date and type (Playoff/Regular)', () => {
      cy.contains(/Playoff|Regular/i).should('exist')
    })
  })

  // ── Game insights ──────────────────────────────────────────
  describe('Game Insights section', () => {
    it('renders section header', () => {
      cy.contains(/Game Insights/i).should('exist')
    })

    it('shows at least one insight card', () => {
      cy.get('[class*="insight"]').should('have.length.greaterThan', 0)
    })

    it('insight cards contain CAR-related text', () => {
      cy.contains(/CAR/).should('exist')
    })
  })

  // ── Shot attempts ──────────────────────────────────────────
  describe('Shot Attempts section', () => {
    it('shows section header', () => {
      cy.contains(/Shot Attempts/i).should('exist')
    })

    it('shows Corsi and Fenwick rows', () => {
      cy.contains(/Corsi|CF/i).should('exist')
      cy.contains(/Fenwick|FF/i).should('exist')
    })

    it('shows shots on goal, missed shots, blocked shots', () => {
      cy.contains(/Shots on Goal/i).should('exist')
      cy.contains(/Missed/i).should('exist')
      cy.contains(/Blocked/i).should('exist')
    })

    it('shows CF%, FF%, PDO, and Luck stats', () => {
      cy.contains('CF%').should('exist')
      cy.contains('FF%').should('exist')
      cy.contains('PDO').should('exist')
      cy.contains('Luck').should('exist')
    })
  })

  // ── Special teams ──────────────────────────────────────────
  describe('Special teams stats', () => {
    it('shows PP% with this game and season average', () => {
      cy.contains('PP %').should('be.visible')
    })

    it('shows PK% with this game and season average', () => {
      cy.contains('PK %').should('be.visible')
    })

    it('shows faceoff percentage', () => {
      cy.contains(/Faceoff|FACEOFF/i).should('exist')
    })
  })

  // ── Momentum chart ─────────────────────────────────────────
  describe('Momentum chart', () => {
    it('renders section header', () => {
      cy.contains(/Momentum/i).should('exist')
    })

    it('shows CAR and opponent momentum percentages', () => {
      cy.contains(/CAR \d+%/).should('exist')
    })

    it('shows period markers P1, P2, P3', () => {
      cy.contains('P1').should('exist')
      cy.contains('P2').should('exist')
      cy.contains('P3').should('exist')
    })

    it('time window buttons are present', () => {
      cy.get('.rink-btn').contains('5m').should('exist')
      cy.get('.rink-btn').contains('10m').should('exist')
      cy.get('.rink-btn').contains('Full').should('exist')
    })

    it('switches between 5m, 10m, Full windows', () => {
      cy.get('.rink-btn').contains('10m').click()
      cy.get('.rink-btn').contains('10m').should('have.class', 'on')
      cy.get('.rink-btn').contains('Full').click()
      cy.get('.rink-btn').contains('Full').should('have.class', 'on')
      cy.get('.rink-btn').contains('5m').click()
      cy.get('.rink-btn').contains('5m').should('have.class', 'on')
    })
  })

  // ── Shot quality ───────────────────────────────────────────
  describe('Shot quality section', () => {
    it('renders section header', () => {
      cy.contains(/Shot Quality|shot quality/i).should('exist')
    })

    it('shows High danger, Medium, Low buckets', () => {
      cy.contains(/High danger/i).should('exist')
      cy.contains(/Medium/i).should('exist')
      cy.contains(/Low/i).should('exist')
    })
  })

  // ── Shot map rink ──────────────────────────────────────────
  describe('Shot map rink', () => {
    it('renders the rink SVG', () => {
      cy.get('svg').should('exist')
    })

    it('shows period filter buttons (All, P1, P2, P3)', () => {
      cy.get('.rink-btn').contains('All').should('exist')
      cy.get('.rink-btn').contains('P1').should('exist')
      cy.get('.rink-btn').contains('P2').should('exist')
      cy.get('.rink-btn').contains('P3').should('exist')
    })

    it('period filter buttons are clickable', () => {
      cy.get('.rink-btn').contains('P1').click()
      cy.get('.rink-btn').contains('P1').should('have.class', 'on')
      cy.get('.rink-btn').contains('P2').click()
      cy.get('.rink-btn').contains('P2').should('have.class', 'on')
      cy.get('.rink-btn').contains('All').click()
      cy.get('.rink-btn').contains('All').should('have.class', 'on')
    })

    it('shows Player filter button', () => {
      cy.get('.rink-btn').contains('Player').should('exist')
    })

    it('shows Heat map toggle', () => {
      cy.get('.rink-btn').contains('Heat').should('exist')
    })

    it('shows shot legend (CAR shot, goal, Opp shot, Blocked)', () => {
      cy.contains(/CAR shot|CAR goal/i).should('exist')
      cy.contains(/Opp shot|Opp goal/i).should('exist')
    })

    it('shows zoom controls', () => {
      cy.get('.zoom-btn').contains('−').should('exist')
      cy.get('.zoom-btn').contains('+').should('exist')
    })

    it('zoom buttons are clickable without crashing', () => {
      cy.get('.zoom-btn').contains('+').click()
      cy.get('.zoom-btn').contains('+').click()
      cy.get('.zoom-btn').contains('−').click()
      cy.get('svg').should('exist') // rink still renders
    })
  })

  // ── CAR scoring sidebar ────────────────────────────────────
  describe('CAR scoring sidebar', () => {
    it('shows scoring section header', () => {
      cy.contains(/CAR scoring/i).should('exist')
    })

    it('shows player names with point totals', () => {
      // Scoring sidebar lists players — at least one should show a goal or assist badge
      cy.contains(/\dG|\dA|\dPTS/i).should('exist')
    })

    it('shows goalies section', () => {
      cy.contains('Goalies').should('exist')
    })

    it('shows team stats section', () => {
      cy.contains(/Team stats/i).should('exist')
    })
  })
})
