// cypress/support/e2e.js

import { addCompareSnapshotCommand } from 'cypress-visual-regression/dist/command'

// errorThreshold: 1 (%) -- these pages hit the live Worker API with no fixture
// seeding, so a baseline captured minutes before a diff run will show small,
// real content drift (roster ordering, live standings, a stat that ticked
// over) even with zero CSS changes. Measured up to ~0.85% on the noisiest
// pages (Players tables) during Phase 0 baseline capture (Session 94) with
// no code change between runs. 1% comfortably clears that floor while still
// failing on real layout/spacing/color regressions, which run far higher.
// The diff image (always generated on failure) is the actual evidence for
// review -- this threshold only controls pass/fail noise, not what gets shown.
addCompareSnapshotCommand({
  errorThreshold: 1,
})

const IGNORED_ERRORS = [
  /ResizeObserver loop/,
  /Non-passive event listener/,
  /\[hmr\]/,
  /Download the React DevTools/,
]

Cypress.on('window:before:load', (win) => {
  cy.stub(win.console, 'error').callsFake((...args) => {
    const msg = args.join(' ')
    if (IGNORED_ERRORS.some(re => re.test(msg))) return
    win.__cypressErrors = win.__cypressErrors || []
    win.__cypressErrors.push(msg)
  })
})

// ── Team fixtures ─────────────────────────────────────────────
// cy.team()        — returns the default CAR fixture (backward compat)
// cy.team('VGK')   — returns the fixture for a specific team
// cy.teams()       — returns all 32 teams
// cy.fullTeams()   — returns only teams with full line data
Cypress.Commands.add('team', (abbr) => {
  return cy.fixture('teams').then(teams => {
    const match = abbr
      ? teams.find(t => t.abbr === abbr)
      : teams.find(t => t.abbr === 'CAR')
    if (!match) throw new Error(`No fixture found for team: ${abbr}`)
    return match
  })
})

Cypress.Commands.add('teams', () => cy.fixture('teams'))

Cypress.Commands.add('fullTeams', () =>
  cy.fixture('teams').then(teams => teams.filter(t => t.line1))
)

// ── Pre-set localStorage so TeamPicker never blocks tests ─────
// Uses CAR by default; individual tests can call setTeam() to switch
Cypress.Commands.add('setTeam', (abbr) => {
  cy.window().then(win => {
    win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr }))
  })
})

beforeEach(() => {
  cy.fixture('teams').then(teams => {
    const car = teams.find(t => t.abbr === 'CAR')
    cy.window().then(win => {
      win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: car.abbr }))
      // Force English regardless of the runner's browser locale -- specs
      // assert on English copy throughout; French coverage is a separate,
      // deliberate concern (not yet added), not something every existing
      // test should have to account for.
      win.localStorage.setItem('eyewall:locale', 'en')
    })
  })
})

// ── PWHL team helpers ────────────────────────────────────────
// cy.pwhlTeam()       — returns default BOS PWHL fixture
// cy.setPWHLTeam()    — sets PWHL localStorage keys (sport + team)
const PWHL_TEAM_FIXTURES = [
  { abbr: 'BOS', teamId: 1 },
  { abbr: 'MIN', teamId: 2 },
  { abbr: 'MTL', teamId: 3 },
  { abbr: 'NY',  teamId: 4 },
  { abbr: 'OTT', teamId: 5 },
  { abbr: 'TOR', teamId: 6 },
  { abbr: 'SEA', teamId: 8 },
  { abbr: 'VAN', teamId: 9 },
  { abbr: 'DET', teamId: 10 },
  { abbr: 'HAM', teamId: 11 },
  { abbr: 'LV',  teamId: 12 },
  { abbr: 'SJS', teamId: 13 },
]

Cypress.Commands.add('pwhlTeam', (abbr = 'BOS') => {
  const match = PWHL_TEAM_FIXTURES.find(t => t.abbr === abbr)
  if (!match) throw new Error(`No PWHL fixture for: ${abbr}`)
  return cy.wrap(match)
})

