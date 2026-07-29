// cypress/e2e/league.cy.js

// ── Offseason guard ───────────────────────────────────────────
// Mirrors the pattern in schedule.cy.js.
// Playoff bracket is only available April–June; tests that depend on it
// are skipped automatically outside those months.
const month = new Date().getMonth() + 1 // 1 = Jan, 12 = Dec
const OFFSEASON = Cypress.env('OFFSEASON') !== undefined
  ? Cypress.env('OFFSEASON') === true || Cypress.env('OFFSEASON') === 'true'
  : month < 4 || month > 6

function liveSeriesIt(title, fn) {
  it(title, function () {
    if (OFFSEASON) this.skip()
    fn()
  })
}

const WORKER_URL_LEAGUE = Cypress.env('VITE_WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev'

// ── Standings / Power rankings / Leaders — zero-data empty states ──
// Regression coverage for the Session 61 NHL season-flip prep: once the
// season live-flips ahead of puck drop, standings/team-seasons/leaders
// endpoints genuinely return zero rows (rosters + schedule exist, no games
// played yet) until real games start. Before this fix, Standings/Leaders
// rendered blank headers with no explanation, and Power Rankings' loading
// skeleton spun forever (`loading = !standings?.length || xgLoading` never
// resolved once standings was a real, empty array) — all three read as
// "broken," not "season hasn't started." Stubbed to zero rows here since
// the real season is rarely (if ever) actually in this state.
//
// Placed as the very first describe block in this spec, before even the
// smoke tests — the leaders endpoints are keyed by season/gameType only
// (not by team), so any earlier real page visit for ANY team populates
// Chromium's HTTP cache for these exact URLs; a later cy.intercept() never
// sees the request at all once that's happened (confirmed: this test
// failed with "No request ever occurred" only when something upstream in
// the same spec file had visited /league for real first, and passed
// instantly in isolation or when run first).

describe('Standings / Power rankings / Leaders — season-not-started empty state', () => {
  beforeEach(() => {
    cy.intercept('GET', `${WORKER_URL_LEAGUE}/cache/standings*`, { body: [] }).as('getStandings')
    cy.intercept('GET', '**/nhl-api/v1/skater-stats-leaders/**', { body: { points: [], goals: [] } }).as('getSkaterLeaders')
    cy.intercept('GET', '**/nhl-api/v1/goalie-stats-leaders/**', { body: { savePctg: [], goalsAgainstAverage: [] } }).as('getGoalieLeaders')
    cy.setTeam('CAR')
    cy.visit('/league')
    cy.get('.league-view', { timeout: 15000 }).should('be.visible')
  })

  it('Standings tab shows the season-not-started message instead of blank headers/table', () => {
    cy.get('.lv-season-empty').should('be.visible').and('contain', "hasn't started yet")
    cy.get('.lv-table').should('not.exist')
    cy.get('.lv-conf-label').should('not.exist')
  })

  it('Power rankings tab shows the season-not-started message instead of an infinite skeleton', () => {
    cy.get('.league-tab').contains('Power rankings').click()
    cy.get('.lv-season-empty').should('be.visible').and('contain', 'Power rankings will appear')
    cy.get('.lv-skeleton-wrap').should('not.exist')
    cy.get('.pr-row').should('not.exist')
  })

  it('Leaders tab shows the season-not-started message instead of four blank cards', () => {
    cy.get('.league-tab').contains('Leaders').click()
    cy.get('.lv-season-empty').should('be.visible').and('contain', 'Stat leaders will appear')
    cy.get('.lv-leaders-card').should('not.exist')
  })
})

// ── Smoke tests — all 32 teams ────────────────────────────────
// Verifies the League page loads without JS errors for a sample of teams.

describe('League page smoke tests (all teams)', () => {
  it('league page loads for a sample of teams without JS errors', () => {
    cy.fixture('teams').then(teams => {
      const sample = teams.filter(t =>
        ['CAR', 'VGK', 'TOR', 'CHI', 'BOS', 'EDM', 'NYR', 'MTL'].includes(t.abbr)
      )
      sample.forEach(team => {
        cy.visit('/league', {
          onBeforeLoad(win) {
            win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: team.abbr }))
          }
        })
        cy.get('.league-view', { timeout: 15000 }).should('be.visible')
        cy.assertNoErrors()
      })
    })
  })
})

