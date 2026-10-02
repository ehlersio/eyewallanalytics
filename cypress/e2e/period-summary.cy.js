// cypress/e2e/period-summary.cy.js

// Pins the game-summary-chip-dependent blocks below to a real, permanent
// CAR game (2026-05-21 playoff win over MTL, gameState OFF) via the app's
// own ?mockGame= dev feature (nhlApi.js:getLiveGame -- DEV-only, statically
// eliminated from production builds, verified against a real `npm run
// build` output during Session 67). Without this, period-summary chips
// only render for a live/very-recent NHL game, which is false for ~4
// months a year (off-season). Same fix applied to shot-map.cy.js's 'Shot
// Map' block, which has the identical dependency.
const MOCK_GAME_ID = '2025030311'

// Opening a summary from the bell only works once the view has settled
// on the mock game. Until ?mockGame='s own lookup comes back, the view
// shows the favorite's most recent real game and lists THAT game's
// summaries in the bell; when the mock goes live it drops them and
// rebuilds for the mock. A chip clicked just before that switch points at
// a summary that no longer exists until the rebuild finishes -- on a slow
// CI runner, longer than the 5s the popup gets, which is how both popup
// blocks below failed intermittently. Wait for the live score bar first.
function waitForMockGameLive() {
  cy.get('.score-card', { timeout: DATA_TIMEOUT }).should('contain', 'LIVE')
}

describe('Settings (⚙️ button)', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.window().then(win => win.sessionStorage.clear())
    cy.visit('/')
    cy.team().then(t => cy.contains(t.abbr, { timeout: 10000 }).should('exist'))
  })

  it('renders the Settings button in the topbar', () => {
    cy.get('button.notif-bell').should('exist').should('contain', '⚙️')
  })

  it('opens the Settings drawer on click', () => {
    cy.get('button.notif-bell').click()
    cy.get('.notif-popup').should('be.visible')
    cy.contains('.notif-title', 'Settings').should('exist')
  })

  it('drawer shows Your teams with the team, marked primary', () => {
    cy.get('button.notif-bell').click()
    cy.contains('Your teams').should('exist')
    cy.team().then(t => cy.contains('.settings-team-row', t.displayName).should('contain', 'Primary'))
  })

  it('drawer offers Manage teams', () => {
    cy.get('button.notif-bell').click()
    cy.get('.settings-manage-teams').should('contain', 'Manage teams')
  })

  it('drawer shows push notification toggle section', () => {
    cy.get('button.notif-bell').click()
    cy.get('.settings-alerts-row').should('contain', 'Notifications').click()
    cy.contains('.notif-title', 'Alerts').should('exist')
    cy.contains(/Turn on notifications|Turn off notifications|Notifications are blocked|aren.t supported|Home Screen/i).should('exist')
  })

  it('lists only the alerts the team’s league sends, and goes back to Settings', () => {
    cy.get('button.notif-bell').click()
    cy.get('.settings-alerts-row').click()
    cy.get('.settings-pref-goal [role=switch]').should('exist')
    // An NHL favorite gets end-of-period alerts (other leagues don't send them).
    cy.get('.settings-pref-periodEnd [role=switch]').should('have.attr', 'aria-checked', 'true')
    cy.get('.settings-back').click()
    cy.contains('.notif-title', 'Settings').should('exist')
  })

  it('a switch on the Alerts screen saves that choice on the device', () => {
    cy.get('button.notif-bell').click()
    cy.get('.settings-alerts-row').click()
    cy.get('.settings-pref-hatTrick [role=switch]').click().should('have.attr', 'aria-checked', 'false')
    cy.window().then(win => {
      expect(JSON.parse(win.localStorage.getItem('eyewall:notif:prefs')).hatTrick).to.equal(false)
    })
  })

  it('About EyeWall opens the About popup', () => {
    cy.get('button.notif-bell').click()
    cy.get('.settings-about-row').click()
    cy.get('.notif-popup').should('not.exist')
    cy.get('.about-popup').should('be.visible')
  })

  it('no longer lists game summaries in Settings -- the bell has them', () => {
    cy.get('button.notif-bell').click()
    cy.get('.notif-popup').should('be.visible')
    cy.get('.notif-popup .notif-summary-chip').should('not.exist')
  })

  it('closes the drawer when X is clicked', () => {
    cy.get('button.notif-bell').click()
    cy.get('.notif-popup').should('be.visible')
    cy.get('.notif-close').click()
    cy.get('.notif-popup').should('not.exist')
  })

  describe('Game summaries (🔔 bell)', () => {
    beforeEach(() => {
      cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
      cy.team().then(t => cy.contains(t.abbr, { timeout: 10000 }).should('exist'))
    })

    it('shows period chips after summaries load', () => {
      cy.get('button.summary-bell').click()
      cy.contains(/P1|P2|P3|FINAL/, { timeout: 15000 }).should('exist')
    })

    it('period chips show period label and goal score', () => {
      // Summaries exist once the bell's dot shows (sessionStorage and localStorage start empty).
      cy.get('.summary-bell-dot', { timeout: DATA_TIMEOUT }).should('exist')
      cy.get('button.summary-bell').click()
      cy.get('.notif-summary-chip', { timeout: 15000 }).should('have.length.greaterThan', 0)
      cy.get('.notif-summary-chip').first().within(() => {
        cy.get('.notif-summary-chip-period').should('exist')
        cy.get('.notif-summary-chip-score').should('exist')
      })
    })

    it('score chip uses team abbr not hardcoded CAR', () => {
      cy.get('button.summary-bell').click()
      cy.team().then(t => {
        cy.get('.notif-summary-chip', { timeout: 15000 }).first().within(() => {
          cy.get('.notif-summary-chip-score').invoke('text')
            .should('match', new RegExp(`${t.abbr} \\d+`))
        })
      })
    })

    it('FINAL chip is styled distinctly', () => {
      // Summaries exist once the bell's dot shows (sessionStorage and localStorage start empty).
      cy.get('.summary-bell-dot', { timeout: DATA_TIMEOUT }).should('exist')
      cy.get('button.summary-bell').click()
      cy.get('.notif-summary-chip-game', { timeout: 15000 }).should('exist')
      cy.get('.notif-summary-chip-game .notif-summary-chip-period').should('contain', 'FINAL')
    })
  })
})

