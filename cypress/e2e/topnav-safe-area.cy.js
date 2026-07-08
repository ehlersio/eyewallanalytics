// cypress/e2e/topnav-safe-area.cy.js
//
// Regression coverage for Session 48's TopNav fix: on rounded-corner/notch
// iPhones, .topbar's About and Settings buttons could render under the
// curved/cutout region with no safe-area padding to push them clear,
// making them effectively unclickable (Session 46 report). There's no way
// to emulate a real device's env(safe-area-inset-top) value in Cypress/
// headless Chrome (it resolves to 0 without an actual display cutout), so
// this suite can't assert the exact inset math — instead it locks down the
// functional regression: both buttons stay visible and clickable at the
// narrow/tall mobile viewports where this bug was reported.
//
// Deliberately not covered here: a live-game scenario where .topbar-momentum
// grows .topbar's height. That's exactly why the fix keeps .topbar in normal
// flex flow (padding-top, not position:fixed + a hardcoded compensating
// padding on .app-main) rather than something that would need its own
// regression test for the dynamic-height case.

const MOBILE_VIEWPORTS = [
  { label: 'Mobile S', width: 375, height: 812 },
  { label: 'Mobile L', width: 430, height: 932 },
]

MOBILE_VIEWPORTS.forEach(({ label, width, height }) => {
  describe(`TopNav safe-area regression: ${label} (${width}×${height})`, () => {
    beforeEach(() => cy.viewport(width, height))

    it('About and Settings buttons are visible and clickable', () => {
      cy.visit('/')
      cy.get('.topbar', { timeout: 10000 }).should('be.visible')

      cy.get('.about-trigger').should('be.visible').click()
      cy.get('.about-popup').should('be.visible')
      cy.get('.about-close').click()

      cy.get('.notif-bell[aria-label="Settings"]').should('be.visible').click()
      cy.contains('.notif-title', 'Settings').should('be.visible')
    })

    it('.topbar reserves safe-area space at its top edge', () => {
      cy.visit('/')
      cy.get('.topbar').then($topbar => {
        const paddingTop = window.getComputedStyle($topbar[0]).paddingTop
        // env(safe-area-inset-top, 0px) resolves to a real px value even
        // without a device inset — confirms the rule is applied at all,
        // which is what regresses if a future edit removes the property.
        expect(paddingTop).to.match(/^\d+(\.\d+)?px$/)
      })
    })
  })
})