// ── Full feature tests ────────────────────────────────────────

describe('League page — CAR', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      if (err.name === 'ReferenceError' || err.name === 'TypeError') throw err
      return false
    })
    cy.setTeam('CAR')
    cy.visit('/league')
    cy.get('.league-view', { timeout: 15000 }).should('be.visible')
  })

  // ── Tab bar ──────────────────────────────────────────────────

  it('renders all five tab buttons', () => {
    cy.get('.league-tab').should('have.length', 5)
    cy.get('.league-tab').eq(0).should('contain', 'Standings')
    cy.get('.league-tab').eq(1).should('contain', 'Playoff bracket')
    cy.get('.league-tab').eq(2).should('contain', 'Leaders')
    cy.get('.league-tab').eq(3).should('contain', 'Power rankings')
  })

  it('Standings tab is active by default', () => {
    cy.get('.league-tab').eq(0).should('have.class', 'league-tab--active')
  })

  it('clicking Leaders makes it the active tab', () => {
    cy.get('.league-tab').contains('Leaders').click()
    cy.get('.league-tab').contains('Leaders').should('have.class', 'league-tab--active')
    cy.get('.league-tab').contains('Standings').should('not.have.class', 'league-tab--active')
  })

  it('clicking Playoff bracket makes it the active tab', () => {
    cy.get('.league-tab').contains('Playoff bracket').click()
    cy.get('.league-tab').contains('Playoff bracket').should('have.class', 'league-tab--active')
  })

  // ── Standings tab ─────────────────────────────────────────────

  describe('Standings tab', () => {
    beforeEach(function () {
      cy.skipIfEither('.lv-season-empty', '.lv-table')
    })

    it('shows the four filter buttons', () => {
      cy.get('.lv-filter-btn').should('have.length', 4)
      cy.get('.lv-filter-btn').eq(0).should('contain', 'By division')
      cy.get('.lv-filter-btn').eq(1).should('contain', 'By conference')
      cy.get('.lv-filter-btn').eq(2).should('contain', 'League')
      cy.get('.lv-filter-btn').eq(3).should('contain', 'Wild card')
    })

    it('"By division" is active by default', () => {
      cy.get('.lv-filter-btn').eq(0).should('have.class', 'lv-filter-btn--active')
    })

    it('shows Eastern and Western conference labels in division view', () => {
      cy.contains('Eastern Conference').should('exist')
      cy.contains('Western Conference').should('exist')
    })

    it('shows 32 teams total across all division tables', () => {
      cy.get('.lv-row').should('have.length', 32)
    })

    it('shows CAR highlighted with YOU badge', () => {
      cy.get('.lv-row--you').should('exist')
    })

    it('shows column headers GP W L OTL PTS L10 STRK', () => {
      cy.get('.lv-th').should('contain', 'GP')
      cy.get('.lv-th').should('contain', 'PTS')
      cy.get('.lv-th').should('contain', 'L10')
      cy.get('.lv-th').should('contain', 'STRK')
    })

    it('shows L10 dot indicators', () => {
      cy.get('.l10-dots').first().should('be.visible')
      cy.get('.l10-dot').should('have.length.greaterThan', 0)
    })

    it('switching to By conference view shows conference labels', () => {
      cy.get('.lv-filter-btn').contains('By conference').click()
      cy.get('.lv-filter-btn').contains('By conference').should('have.class', 'lv-filter-btn--active')
      cy.get('.lv-conf-label').should('have.length.gte', 2)
      cy.contains('Eastern Conference').should('exist')
      cy.contains('Western Conference').should('exist')
    })

    it('conference view shows 32 teams', () => {
      cy.get('.lv-filter-btn').contains('By conference').click()
      cy.get('.lv-row').should('have.length', 32)
    })

    it('switching to League view shows a single table with 32 rows', () => {
      cy.get('.lv-filter-btn').contains('League').click()
      cy.get('.lv-row').should('have.length', 32)
      // Only one card (no division sub-headers)
      cy.get('.lv-div-card').should('have.length', 1)
    })

    it('League view rows are sorted by points descending (rank 1 at top)', () => {
      cy.get('.lv-filter-btn').contains('League').click()
      cy.get('.lv-td--rank').first().should('contain', '1')
    })

    it('switching to Wild card view shows division leaders and wild card race sections', () => {
      cy.get('.lv-filter-btn').contains('Wild card').click()
      cy.contains(/Division leaders/i).should('exist')
      cy.contains(/Wild card race/i).should('exist')
    })

    it('wild card view shows exactly 2 wild card race tables (one per conference)', () => {
      cy.get('.lv-filter-btn').contains('Wild card').click()
      cy.get('.lv-div-card--wc').should('have.length', 2)
    })

    it('legend shows clinch and wild card indicators', () => {
      cy.get('.lv-legend').should('be.visible')
      cy.contains(/Clinched/i).should('exist')
      cy.contains(/Wild card position/i).should('exist')
    })
  })

  // ── Playoff bracket tab ───────────────────────────────────────

  describe('Playoff bracket tab', () => {
    beforeEach(() => cy.get('.league-tab').contains('Playoff bracket').click())

    it('shows bracket panel content area', () => {
      cy.get('.league-content').should('be.visible')
    })

    // Offseason: API returns null → OFFSEASON_BRACKET fallback always shows.
    // We never show the empty-state message unless we're mid-playoffs with a
    // genuinely bad API response — not testable in e2e, so we assert the bracket.
    it('shows bracket root with round columns', () => {
      cy.get('.bkt-root', { timeout: 10000 }).should('be.visible')
      cy.get('.bkt-bracket').should('exist')
      cy.get('.bkt-round-col').should('have.length.gte', 2)
    })

    it('shows series cards with team abbreviations', () => {
      cy.get('.bkt-card').should('have.length.gte', 1)
      cy.get('.bkt-abbr').first().invoke('text').should('match', /^[A-Z]{2,3}$/)
    })

    it('shows win dot indicators', () => {
      cy.get('.bkt-dots').should('have.length.gte', 1)
      cy.get('.bkt-dot').should('have.length.gte', 4)
    })

    it('shows series status labels', () => {
      cy.get('.bkt-series-label').first().invoke('text')
        .should('match', /wins|leads|Tied/i)
    })

    it('shows Stanley Cup Final column', () => {
      cy.get('.bkt-final-col').should('exist')
      cy.get('.bkt-card--final').should('exist')
    })

    it('shows champion line with trophy when series is complete', () => {
      cy.get('.bkt-winner-line').should('exist')
      cy.get('.bkt-winner-line').invoke('text').should('include', '🏆')
    })

    it('PRIMARY team card has primary border accent', () => {
      cy.get('.bkt-card--primary').should('exist')
    })

    it('round headers are visible', () => {
      cy.get('.bkt-round-label').should('have.length.gte', 2)
      cy.get('.bkt-round-label').first().invoke('text')
        .should('match', /First round|Second round|Conf\. finals|Stanley Cup Final/i)
    })

    liveSeriesIt('in-season: live bracket loads without fallback data', () => {
      // If API returns data, parseBracketData should succeed and we still
      // see the same bracket UI — just with live series results
      cy.get('.bkt-root').should('be.visible')
      cy.get('.bkt-card').should('have.length.gte', 1)
    })

    it('completed series cards have the clickable class', () => {
      cy.get('.bkt-card--clickable').should('have.length.gte', 1)
    })

    it('clicking a completed series card opens the series modal', () => {
      cy.get('.bkt-card--clickable').first().click()
      cy.get('.series-modal', { timeout: 3000 }).should('be.visible')
    })

    it('series modal shows both team abbreviations', () => {
      cy.get('.bkt-card--clickable').first().click()
      cy.get('.series-modal', { timeout: 3000 }).should('be.visible')
      cy.get('.series-modal__abbrev').should('have.length', 2)
      cy.get('.series-modal__abbrev').first().invoke('text').should('match', /^[A-Z]{2,3}$/)
    })

    it('series modal shows win dots for both teams', () => {
      cy.get('.bkt-card--clickable').first().click()
      cy.get('.series-modal', { timeout: 3000 }).should('be.visible')
      cy.get('.series-modal .bkt-dots').should('have.length', 2)
    })

    // Per-game data is only fetchable for OFFSEASON_BRACKET's series once
    // the app's "current season" still matches the season those games
    // actually belong to. Once the season flips, that stops being true
    // until OFFSEASON_BRACKET itself gets refreshed to a fetchable season —
    // the modal already handles this gracefully ("Game data unavailable for
    // this series."), so these accept either outcome rather than asserting
    // real games always load.
    it('series modal shows game rows after loading, or the graceful empty state', () => {
      cy.get('.bkt-card--clickable').first().click()
      cy.get('.series-modal', { timeout: 3000 }).should('be.visible')
      cy.get('.series-modal__loading', { timeout: 10000 }).should('not.exist')
      cy.get('body').then(($body) => {
        if ($body.find('.series-modal__empty').length > 0) {
          cy.get('.series-modal__empty').should('contain', 'unavailable')
        } else {
          cy.get('.series-modal__game-row').should('have.length.gte', 1)
        }
      })
    })

    it('game rows show a score for each team, when game data is available', () => {
      cy.get('.bkt-card--clickable').first().click()
      cy.get('.series-modal__loading', { timeout: 10000 }).should('not.exist')
      cy.get('body').then(($body) => {
        if ($body.find('.series-modal__empty').length > 0) {
          cy.get('.series-modal__empty').should('exist')
        } else {
          cy.get('.series-modal__game-row').first().within(() => {
            cy.get('.series-modal__score').should('have.length', 2)
            cy.get('.series-modal__score').first().invoke('text').should('match', /^\d+$/)
          })
        }
      })
    })

    it('series modal closes when backdrop is clicked', () => {
      cy.get('.bkt-card--clickable').first().click()
      cy.get('.series-modal', { timeout: 3000 }).should('be.visible')
      cy.get('.popup-backdrop').click({ force: true })
      cy.get('.series-modal').should('not.exist')
    })

    it('series modal closes when ✕ button is clicked', () => {
      cy.get('.bkt-card--clickable').first().click()
      cy.get('.series-modal', { timeout: 3000 }).should('be.visible')
      cy.get('.series-modal .pp-close').click()
      cy.get('.series-modal').should('not.exist')
    })
  })

  // ── Leaders tab ───────────────────────────────────────────────

  describe('Leaders tab', () => {
    // These assert real leader data (10 rows/card, real names/stats). That's
    // only ever true once real games exist for the app's current season —
    // not true right after a season flip, and not true for most of every
    // preseason going forward. Skip (not fail) when the SeasonNotStartedState
    // is showing instead — same philosophy as `liveSeriesIt` below.
    beforeEach(function () {
      cy.get('.league-tab').contains('Leaders').click()
      cy.get('.lv-season-empty, .lv-leaders-card', { timeout: 10000 }).then(($el) => {
        if ($el.hasClass('lv-season-empty')) this.skip()
      })
    })

    it('shows four leader cards', () => {
      cy.get('.lv-leaders-card', { timeout: 10000 }).should('have.length', 4)
    })

    it('shows Points card', () => {
      cy.get('.lv-leaders-card').contains('Points').should('exist')
    })

    it('shows Goals card', () => {
      cy.get('.lv-leaders-card').contains('Goals').should('exist')
    })

    it('shows Goals against avg. card', () => {
      cy.get('.lv-leaders-card').contains('Goals against avg.').should('exist')
    })

    it('shows Save percentage card', () => {
      cy.get('.lv-leaders-card').contains('Save percentage').should('exist')
    })

    it('each card shows 10 player rows', () => {
      cy.get('.lv-leaders-card', { timeout: 10000 }).each($card => {
        cy.wrap($card).find('.lv-leaders-row').should('have.length', 10)
      })
    })

    it('Points leader shows a numeric stat value', () => {
      cy.get('.lv-leaders-card').contains('Points').parents('.lv-leaders-card')
        .find('.lv-leaders-stat').first()
        .invoke('text')
        .should('match', /^\d+$/)
    })

    it('Goals leader shows a numeric stat value', () => {
      cy.get('.lv-leaders-card').contains('Goals').parents('.lv-leaders-card')
        .find('.lv-leaders-stat').first()
        .invoke('text')
        .should('match', /^\d+$/)
    })

    it('GAA leader shows a decimal stat value', () => {
      cy.get('.lv-leaders-card').contains('Goals against avg.').parents('.lv-leaders-card')
        .find('.lv-leaders-stat').first()
        .invoke('text')
        .should('match', /^\d+\.\d{2}$/)
    })

    it('SV% leader shows a decimal stat value like .920', () => {
      cy.get('.lv-leaders-card').contains('Save percentage').parents('.lv-leaders-card')
        .find('.lv-leaders-stat').first()
        .invoke('text')
        .should('match', /^\.\d{3}$/)
    })

    it('each row shows a team abbreviation', () => {
      cy.get('.lv-leaders-card').first().find('.lv-leaders-team').first()
        .invoke('text')
        .should('match', /^[A-Z]{2,3}$/)
    })

    it('each row shows a player name', () => {
      cy.get('.lv-leaders-card').first().find('.lv-leaders-name').first()
        .invoke('text')
        .should('match', /[A-Za-z]/)
    })

    it('highlights CAR player with lv-leaders-row--you class if they appear', () => {
      // CAR may or may not have a player in the top 10 — just assert the
      // class is applied correctly when present, without asserting presence
      cy.get('.lv-leaders-card').first().find('.lv-leaders-row').then($rows => {
        const youRows = $rows.filter('.lv-leaders-row--you')
        if (youRows.length > 0) {
          cy.wrap(youRows.first()).find('.lv-leaders-team').should('contain', 'CAR')
        }
      })
    })

    it('all leader rows have the clickable class', () => {
      cy.get('.lv-leaders-card', { timeout: 10000 }).first()
        .find('.lv-leaders-row')
        .each($row => {
          cy.wrap($row).should('have.class', 'lv-leaders-row--clickable')
        })
    })

    it('team abbreviation cell has an inline color style', () => {
      cy.get('.lv-leaders-card', { timeout: 10000 }).first()
        .find('.lv-leaders-team').first()
        .should('have.attr', 'style')
        .and('include', 'color')
    })

    it('clicking a player row opens the player popup', () => {
      cy.get('.lv-leaders-card', { timeout: 10000 }).first()
        .find('.lv-leaders-row').first().click()
      cy.get('.player-popup', { timeout: 8000 }).should('be.visible')
    })

    it('player popup from Leaders tab shows Stats and Analytics tabs only', () => {
      cy.get('.lv-leaders-card', { timeout: 10000 }).first()
        .find('.lv-leaders-row').first().click()
      cy.get('.player-popup', { timeout: 8000 }).should('be.visible')
      cy.get('.pp-tab').should('contain', '📊 Stats')
      cy.get('.pp-tab').should('contain', '🧮 Analytics')
      cy.get('.pp-tab').should('not.contain', '🎯 Heat Map')
      cy.get('.pp-tab').should('not.contain', '🔍 Scout')
    })

    it('player popup closes when the ✕ button is clicked', () => {
      cy.get('.lv-leaders-card', { timeout: 10000 }).first()
        .find('.lv-leaders-row').first().click()
      cy.get('.player-popup', { timeout: 8000 }).should('be.visible')
      cy.get('.pp-close').click()
      cy.get('.player-popup').should('not.exist')
    })
  })
  // ── Power Rankings tab ───────────────────────────────────────

  describe('Power rankings tab', () => {
    beforeEach(() => cy.get('.league-tab').contains('Power rankings').click())

    it('makes Power rankings the active tab', () => {
      cy.get('.league-tab').contains('Power rankings').should('have.class', 'league-tab--active')
      cy.get('.league-tab').contains('Standings').should('not.have.class', 'league-tab--active')
    })

    it('shows 32 ranked rows', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row', { timeout: 10000 })
      cy.get('.pr-row', { timeout: 10000 }).should('have.length', 32)
    })

    it('first row has rank 1', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-rank-num').first().should('contain', '1')
    })

    it('last row has rank 32', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-rank-num').last().should('contain', '32')
    })

    it('shows column headers Pts%, L10, xGF%, GD/GP', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-table-header-row').should('contain', 'Pts%')
      cy.get('.pr-table-header-row').should('contain', 'L10')
      cy.get('.pr-table-header-row').should('contain', 'xGF%')
      cy.get('.pr-table-header-row').should('contain', 'GD/GP')
    })

    it('shows team abbreviations in each row', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-abbr').first().invoke('text').should('match', /^[A-Z]{2,3}$/)
    })

    it('shows Pts% as a percentage value', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-row').first().find('.pr-col-stat').first()
        .invoke('text').should('match', /\d+\.\d%/)
    })

    it('shows YOU row highlighted on CAR', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-row--you').should('exist')
    })

    it('top 8 ranks are styled with pr-rank--top class', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-rank--top').should('have.length', 8)
    })

    it('bottom 8 ranks are styled with pr-rank--bot class', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-rank--bot').should('have.length', 8)
    })

    it('shows "How is this calculated?" toggle', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-how-toggle').scrollIntoView().should('exist')
      cy.get('.pr-how-toggle').should('contain', 'How is this calculated?')
    })

    it('how-toggle expands and collapses the explanation', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-how-body').should('not.exist')
      cy.get('.pr-how-toggle').click()
      cy.get('.pr-how-body').should('be.visible')
      cy.get('.pr-how-toggle').click()
      cy.get('.pr-how-body').should('not.exist')
    })

    it('expanded explanation shows all six components', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-how-toggle').click()
      cy.get('.pr-how-item').should('have.length', 6)
      cy.get('.pr-how-item').eq(0).should('contain', 'Points %')
      cy.get('.pr-how-item').eq(1).should('contain', 'L10 Points %')
      cy.get('.pr-how-item').eq(2).should('contain', 'Goal Differential')
      cy.get('.pr-how-item').eq(3).should('contain', '5v5 xGF%')
      cy.get('.pr-how-item').eq(4).should('contain', 'Special Teams')
      cy.get('.pr-how-item').eq(5).should('contain', 'Roster WAR')
    })

    it('each component shows a weight percentage', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-how-toggle').click()
      cy.get('.pr-how-weight').should('have.length', 6)
      cy.get('.pr-how-weight').each($el => {
        cy.wrap($el).invoke('text').should('match', /\d+%/)
      })
    })

    it('shows Roster WAR component in explanation', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.pr-how-toggle').click()
      cy.get('.pr-how-item').should('have.length', 6)
      cy.get('.pr-how-item').eq(5).should('contain', 'Roster WAR')
    })

    it('shows narrative card or sparkline when rank history exists', () => {
      // This test depends on live Supabase data (power_rankings_narratives table).
      // It passes silently if no data exists yet — the card only renders after
      // the first nightly pipeline run populates rank history.
      cy.wait(2000) // allow lazy fetch to resolve
      cy.get('body').then($body => {
        const hasCard     = $body.find('.pr-narrative-card').length > 0
        const hasSparkline = $body.find('.pr-sparkline').length > 0
        if (hasCard) {
          cy.get('.pr-narrative-card').should('exist')
          if ($body.find('.pr-narrative-label').length) {
            cy.get('.pr-narrative-label').should('contain', 'EyeWall AI')
          }
        }
        if (hasSparkline) {
          cy.get('.pr-sparkline').should('exist')
        }
        // No hard assertion — passes whether or not data is available
      })
    })

    it('shows movement arrow on YOU row when prior rank exists', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      // Movement arrow only appears after first baseline run
      cy.get('.pr-row--you').then($row => {
        const $mvmt = $row.find('.pr-mvmt')
        if ($mvmt.length) {
          cy.wrap($mvmt).invoke('text').should('match', /^(▲\d+|▼\d+|—)$/)
        }
      })
    })

    it('shows export button', function () {
      cy.skipIfEither('.lv-season-empty', '.pr-row')
      cy.get('.share-buttons-row').scrollIntoView().should('exist')
      cy.get('.share-buttons-row').should('contain', 'Save Image')
    })
  })
})

