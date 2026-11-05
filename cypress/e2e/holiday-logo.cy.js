// cypress/e2e/holiday-logo.cy.js
// The top bar logo on a holiday and in a season, and the Settings controls:
// Off / Holidays / Holidays & seasons, and "Always use a theme". Dates are
// pinned (CI runs in UTC); noon local keeps the day the same in any time
// zone. Halloween and the seasons are for every region, so this doesn't
// depend on the browser's language.

const ORDINARY_DAY = new Date(2027, 2, 10, 12) // no holiday, no season
const FALL_DAY = new Date(2026, 10, 5, 12)
const HALLOWEEN = new Date(2026, 9, 31, 12)

const visitOn = (date, onBeforeLoad) => {
  cy.clock(date.getTime(), ['Date'])
  cy.visit('/', { onBeforeLoad })
}

const topBarLogo = () => cy.get('.about-trigger')

describe('Holiday logo', () => {
  it('shows the plain logo on an ordinary day', () => {
    visitOn(ORDINARY_DAY)
    topBarLogo().find('img.eyewall-logo-dark').should('exist')
    topBarLogo().find('[data-holiday]').should('not.exist')
  })

  it('shows the Halloween logo in the top bar and the About popup', () => {
    visitOn(HALLOWEEN)
    topBarLogo().find('svg[data-holiday="halloween"] [data-accent="jackOLantern"]').should('exist')
    topBarLogo().click()
    cy.get('[role="dialog"] svg[data-holiday="halloween"]').should('exist')
  })

  it('shows the fall logo in the fall', () => {
    visitOn(FALL_DAY)
    topBarLogo().find('svg[data-holiday="fall"] [data-accent="leaf"]').should('exist')
  })

  it('goes back to the plain logo when holiday themes are turned off, and remembers it', () => {
    visitOn(HALLOWEEN)
    topBarLogo().find('svg[data-holiday="halloween"]').should('exist')
    cy.get('.notif-bell').click()
    cy.contains('Holiday themes').should('exist')
    cy.get('.settings-holiday-themes-off').click()
    topBarLogo().find('[data-holiday]').should('not.exist')
    topBarLogo().find('img.eyewall-logo-dark').should('exist')
    // Nothing to pin while themes are off.
    cy.get('.settings-pinned-theme').should('not.exist')
    cy.window().then(win => {
      expect(win.localStorage.getItem('eyewall:holiday-themes')).to.equal('off')
    })
  })

  it('drops the season but keeps holidays in holidays-only mode', () => {
    visitOn(FALL_DAY)
    topBarLogo().find('svg[data-holiday="fall"]').should('exist')
    cy.get('.notif-bell').click()
    cy.get('.settings-holiday-themes-holidays').click()
    topBarLogo().find('[data-holiday]').should('not.exist')
  })

  it('uses a pinned theme on a quiet day', () => {
    visitOn(ORDINARY_DAY)
    topBarLogo().find('[data-holiday]').should('not.exist')
    cy.get('.notif-bell').click()
    cy.get('.settings-pinned-theme').select('winter')
    topBarLogo().find('svg[data-holiday="winter"] [data-accent="snowflake"]').should('exist')
    cy.window().then(win => {
      expect(win.localStorage.getItem('eyewall:pinned-theme')).to.equal('winter')
    })
  })

  it('stays plain on a holiday when holiday themes were turned off earlier', () => {
    visitOn(HALLOWEEN, win => win.localStorage.setItem('eyewall:holiday-themes', 'off'))
    topBarLogo().find('img.eyewall-logo-dark').should('exist')
    topBarLogo().find('[data-holiday]').should('not.exist')
  })
})
