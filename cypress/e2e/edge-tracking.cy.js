// cypress/e2e/edge-tracking.cy.js
// NHL EDGE tracking on the player Analytics tab. The Worker's /nhl/edge is
// stubbed (fixtures/edge-skater.json: a real 82-GP response, McDavid
// 2025-26) so these don't depend on the NHL's EDGE feed or on the player's
// games played so far this season.

const openAnalytics = () => {
  cy.setTeam('CAR')
  cy.visit('/players')
  cy.contains('Forwards', { timeout: 15000 }).should('exist')
  cy.team('CAR').then(t => cy.contains(t.skater).first().click())
  cy.get('.pp-tab', { timeout: DATA_TIMEOUT }).contains('Analytics').click()
}

describe('NHL EDGE tracking section', () => {
  it('shows headline values and percentile bars from the NHL', () => {
    cy.intercept('GET', '**/nhl/edge/skater/**', { fixture: 'edge-skater.json' }).as('edge')
    openAnalytics()
    cy.wait('@edge')
    cy.get('[data-testid="edge-tracking"]', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('82 GP')
      cy.contains('24.6 mph')
      cy.contains('Top speed')
      cy.contains('Bursts 20+ mph')
      cy.contains('100th')
      cy.contains('NHL EDGE')
    })
  })

  it('reads speeds and distances in metric once chosen', () => {
    cy.intercept('GET', '**/nhl/edge/skater/**', { fixture: 'edge-skater.json' }).as('edge')
    cy.window().then(win => win.localStorage.setItem('eyewall:units', 'metric'))
    openAnalytics()
    cy.wait('@edge')
    cy.get('[data-testid="edge-tracking"]', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('39.6 km/h')
      cy.contains('16.9 km')
      cy.contains('Bursts 32+ km/h')
    })
  })

  it('shows nothing when the NHL has no EDGE data', () => {
    cy.intercept('GET', '**/nhl/edge/skater/**', { statusCode: 404, body: { available: false } }).as('edge')
    openAnalytics()
    cy.wait('@edge')
    cy.get('.pa-wrap, .pp-heatmap-empty', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('[data-testid="edge-tracking"]').should('not.exist')
  })
})