// ── Standings tab — magic/tragic number display (Session 59) ───
// Live standings + team-seasons data are both stubbed here so these four
// states (clinched, eliminated, active magic number, wildcard bubble) are
// deterministic — the real season is rarely in all four states at once,
// and definitely isn't during summer preseason.

function standingsEntry(overrides) {
  return {
    teamAbbrev: { default: overrides.abbr },
    teamName: { default: overrides.abbr },
    divisionName: 'Metropolitan',
    conferenceName: 'Eastern',
    gamesPlayed: 78,
    wins: 40, losses: 30, otLosses: 8,
    points: 88,
    l10Wins: 5, l10Losses: 3, l10OtLosses: 2,
    streakCode: 'W', streakCount: 2,
    clinchIndicator: null,
    ...overrides,
  }
}

const MAGIC_STANDINGS = [
  standingsEntry({ abbr: 'CAR', divisionSequence: 1, conferenceSequence: 1, leagueSequence: 1, wildcardSequence: 0, points: 110, clinchIndicator: 'p' }),
  standingsEntry({ abbr: 'NYR', divisionSequence: 2, conferenceSequence: 2, leagueSequence: 2, wildcardSequence: 0, points: 95 }),
  standingsEntry({ abbr: 'NJD', divisionSequence: 3, conferenceSequence: 3, leagueSequence: 3, wildcardSequence: 0, points: 90 }),
  standingsEntry({ abbr: 'CBJ', divisionSequence: 4, conferenceSequence: 4, leagueSequence: 4, wildcardSequence: 1, points: 70 }),
  standingsEntry({ abbr: 'PHI', divisionSequence: 5, conferenceSequence: 5, leagueSequence: 5, wildcardSequence: 2, points: 50, clinchIndicator: 'e' }),
]

