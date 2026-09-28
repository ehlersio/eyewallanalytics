// cypress/e2e/tour.cy.js
// The app tour (utils/tour.js, components/TourHost.jsx). cypress/support
// marks it done for every other spec; each test here sets its own state.

const tourState = win => JSON.parse(win.localStorage.getItem('eyewall:tour') || '{}')
const withTour = state => win => {
  if (state === null) win.localStorage.removeItem('eyewall:tour')
  else win.localStorage.setItem('eyewall:tour', JSON.stringify(state))
}

// Next until the last stop's Done, checking each popover as it comes.
function stepThrough() {
  cy.get('.eyewall-tour .driver-popover-progress-text', { timeout: DATA_TIMEOUT }).invoke('text').then(text => {
    const [, current, total] = text.match(/(\d+) of (\d+)/)
    cy.get('.eyewall-tour .driver-popover-title').should('not.be.empty')
    cy.get('.eyewall-tour .driver-popover-next-btn').click()
    if (Number(current) < Number(total)) {
      cy.get('.eyewall-tour .driver-popover-progress-text').should('contain', `${Number(current) + 1} of ${total}`)
      stepThrough()
    }
  })
}

describe('App tour', () => {
  it('invites someone already using the app, once', () => {
    cy.visit('/', { onBeforeLoad: withTour(null) })
    cy.get('.tour-invite', { timeout: DATA_TIMEOUT }).should('contain', 'Take the tour')
    cy.get('.tour-invite-dismiss').click()
    cy.get('.tour-invite').should('not.exist')
    cy.window().then(win => expect(tourState(win)).to.include({ invited: true }))
    cy.reload()
    cy.get('.score-card', { timeout: DATA_TIMEOUT }).should('exist')
    cy.wait(2500) // past when the invite would have appeared
    cy.get('.tour-invite').should('not.exist')
  })

  it('takes the tour from the invite, all the way through', () => {
    cy.visit('/', { onBeforeLoad: withTour(null) })
    cy.get('.tour-invite-start', { timeout: DATA_TIMEOUT }).click()
    cy.get('.eyewall-tour .driver-popover-title', { timeout: DATA_TIMEOUT }).should('contain', 'Your game')
    stepThrough()
    cy.get('.eyewall-tour').should('not.exist')
    cy.get('.driver-overlay').should('not.exist')
    // Saved by driver.js's onDestroyed, a moment after the popover goes.
    cy.window().its('localStorage').invoke('getItem', 'eyewall:tour').should('contain', '"done":true')
  })

  it('starts by itself right after a first team is picked', () => {
    cy.visit('/', { onBeforeLoad: withTour({ pending: true }) })
    cy.get('.eyewall-tour .driver-popover-title', { timeout: DATA_TIMEOUT }).should('contain', 'Your game')
    cy.get('.tour-invite').should('not.exist')
  })

  it('leaves out stops that aren’t on screen', () => {
    // One followed team: no team switcher to point at.
    cy.visit('/', { onBeforeLoad: withTour({ pending: true }) })
    cy.get('.eyewall-tour .driver-popover-progress-text', { timeout: DATA_TIMEOUT }).should('contain', 'of 6')
  })

  it('closing it early still counts as done', () => {
    cy.visit('/', { onBeforeLoad: withTour({ pending: true }) })
    cy.get('.eyewall-tour .driver-popover-close-btn', { timeout: DATA_TIMEOUT }).click()
    cy.get('.eyewall-tour').should('not.exist')
    // Saved by driver.js's onDestroyed, a moment after the popover goes.
    cy.window().its('localStorage').invoke('getItem', 'eyewall:tour').should('contain', '"done":true')
  })

  it('Settings > Help > Take the tour replays it, from any page', () => {
    cy.visit('/schedule', { onBeforeLoad: withTour({ done: true }) })
    cy.get('button.notif-bell').click()
    cy.get('.settings-tour-row').click()
    cy.location('pathname').should('eq', '/')
    cy.get('.eyewall-tour .driver-popover-title', { timeout: DATA_TIMEOUT }).should('contain', 'Your game')
  })
})
