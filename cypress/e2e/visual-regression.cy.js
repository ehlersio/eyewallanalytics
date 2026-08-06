// cypress/e2e/visual-regression.cy.js
//
// Pixel-level parity evidence for the Tailwind migration (Session 94).
// This is new infrastructure as of Phase 0 — there was no visual-diffing
// capability in this repo before (functional Cypress + a failure-only
// screenshot upload in CI, nothing that compares against a baseline).
//
// Usage:
//   Capture/update baselines:
//     npx cypress run --spec cypress/e2e/visual-regression.cy.js --expose visualRegressionType=base
//   Diff against the committed baselines (default mode, see cypress.config.js):
//     npx cypress run --spec cypress/e2e/visual-regression.cy.js
//
// Known limitation, by design: these routes hit the live Worker API (same
// as every other spec in this suite), so scores/standings/rosters can
// legitimately differ between the moment a baseline was captured and the
// moment it's diffed against. That's an acceptable tradeoff for this use
// case — the intended workflow is "capture baseline immediately before a
// phase's migration, diff immediately after," minutes apart, not day over
// day. A real content change (a game going final, a new headline) will
// register as a mismatch; treat those as expected noise and re-baseline,
// distinct from a structural/layout mismatch (spacing, color, font) which
// is exactly what this exists to catch.
//
// Deliberately excludes any page gated entirely behind live-game state
// (period summary, live shot events) — those are inherently unstable
// between baseline and diff and belong in per-phase manual verification
// instead (per SESSION_93_FINDINGS_tailwind_migration.md's BottomNav note
// on device-level checks the automated suite can't replace).

const THEMES = ['dark', 'light']
const VIEWPORTS = [
  { label: 'mobile',  width: 390,  height: 844 },
  { label: 'desktop', width: 1280, height: 800 },
]

const NHL_ROUTES = [
  { path: '/',         name: 'nhl-shotmap' },
  { path: '/schedule', name: 'nhl-schedule' },
  { path: '/players',  name: 'nhl-players' },
  { path: '/team',     name: 'nhl-team' },
  { path: '/league',   name: 'nhl-league' },
  { path: '/news',     name: 'nhl-news' },
]

const PWHL_ROUTES = [
  { path: '/pwhl/shots',    name: 'pwhl-shotmap' },
  { path: '/pwhl/schedule', name: 'pwhl-schedule' },
  { path: '/pwhl/players',  name: 'pwhl-players' },
  { path: '/pwhl/team',     name: 'pwhl-team' },
  { path: '/pwhl/league',   name: 'pwhl-league' },
  { path: '/pwhl/news',     name: 'pwhl-news' },
]

function visitAndSnapshot(path, snapshotName, theme) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('eyewall:theme', theme)
    },
  })
  cy.get('.topbar', { timeout: 10000 }).should('exist')
  // Let route data settle (fonts, images, async fetches) before capturing —
  // matches the timeout budget the rest of the suite already uses.
  cy.get('body', { timeout: 8000 }).should('not.contain', 'Something went wrong')
  cy.wait(300)
  cy.compareSnapshot(snapshotName, { capture: 'viewport' })
}

VIEWPORTS.forEach(({ label, width, height }) => {
  THEMES.forEach((theme) => {
    describe(`Visual baseline: ${label} / ${theme}`, () => {
      beforeEach(() => {
        cy.viewport(width, height)
      })

      NHL_ROUTES.forEach(({ path, name }) => {
        it(`${name} (${label}, ${theme})`, () => {
          cy.setTeam('CAR')
          visitAndSnapshot(path, `${name}-${label}-${theme}`, theme)
        })
      })

      PWHL_ROUTES.forEach(({ path, name }) => {
        it(`${name} (${label}, ${theme})`, () => {
          cy.setPWHLTeam('BOS')
          visitAndSnapshot(path, `${name}-${label}-${theme}`, theme)
        })
      })
    })
  })
})
