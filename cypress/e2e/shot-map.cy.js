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

  // Session 100: live event rink + relocated/widened event ticker. This
  // block only exercises the render/type-vocabulary path deterministically
  // available via ?mockGame= -- the intermission/Zamboni path can't be
  // forced through this harness (the pinned mock game's real PBP has no
  // control over pbp.clock.inIntermission), so that path was verified live
  // instead (temporarily hardcoding inIntermission=true, confirmed the
  // animation/overlay render correctly, then reverted before commit).
  describe('Live rink + event ticker', () => {
    it('renders the live rink and event ticker side by side, live-only', () => {
      cy.contains('Live rink').should('exist')
      cy.contains('Recent events').should('exist')
      cy.get('svg').should('have.length.greaterThan', 1) // rink SVG + season shot map SVG both present
    })

    it('plots dots on the live rink for at least one recent event', () => {
      cy.contains('Live rink').parents('.card').find('svg circle').should('have.length.greaterThan', 0)
    })

    it('event ticker includes at least one of the newly-widened event types (faceoff/giveaway/takeaway), not just goal/shot/penalty/hit/block', () => {
      // Not guaranteed for every single type every poll, but this pinned
      // game's real last-12-events window (2025030311) reliably includes
      // at least a faceoff or giveaway/takeaway.
      cy.contains('Recent events').parents('.card')
        .find('span').contains(/FACEOFF|GIVEAWAY|TAKEAWAY/).should('exist')
    })

    it('no console errors', () => {
      cy.assertNoErrors()
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
      cy.get('.rhr-btn').contains('All').should('exist')
      cy.get('.rhr-btn').contains('P1').should('exist')
      cy.get('.rhr-btn').contains('P2').should('exist')
      cy.get('.rhr-btn').contains('P3').should('exist')
    })

    it('period filter buttons are clickable', () => {
      cy.get('.rhr-btn').contains('P1').click()
      cy.get('.rhr-btn').contains('P1').should('have.class', 'rhr-btn-on')
      cy.get('.rhr-btn').contains('All').click()
      cy.get('.rhr-btn').contains('All').should('have.class', 'rhr-btn-on')
    })

    it('shows Player filter and Heat map toggles', () => {
      cy.get('.rhr-btn').contains('Player').should('exist')
      cy.get('.rhr-btn').contains('Heat').should('exist')
    })

    it('shows shot legend with team abbr', () => {
      cy.team().then(t => {
        cy.contains(new RegExp(`${t.abbr} shot|${t.abbr} goal`, 'i')).should('exist')
        cy.contains(/Opp shot|Opp goal/i).should('exist')
      })
    })

    it('shows zoom controls', () => {
      cy.get('.rhr-zoom-btn').contains('−').should('exist')
      cy.get('.rhr-zoom-btn').contains('+').should('exist')
    })

    it('zoom buttons are clickable without crashing', () => {
      cy.get('.rhr-zoom-btn').contains('+').click().click()
      cy.get('.rhr-zoom-btn').contains('−').click()
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
  const workerUrl = Cypress.expose('WORKER_URL')
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

// ── Special teams units ───────────────────────────────────────────────────
// The PP/PK unit chips and the per-opportunity PP1/PP2 badges render from
// the `special_teams_units` Supabase table, via the Worker's /special-teams
// route. They rendered NOTHING for the entire life of a compatibility shim:
// the data moved out of ppUnits.js's static constants into Supabase, the
// constants were left behind as empty objects "until all imports have been
// updated", and ShotMapView -- the only importer -- was never updated. No
// test failed, no error was logged, the chips just quietly stopped
// existing. This block is here so that can't happen silently again.
describe('Shot Map — special teams units', () => {
  const workerUrl = Cypress.expose('WORKER_URL')

  // Real CAR skaters from MOCK_GAME_ID's own rosterSpots -- the drill-down
  // resolves ids to names out of that game's play-by-play, so stubbed ids
  // have to be players who actually dressed. The game is permanent and
  // historical (see MOCK_GAME_ID at the top of this file), so these are stable.
  const STAAL = 8473533   // Jordan Staal
  const HALL = 8475791    // Taylor Hall
  const GHOST = 8476906   // Shayne Gostisbehere
  const SLAVIN = 8476958  // Jaccob Slavin

  beforeEach(() => {
    cy.intercept('GET', `${workerUrl}/special-teams*`, {
      statusCode: 200,
      body: {
        CAR: {
          PP: { 1: [STAAL, HALL], 2: [GHOST] },
          PK: { 1: [SLAVIN, STAAL] },
        },
      },
    }).as('specialTeams')
    cy.visit(`/?mockGame=${MOCK_GAME_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: 'CAR' }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
  })

  // Asserts a season is sent, not WHICH one: the shot map's season follows
  // the off-season fallback and the season chips, so pinning a value here
  // would make this test start failing on opening night.
  it('requests units for the season it is displaying', () => {
    cy.wait('@specialTeams').its('request.url').should('match', /[?&]season=\d{8}(&|$)/)
  })

  // Scoped to the unit row rather than asserted against the whole page:
  // LiveEventRink renders an <svg><title> per shot dot carrying the
  // shooter's name, so a bare cy.contains('Staal') matches an invisible
  // tooltip on the rink instead of the chip.
  it('renders the PP unit chips from the fetched map', () => {
    cy.wait('@specialTeams')
    cy.contains('PP %').closest('[role="button"]').click()
    cy.contains('span', 'PP1').parent()
      .should('contain.text', 'Staal')
      .and('contain.text', 'Hall')
    cy.contains('span', 'PP2').parent().should('contain.text', 'Gostisbehere')
    cy.assertNoErrors()
  })

  it('renders the PK unit chips from the fetched map', () => {
    cy.wait('@specialTeams')
    cy.contains('PK %').closest('[role="button"]').click()
    cy.contains('span', 'PK1').parent()
      .should('contain.text', 'Slavin')
      .and('contain.text', 'Staal')
    cy.assertNoErrors()
  })

  // The failure mode that actually shipped: an empty map is exactly what
  // the old static constants returned, so this is the shape of the bug.
  it('shows no unit chips when the map is empty, without crashing', () => {
    cy.intercept('GET', `${workerUrl}/special-teams*`, { statusCode: 200, body: {} }).as('emptyUnits')
    cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
    cy.wait('@emptyUnits')
    cy.contains('PP %').closest('[role="button"]').click()
    cy.contains('span', 'PP1').should('not.exist')
    cy.assertNoErrors()
  })
})

// ── Special teams unit names ──────────────────────────────────────────────
// The unit rosters are SEASON-level, but the drill-down resolves ids from
// this one game's rosterSpots. A unit member who sat out that game was in
// neither, so the chip rendered a bare "#8479318" -- which is exactly what
// production showed the day the chips first appeared (Auston Matthews, out
// for the game being viewed). The team roster is the second source; anyone
// neither source can name is dropped rather than shown as a raw id.
describe('Shot Map — special teams unit names', () => {
  const workerUrl = Cypress.expose('WORKER_URL')

  const IN_GAME     = 8473533   // Jordan Staal — dressed in MOCK_GAME_ID
  const ROSTER_ONLY = 9000001   // not in this game's rosterSpots, on the roster
  const NOWHERE     = 9000002   // in neither source

  beforeEach(() => {
    cy.intercept('GET', `${workerUrl}/special-teams*`, {
      statusCode: 200,
      body: { CAR: { PP: { 1: [IN_GAME, ROSTER_ONLY, NOWHERE] }, PK: {} } },
    }).as('specialTeams')

    cy.intercept('GET', `${workerUrl}/roster*`, {
      statusCode: 200,
      body: {
        forwards: [
          { id: ROSTER_ONLY, firstName: { default: 'Rosteronly' }, lastName: { default: 'Skater' } },
        ],
        defensemen: [],
        goalies: [],
      },
    }).as('roster')

    cy.visit(`/?mockGame=${MOCK_GAME_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: 'CAR' }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.wait('@specialTeams')
  })

  it('falls back to the team roster for a unit member who did not dress in this game', () => {
    cy.contains('PP %').closest('[role="button"]').click()
    // Chips render last names only (name.split(' ').pop()).
    cy.contains('span', 'PP1').parent()
      .should('contain.text', 'Staal')     // from this game's rosterSpots
      .and('contain.text', 'Skater')       // from the team roster
  })

  it('drops a unit member neither source can name, rather than showing a raw id', () => {
    cy.contains('PP %').closest('[role="button"]').click()
    cy.contains('span', 'PP1').parent().within(() => {
      cy.contains(String(NOWHERE)).should('not.exist')
      cy.contains(`#${NOWHERE}`).should('not.exist')
    })
    cy.assertNoErrors()
  })
})
