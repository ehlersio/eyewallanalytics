// TEMPORARY A/B diagnostics (Chrome 155 vs 154, cy.intercept vs in-page). Do not merge.
// cypress/e2e/hockeytech-period-summary.cy.js
// AHL/ECHL period and final summaries with the EyeWall AI narrative
// (contract C8; HockeyTechPeriodSummary.jsx, useHockeyTechPeriodSummary.js).
//
// A real game replayed through stubbed routes: AHL 1029081, CLT 5 at HER 2
// (2026-10-03), its /ahl/live and /ahl/summary answers as saved for the
// unit tests. ECHL plays the same game with its teams' ids swapped in (ADK
// at home, TRE away). /today says the game is live; /live grows a period
// at a time and a push re-checks at once. The narrative route and the KV
// /cache read are stubbed: no AI is called. The narrative POST is answered
// inside the page, not by cy.intercept -- see answerInPage.

import { answerInPage, firstCall } from '../support/answerInPage'
import { LEAGUES } from '../support/hockeytech'

const FIXTURES = 'src/utils/__tests__/fixtures/ahl-game-1029081'
const GAME_ID = 1029081
const SIDES = {
  ahl:  { home: { abbr: 'HER', teamId: 319 }, away: { abbr: 'CLT', teamId: 384 } },
  echl: { home: { abbr: 'ADK', teamId: 74 },  away: { abbr: 'TRE', teamId: 113 } },
}
const NARRATIVE = 'The home side outshot the visitors in a tight opening period.'

// The narrative POST (HockeyTechPeriodSummary.jsx's generateNarrative) is
// answered inside the page by answerInPage, not by a cy.intercept stub.
// As a cy.intercept stub it made the first test flake in CI (AHL and ECHL
// alike, about 1 run in 100): the stubbed POST now and then failed, every
// connection through Cypress's proxy dropped with it, Vite's HMR client
// reloaded the page, and the reloaded page joins the game mid-period-2 and
// builds P1 quietly (no popup), so `cy.get('@popup').find(...)` timed out
// on a popup that was gone. 0 failures in 240 looped CI runs answered in
// the page, against 5 in ~470 the old way (#545). See answerInPage.js.

// The AHL game with this league's team ids.
function remap(value, ids, parentKey = null) {
  if (Array.isArray(value)) return value.map(v => remap(v, ids, parentKey))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([k, v]) => {
    const isTeamId = ['teamId', 'homeTeamId', 'awayTeamId'].includes(k) || (k === 'id' && parentKey === 'team')
    return [k, isTeamId && ids[v] != null ? ids[v] : remap(v, ids, k)]
  }))
}