describe('Goalie shot-area map (Analytics tab)', () => {
  // fixtures/edge-goalie.json: a real 39-GP response (Blackwood 2025-26)
  // with the NHL's per-area numbers (`areas`).
  //
  // The Worker's /goalie-analytics is stubbed too
  // (fixtures/goalie-analytics-car-2025-26.json: the real 2025-26 response,
  // CAR goalies only). Live, it changes every game night and the dev
  // server's StrictMode fetches it twice: when the second copy landed after
  // the first was waited on, the tab re-laid itself out mid-test and
  // dropped the tapped area (flaky on #472, 2026-10-07).
  beforeEach(() => {
    cy.intercept('GET', '**/goalie-analytics*', { fixture: 'goalie-analytics-car-2025-26.json' }).as('goalieAnalytics')
  })
  const openGoalieAnalytics = () => {
    cy.setTeam('CAR')
    cy.visit('/players')
    cy.contains('Goalies', { timeout: 15000 }).should('exist')
    cy.team('CAR').then(t => cy.contains(t.goalie).first().click())
    cy.get('.pp-tab', { timeout: DATA_TIMEOUT }).contains('Analytics').click()
  }

  it('shows save % by NHL shot area, colored by percentile, tappable', () => {
    cy.intercept('GET', '**/nhl/edge/goalie/**', { fixture: 'edge-goalie.json' }).as('edge')
    openGoalieAnalytics()
    cy.wait('@edge')
    cy.wait('@goalieAnalytics')
    // The tab re-lays itself out when the MoneyPuck goalie data lands, which
    // remounts the map and clears a tapped area: interact only once the
    // data layout (its GSAx card) is on screen.
    cy.contains('Goals saved above expected', { timeout: DATA_TIMEOUT }).should('be.visible')
    cy.get('[data-testid="edge-tracking"] [data-testid="goalie-area-map"]', { timeout: DATA_TIMEOUT }).within(() => {
      cy.get('path.rhr-area').should('have.length', 17)
      // Low Slot: 229 shots, .825, 61st percentile -> the middle color
      cy.get('path[data-area="Low Slot"]').should('have.attr', 'fill', '#fbbf24')
      // L Corner: 2 shots -- too few to color, however the NHL ranks it
      cy.get('path[data-area="L Corner"]').should('have.attr', 'fill', 'transparent')
      cy.get('path[data-area="Low Slot"]').click({ force: true })
      cy.contains('Low slot · 229 shots · .825 · 61st percentile')
      cy.get('path[data-area="L Corner"]').click({ force: true })
      cy.contains('too few to rate')
    })
  })

  it('leaves the map out when the NHL has no area data', () => {
    cy.fixture('edge-goalie.json').then(body => {
      cy.intercept('GET', '**/nhl/edge/goalie/**', { ...body, areas: null }).as('edge')
    })
    openGoalieAnalytics()
    cy.wait('@edge')
    cy.get('[data-testid="edge-tracking"]', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('[data-testid="goalie-area-map"]').should('not.exist')
  })
})

describe('Team page: NHL EDGE ranks (Advanced tab)', () => {
  // fixtures/edge-team.json: Carolina's real 2025-26 regular season
  const openAdvanced = () => {
    cy.setTeam('CAR')
    cy.visit('/team')
    cy.contains('Advanced', { timeout: 15000 }).click()
  }

  it('lists each metric with its value, NHL rank and league average', () => {
    cy.intercept('GET', '**/nhl/edge/team/**', { fixture: 'edge-team.json' }).as('edge')
    openAdvanced()
    // Fires only once the live team stats have settled which season to show
    cy.wait('@edge', { timeout: DATA_TIMEOUT }).its('request.url').should('match', /\/nhl\/edge\/team\/12\/\d{8}\/2$/)
    cy.get('[data-testid="edge-team"]', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('Tracking (NHL EDGE)')
      cy.contains('O-zone time').parent().should('contain', '1st in NHL')
      cy.contains('45.5%')
      cy.contains('D-zone time').parent().should('contain', '1st in NHL')
      cy.contains('Top skating speed').parent().should('contain', '22nd in NHL')
      cy.contains('23.6 mph')
      // season totals (shots, bursts, distance) aren't shown: they grow with games played
      cy.contains('Distance skated').should('not.exist')
    })
  })

  it('holds back ranks and averages under 10 games played', () => {
    cy.fixture('edge-team.json').then(body => {
      cy.intercept('GET', '**/nhl/edge/team/**', { ...body, gamesPlayed: 1 }).as('edge')
    })
    openAdvanced()
    cy.wait('@edge', { timeout: DATA_TIMEOUT })
    cy.get('[data-testid="edge-team"]', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('Ranks and averages after 10 games played')
      cy.contains('45.5%')
      cy.contains('in NHL').should('not.exist')
      cy.contains('avg').should('not.exist')
    })
  })

  it('shows nothing when the NHL has no EDGE data for the team', () => {
    cy.intercept('GET', '**/nhl/edge/team/**', { statusCode: 404, body: { available: false } }).as('edge')
    openAdvanced()
    cy.wait('@edge', { timeout: DATA_TIMEOUT })
    cy.contains(/Shot Volume|Possession/i, { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('[data-testid="edge-team"]').should('not.exist')
  })
})

describe('League view: NHL EDGE leaders', () => {
  // fixtures/edge-leaders.json: the NHL's real 2025-26 top 10s
  const openLeaders = () => {
    cy.setTeam('CAR')
    cy.visit('/league')
    cy.contains('button', /^Leaders$/, { timeout: 15000 }).click()
  }

  it('lists the four top 10s, with when a speed was clocked, and opens a player', () => {
    cy.intercept('GET', '**/nhl/edge/leaders/**', { fixture: 'edge-leaders.json' }).as('edge')
    openLeaders()
    cy.wait('@edge', { timeout: DATA_TIMEOUT })
    cy.get('[data-testid="edge-leaders"]', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('Fastest skaters')
      cy.contains('Hardest shots')
      cy.contains('Distance skated')
      cy.contains('Offensive-zone time')
      cy.get('.lv-leaders-card').first().within(() => {
        cy.get('.lv-leaders-row').should('have.length', 10)
        cy.get('.lv-leaders-row').first().should('contain', 'Beck Malenstyn').and('contain', '24.9').and('contain', 'WSH @ BUF')
      })
      cy.contains('.lv-leaders-row', 'Shayne Gostisbehere').should('contain', '49.6%')
      cy.contains('.lv-leaders-row', 'Beck Malenstyn').click()
    })
    cy.get('.player-popup', { timeout: DATA_TIMEOUT }).should('contain', 'Malenstyn')
  })

  it('shows nothing when the NHL has no leaders for the season', () => {
    cy.intercept('GET', '**/nhl/edge/leaders/**', { statusCode: 404, body: { available: false } }).as('edge')
    openLeaders()
    cy.wait('@edge', { timeout: DATA_TIMEOUT })
    cy.get('.lv-leaders-card', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('[data-testid="edge-leaders"]').should('not.exist')
  })
})

describe('Player comparison: Tracking tab (NHL EDGE)', () => {
  // McDavid vs Draisaitl; both stubbed with fixtures/edge-skater.json (a
  // real 82-GP response), Draisaitl's percentiles lowered so one side wins.
  const openComparison = () => {
    cy.setTeam('CAR')
    cy.visit('/')
    cy.get('.player-search-toggle').click()
    cy.get('.player-search-input').type('mcdavid')
    cy.contains('.player-search-result', 'Connor McDavid', { timeout: DATA_TIMEOUT }).click()
    cy.get('.player-popup', { timeout: 10000 }).should('exist')
    cy.get('.pp-quickstats-col .pce-toggle', { timeout: 10000 }).click()
    cy.get('.pce-input').type('draisaitl')
    cy.contains('.pce-result', 'Leon Draisaitl', { timeout: DATA_TIMEOUT }).click()
    cy.get('.pcp-root', { timeout: DATA_TIMEOUT }).should('exist')
  }

  it('compares the two players metric by metric, the better percentile highlighted', () => {
    cy.fixture('edge-skater.json').then(body => {
      cy.intercept('GET', '**/nhl/edge/skater/**', req => {
        if (req.url.includes('/8478402/')) return req.reply(body)
        const metrics = Object.fromEntries(Object.entries(body.metrics).map(([k, m]) => [k, m && { ...m, pct: 10 }]))
        return req.reply({ ...body, playerId: 8477934, metrics })
      }).as('edge')
    })
    openComparison()
    cy.contains('.pcp-tab', 'Tracking', { timeout: DATA_TIMEOUT }).click()
    cy.get('[data-testid="edge-h2h"]').within(() => {
      cy.contains('2025-26 · 82 GP')
      cy.get('tr[data-metric="topSpeed"]').should('contain', '24.6 mph').and('contain', '100th pct.')
      // McDavid (left, 100th) beats the stubbed 10th
      cy.get('tr[data-metric="topSpeed"] td').first().find('span').first().should('have.class', 'font-bold')
      cy.get('tr[data-metric="topSpeed"] td').last().find('span').first().should('not.have.class', 'font-bold')
    })
  })

  it('offers no Tracking tab when neither player has EDGE data', () => {
    cy.intercept('GET', '**/nhl/edge/skater/**', { statusCode: 404, body: { available: false } }).as('edge')
    openComparison()
    cy.contains('.pcp-tab', 'Scoring', { timeout: DATA_TIMEOUT }).should('exist')
    cy.wait('@edge', { timeout: DATA_TIMEOUT })
    cy.get('.pcp-tab').should('not.contain', 'Tracking')
  })
})

describe('Team comparison: NHL EDGE rows', () => {
  it('adds each season card\'s EDGE metrics with the NHL rank', () => {
    cy.intercept('GET', '**/nhl/edge/team/**', { fixture: 'edge-team.json' }).as('edge')
    cy.setTeam('CAR')
    cy.visit('/team')
    cy.contains('🆚 Compare Seasons', { timeout: 15000 }).click()
    cy.get('.season-chip', { timeout: DATA_TIMEOUT }).eq(1).click()
    cy.wait('@edge', { timeout: DATA_TIMEOUT })
    cy.get('[data-testid="edge-team-rows"]', { timeout: DATA_TIMEOUT }).first().scrollIntoView()
      .should('contain', 'Tracking (NHL EDGE)')
      .and('contain', 'O-zone time')
      .and('contain', '1st in NHL')
      .and('contain', '45.5%')
  })
})

describe('Units setting', () => {
  it('follows the language until chosen, then keeps the choice', () => {
    cy.visit('/')
    cy.get('.notif-bell').click()
    cy.get('.settings-units-imperial').should('have.attr', 'aria-checked', 'true')
    cy.get('.settings-units-metric').click()
    cy.get('.settings-units-metric').should('have.attr', 'aria-checked', 'true')
    cy.window().then(win => {
      expect(win.localStorage.getItem('eyewall:units')).to.equal('metric')
    })
  })
})
