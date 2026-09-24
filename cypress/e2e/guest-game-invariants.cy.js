// cypress/e2e/guest-game-invariants.cy.js
// Watching a game as another team must leave the favorite exactly as it
// was: nothing saved on this device, nothing sent to the user's account,
// and the favorite's own game view unchanged on the way back. See
// GameTeamContext.jsx / GuestGameView.jsx; guest-game.cy.js covers the
// feature itself.
//
// Signed in, because that's when a stray write would reach the account:
// a fake session (same shape auth.cy.js injects) and a stubbed
// user_preferences read that already agrees with the device, so the
// sign-in sync has nothing of its own to write. The guest view is reached
// by tapping the Scoreboard -- an in-app navigation, no reload -- and
// recording starts only once the favorite's page has settled, so any
// write it catches came from the guest visit.

const SUPABASE_URL = 'https://mqgasjzywoibdgxjjkux.supabase.co'
const AUTH_STORAGE_KEY = 'sb-mqgasjzywoibdgxjjkux-auth-token'
const CAR_TEAM_ID = 12
const TOR_TEAM_ID = 10
const GUEST_GAME_ID = 2026010036 // TOR at OTT, 2026-09-23 -- see guest-game.cy.js
const TODAY = [
  { gameId: GUEST_GAME_ID, gameDate: '2026-09-23', homeTeamCode: 'OTT', awayTeamCode: 'TOR',
    homeScore: 2, awayScore: 4, status: 'live', period: 3, periodType: 'REG', clock: '05:00', inIntermission: false },
]
const FAVORITE_SUMMARY_KEYS = [`eyewall_period_summaries:${CAR_TEAM_ID}`, `eyewall_game_summary:${CAR_TEAM_ID}`]
const SENTINEL = JSON.stringify({ gameId: 1, summaries: [], summary: { sentinel: true } })

const fakeSession = () => ({
  access_token: 'cypress-fake-access-token',
  refresh_token: 'cypress-fake-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'cypress-test-user-id', email: 'guest-watcher@example.com', app_metadata: {}, user_metadata: {} },
})

const snapshot = storage => Object.fromEntries(Object.keys(storage).sort().map(k => [k, storage.getItem(k)]))

describe('Watching as another team leaves the favorite alone', () => {
  let recording
  let writes

  beforeEach(() => {
    recording = false
    writes = []
    const record = req => { if (recording) writes.push(`${req.method} ${req.url}`) }

    cy.intercept('GET', `${SUPABASE_URL}/rest/v1/user_preferences*`,
      [{ favorite_team: 'CAR', favorite_sport: 'nhl', locale: 'en' }])
    cy.intercept({ url: `${SUPABASE_URL}/**`, method: /^(POST|PATCH|PUT|DELETE)$/ }, req => {
      record(req)
      req.reply({ statusCode: 201, body: {} })
    })
    for (const path of ['**/push/**', '**/live-activity/**']) {
      cy.intercept({ url: path, method: 'POST' }, req => { record(req); req.reply({}) })
    }
    cy.intercept('GET', '**/nhl/today', TODAY).as('today')

    cy.visit('/league', {
      onBeforeLoad(win) {
        win.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fakeSession()))
        for (const key of FAVORITE_SUMMARY_KEYS) win.sessionStorage.setItem(key, SENTINEL)
      },
    })
    cy.wait('@today')
    cy.get('.scoreboard-team-link', { timeout: DATA_TIMEOUT }).should('have.length', 2)
  })

  it('saves nothing on the device or to the account, and comes back to the same favorite', () => {
    cy.window().then(win => cy.wrap(snapshot(win.localStorage)).as('localBefore'))
    cy.then(() => { recording = true })

    cy.contains('.scoreboard-team-link', 'Maple Leafs').click()
    cy.get('.guest-game-bar', { timeout: DATA_TIMEOUT }).should('contain', 'Viewing as TOR')
    cy.get('.score-card', { timeout: DATA_TIMEOUT }).should('contain', 'TOR')
    // The guest view builds this game's summary (it's a final) -- under
    // TOR's own key. Waiting for it is also what lets the view's fetches
    // and effects run their course before anything below is checked.
    cy.window({ timeout: DATA_TIMEOUT }).its('sessionStorage')
      .invoke('getItem', `eyewall_game_summary:${TOR_TEAM_ID}`)
      .should('contain', `${GUEST_GAME_ID}`)

    // Checked before leaving: back on /, the favorite's own view goes on
    // to write its own summaries, legitimately, over the sentinel.
    cy.window().then(win => {
      cy.get('@localBefore').then(before => {
        expect(snapshot(win.localStorage), 'localStorage').to.deep.equal(before)
      })
      for (const key of FAVORITE_SUMMARY_KEYS) {
        expect(win.sessionStorage.getItem(key), key).to.eq(SENTINEL)
      }
    })

    cy.get('.guest-game-back').click()
    cy.location('pathname').should('eq', '/')
    cy.then(() => {
      recording = false
      expect(writes, 'writes during the guest visit').to.deep.equal([])
    })

    // The favorite's own view, as it always is: its team, its season
    // history, no guest bar.
    cy.get('.score-card', { timeout: DATA_TIMEOUT }).should('contain', 'CAR')
    cy.get('.season-selector').should('exist')
    cy.get('.guest-game-bar').should('not.exist')
  })
})