describe('Period Summary popup', () => {
  beforeEach(() => {
    cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
    cy.window().then(win => win.sessionStorage.clear())
    cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
    cy.team().then(t => cy.contains(t.abbr, { timeout: 10000 }).should('exist'))
    waitForMockGameLive()
    // Summaries exist once the bell's dot shows (sessionStorage and localStorage start empty).
    cy.get('.summary-bell-dot', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('button.summary-bell').click()
    cy.get('.notif-summary-chip', { timeout: 15000 }).first().click()
    cy.get('.ps-card', { timeout: 5000 }).should('exist')
  })

  it('shows period badge in header', () => {
    cy.get('.ps-period-badge').should('exist')
  })

  it('shows score banner with team abbreviations', () => {
    cy.get('.ps-score-banner').should('exist')
    cy.get('.ps-team-abbr').should('have.length.greaterThan', 0)
    cy.get('.ps-score-num').should('have.length', 2)
  })

  it('shows team logos', () => {
    cy.get('.ps-team-logo').should('have.length', 2)
  })

  it('shows stat grid with 6 cells', () => {
    cy.get('.ps-stat-grid').should('exist')
    cy.get('.ps-stat-cell').should('have.length', 6)
  })

  it('stat grid uses team abbr in labels', () => {
    cy.team().then(t => {
      cy.contains(new RegExp(`${t.abbr} Corsi For%`)).should('exist')
      cy.contains('Shots on Goal').should('exist')
      cy.contains(new RegExp(`${t.abbr} Fenwick For%`)).should('exist')
      cy.contains(new RegExp(`${t.abbr} Hits`)).should('exist')
      cy.contains('Faceoff Win%').should('exist')
      cy.contains('High Danger Chances').should('exist')
    })
  })

  it('shows EyeWall AI section', () => {
    cy.contains('EyeWall AI').should('exist')
    cy.get('.ps-narrative').should('exist')
  })

  it('AI narrative loads within 15 seconds', () => {
    cy.get('.ps-narrative-text', { timeout: 30000 }).should('exist')
    cy.get('.ps-narrative-loading').should('not.exist')
  })

  it('shows penalties section when penalties exist', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-penalties').length) {
        cy.get('.ps-penalty-row').should('have.length.greaterThan', 0)
        cy.get('.ps-penalty-team').should('exist')
        cy.get('.ps-penalty-player').should('exist')
      }
    })
  })

  it('collapses penalties beyond 3 with show more toggle', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-penalties-toggle').length) {
        cy.get('.ps-penalties-toggle').should('contain', 'Show')
        cy.get('.ps-penalties-toggle').click()
        cy.get('.ps-penalties-toggle').should('contain', 'Show less')
      }
    })
  })

  it('shows goals section with carousel when goals exist', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-carousel').length) {
        cy.get('.ps-carousel').should('exist')
        cy.get('.ps-carousel-dots').should('exist')
        cy.get('.ps-goal-card').should('exist')
        cy.get('.ps-goal-scorer').should('exist')
      }
    })
  })

  it('carousel navigation arrows work', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-carousel').length) {
        const dots = $body.find('.ps-carousel-dot').length
        if (dots > 1) {
          cy.get('.ps-carousel-arrow').last().click()
          cy.get('.ps-carousel-counter').should('contain', '2 /')
        }
      }
    })
  })

  it('shows the share button', () => {
    cy.get('.ps-share-section').should('exist')
    cy.get('.share-buttons-row').should('exist')
    cy.contains('Share').should('exist')
  })

  it('closes when X button is clicked', () => {
    cy.get('.ps-header .ps-btn-icon').click()
    cy.get('.ps-card').should('not.exist')
  })
})

