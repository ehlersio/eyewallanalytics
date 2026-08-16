// cypress/e2e/player-comparison.cy.js
// Player-vs-Player Comparison (Session 91) — "vs Player" entry point
// (PlayerComparisonEntry.jsx) on both PlayerPopup.jsx (NHL) and
// PWHLPlayerPopup.jsx (PWHL), opening PlayerComparisonPopup.jsx.
//
// Same-league only (NHL-NHL or PWHL-PWHL); goalie-vs-skater and PWHL
// goalie-vs-goalie are hard-blocked (see PlayerComparisonPopup.jsx's own
// comments for why). Follows player-search.cy.js's convention of hitting
// live production data with real, well-known players rather than mocking
// — assertions check shape (tabs/radar/tiles render, names/messages match)
// rather than exact stat values, since those change with every game played
// and this repo's own whole-season fallback can shift which season's
// numbers are showing at any given time.

describe('NHL player comparison', () => {
  beforeEach(() => {
    cy.setTeam('CAR')
    cy.visit('/')
    cy.get('.player-search-toggle').click()
    cy.get('.player-search-input').type('mcdavid')
    cy.contains('.player-search-result', 'Connor McDavid', { timeout: 8000 }).click()
    cy.get('.player-popup', { timeout: 10000 }).should('exist')
    // Wait for the header's own async data (percentiles/box stats) to
    // settle before touching "vs Player" -- clicking while that's still
    // resolving raced Cypress's click against the resulting re-render.
    cy.contains('Goals', { timeout: 10000 }).should('exist')
    // The radar (Recharts ResponsiveContainer) measures itself via
    // ResizeObserver and re-renders once real dimensions land, shortly
    // after "Goals" is already visible -- confirmed live that clicking
    // "vs Player" while that resize re-render was still in flight could
    // race Cypress's click against React swapping the button's DOM node.
    // PWHL's header has no radar and never showed this flake, which is
    // what pointed at Recharts specifically rather than a general fetch
    // race.
    cy.wait(500)
  })

  it('shows a "vs Player" entry point distinct from the existing season-over-season Compare tab', () => {
    // Naming-collision regression guard (design note from the build): the
    // "🆚 Compare" tab already means "compare this player's own past
    // seasons" (Session 64/70) -- the new entry point must not reuse that
    // word in the same popup.
    cy.get('.pce-toggle').should('be.visible').and('contain.text', 'vs Player')
    cy.get('.pp-tab').contains('🆚 Compare').should('exist')
    cy.get('.pce-toggle').should('not.contain.text', 'Compare')
  })

  it('does not compress the single-player radar chart (regression)', () => {
    // .pp-radar-wrap has a 50-130px flex range (PlayersView.css) -- the
    // "vs Player" button used to sit inline in the same flex row and ate
    // into that range. It now stacks under the quickstats grid instead.
    cy.get('.pp-radar-wrap', { timeout: 10000 }).should(($radar) => {
      expect($radar.width()).to.be.greaterThan(60)
    })
    cy.get('.pp-quickstats-col .pce-toggle').should('exist')
  })

  it('opens a same-league (NHL) scoped search panel', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').should('be.visible').and('have.attr', 'placeholder', 'Search NHL players…')
  })

  it('excludes the currently-open player from their own comparison search results', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('mcdavid')
    // Fuse's fuzzy matching returns other loosely-similar names too (e.g.
    // "David Savard", "Mason McTavish") -- the real assertion is that
    // McDavid himself, excluded by id, never appears among them, not that
    // the result list is empty.
    cy.get('.pce-result', { timeout: 8000 }).should('have.length.greaterThan', 0)
    cy.get('.pce-result').should('not.contain.text', 'Connor McDavid')
  })

  it('scopes search results to NHL only, even for a well-known PWHL name', () => {
    cy.get('.pce-toggle').click()
    // Sarah Wozniewicz — real PWHL player (see player-search.cy.js's typo-
    // tolerance test), no NHL namesake.
    cy.get('.pce-input').type('wozniewicz')
    cy.get('.pce-status', { timeout: 8000 }).should('contain.text', 'No players found')
  })

  it('compares two NHL skaters: header, radar, and all four tabs render with real tiles', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('matthews')
    cy.contains('.pce-result', 'Auston Matthews', { timeout: 8000 }).click()

    cy.get('.pcp-backdrop', { timeout: 10000 }).should('exist')
    cy.contains('Connor McDavid').should('exist')
    cy.contains('Auston Matthews').should('exist')
    cy.get('.pcp-radar svg', { timeout: 10000 }).should('exist')

    ;['Scoring', 'Possession', 'Physical', 'Special Teams'].forEach((tab) => {
      cy.get('.pcp-tab').contains(tab).click()
      cy.get('.pcp-tab').contains(tab).should('have.class', 'pcp-tab-active')
    })
    cy.get('.pcp-tab').contains('Scoring').click()
    cy.get('.stat-tile', { timeout: 10000 }).should('have.length.greaterThan', 0)
  })

  it('tab clicks land on the comparison popup, not the bottom nav underneath (regression)', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('matthews')
    cy.contains('.pce-result', 'Auston Matthews', { timeout: 8000 }).click()
    cy.get('.pcp-backdrop', { timeout: 10000 }).should('exist')

    cy.url().then((urlBefore) => {
      cy.get('.pcp-tab').contains('Physical').click()
      // If the click had instead landed on .bottom-nav underneath (the
      // real bug), the app would have navigated to a different route and
      // the comparison popup would have unmounted along with it.
      cy.get('.pcp-tab').contains('Physical').should('have.class', 'pcp-tab-active')
      cy.url().should('eq', urlBefore)
      cy.get('.pcp-backdrop').should('exist')
    })
  })

  it('closes back to the original player popup, not all the way out', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('matthews')
    cy.contains('.pce-result', 'Auston Matthews', { timeout: 8000 }).click()
    cy.get('.pcp-backdrop', { timeout: 10000 }).should('exist')

    cy.get('.pcp-backdrop .pp-close').click()
    cy.get('.pcp-backdrop').should('not.exist')
    cy.get('.player-popup').should('exist')
    cy.contains('McDavid').should('exist')
  })

  it('goalie vs skater is hard-blocked with an explanatory message', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('shesterkin')
    cy.contains('.pce-result', 'Igor Shesterkin', { timeout: 8000 }).click()

    cy.get('.pcp-backdrop', { timeout: 10000 }).should('exist')
    cy.contains(/different stat sets and can.t be compared/i).should('exist')
    cy.get('.pcp-tab').should('not.exist')
    cy.get('.pcp-radar').should('not.exist')
  })

  it('flags a soft position mismatch (forward vs defenceman) without blocking the comparison', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('makar')
    cy.contains('.pce-result', 'Cale Makar', { timeout: 8000 }).click()

    cy.get('.pcp-backdrop', { timeout: 10000 }).should('exist')
    cy.contains(/Position mismatch/i).should('exist')
    // Non-blocking — stats still render below the badge.
    cy.get('.pcp-radar', { timeout: 10000 }).should('exist')
    cy.get('.pcp-tab').should('have.length.greaterThan', 0)
  })
})

