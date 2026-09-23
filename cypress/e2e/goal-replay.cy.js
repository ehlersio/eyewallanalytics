// cypress/e2e/goal-replay.cy.js
// Goal replay in the period / game summary: Video | Tracking.
//
// Same pinned game as period-summary.cy.js (?mockGame= -- a real, permanent
// CAR playoff game with goal videos). The Worker's /nhl/goal-replay is
// stubbed with a small synthetic replay (fixtures/goal-replay.json, puck in
// the net at frame 30) so these don't depend on the NHL's tracking feed or
// on the Worker route being deployed.
const MOCK_GAME_ID = '2025030311'

// A controlled React range input only sees a value set through the native
// setter followed by an input event (jQuery's .val() bypasses React).
function scrubTo(frame) {
  cy.get('.goal-tracking-scrubber').then($el => {
    const win = $el[0].ownerDocument.defaultView // the app's window, not Cypress's
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set
    setter.call($el[0], String(frame))
    $el[0].dispatchEvent(new win.Event('input', { bubbles: true }))
  })
}

function openSummary() {
  cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
  cy.window().then(win => win.sessionStorage.clear())
  cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
  cy.team().then(t => cy.contains(t.abbr, { timeout: 10000 }).should('exist'))
  cy.get('button.notif-bell').click()
  cy.get('.notif-summary-chip', { timeout: 15000 }).first().click()
  cy.get('.ps-card', { timeout: 5000 }).should('exist')
  cy.get('.ps-goal-card', { timeout: 10000 }).should('exist')
}

describe('Goal replay: Video | Tracking', () => {
  describe('with tracking available', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/nhl/goal-replay/**', { fixture: 'goal-replay.json' }).as('replay')
      openSummary()
      cy.wait('@replay')
    })

    it('offers both, with the video first as before', () => {
      cy.get('.goal-replay-switch-btn').should('have.length', 2)
      cy.get('.goal-replay-switch-btn.on').should('contain', 'Video')
      cy.get('.goal-replay iframe').should('exist')
    })

    it('Tracking draws every skater and the puck, the scorer ringed', () => {
      cy.contains('.goal-replay-switch-btn', 'Tracking').click()
      cy.get('.goal-tracking-replay svg').should('exist')
      cy.get('.goal-replay iframe').should('not.exist')
      cy.get('.goal-tracking-player').should('have.length', 4)
      cy.get('.goal-tracking-puck').should('exist')
      cy.get('.goal-tracking-player').filter((_, g) => g.querySelectorAll('circle').length === 2)
        .should('have.length', 1).and('contain', '20')
      cy.contains('Player & puck tracking: NHL EDGE').should('exist')
    })

    it('shows GOAL once the puck is in the net', () => {
      cy.contains('.goal-replay-switch-btn', 'Tracking').click()
      scrubTo(29) // scrubbing also pauses playback
      cy.get('.goal-tracking-goal').should('not.exist')
      scrubTo(31)
      cy.get('.goal-tracking-goal').should('contain', 'GOAL')
    })

    it('dragging the scrubber does not swipe the carousel to another goal', () => {
      cy.contains('.goal-replay-switch-btn', 'Tracking').click()
      cy.get('.goal-tracking-scrubber').should('exist')
      cy.get('.ps-carousel-counter').invoke('text').then(before => {
        cy.get('.goal-tracking-scrubber')
          .trigger('touchstart', { touches: [{ clientX: 300, clientY: 10 }] })
          .trigger('touchend', { changedTouches: [{ clientX: 100, clientY: 10 }] })
        cy.get('.ps-carousel-counter').should('have.text', before)
      })
    })
  })

  describe('in the shot map goal popup', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/nhl/goal-replay/**', { fixture: 'goal-replay.json' }).as('replay')
      cy.visit(`/?mockGame=${MOCK_GAME_ID}`)
      cy.team().then(t => cy.contains(t.abbr, { timeout: 10000 }).should('exist'))
      cy.get('.rhr-svg circle[style*="cursor: pointer"]', { timeout: 20000 }).should('exist')
      // No cy.wait() on the two feeds: the tests above visit this same
      // game, so by now the app serves them from its own cache and the
      // requests never reach the network. openAGoal() waits for the data
      // instead, by way of what it renders.
    })

    // The rink's dots carry no marker for their event type, so open them
    // until one is a goal with its media -- the pinned game has 8 goals.
    //
    // Two reasons a dot can miss. It isn't a goal; or the rink is still
    // showing another game's events (it renders what it has and swaps this
    // game's in when both feeds arrive), and a goal from that one has ids
    // matching neither feed, so it gets no media. Both are "try the next
    // dot": by the time a few have been tried the swap has happened, and
    // if it never does, this fails rather than passing on a stale goal.
    // Each attempt re-queries by index -- the rink re-renders between
    // clicks, detaching anything held across one.
    const DOTS = '.rhr-svg circle[style*="cursor: pointer"]'
    function openAGoal(i = 0) {
      cy.get(DOTS).its('length').should('be.gt', i)
      cy.get(DOTS).eq(i).click({ force: true })
      cy.get('.rhr-popup').should('exist')
      cy.document().then(doc => {
        const isGoal = doc.querySelector('.rhr-popup-type-label')?.textContent === 'Goal'
        if (isGoal && doc.querySelector('.rhr-popup-media-section')) return
        cy.get('.rhr-popup-close').click()
        openAGoal(i + 1)
      })
    }

    it('puts our replay in a goal\'s popup, and plays the tracking', () => {
      openAGoal()
      // Video | Tracking when the goal also has a video, Tracking alone
      // when it doesn't -- which of the two depends on the game whose
      // feeds the dev harness has loaded, so this asserts the part that
      // is ours: the replay is in the popup and it plays.
      cy.get('.rhr-popup-media-section').should('exist')
      cy.get('.rhr-popup-media-section').then($media => {
        const tracking = $media.find('.goal-replay-switch-btn:contains(Tracking)')
        if (tracking.length) cy.wrap(tracking).click()
      })
      cy.get('.goal-tracking-player').should('have.length', 4)
      cy.get('.goal-tracking-puck').should('exist')
      cy.contains('Player & puck tracking: NHL EDGE').should('exist')
    })
  })

  describe('without tracking', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/nhl/goal-replay/**', { statusCode: 404, body: { available: false } }).as('replay')
      openSummary()
      cy.wait('@replay')
    })

    it('shows just the video, no switch', () => {
      cy.get('.goal-replay-switch').should('not.exist')
      cy.get('.goal-replay iframe').should('exist')
    })
  })
})
