// cypress/e2e/theme.cy.js

// ── Helpers ───────────────────────────────────────────────────────────────

const seedTheme = (mode) => {
  cy.window().then(win => {
    win.localStorage.setItem('eyewall:theme', mode)
  })
}

const assertDataTheme = (mode) => {
  cy.get('html').should('have.attr', 'data-theme', mode)
}

const assertStoredTheme = (mode) => {
  cy.window().then(win => {
    expect(win.localStorage.getItem('eyewall:theme')).to.equal(mode)
  })
}

const openSettings = () => {
  cy.get('.notif-bell').click()
  cy.contains('🎨 Appearance').should('exist')
}

const closeSettings = () => {
  cy.get('.notif-close').click()
}

// ── Theme toggle ──────────────────────────────────────────────────────────

describe('Theme toggle', () => {
  it('defaults to dark mode for a new user', () => {
    // e2e.js beforeEach seeds eyewall:team but not eyewall:theme
    cy.visit('/')
    assertDataTheme('dark')
  })

  it('switches to light mode, updates data-theme and localStorage immediately', () => {
    cy.visit('/')
    openSettings()
    cy.contains('Light mode').click()
    assertDataTheme('light')
    assertStoredTheme('light')
    closeSettings()
    cy.assertNoErrors()
  })

  it('switches back to dark mode from light', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:theme', 'light')
      },
    })
    assertDataTheme('light')
    openSettings()
    cy.contains('Dark mode').click()
    assertDataTheme('dark')
    assertStoredTheme('dark')
    closeSettings()
    cy.assertNoErrors()
  })

  it('persists light mode across a full page reload', () => {
    cy.visit('/')
    openSettings()
    cy.contains('Light mode').click()
    closeSettings()

    cy.reload()
    assertDataTheme('light')
    assertStoredTheme('light')
  })

  it('persists light mode across navigation to all main routes', () => {
    cy.visit('/')
    openSettings()
    cy.contains('Light mode').click()
    closeSettings()

    const routes = ['/', '/schedule', '/players', '/team', '/news']
    routes.forEach(path => {
      cy.visit(path)
      assertDataTheme('light')
      assertStoredTheme('light')
      cy.get('body').should('not.contain', 'Something went wrong')
    })
  })

  it('persists dark mode across navigation to all main routes', () => {
    cy.visit('/')
    // dark is the default — explicitly set it so the test doesn't rely on absence of a key
    seedTheme('dark')

    const routes = ['/', '/schedule', '/players', '/team', '/news']
    routes.forEach(path => {
      cy.visit(path)
      assertDataTheme('dark')
    })
  })
})

// ── Button label reflects current theme ──────────────────────────────────

describe('Theme toggle button label', () => {
  it('shows "Light mode" button when in dark mode', () => {
    cy.visit('/')
    openSettings()
    cy.contains('Light mode').should('exist')
    cy.contains('Dark mode').should('not.exist')
    closeSettings()
  })

  it('shows "Dark mode" button when in light mode', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:theme', 'light')
      },
    })
    openSettings()
    cy.contains('Dark mode').should('exist')
    cy.contains('Light mode').should('not.exist')
    closeSettings()
  })
})
