// cypress/e2e/french-locale.cy.js
// French is loaded on demand (its own chunk, i18n/index.js): a French user
// gets French from the first render, never English first, and switching
// language in Settings loads it without a reload. Every other spec forces
// English (support/e2e.js).

const NAV = '.nav-tab'

describe('French', () => {
  it('renders in French from the start for a French user', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:locale', 'fr')
        // Every text node the app commits, from the first render on.
        win.__texts = []
        new win.MutationObserver(records => {
          for (const r of records) for (const n of r.addedNodes) if (n.textContent) win.__texts.push(n.textContent)
        }).observe(win.document, { childList: true, subtree: true })
      },
    })
    cy.get(NAV, { timeout: 10000 }).should('contain', 'Carte des tirs').and('contain', 'Calendrier')
    // The English nav labels were never on screen.
    cy.window().then(win => {
      const seen = win.__texts.join(' | ')
      expect(seen, 'the French nav was recorded').to.contain('Carte des tirs')
      expect(seen, 'no English nav first').not.to.match(/Shot Map.*Schedule/)
    })
    cy.assertNoErrors()
  })

  it('switches to French in Settings without a reload', () => {
    cy.visit('/')
    cy.get(NAV, { timeout: 10000 }).should('contain', 'Shot Map')
    cy.window().then(win => { win.__sameDocument = true })
    cy.get('.notif-bell').click()
    cy.contains('Appearance').should('exist')
    cy.contains('button', 'Français').click()
    cy.contains('Apparence', { timeout: 10000 }).should('exist')
    cy.get('.notif-close').click()
    cy.get(NAV).should('contain', 'Carte des tirs')
    cy.window().its('__sameDocument').should('equal', true)
    cy.window().its('localStorage').invoke('getItem', 'eyewall:locale').should('equal', 'fr')
  })
})
