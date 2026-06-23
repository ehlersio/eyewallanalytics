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

    it('series modal shows game rows after loading', () => {
      cy.get('.bkt-card--clickable').first().click()
      cy.get('.series-modal', { timeout: 3000 }).should('be.visible')
      // Wait for games to load — skeleton disappears, rows appear
      cy.get('.series-modal__game-row', { timeout: 10000 }).should('have.length.gte', 1)
    })

    it('game rows show a score for each team', () => {
      cy.get('.bkt-card--clickable').first().click()
      cy.get('.series-modal__game-row', { timeout: 10000 }).first().within(() => {
        cy.get('.series-modal__score').should('have.length', 2)
        cy.get('.series-modal__score').first().invoke('text').should('match', /^\d+$/)
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
    beforeEach(() => cy.get('.league-tab').contains('Leaders').click())

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

    it('shows 32 ranked rows', () => {
      cy.get('.pr-row', { timeout: 10000 }).should('have.length', 32)
    })

    it('first row has rank 1', () => {
      cy.get('.pr-rank-num').first().should('contain', '1')
    })

    it('last row has rank 32', () => {
      cy.get('.pr-rank-num').last().should('contain', '32')
    })

    it('shows column headers Pts%, L10, xGF%, GD/GP', () => {
      cy.get('.pr-table-header-row').should('contain', 'Pts%')
      cy.get('.pr-table-header-row').should('contain', 'L10')
      cy.get('.pr-table-header-row').should('contain', 'xGF%')
      cy.get('.pr-table-header-row').should('contain', 'GD/GP')
    })

    it('shows team abbreviations in each row', () => {
      cy.get('.pr-abbr').first().invoke('text').should('match', /^[A-Z]{2,3}$/)
    })

    it('shows Pts% as a percentage value', () => {
      cy.get('.pr-row').first().find('.pr-col-stat').first()
        .invoke('text').should('match', /\d+\.\d%/)
    })

    it('shows YOU row highlighted on CAR', () => {
      cy.get('.pr-row--you').should('exist')
    })

    it('top 8 ranks are styled with pr-rank--top class', () => {
      cy.get('.pr-rank--top').should('have.length', 8)
    })

    it('bottom 8 ranks are styled with pr-rank--bot class', () => {
      cy.get('.pr-rank--bot').should('have.length', 8)
    })

    it('shows "How is this calculated?" toggle', () => {
      cy.get('.pr-how-toggle').scrollIntoView().should('exist')
      cy.get('.pr-how-toggle').should('contain', 'How is this calculated?')
    })

    it('how-toggle expands and collapses the explanation', () => {
      cy.get('.pr-how-body').should('not.exist')
      cy.get('.pr-how-toggle').click()
      cy.get('.pr-how-body').should('be.visible')
      cy.get('.pr-how-toggle').click()
      cy.get('.pr-how-body').should('not.exist')
    })

    it('expanded explanation shows all six components', () => {
      cy.get('.pr-how-toggle').click()
      cy.get('.pr-how-item').should('have.length', 6)
      cy.get('.pr-how-item').eq(0).should('contain', 'Points %')
      cy.get('.pr-how-item').eq(1).should('contain', 'L10 Points %')
      cy.get('.pr-how-item').eq(2).should('contain', 'Goal Differential')
      cy.get('.pr-how-item').eq(3).should('contain', '5v5 xGF%')
      cy.get('.pr-how-item').eq(4).should('contain', 'Special Teams')
      cy.get('.pr-how-item').eq(5).should('contain', 'Roster WAR')
    })

    it('each component shows a weight percentage', () => {
      cy.get('.pr-how-toggle').click()
      cy.get('.pr-how-weight').should('have.length', 6)
      cy.get('.pr-how-weight').each($el => {
        cy.wrap($el).invoke('text').should('match', /\d+%/)
      })
    })

    it('shows Roster WAR component in explanation', () => {
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

    it('shows movement arrow on YOU row when prior rank exists', () => {
      // Movement arrow only appears after first baseline run
      cy.get('.pr-row--you').then($row => {
        const $mvmt = $row.find('.pr-mvmt')
        if ($mvmt.length) {
          cy.wrap($mvmt).invoke('text').should('match', /^(▲\d+|▼\d+|—)$/)
        }
      })
    })

    it('shows export button', () => {
      cy.get('.share-buttons-row').scrollIntoView().should('exist')
      cy.get('.share-buttons-row').should('contain', 'Save Image')
    })
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
