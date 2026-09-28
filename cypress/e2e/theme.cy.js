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
  cy.contains('Appearance').should('exist')
}

const closeSettings = () => {
  cy.get('.notif-close').click()
}

// ── Theme toggle ──────────────────────────────────────────────────────────

describe('Theme toggle', () => {
  it("follows the device's dark setting for a new user", () => {
    // e2e.js beforeEach seeds eyewall:team but not eyewall:theme, and pins
    // the device setting to dark
    cy.visit('/')
    assertDataTheme('dark')
    cy.window().then(win => {
      expect(win.localStorage.getItem('eyewall:theme')).to.equal(null)
    })
  })

  it("follows the device's light setting for a new user", () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.__eyewallSystemScheme = 'light'
      },
    })
    assertDataTheme('light')
    openSettings()
    cy.get('.settings-theme-system').should('have.attr', 'aria-checked', 'true')
    closeSettings()
    cy.window().then(win => {
      expect(win.localStorage.getItem('eyewall:theme')).to.equal(null)
    })
  })

  it("keeps a saved choice even when the device's setting differs", () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.__eyewallSystemScheme = 'light'
        win.localStorage.setItem('eyewall:theme', 'dark')
      },
    })
    assertDataTheme('dark')
  })

  it('saves the choice once the user picks a theme, overriding the device', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.__eyewallSystemScheme = 'light'
      },
    })
    openSettings()
    cy.get('.settings-theme-dark').click()
    assertDataTheme('dark')
    assertStoredTheme('dark')
    closeSettings()
    cy.reload()
    assertDataTheme('dark')
  })

  it('switches to light mode, updates data-theme and localStorage immediately', () => {
    cy.visit('/')
    openSettings()
    cy.get('.settings-theme-light').click()
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
    cy.get('.settings-theme-dark').click()
    assertDataTheme('dark')
    assertStoredTheme('dark')
    closeSettings()
    cy.assertNoErrors()
  })

  it('persists light mode across a full page reload', () => {
    cy.visit('/')
    openSettings()
    cy.get('.settings-theme-light').click()
    closeSettings()

    cy.reload()
    assertDataTheme('light')
    assertStoredTheme('light')
  })

  it('persists light mode across navigation to all main routes', () => {
    cy.visit('/')
    openSettings()
    cy.get('.settings-theme-light').click()
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

// ── The Appearance choice shown reflects the current setting ─────────────

describe('Appearance choice', () => {
  it('shows Dark picked when dark is saved', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:theme', 'dark')
      },
    })
    openSettings()
    cy.get('.settings-theme-dark').should('have.attr', 'aria-checked', 'true')
    cy.get('.settings-theme-light').should('have.attr', 'aria-checked', 'false')
    closeSettings()
  })

  it('shows Light picked when light is saved', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:theme', 'light')
      },
    })
    openSettings()
    cy.get('.settings-theme-light').should('have.attr', 'aria-checked', 'true')
    closeSettings()
  })

  it('Match device forgets the saved choice and follows the device again', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.__eyewallSystemScheme = 'light'
        win.localStorage.setItem('eyewall:theme', 'dark')
      },
    })
    assertDataTheme('dark')
    openSettings()
    cy.get('.settings-theme-system').click().should('have.attr', 'aria-checked', 'true')
    assertDataTheme('light')
    cy.window().then(win => {
      expect(win.localStorage.getItem('eyewall:theme')).to.equal(null)
    })
    closeSettings()
  })
})