describe('Final Game Summary popup', () => {
  beforeEach(() => {
    cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
    cy.window().then(win => win.sessionStorage.clear())
    cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
    cy.team().then(t => cy.contains(t.abbr, { timeout: 10000 }).should('exist'))
    waitForMockGameLive()
    // Summaries exist once the bell's dot shows (sessionStorage and localStorage start empty).
    cy.get('.summary-bell-dot', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('button.summary-bell').click()
    cy.get('.notif-summary-chip-game', { timeout: 15000 }).click()
    cy.get('.ps-card', { timeout: 5000 }).should('exist')
  })

  it('shows FINAL badge', () => {
    cy.get('.ps-period-badge').should('contain', 'FINAL')
  })

  it('shows period breakdown section', () => {
    cy.get('.ps-period-breakdown', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('.ps-period-row').should('have.length.greaterThan', 0)
  })

  it('period breakdown shows CF% per period', () => {
    cy.get('.ps-period-row-pct').should('have.length.greaterThan', 0)
    cy.get('.ps-period-row-pct').first().invoke('text').should('match', /\d+%/)
  })

  it('shows three stars section', () => {
    cy.contains('Three Stars', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('.ps-star-card').should('have.length', 3)
    cy.get('.ps-star-name').should('have.length', 3)
  })

  it('goals section is labeled Goals not Goals This Period', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-goals').length) {
        cy.get('.ps-section-label').contains(/Goals \(\d+\)/).should('exist')
      }
    })
  })

  it('shows all goals not just first 4', () => {
    cy.get('body').then($body => {
      if ($body.find('.ps-goals').length) {
        cy.get('.ps-carousel-dot').should('have.length.greaterThan', 3)
      }
    })
  })
})