describe('NHL goalie comparison', () => {
  beforeEach(() => {
    cy.setTeam('CAR')
    cy.visit('/')
    cy.get('.player-search-toggle').click()
    cy.get('.player-search-input').type('shesterkin')
    cy.contains('.player-search-result', 'Igor Shesterkin', { timeout: 8000 }).click()
    cy.get('.player-popup', { timeout: 10000 }).should('exist')
    cy.contains(/GP|Record/i, { timeout: 10000 }).should('exist')
  })

  it('compares two goalies with their own Record/Performance/Advanced tabs, not the skater tab set', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('hellebuyck')
    cy.contains('.pce-result', 'Connor Hellebuyck', { timeout: 8000 }).click()

    cy.get('.pcp-backdrop', { timeout: 10000 }).should('exist')
    cy.contains('Igor Shesterkin').should('exist')
    cy.contains('Connor Hellebuyck').should('exist')

    ;['Record', 'Performance', 'Advanced'].forEach((tab) => {
      cy.get('.pcp-tab').contains(tab).should('exist')
    })
    cy.get('.pcp-tab').contains('Scoring').should('not.exist')

    cy.get('.pcp-tab').contains('Record').click()
    cy.get('.stat-tile', { timeout: 10000 }).should('have.length.greaterThan', 0)
  })
})

