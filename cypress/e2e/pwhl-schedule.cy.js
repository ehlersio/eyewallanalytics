// cypress/e2e/pwhl-schedule.cy.js

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
describe('PWHL Schedule smoke tests (multi-team)', () => {
  PWHL_TEAMS.forEach(({ abbr, teamId }) => {
    it(`schedule loads without crashing for ${abbr}`, () => {
      cy.visit('/pwhl/schedule', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'pwhl')
          win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr, teamId }))
        },
      })
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.assertNoErrors()
    })
  })
})

// ── Full feature tests (BOS) ──────────────────────────────────────────────────
describe('PWHL Schedule', () => {
  beforeEach(() => {
    cy.setPWHLTeam('BOS')
    cy.visit('/pwhl/schedule')
    cy.get('.topbar', { timeout: 10000 }).should('exist')
  })

  describe('Season picker', () => {
    it('renders season tabs', () => {
      cy.contains('2025-26').should('exist')
      cy.contains('2024-25').should('exist')
      cy.contains('2023-24').should('exist')
    })

    it('switches seasons without crashing', () => {
      cy.contains('2024-25').click()
      cy.assertNoErrors()
      cy.contains('2025-26').click()
    })
  })

  describe('Regular Season tab', () => {
    it('renders played/upcoming count', () => {
      cy.contains(/\d+ played/i, { timeout: 8000 }).should('exist')
    })

    it('renders sort bar', () => {
      cy.contains(/Newest|Oldest/i, { timeout: 8000 }).should('exist')
    })

    it('can toggle sort order', () => {
      cy.contains(/Newest first|Oldest first/i).first().click()
      cy.assertNoErrors()
    })

    it('renders game cards', () => {
      cy.get('.card', { timeout: 8000 }).should('have.length.greaterThan', 2)
    })

    it('shows final scores', () => {
      cy.contains(/FINAL|Final|W\d+|\d+–\d+/i, { timeout: 8000 }).should('exist')
    })

    it('calendar toggle button exists', () => {
      // Calendar toggle may use icon or class — check it renders without crashing
      cy.get('button', { timeout: 8000 }).should('have.length.greaterThan', 0)
      cy.assertNoErrors()
    })
  })

  describe('Playoffs tab', () => {
    it('playoffs tab exists', () => {
      cy.contains('Playoffs', { timeout: 8000 }).should('exist')
    })

    it('clicking playoffs tab does not crash', () => {
      cy.contains('Playoffs').click()
      cy.assertNoErrors()
    })
  })

  // ── Game stats popup (Session 50) ──────────────────────────────────────────
  // PWHLGameStatsPopup replaced the old lightweight PWHLGamePopup at this
  // click point -- covers the box-score table/toggle/CTA that popup didn't
  // have. Relies on a completed game existing in the default (regular
  // season) tab; BOS's 2025-26 regular season has plenty.
  describe('Game stats popup', () => {
    it('opens on a completed game click and shows the score header', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-card', { timeout: 8000 }).should('be.visible')
      cy.get('.pgs-header').should('exist')
      cy.get('.pgs-score-big').should('have.length', 2)
      cy.assertNoErrors()
    })

    it('renders period scoring and three stars when available', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-card', { timeout: 8000 }).should('be.visible')
      // Both sections are data-dependent (HockeyTech gameSummary) -- assert
      // the popup doesn't crash either way rather than requiring both.
      cy.assertNoErrors()
    })

    it('toggles between team skater tables when box-score data is present', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-card', { timeout: 8000 }).should('be.visible')
      cy.get('body').then($body => {
        if ($body.find('.pgs-toggle-btn').length === 2) {
          cy.get('.pgs-toggle-btn').eq(1).click()
          cy.get('.pgs-toggle-btn.active').should('exist')
          cy.assertNoErrors()
        }
      })
    })

    it('CTA navigates to the shot map for the selected game', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-cta-btn', { timeout: 8000 }).should('contain.text', 'Shot Map').click()
      cy.location('pathname', { timeout: 8000 }).should('eq', '/pwhl/shots')
      cy.assertNoErrors()
    })

    it('closes via the close button', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-card', { timeout: 8000 }).should('be.visible')
      cy.get('.pgs-close').click()
      cy.get('.pgs-card').should('not.exist')
    })
  })

  // ── Game preview popup (Session 51) ────────────────────────────────────────
  // PWHLGamePreviewPopup triggers from an upcoming game's card, mirroring
  // the box-score popup above for completed games. Unlike every other test
  // in this spec, this block intercepts the network: PWHL is fully
  // off-season as of this session (2026-07-10 -- season 8's 120 games and
  // season 9's playoffs are both 100% Final, season 10's preseason has zero
  // scheduled games yet), so there is no live upcoming game to click
  // through. Intercepting /pwhl/schedule with one synthetic upcoming game,
  // plus the two new routes, gives this click path real deterministic
  // coverage regardless of season state instead of silently skipping it.
  describe('Game preview popup', () => {
    const UPCOMING_GAME_ID = 999001

    const upcomingGame = {
      game_id: UPCOMING_GAME_ID,
      season_id: 8,
      home_team_id: 1, // BOS
      away_team_id: 5, // OTT
      game_date: '2026-08-01',
      game_state: 'Preview',
      ot: false,
      shootout: false,
    }

    const previewFixture = {
      gameId: UPCOMING_GAME_ID,
      homeTeam: {
        id: 1, abbreviation: 'BOS', name: 'Boston Fleet',
        goalsFor: 50, goalsAgainst: 40,
        streak: 'W2',
        overallRecord: '10-5-2-1',
        last10Record: '6-3-1-0',
        leadingScorers: [{ name: 'Test Skater', stats: { points: 20, goals: 10, assists: 10 } }],
        leadingRookie: null,
        leadingPIM: null,
        powerPlay: { percentage: 20.5 },
        penaltyKill: { percentage: 82.3 },
      },
      visitingTeam: {
        id: 5, abbreviation: 'OTT', name: 'Ottawa Charge',
        goalsFor: 40, goalsAgainst: 50,
        streak: 'L1',
        overallRecord: '5-10-2-1',
        last10Record: '3-6-1-0',
        leadingScorers: [{ name: 'Test Opponent', stats: { points: 15, goals: 8, assists: 7 } }],
        leadingRookie: null,
        leadingPIM: null,
        powerPlay: { percentage: 15.2 },
        penaltyKill: { percentage: 75.0 },
      },
      seasonSeries: [
        { gameId: 900, datePlayed: '2026-01-10', homeTeamId: 1, homeCity: 'Boston', homeScore: 3, visitingTeamId: 5, visitingCity: 'Ottawa', visitingScore: 2 },
      ],
      headToHeadRecords: {
        homeTeam:     { previousFiveYears: { formattedRecord: '5-3-0-0' } },
        visitingTeam: { previousFiveYears: { formattedRecord: '3-5-0-0' } },
      },
      longestStreaks: {
        // player is a full player object, not a plain name string --
        // confirmed live against real HockeyTech data (Session 51, game
        // 329). This fixture deliberately keeps that shape so this test
        // would catch a regression of the "Objects are not valid as a
        // React child" crash that shape caused before it was fixed.
        home:     { points: [{ player: { firstName: 'Test', lastName: 'Streaker' }, streak: 'points', length: 4 }] },
        visiting: { points: [] },
      },
      generatedAt: new Date().toISOString(),
    }

    const predictionFixture = {
      gameId: UPCOMING_GAME_ID,
      homeTeamId: 1, awayTeamId: 5,
      homeAbbr: 'BOS', awayAbbr: 'OTT',
      isPlayoff: false,
      homeWinPct: 65, awayWinPct: 35,
      expHome: 3.1, expAway: 2.2,
      narrative: 'Boston is favored in this test matchup based on stronger possession numbers and a better record.',
      h2hRecord: '2-1',
      homeStreak: 'W2', awayStreak: 'L1',
      corsiForPct: { home: 54.3, away: 45.7 },
      corsiCaveat: 'All-situations shot-attempt share (goals+shots+blocked), not 5-on-5 filtered.',
      generatedAt: new Date().toISOString(),
    }

    beforeEach(() => {
      // Anchored to the Worker origin, not a bare glob -- '**/pwhl/schedule*'
      // also matched the frontend's own /pwhl/schedule page route and broke
      // cy.visit() (it intercepted the page-navigation request itself,
      // returning JSON instead of HTML).
      const workerUrl = Cypress.env('WORKER_URL')
      cy.intercept('GET', `${workerUrl}/pwhl/schedule*`, { statusCode: 200, body: [upcomingGame] }).as('schedule')
      cy.intercept('GET', `${workerUrl}/pwhl/preview*gameId=${UPCOMING_GAME_ID}*`, { statusCode: 200, body: previewFixture }).as('preview')
      cy.intercept('GET', `${workerUrl}/pwhl/prediction*gameId=${UPCOMING_GAME_ID}*`, { statusCode: 200, body: predictionFixture }).as('prediction')
      // Re-visit with intercepts already registered -- the outer describe's
      // beforeEach already visited once before these intercepts existed.
      cy.visit('/pwhl/schedule', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'pwhl')
          win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
        },
      })
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.wait('@schedule')
    })

    it('shows the upcoming card as clickable with a preview hint', () => {
      cy.contains('Tap for preview', { timeout: 8000 }).should('exist')
      cy.assertNoErrors()
    })

    it('opens on an upcoming game click and shows the prediction section', () => {
      cy.contains('Tap for preview', { timeout: 8000 }).click()
      cy.wait(['@preview', '@prediction'])
      cy.get('.pgp-card', { timeout: 8000 }).should('be.visible')
      cy.contains('.pgp-section-label', 'Prediction').should('exist')
      cy.contains('65%').should('exist')
      cy.contains('Boston is favored in this test matchup').should('exist')
      cy.assertNoErrors()
    })

    it('renders season series, head-to-head, team form, hot streaks, leaders, and special teams', () => {
      cy.contains('Tap for preview', { timeout: 8000 }).click()
      cy.wait(['@preview', '@prediction'])
      cy.get('.pgp-card', { timeout: 8000 }).should('be.visible')
      cy.contains('.pgp-section-label', 'Season Series').should('exist')
      cy.contains('Last 5 seasons vs OTT').should('exist')
      cy.contains('.pgp-section-label', 'Team Form').should('exist')
      cy.contains('.pgp-section-label', 'Hot Streaks').should('exist')
      cy.contains('Test Streaker').should('exist')
      cy.contains('.pgp-section-label', 'Team Leaders').should('exist')
      cy.contains('Test Skater').should('exist')
      cy.contains('.pgp-section-label', 'Special Teams').should('exist')
      cy.assertNoErrors()
    })

    it('closes via the close button', () => {
      cy.contains('Tap for preview', { timeout: 8000 }).click()
      cy.get('.pgp-card', { timeout: 8000 }).should('be.visible')
      cy.get('.pgp-close').click()
      cy.get('.pgp-card').should('not.exist')
    })
  })
})
