// cypress/e2e/hockeytech-guest-game-invariants.cy.js
// The AHL/ECHL twin of guest-game-invariants.cy.js: watching a game as
// another team must leave the followed team exactly as it was -- nothing
// saved on this device, nothing sent to the user's account, and the
// followed team's own Shot Map unchanged on the way back. See
// HockeyTechGuestGameView.jsx; hockeytech-guest-game.cy.js covers the
// feature itself.
//
// Signed in (a fake session, the shape auth.cy.js injects) with a stubbed
// user_preferences read that already agrees with the device, so the
// sign-in sync has nothing of its own to write. The guest view is reached
// by tapping the Scoreboard -- in-app, no reload -- and recording starts
// only once the followed team's page has settled.

import { answerInPage } from '../support/answerInPage'
import { LEAGUES } from '../support/hockeytech'

const SUPABASE_URL = 'https://mqgasjzywoibdgxjjkux.supabase.co'
const AUTH_STORAGE_KEY = 'sb-mqgasjzywoibdgxjjkux-auth-token'
const GUESTS = {
  ahl:  { home: { abbr: 'CLT', teamId: 384 }, away: { abbr: 'TEX', teamId: 380 } },
  echl: { home: { abbr: 'FLA', teamId: 8 },   away: { abbr: 'ORL', teamId: 61 } },
}
const GUEST_GAME_ID = 778

const fakeSession = () => ({
  access_token: 'cypress-fake-access-token',
  refresh_token: 'cypress-fake-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'cypress-test-user-id', email: 'guest-watcher@example.com', app_metadata: {}, user_metadata: {} },
})

const snapshot = storage => Object.fromEntries(Object.keys(storage).sort().map(k => [k, storage.getItem(k)]))

LEAGUES.forEach(({ key, label, team }) => {
  const { home, away } = GUESTS[key]

  describe(`${label}: watching as another team leaves the followed team alone`, () => {
    let recording
    let writes

    beforeEach(() => {
      recording = false
      writes = []
      const record = call => { if (recording) writes.push(`${call.method} ${call.url}`) }
      const workerUrl = Cypress.expose('WORKER_URL')

      cy.intercept('GET', `${SUPABASE_URL}/rest/v1/user_preferences*`,
        [{ favorite_team: team.abbr, favorite_sport: key, locale: 'en' }])
      // Every write is answered in the page (answerInPage), and recorded once
      // recording.
      const account = { method: /^(POST|PATCH|PUT|DELETE)$/, url: /\.supabase\.co\//, reply: call => { record(call); return { statusCode: 201 } } }
      answerInPage([
        account,
        { method: 'POST', url: /\/(push|live-activity)\//, reply: call => { record(call); return { statusCode: 200 } } },
      ])
      cy.intercept('GET', `${workerUrl}/${key}/today*`, [
        { gameId: GUEST_GAME_ID, gameDate: '2026-10-10', homeTeamId: home.teamId, awayTeamId: away.teamId,
          homeTeamCode: home.abbr, awayTeamCode: away.abbr, homeScore: 1, awayScore: 1, status: 'live' },
      ]).as('today')
      cy.intercept('GET', `${workerUrl}/${key}/live/${GUEST_GAME_ID}`, {
        gameId: GUEST_GAME_ID, homeTeamId: home.teamId, awayTeamId: away.teamId,
        homeScore: 1, awayScore: 2, gameStatus: 'live', events: [],
      }).as('guestLive')

      cy.visit(`/${key}/league`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', key)
          win.localStorage.setItem(`eyewall:${key}_team`, JSON.stringify(team))
          win.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fakeSession()))
        },
      })
      cy.wait('@today', { timeout: DATA_TIMEOUT })
      cy.get('.scoreboard-team-link', { timeout: DATA_TIMEOUT }).should('have.length', 2)
      // The bell saves "alerts seen" the first time its alerts load: part of
      // the followed team's page settling, not the guest visit.
      cy.window({ timeout: DATA_TIMEOUT }).its('localStorage')
        .invoke('getItem', 'eyewall:alerts-seen-at').should('not.be.null')
      // The sign-in sync writes this device's followed teams to the account
      // (the stubbed preferences have none) as the page loads, twice under
      // StrictMode: part of the page settling too, so recording starts once
      // it has gone quiet.
      cy.wrap(account.calls, { timeout: DATA_TIMEOUT }).should(calls => {
        const synced = calls.filter(c => c.body?.followed_teams)
        expect(synced, 'followed_teams sync').not.to.be.empty
        expect(Date.now() - synced.at(-1).at, 'ms since its last write').to.be.gte(250)
      })
    })

    it('saves nothing on the device or to the account, and comes back to the same followed team', () => {
      cy.window().then(win => cy.wrap(snapshot(win.localStorage)).as('localBefore'))
      cy.then(() => { recording = true })

      cy.get(`.scoreboard-team-link[href="/${key}/game/${GUEST_GAME_ID}?as=${away.abbr}"]`).click()
      cy.get('.guest-game-bar', { timeout: DATA_TIMEOUT }).should('contain', `Viewing as ${away.abbr}`)
      cy.wait('@guestLive', { timeout: DATA_TIMEOUT })
      cy.contains('#main-content button', '🔴 LIVE', { timeout: DATA_TIMEOUT }).should('contain', '2–1')
      // Let the view's fetches and effects run their course.
      cy.get('[data-tour="rink"]', { timeout: DATA_TIMEOUT }).should('contain', "Shot data for this game isn't in yet")
      cy.wait(1000)

      cy.window().then(win => {
        cy.get('@localBefore').then(before => {
          expect(snapshot(win.localStorage), 'localStorage').to.deep.equal(before)
        })
      })

      cy.get('.guest-game-back').click()
      cy.location('pathname').should('eq', `/${key}/league`)
      cy.then(() => {
        recording = false
        expect(writes, 'writes during the guest visit').to.deep.equal([])
      })

      // The followed team's own Shot Map, as it always is: its logo, its
      // season tabs, no guest bar. Reached in-app, as a user would.
      cy.get('.nav-tab').contains('Shot Map').click()
      cy.location('pathname').should('eq', `/${key}/shots`)
      cy.contains('h2', 'Shot Map', { timeout: DATA_TIMEOUT })
        .find(`img[alt="${team.abbr}"]`).should('exist')
      cy.get('.guest-game-bar').should('not.exist')
      cy.get('#main-content').should('not.contain', 'Live · ')
    })
  })
})