Cypress.Commands.add('setPWHLTeam', (abbr = 'BOS') => {
  const match = PWHL_TEAM_FIXTURES.find(t => t.abbr === abbr)
  if (!match) throw new Error(`No PWHL fixture for: ${abbr}`)
  cy.window().then(win => {
    win.localStorage.setItem('eyewall:sport',     'pwhl')
    win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify(match))
  })
})

// ── Custom commands ───────────────────────────────────────────
Cypress.Commands.add('waitForContent', (selector, options = {}) => {
  cy.get(selector, { timeout: options.timeout || 8000 }).should('be.visible')
})

Cypress.Commands.add('goTo', (path) => {
  cy.visit(path)
  cy.get('.skeleton', { timeout: 500 }).should('not.exist').then(() => {}, () => {})
})

Cypress.Commands.add('navTo', (label) => {
  cy.get('nav').contains(label).click()
  cy.url().should('not.eq', 'about:blank')
})

Cypress.Commands.add('assertNoErrors', () => {
  cy.window().then(win => {
    const errors = win.__cypressErrors || []
    expect(errors, `Unexpected console errors: ${errors.join(', ')}`).to.have.length(0)
  })
})

// ── Season-boundary skip gate (Session 62) ──────────────────────
// Real, current-season data (standings, team/player stats, completed
// games) doesn't exist for weeks after a live season flip — the app
// already renders each page's own correct empty/graceful state for this
// (built across #34/#35/#36/#37). These tests assert real data, which is
// a safe assumption once games exist but not during that gap. Rather than
// a parallel heuristic like "games played > 0" (the exact class of bug
// this whole arc kept finding), each of these waits for a selector this
// page's OWN rendering logic already produces, and skips only if that's
// the "no data" one — never invents a new signal.
//
// Usage:
//   cy.skipIfEither('.lv-season-empty', '.lv-leaders-card')
//     — for pages with a dedicated empty-state marker (league.cy.js,
//       players.cy.js's `.drill-empty`). Waits for whichever renders.
//
//   cy.skipUnlessContentAppears('.records-row', 'Season stats')
//     — for pages with no dedicated empty marker, only the absence of a
//       real-content marker (team.cy.js). Waits for a guaranteed-present
//       anchor first (proof the page has settled, not still loading),
//       then checks for the content synchronously.
//
// Both must be called from a `function () {}` test/hook body (not an
// arrow function) so `this.skip()` binds to the real Mocha context —
// Cypress binds a custom command's own `this` to that context the same
// way it does for `it`/`before`/`beforeEach`.
Cypress.Commands.add('skipIfEither', function (emptySelector, realSelector, options = {}) {
  const timeout = options.timeout ?? 10000
  cy.get(`${emptySelector}, ${realSelector}`, { timeout }).then(($el) => {
    if ($el.is(emptySelector)) {
      cy.log(`Skipping — ${emptySelector} present (no live season data yet)`)
      this.skip()
    }
  })
})

Cypress.Commands.add('skipUnlessContentAppears', function (anchorSelector, contentMatcher, options = {}) {
  const timeout = options.timeout ?? 10000
  cy.get(anchorSelector, { timeout }).should('exist')
  cy.get('body').then(($body) => {
    const hasContent = typeof contentMatcher === 'string'
      ? $body.text().includes(contentMatcher)
      : $body.find(contentMatcher).length > 0
    if (!hasContent) {
      cy.log(`Skipping — "${contentMatcher}" not present (no live season data yet)`)
      this.skip()
    }
  })
})

// Inverse of skipUnlessContentAppears — for pages whose own "no data yet"
// state is a specific piece of real, live-computed text (e.g. "0 played")
// rather than a dedicated empty-state marker.
Cypress.Commands.add('skipIfContentAppears', function (anchorSelector, contentMatcher, options = {}) {
  const timeout = options.timeout ?? 10000
  cy.get(anchorSelector, { timeout }).should('exist')
  cy.get('body').then(($body) => {
    const hasContent = typeof contentMatcher === 'string'
      ? $body.text().includes(contentMatcher)
      : $body.find(contentMatcher).length > 0
    if (hasContent) {
      cy.log(`Skipping — "${contentMatcher}" present (no live season data yet)`)
      this.skip()
    }
  })
})
