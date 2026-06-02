// cypress/e2e/viewports.cy.js
// Runs smoke tests across mobile, tablet, and desktop viewports.
// Catches layout breakage, overflow, hidden nav, and truncated content
// that only appears at certain screen sizes.

const VIEWPORTS = [
  { label: 'Mobile S',  width: 375,  height: 812  }, // iPhone SE
  { label: 'Mobile L',  width: 430,  height: 932  }, // iPhone 15 Pro Max
  { label: 'Tablet',    width: 768,  height: 1024 }, // iPad
  { label: 'Desktop',   width: 1280, height: 800  }, // Standard laptop
]

const ROUTES = [
  { path: '/',         label: 'Shot Map',  checks: ['CAR', /FINAL|LIVE|P[123]|OT/i] },
  { path: '/schedule', label: 'Schedule',  checks: ['CAR', /W|L/] },
  { path: '/players',  label: 'Players',   checks: ['Forwards', 'Aho'] },
  { path: '/team',     label: 'Team',      checks: ['Carolina Hurricanes', 'Overview'] },
  { path: '/news',     label: 'News',      checks: ['EyeWall Analytics'] },
]

VIEWPORTS.forEach(({ label, width, height }) => {
  describe(`Viewport: ${label} (${width}×${height})`, () => {
    beforeEach(() => {
      cy.viewport(width, height)
    })

    // ── Every route loads ───────────────────────────────────
    ROUTES.forEach(({ path, label: routeLabel, checks }) => {
      it(`${routeLabel} loads and renders key content`, () => {
        cy.visit(path)
        checks.forEach(check => {
          if (typeof check === 'string') {
            cy.contains(check, { timeout: 8000 }).should('exist')
          } else {
            cy.contains(check, { timeout: 8000 }).should('exist')
          }
        })
        // No crash
        cy.get('body').should('not.contain', 'Something went wrong')
      })
    })

    // ── Bottom nav is always accessible ────────────────────
    it('bottom nav is accessible', () => {
      cy.visit('/')
      const tabs = ['Shot Map', 'Schedule', 'Players', 'Team', 'News']
      tabs.forEach(tab => {
        cy.contains(tab).should('exist')
      })
    })

    // ── No horizontal overflow ──────────────────────────────
    // A common responsive bug: content wider than the viewport
    // causes a horizontal scrollbar, breaking the layout.
    it('no horizontal overflow on Shot Map', () => {
      cy.visit('/')
      cy.window().then(win => {
        const docWidth  = win.document.documentElement.scrollWidth
        const winWidth  = win.innerWidth
        expect(docWidth, `Horizontal overflow at ${label}: doc=${docWidth} win=${winWidth}`)
          .to.be.lte(winWidth + 2) // +2px tolerance for rounding
      })
    })

    it('no horizontal overflow on Players', () => {
      cy.visit('/players')
      cy.contains('Forwards', { timeout: 8000 }).should('exist')
      cy.window().then(win => {
        const docWidth = win.document.documentElement.scrollWidth
        const winWidth = win.innerWidth
        expect(docWidth, `Horizontal overflow at ${label}: doc=${docWidth} win=${winWidth}`)
          .to.be.lte(winWidth + 2)
      })
    })

    it('no horizontal overflow on Team', () => {
      cy.visit('/team')
      cy.contains('Carolina Hurricanes', { timeout: 8000 }).should('exist')
      cy.window().then(win => {
        const docWidth = win.document.documentElement.scrollWidth
        const winWidth = win.innerWidth
        expect(docWidth, `Horizontal overflow at ${label}: doc=${docWidth} win=${winWidth}`)
          .to.be.lte(winWidth + 2)
      })
    })

    // ── Team tab navigation works at all sizes ──────────────
    it('Team tabs are clickable', () => {
      cy.visit('/team')
      cy.contains('Carolina Hurricanes', { timeout: 8000 }).should('exist')
      const tabs = ['Overview', 'Advanced', 'Splits', 'Trends', 'Cap & Picks']
      tabs.forEach(tab => {
        cy.contains(tab).should('exist').click()
        cy.get('body').should('not.contain', 'Something went wrong')
      })
    })

    // ── Player card opens and is usable ────────────────────
    it('player card opens and shows content', () => {
      cy.visit('/players')
      cy.contains('Forwards', { timeout: 8000 }).should('exist')
      cy.contains('Aho').first().click()
      cy.contains(/Cap Hit|AAV/i, { timeout: 8000 }).should('exist')
      // Card tabs should be reachable
      cy.contains('Analytics').should('exist')
      cy.contains('Heat Map').should('exist')
    })
  })
})