describe('PWHL player comparison', () => {
  beforeEach(() => {
    cy.visit('/pwhl/players', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
      },
    })
    cy.get('.pc-last', { timeout: 8000 }).first().invoke('text').then((lastName) => {
      cy.contains('.player-card', lastName).click()
    })
    cy.get('.player-popup', { timeout: 10000 }).should('exist')
    cy.contains('Goals', { timeout: 10000 }).should('exist')
    // Same race as the NHL describe block above, different trigger: PWHL's
    // header has no Recharts radar, but PWHLHeaderPanel (the 2x2 percentile
    // tile grid) only mounts once the async /pwhl/player/percentiles fetch
    // resolves (showHeaderReflow flips false->true in PWHLPlayerPopup.jsx),
    // reflowing the header shortly after "Goals" is already visible --
    // clicking "vs Player" while that's still in flight can race Cypress's
    // click against React swapping the toggle button's DOM node, same as
    // the Recharts case. Confirmed live (reproduced locally 1-in-3 runs
    // before this fix) after this test flaked 3 times in CI across 3
    // separate unrelated PRs -- the original "PWHL never showed this flake"
    // note above was right that it isn't Recharts-specific, but wrong that
    // PWHL has no equivalent async reflow at all.
    cy.wait(500)
  })

  it('opens a same-league (PWHL) scoped search panel', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').should('be.visible').and('have.attr', 'placeholder', 'Search PWHL players…')
  })

  it('scopes search results to PWHL only, even for a well-known NHL name', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('mcdavid')
    cy.get('.pce-status', { timeout: 8000 }).should('contain.text', 'No players found')
  })

  it('compares two PWHL skaters: radar and all four tabs render', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('newhook')
    cy.get('.pce-result', { timeout: 8000 }).then(($results) => {
      if ($results.length === 0) {
        cy.log('Abby Newhook not on this roster in live data — skipping')
        return
      }
      cy.wrap($results).first().click()
      cy.get('.pcp-backdrop', { timeout: 10000 }).should('exist')
      cy.get('.pcp-radar svg', { timeout: 10000 }).should('exist')
      ;['Scoring', 'Possession', 'Physical', 'Special Teams'].forEach((tab) => {
        cy.get('.pcp-tab').contains(tab).should('exist')
      })
    })
  })

  it('Possession tab explains PWHL has no WAR/RAPM data yet, rather than rendering blank', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('newhook')
    cy.get('.pce-result', { timeout: 8000 }).then(($results) => {
      if ($results.length === 0) {
        cy.log('Abby Newhook not on this roster in live data — skipping')
        return
      }
      cy.wrap($results).first().click()
      cy.get('.pcp-backdrop', { timeout: 10000 }).should('exist')
      cy.get('.pcp-tab').contains('Possession').click()
      cy.contains(/WAR\/RAPM|not available for PWHL/i).should('exist')
    })
  })
})

describe('PWHL goalie comparison', () => {
  beforeEach(() => {
    cy.visit('/pwhl/players', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
      },
    })
    // Real BOS goalies (Roster tab, Goalies section) — PWHL has no
    // fixture command for named players the way cy.team() does for NHL,
    // so these are hardcoded real names, same convention player-search.cy.js
    // already uses for McDavid/Poulin/Crosby.
    cy.contains('.player-card', 'Frankel', { timeout: 8000 }).click()
    cy.get('.player-popup', { timeout: 10000 }).should('exist')
    cy.contains('GP', { timeout: 10000 }).should('exist')
  })

  // Regression: PWHL goalie-vs-goalie was hard-blocked ("percentile
  // tracking for PWHL goalies hasn't been built") until 2026-08, when
  // eyewall-pipeline's pwhl_goalie_percentiles.py + eyewall-poller's
  // /pwhl/goalie/percentiles shipped real GSAX/GSAX-60/5v5/HD/MD/PK SV%
  // data. Same shape as the NHL goalie comparison test above -- own
  // Record/Performance/Advanced tabs, not the skater tab set, real radar.
  it('compares two goalies with their own Record/Performance/Advanced tabs and a real radar, not a broken-empty one', () => {
    cy.get('.pce-toggle').click()
    cy.get('.pce-input').type('thiele')
    cy.contains('.pce-result', 'Thiele', { timeout: 8000 }).click()

    cy.get('.pcp-backdrop', { timeout: 10000 }).should('exist')
    cy.contains('Frankel').should('exist')
    cy.contains('Thiele').should('exist')
    cy.contains(/PWHL goalie comparison isn.t available yet/i).should('not.exist')

    ;['Record', 'Performance', 'Advanced'].forEach((tab) => {
      cy.get('.pcp-tab').contains(tab).should('exist')
    })
    cy.get('.pcp-tab').contains('Scoring').should('not.exist')
    cy.get('.pcp-radar svg', { timeout: 10000 }).should('exist')

    cy.get('.pcp-tab').contains('Record').click()
    cy.get('.stat-tile', { timeout: 10000 }).should('have.length.greaterThan', 0)

    cy.get('.pcp-tab').contains('Advanced').click()
    cy.get('.pcp-pct-col', { timeout: 10000 }).should('have.length.greaterThan', 0)
  })
})