const MAGIC_TEAM_SEASONS = [
  { team: 'NYR', magic_number: 4,  tragic_number: 45, clinched: false, eliminated: false },
  { team: 'CBJ', magic_number: 30, tragic_number: 6,  clinched: false, eliminated: false },
]

describe('Standings tab — magic/tragic number display', () => {
  beforeEach(() => {
    cy.intercept('GET', `${WORKER_URL_LEAGUE}/cache/standings*`, { body: MAGIC_STANDINGS }).as('getStandings')
    cy.intercept('GET', `${WORKER_URL_LEAGUE}/team-seasons*`, { body: MAGIC_TEAM_SEASONS }).as('getTeamSeasons')
    cy.setTeam('CAR')
    cy.visit('/league')
    cy.get('.league-view', { timeout: 15000 }).should('be.visible')
  })

  function rowFor(abbr) {
    return cy.get('.lv-team-abbrev').contains(abbr).closest('.lv-row')
  }

  it('clinched: Presidents\' Trophy letter shows the fixed border color (CLINCH_COLOR bug fix)', () => {
    rowFor('CAR').find('.lv-clinch-badge').should('contain', 'P')
    rowFor('CAR').find('.lv-td--team')
      .should('have.attr', 'style')
      .and('include', 'border-left')
  })

  it('eliminated: "e" letter shows the fixed border color (CLINCH_COLOR bug fix)', () => {
    rowFor('PHI').find('.lv-clinch-badge').should('contain', 'E')
    rowFor('PHI').find('.lv-td--team')
      .should('have.attr', 'style')
      .and('include', 'border-left')
  })

  it('active magic number: pre-clinch team shows a green M-badge, no official clinch badge', () => {
    rowFor('NYR').find('.lv-magic-badge').should('have.class', 'lv-magic-badge--clinch').and('contain', 'M4')
    rowFor('NYR').find('.lv-clinch-badge').should('not.exist')
  })

  it('wildcard bubble: pre-elimination wildcard-pool team shows a red E-badge', () => {
    cy.get('.lv-filter-btn').contains('Wild card').click()
    rowFor('CBJ').find('.lv-magic-badge').should('have.class', 'lv-magic-badge--elim').and('contain', 'E6')
  })
})

// ── Bottom nav ────────────────────────────────────────────────

describe('League bottom nav link', () => {
  beforeEach(() => {
    cy.setTeam('CAR')
    cy.visit('/')
  })

  it('League tab is present in bottom nav', () => {
    cy.get('.nav-tab').contains('League').should('exist')
  })

  it('clicking League nav tab navigates to /league', () => {
    cy.get('.nav-tab').contains('League').click()
    cy.url().should('include', '/league')
    cy.get('.league-view', { timeout: 15000 }).should('be.visible')
  })

  it('League nav tab is marked active when on /league', () => {
    cy.visit('/league')
    cy.get('.nav-tab').filter(':contains("League")').should('have.class', 'active')
  })
})