describe('Notifications bell', () => {
  it('shows a dot for a summary not yet seen, and clears it once opened', () => {
    // The dot also lights for a new live alert, and the bell refetches
    // /alerts/recent. On a game night a real goal alert landing between
    // opening the panel and the reload relit it -- this failed twice that
    // way (2026-10-02). This test is about summaries, so no alerts.
    cy.intercept('GET', '**/alerts/recent*', [])
    cy.visit(`/?mockGame=${MOCK_GAME_ID}`, {
      onBeforeLoad(win) { win.localStorage.removeItem('eyewall:summaries-seen') },
    })
    waitForMockGameLive()
    cy.get('.summary-bell-dot', { timeout: 15000 }).should('exist')
    cy.get('button.summary-bell').click()
    cy.get('.summary-bell-panel .notif-summary-chip').should('have.length.greaterThan', 0)
    cy.get('.summary-bell-dot').should('not.exist')
    cy.get('.summary-bell-close').click()
    cy.reload()
    waitForMockGameLive()
    cy.get('button.summary-bell').should('exist')
    cy.get('.summary-bell-dot').should('not.exist')
  })

  it('says why it’s empty when there are no summaries or alerts yet', () => {
    // Loaded straight onto the League page, no game view has built any.
    cy.intercept('GET', '**/alerts/recent*', []).as('alerts')
    cy.visit('/league')
    cy.wait('@alerts')
    cy.get('button.summary-bell').click()
    cy.get('.summary-bell-panel .notif-summary-chip').should('not.exist')
    cy.get('.summary-bell-empty').should('contain', 'summaries')
  })

  it('Alert settings opens Settings on the Alerts screen', () => {
    cy.visit('/')
    cy.get('button.summary-bell').click()
    cy.get('.summary-bell-alert-settings').click()
    cy.get('.summary-bell-panel').should('not.exist')
    cy.contains('.notif-popup .notif-title', 'Alerts').should('be.visible')
  })

  it('opening one top-bar panel closes the other', () => {
    cy.visit('/')
    cy.get('button.notif-bell').click()
    cy.get('.notif-popup').should('exist')
    cy.get('.notif-close').click()
    cy.get('button.summary-bell').click()
    cy.get('.summary-bell-panel').should('exist')
    cy.get('.notif-popup').should('not.exist')
  })

  it('is there for AHL too, with its recent alerts (no summaries there)', () => {
    cy.intercept('GET', '**/alerts/recent*', req => {
      expect(req.query.teams).to.eq('AHL:HER')
      req.reply([{ team: 'AHL:HER', vs: 'AHL:HFD', type: 'goal', title: '🚨 GOAL! HER 1–0 HFD', body: 'Bears score', url: '/ahl/shots', at: Date.now() - 60000 }])
    })
    cy.visit('/ahl/shots', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'ahl')
        win.localStorage.setItem('eyewall:ahl_team', JSON.stringify({ abbr: 'HER', teamId: 319 }))
      },
    })
    cy.get('button.summary-bell', { timeout: DATA_TIMEOUT }).click()
    cy.contains('.summary-bell-alert', 'GOAL! HER 1–0 HFD').should('contain', 'Bears score')
  })
})

