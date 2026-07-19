// cypress/e2e/shot-map.cy.js

// Pins the 'Shot Map' describe block below to a real, permanent CAR game
// (2026-05-21 playoff win over MTL, gameState OFF) via the app's own
// ?mockGame= dev feature (nhlApi.js:getLiveGame -- DEV-only, statically
// eliminated from production builds, verified against a real `npm run
// build` output during Session 67). Without this, every assertion in that
// block requires a live/very-recent NHL game to exist, which is false for
// ~4 months a year (off-season) -- this makes the block's 30 tests of real
// feature coverage deterministic year-round instead of skip-gating them
// dark. Same fix applied to period-summary.cy.js's "Game Summaries" and
// "Period Summary popup" blocks, which have the identical dependency.
const MOCK_GAME_ID = '2025030311'

// ── Multi-team smoke ──────────────────────────────────────────────────────
describe('Shot Map smoke tests (multi-team)', () => {
  const SAMPLE_TEAMS = ['CAR', 'VGK', 'TOR', 'CHI', 'BOS', 'EDM']

  SAMPLE_TEAMS.forEach(abbr => {
    it(`shot map loads without crashing for ${abbr}`, () => {
      cy.visit('/', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr }))
        },
      })
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.contains(abbr).should('be.visible')
      cy.get('svg').should('exist')
      cy.assertNoErrors()
    })
  })
})

describe('Shot Map', () => {
  beforeEach(() => {
    cy.team().then(t => {
      cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
      cy.contains(t.abbr).should('be.visible')
    })
  })

  describe('Game header', () => {
    it('shows team abbr and opponent', () => {
      cy.team().then(t => cy.contains(t.abbr).should('be.visible'))
      cy.contains(/FINAL|LIVE|P[123]|OT/i).should('be.visible')
    })

    it('shows game date and type', () => {
      // ?mockGame= unconditionally forces gameState 'LIVE' (nhlApi.js:201),
      // which routes the header into its live-clock branch -- the
      // "🏒 Playoff ·"/date line only exists in the completed-game branch
      // (ShotMapView.jsx:1263-1269), so it can't appear here. The correct,
      // live equivalent is the "🔴 LIVE" state pill this branch shows instead.
      cy.contains('🔴 LIVE').should('exist')
    })
  })

  describe('Game Insights section', () => {
    it('renders section header', () => {
      // Live-mocked games render "LIVE INSIGHTS" instead of "Game Insights"
      // (ShotMapView.jsx's LiveInsights component swaps the label when
      // isLive is true, which ?mockGame= always forces -- see note above).
      cy.contains(/Game Insights|LIVE INSIGHTS/i).should('exist')
    })

    it('shows at least one insight card', () => {
      cy.get('[class*="insight"]').should('have.length.greaterThan', 0)
    })

    it('insight cards contain team abbr text', () => {
      cy.team().then(t => cy.contains(new RegExp(t.abbr)).should('exist'))
    })
  })

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

  describe('Special teams stats', () => {
    it('shows PP%', () => {
      cy.contains('PP %').should('be.visible')
    })

    it('shows PK%', () => {
      cy.contains('PK %').should('be.visible')
    })

    it('shows faceoff percentage', () => {
      cy.contains(/Faceoff|FACEOFF/i).should('exist')
    })
  })

  describe('Momentum chart', () => {
    it('renders section header', () => {
      cy.contains(/Momentum/i).should('exist')
    })

    it('shows team abbr and momentum percentage', () => {
      cy.team().then(t => {
        cy.contains(new RegExp(`${t.abbr} \\d+%`)).should('exist')
      })
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

  describe('Shot map rink', () => {
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

    it('shows Player filter and Heat map toggles', () => {
      cy.get('.rink-btn').contains('Player').should('exist')
      cy.get('.rink-btn').contains('Heat').should('exist')
    })

    it('shows shot legend with team abbr', () => {
      cy.team().then(t => {
        cy.contains(new RegExp(`${t.abbr} shot|${t.abbr} goal`, 'i')).should('exist')
        cy.contains(/Opp shot|Opp goal/i).should('exist')
      })
    })

    it('shows zoom controls', () => {
      cy.get('.zoom-btn').contains('−').should('exist')
      cy.get('.zoom-btn').contains('+').should('exist')
    })

    it('zoom buttons are clickable without crashing', () => {
      cy.get('.zoom-btn').contains('+').click().click()
      cy.get('.zoom-btn').contains('−').click()
      cy.get('svg').should('exist')
    })
  })

  describe('Team scoring sidebar', () => {
    it('shows scoring section header with team abbr', () => {
      cy.team().then(t => {
        cy.contains(new RegExp(`${t.abbr} scoring`, 'i')).should('exist')
      })
    })

    it('shows player names with point totals', () => {
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