const MODE = Cypress.expose('DIAG_MODE') || 'control'
const T = () => new Date().toISOString()
const marks = []
LEAGUES.filter(l => l.key === 'ahl').forEach(({ key, label }) => {
  const { home, away } = SIDES[key]
  const ids = { 319: home.teamId, 384: away.teamId }
  const workerUrl = Cypress.expose('WORKER_URL')

  describe(`${label} period and final summaries`, () => {
    let live, summary, period, status, narrative

    const today = () => [{
      gameId: GAME_ID, gameDate: '2026-10-10', homeTeamId: home.teamId, awayTeamId: away.teamId,
      homeTeamCode: home.abbr, awayTeamCode: away.abbr, homeScore: 0, awayScore: 0, status,
    }]

    beforeEach(() => {
      period = 1
      status = 'live'
      narrative = { calls: [],
        method: 'POST', url: /\/summary\/narrative\?/,
        reply: { body: { narrative: NARRATIVE, cardNarrative: null } },
      }
      if (MODE === 'inpage') answerInPage([narrative])
      else cy.intercept('POST', `${workerUrl}/${key}/summary/narrative*`, req => {
        narrative.calls.push({ url: req.url, body: req.body })
        req.reply(narrative.reply.body)
      })
      marks.length = 0
      cy.on('window:before:load', win => {
        marks.push(`${T()} load ${win.location.pathname}`)
        win.addEventListener('beforeunload', () => marks.push(`${T()} beforeunload`))
        const OrigWS = win.WebSocket
        win.WebSocket = function (...a) { const ws = new OrigWS(...a); ws.addEventListener('close', e => marks.push(`${T()} ws close ${e.code}`)); return ws }
        win.WebSocket.prototype = OrigWS.prototype
        Object.assign(win.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })
        const f = win.fetch.bind(win)
        win.fetch = (i, init) => f(i, init).catch(e => { marks.push(`${T()} fetch! ${String(i?.url ?? i).slice(0, 90)} ${e.message}`); throw e })
      })
      cy.readFile(`${FIXTURES}/live.json`).then(json => { live = remap(json, ids) })
      cy.readFile(`${FIXTURES}/summary.json`).then(json => { summary = remap(json, ids) })
      cy.then(() => {
        cy.intercept('GET', `${workerUrl}/${key}/today*`, req => req.reply(today())).as('today')
        cy.intercept('GET', `${workerUrl}/${key}/live/${GAME_ID}`, req => req.reply({
          ...live, gameStatus: status, events: live.events.filter(e => e.period <= period),
        })).as('live')
        cy.intercept('GET', `${workerUrl}/${key}/summary?gameId=${GAME_ID}`, summary)
        cy.intercept('GET', `${workerUrl}/cache/${key}*`, { statusCode: 404, body: {} })
      })
    })

    const visitAs = (path, team) => cy.visit(path, {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', key)
        win.localStorage.setItem(`eyewall:${key}_team`, JSON.stringify(team))
      },
    })
    const narrativeRequest = () => firstCall(narrative)
    const push = () => cy.window().then(win => win.dispatchEvent(new win.Event('eyewall:push-received')))
    // The page has the game live, on its first period: only then does the
    // next period's first event close it.
    const seesFirstPeriod = () => {
      cy.wait('@live', { timeout: DATA_TIMEOUT })
      cy.contains('#main-content button', '🔴 LIVE', { timeout: DATA_TIMEOUT })
      cy.wait(500)
    }
    // The live game's goal/penalty popups (the period's events arrive with
    // it), tapped away so the bell can be reached.
    const clearEventPopups = (left = 10) => cy.get('body').then($body => {
      const popup = $body.find('.goal-popup, .penalty-popup, .puck-drop-popup')
      if (!popup.length || !left) return
      cy.wrap(popup.first()).click({ force: true })
      cy.wait(200)
      clearEventPopups(left - 1)
    })

    Cypress._.times(Number(Cypress.expose('DIAG_N') || 120), n => it(`${MODE} ${n}: opens a period’s summary`, () => {
      visitAs(`/${key}/shots`, home)
      seesFirstPeriod()
      cy.get('.hockeytech-summary-overlay').should('not.exist')

      cy.then(() => { period = 2 })
      push()
      cy.get('.hockeytech-summary-overlay', { timeout: DATA_TIMEOUT }).as('popup')
        .should('contain', 'P1 Summary').and('contain', home.abbr).and('contain', away.abbr)
      cy.get('@popup').should('contain', '12–10')            // shots on goal, HockeyTech's own
      cy.get('@popup').should('contain', 'EyeWall AI')
      cy.get('@popup').find('.ps-narrative-text').should('have.text', NARRATIVE)
      cy.get('@popup').should('not.contain', 'Corsi').and('not.contain', 'Faceoff')
      narrativeRequest().then(({ url, body }) => {
        expect(url).to.contain(`gameId=${GAME_ID}`).and.contain('period=1').and.contain(`teamId=${home.teamId}`).and.contain('locale=en')
        expect(body).to.include({ carAbbr: home.abbr, oppAbbr: away.abbr, carSOG: 12, oppSOG: 10 })
        expect(body).not.to.have.any.keys('carHits', 'carFOPct', 'corsiForPct')
      })
      cy.get('@popup').find('button[aria-label="Close"]').click()

      clearEventPopups()
      cy.get('button.summary-bell').click()
      cy.get('.notif-summary-chip').should('have.length', 1).and('contain', 'P1')
      cy.get('.notif-summary-chip').click()
      cy.get('.hockeytech-summary-overlay').should('contain', 'P1 Summary')
      cy.assertNoErrors()
    }))
    afterEach(function () {
      if (this.currentTest.state === 'failed') cy.task('diagLog', `[DIAG FAIL ${MODE} ${this.currentTest.title.slice(0, 20)}]\n${marks.join('\n')}`)
    })
  })
})
