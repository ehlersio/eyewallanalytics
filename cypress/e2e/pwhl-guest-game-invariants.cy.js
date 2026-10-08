// cypress/e2e/pwhl-guest-game-invariants.cy.js
// The PWHL twin of guest-game-invariants.cy.js and
// hockeytech-guest-game-invariants.cy.js: watching a game as another team
// must leave the followed team exactly as it was -- nothing saved on this
// device, nothing sent to the user's account, no "already shown" popup flag
// or summary of the followed team's touched, and the followed team's own
// Shot Map unchanged on the way back. See PWHLGuestGameView.jsx;
// pwhl-guest-game.cy.js covers the feature itself.
//
// Signed in (a fake session, the shape auth.cy.js injects) with a stubbed
// user_preferences read that already agrees with the device, so the
// sign-in sync has nothing of its own to write. The guest view is reached
// by tapping the Scoreboard -- in-app, no reload -- and recording starts
// only once the followed team's page has settled. The guest game is the
// saved real PWHL 212 (NY at OTT) replayed as live.

const SUPABASE_URL = 'https://mqgasjzywoibdgxjjkux.supabase.co'
const AUTH_STORAGE_KEY = 'sb-mqgasjzywoibdgxjjkux-auth-token'
const FOLLOWED = { abbr: 'MTL', teamId: 3 }
const GUEST_GAME_ID = 212

const fakeSession = () => ({
  access_token: 'cypress-fake-access-token',
  refresh_token: 'cypress-fake-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'cypress-test-user-id', email: 'guest-watcher@example.com', app_metadata: {}, user_metadata: {} },
})

const snapshot = storage => Object.fromEntries(Object.keys(storage).sort().map(k => [k, storage.getItem(k)]))

describe('PWHL: watching as another team leaves the followed team alone', () => {
  let recording
  let writes

  beforeEach(() => {
    recording = false
    writes = []
    const record = req => { if (recording) writes.push(`${req.method} ${req.url}`) }
    const workerUrl = Cypress.expose('WORKER_URL')

    cy.intercept('GET', `${SUPABASE_URL}/rest/v1/user_preferences*`,
      [{ favorite_team: FOLLOWED.abbr, favorite_sport: 'pwhl', locale: 'en' }])
    cy.intercept({ url: `${SUPABASE_URL}/**`, method: /^(POST|PATCH|PUT|DELETE)$/ }, req => {
      record(req)
      req.reply({ statusCode: 201, body: {} })
    })
    for (const path of ['**/push/**', '**/live-activity/**']) {
      cy.intercept({ url: path, method: 'POST' }, req => { record(req); req.reply({}) })
    }
    cy.intercept('GET', `${workerUrl}/pwhl/today*`, [
      { gameId: GUEST_GAME_ID, gameDate: '2026-10-10', homeTeamId: 5, awayTeamId: 4,
        homeTeamCode: 'OTT', awayTeamCode: 'NY', homeScore: 0, awayScore: 3, status: 'live' },
    ]).as('today')
    cy.readFile('src/utils/__tests__/fixtures/pwhl-game-212/live.json').then(live => {
      cy.intercept('GET', `${workerUrl}/pwhl/live/${GUEST_GAME_ID}`, { ...live, gameStatus: 'live' }).as('guestLive')
    })

    cy.visit('/pwhl/league', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify(FOLLOWED))
        win.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fakeSession()))
      },
    })
    cy.wait('@today', { timeout: DATA_TIMEOUT })
    cy.get('.scoreboard-team-link', { timeout: DATA_TIMEOUT }).should('have.length', 2)
    // The bell saves "alerts seen" the first time its alerts load: part of
    // the followed team's page settling, not the guest visit.
    cy.window({ timeout: DATA_TIMEOUT }).its('localStorage')
      .invoke('getItem', 'eyewall:alerts-seen-at').should('not.be.null')
  })

  it('saves nothing on the device or to the account, and comes back to the same followed team', () => {
    cy.window().then(win => {
      cy.wrap(snapshot(win.localStorage)).as('localBefore')
      cy.wrap(snapshot(win.sessionStorage)).as('sessionBefore')
    })
    cy.then(() => { recording = true })

    cy.get(`.scoreboard-team-link[href="/pwhl/game/${GUEST_GAME_ID}?as=NY"]`).click()
    cy.get('.guest-game-bar', { timeout: DATA_TIMEOUT }).should('contain', 'Viewing as NY')
    cy.wait('@guestLive', { timeout: DATA_TIMEOUT })
    cy.contains('#main-content button', '🔴 LIVE', { timeout: DATA_TIMEOUT }).should('contain', '4–0')
    // Let the view's fetches and effects run their course.
    cy.get('.rhr-svg circle[style*="cursor: pointer"]', { timeout: DATA_TIMEOUT }).should('have.length.greaterThan', 0)
    cy.wait(1500)

    cy.window().then(win => {
      cy.get('@localBefore').then(before => {
        expect(snapshot(win.localStorage), 'localStorage').to.deep.equal(before)
      })
      // sessionStorage: whatever the guest view keeps is under its own
      // ":guest:" keys; nothing of the followed team's changed.
      cy.get('@sessionBefore').then(before => {
        const after = snapshot(win.sessionStorage)
        const changed = Object.keys(after).filter(k => after[k] !== before[k])
        const notGuest = changed.filter(k => /pwhl/.test(k) && !k.includes(':guest:'))
        expect(notGuest, 'followed-team session keys written').to.deep.equal([])
      })
    })

    cy.get('.guest-game-back').click()
    cy.location('pathname').should('eq', '/pwhl/league')
    cy.then(() => {
      recording = false
      expect(writes, 'writes during the guest visit').to.deep.equal([])
    })

    // The followed team's own Shot Map, as it always is: its team on the
    // score card, its season chips and game chips, no guest bar. Reached
    // in-app, as a user would.
    cy.get('.nav-tab').contains('Shot Map').click()
    cy.location('pathname').should('eq', '/pwhl/shots')
    cy.get('.score-card', { timeout: DATA_TIMEOUT }).should('contain', FOLLOWED.abbr)
    cy.contains('#main-content button', /^All\s*\d/, { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('.guest-game-bar').should('not.exist')
  })
})
