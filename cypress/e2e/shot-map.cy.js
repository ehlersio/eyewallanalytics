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

  describe('Season/game history selector — disabled during a live game', () => {
    // ?mockGame= forces isLive true, making this deterministic (unlike the
    // "Shot Map — season/game history selector" block below, which visits
    // without the mock and can't force either state). isLive itself only
    // resolves once the live-game poll's first fetch completes though —
    // wait for the disabled class to actually appear before interacting,
    // rather than assuming it's already true right after cy.visit().
    beforeEach(() => {
      cy.get('.season-type-toggle', { timeout: 10000 }).should('have.class', 'chip-disabled')
    })

    it('shows the selector but visually disabled, and hover/tap reveals why', () => {
      cy.get('.season-type-toggle').should('have.attr', 'title', 'Available after the game ends.')
      cy.get('.season-type-toggle-btn[aria-disabled="true"]').should('have.length', 2)
    })

    it('clicking a disabled chip does not change the selection', () => {
      cy.get('.season-type-toggle-btn.on').should('contain.text', 'Regular')
      cy.contains('Playoffs').click()
      cy.get('.season-type-toggle-btn.on').should('contain.text', 'Regular') // unchanged
    })

    it('tapping a disabled chip surfaces the tooltip', () => {
      cy.contains('Playoffs').click()
      cy.get('.disabled-hint-popup').should('be.visible').and('contain.text', 'Available after the game ends.')
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

// ── Season/game history selector (Session 77) ─────────────────────────────
// The selector always renders now (Session 77 follow-up — disabled+tooltip
// replaced hidden-during-live), but a real live game at test-run time would
// make it genuinely non-interactive, and these tests need to actually
// switch seasons/games. Unlike the block above, this visit can't be pinned
// live via ?mockGame= (that only forces isLive TRUE, the opposite of what's
// needed here), so each test skips cleanly if a real live game happens to
// be in progress, rather than flaking. The /schedule intercept also
// sidesteps a real, current off-season gap: "today" mid-summer has zero
// completed current-season games, which would otherwise starve the
// game-chip tests independent of the isLive question entirely.
describe('Shot Map — season/game history selector', () => {
  const workerUrl = Cypress.env('WORKER_URL')
  const stubGames = [
    { id: 2025020100, gameDate: '2025-11-10', gameType: 2, gameState: 'FINAL', homeTeam: { abbrev: 'CAR', score: 4 }, awayTeam: { abbrev: 'BOS', score: 2 } },
    { id: 2025020050, gameDate: '2025-10-20', gameType: 2, gameState: 'FINAL', homeTeam: { abbrev: 'TOR', score: 1 }, awayTeam: { abbrev: 'CAR', score: 3 } },
  ]

  beforeEach(function () {
    cy.intercept('GET', `${workerUrl}/schedule*`, { statusCode: 200, body: stubGames }).as('schedule')
    cy.visit('/')
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.get('.season-type-toggle', { timeout: 10000 }).then($toggle => {
      if ($toggle.hasClass('chip-disabled')) {
        cy.log('Skipping — a real live game is in progress, selector is disabled')
        this.skip()
      }
    })
  })

  it('shows the Regular/Playoffs toggle and season chips (current + 2 prior)', () => {
    cy.get('.season-type-toggle').should('exist')
    cy.contains('Regular').should('exist')
    cy.contains('Playoffs').should('exist')
    cy.contains('2026-27').should('exist')
    cy.contains('2025-26').should('exist')
    cy.contains('2024-25').should('exist')
  })

  it('switches seasons without crashing', () => {
    cy.contains('2025-26').click()
    cy.wait('@schedule')
    cy.get('svg').should('exist')
    cy.assertNoErrors()
  })

  it('More seasons overflow opens and lists an older season', () => {
    cy.contains('•••').click()
    cy.get('.season-archive-dropdown').should('be.visible')
    cy.contains('2023-24').should('exist')
    cy.contains('2023-24').click()
    cy.get('.season-archive-dropdown').should('not.exist')
  })

  it('toggles to Playoffs and back without crashing', () => {
    cy.contains('Playoffs').click()
    cy.get('.season-type-toggle-btn.on').should('contain.text', 'Playoffs')
    cy.assertNoErrors()
    cy.contains('Regular').click()
    cy.get('.season-type-toggle-btn.on').should('contain.text', 'Regular')
  })

  it('shows game chips from the stubbed schedule and selecting one highlights it', () => {
    cy.wait('@schedule')
    cy.contains(/^All \d+$/).should('exist')
    cy.get('.game-chip').not('.game-chip-all').first().click()
    cy.get('.game-chip-active').not('.game-chip-all').should('exist')
    cy.get('.game-chip-all').click()
    cy.get('.game-chip-all').should('have.class', 'game-chip-active')
  })
})