describe('Notifications bell: recent alerts', () => {
  const now = () => Date.now()
  const alerts = () => [
    { team: 'NHL:CAR', vs: 'NHL:BOS', type: 'periodEnd', title: '🔔 End of P1', body: 'CAR 1–0 BOS after P1', url: '/?summary=1&game=2026020001', at: now() - 2 * 60000 },
    { team: 'NHL:BOS', vs: 'NHL:CAR', type: 'oppGoal', title: 'CAR scores. BOS 0–1 CAR', body: '', url: '/', at: now() - 5 * 60000 },
    { team: 'NHL:CAR', vs: 'NHL:BOS', type: 'goal', title: '🚨 GOAL! CAR 1–0 BOS', body: 'Aho (Jarvis)', url: '/', at: now() - 5 * 60000 },
  ]
  const followBoth = win => win.localStorage.setItem('eyewall:followed', JSON.stringify([
    { sport: 'nhl', abbr: 'CAR' }, { sport: 'nhl', abbr: 'BOS' },
  ]))

  beforeEach(() => cy.intercept('GET', '**/alerts/recent*', alerts()).as('alerts'))

  it('lists the followed teams’ alerts, newest first, once per event for a fan of both teams', () => {
    cy.visit('/league', { onBeforeLoad: followBoth })
    cy.wait('@alerts')
    cy.get('button.summary-bell').click()
    cy.get('.summary-bell-alert').should('have.length', 2)
    cy.get('.summary-bell-alert').first().should('contain', 'End of P1')
    cy.get('.summary-bell-alert').last().should('contain', 'GOAL! CAR 1–0 BOS')
    cy.contains('.summary-bell-alert', 'BOS 0–1 CAR').should('not.exist')
  })

  it('an alert with a link opens it', () => {
    cy.visit('/league', { onBeforeLoad: followBoth })
    cy.get('button.summary-bell').click()
    cy.contains('button.summary-bell-alert', 'End of P1').click()
    cy.location('pathname').should('eq', '/')
    cy.get('.summary-bell-panel').should('not.exist')
  })

  it('shows a dot only for alerts newer than the last look', () => {
    cy.visit('/league', {
      onBeforeLoad(win) {
        followBoth(win)
        // Last looked 3 minutes ago: the End of P1 alert (2 minutes ago) is new.
        win.localStorage.setItem('eyewall:alerts-seen-at', String(Date.now() - 3 * 60000))
      },
    })
    cy.wait('@alerts')
    cy.get('.summary-bell-dot').should('exist')
    cy.get('button.summary-bell').click()
    cy.get('.summary-bell-dot').should('not.exist')
  })

  // Clearing (2026-09-30): on this device only -- the poller's log is
  // shared per team.
  it('the × clears one alert, and it stays cleared', () => {
    cy.visit('/league', { onBeforeLoad: followBoth })
    cy.get('button.summary-bell').click()
    // Shows on hover; Cypress can't hover, so force the click.
    cy.contains('.swipe-row', 'GOAL! CAR 1–0 BOS').find('.swipe-row-x').click({ force: true })
    cy.contains('.summary-bell-alert', 'GOAL! CAR 1–0 BOS').should('not.exist')
    cy.location('pathname').should('eq', '/league')
    cy.reload()
    cy.get('button.summary-bell').click()
    cy.get('.summary-bell-alert').should('have.length', 1).and('contain', 'End of P1')
  })

  it('swiping a row left shows its delete button, which clears it', () => {
    cy.visit('/league', { onBeforeLoad: followBoth })
    cy.get('button.summary-bell').click()
    cy.contains('.swipe-row', 'End of P1').then($row => {
      const { right, top, height } = $row[0].getBoundingClientRect()
      const y = top + height / 2
      const at = x => ({ touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] })
      cy.wrap($row).trigger('touchstart', at(right - 10))
        .trigger('touchmove', at(right - 40)).trigger('touchmove', at(right - 90))
        .trigger('touchend', { touches: [], changedTouches: [{ clientX: right - 90, clientY: y }] })
    })
    cy.contains('.swipe-row', 'End of P1').find('.swipe-row-delete').click()
    cy.contains('.summary-bell-alert', 'End of P1').should('not.exist')
    cy.location('pathname').should('eq', '/league')
  })

  it('Clear all clears every alert there is now, not ones after', () => {
    const before = alerts() // the same times on both loads
    cy.intercept('GET', '**/alerts/recent*', before)
    cy.visit('/league', { onBeforeLoad: followBoth })
    cy.get('button.summary-bell').click()
    cy.get('.summary-bell-clear-all').click()
    cy.get('.summary-bell-alert').should('not.exist')
    cy.get('.summary-bell-empty').should('exist')
    cy.get('.summary-bell-clear-all').should('not.exist')
    cy.intercept('GET', '**/alerts/recent*', [
      { team: 'NHL:CAR', vs: 'NHL:BOS', type: 'win', title: '🏆 CAR Win!', body: '', url: '/', at: Date.now() + 60000 },
      ...before,
    ])
    cy.reload()
    cy.get('button.summary-bell').click()
    cy.get('.summary-bell-alert').should('have.length', 1).and('contain', 'CAR Win!')
  })

  it('a first look counts what’s there as seen: no dot', () => {
    cy.visit('/league', { onBeforeLoad: followBoth })
    cy.wait('@alerts')
    cy.get('button.summary-bell').should('exist')
    cy.get('.summary-bell-dot').should('not.exist')
  })
})
