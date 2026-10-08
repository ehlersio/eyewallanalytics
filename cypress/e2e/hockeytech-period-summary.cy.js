// cypress/e2e/hockeytech-period-summary.cy.js
// AHL/ECHL period and final summaries with the EyeWall AI narrative
// (contract C8; HockeyTechPeriodSummary.jsx, useHockeyTechPeriodSummary.js).
//
// A real game replayed through stubbed routes: AHL 1029081, CLT 5 at HER 2
// (2026-10-03), its /ahl/live and /ahl/summary answers as saved for the
// unit tests. ECHL plays the same game with its teams' ids swapped in (ADK
// at home, TRE away). /today says the game is live; /live grows a period
// at a time and a push re-checks at once. The narrative route and the KV
// /cache read are stubbed: no AI is called.

import { LEAGUES } from '../support/hockeytech'

const FIXTURES = 'src/utils/__tests__/fixtures/ahl-game-1029081'
const GAME_ID = 1029081
const SIDES = {
  ahl:  { home: { abbr: 'HER', teamId: 319 }, away: { abbr: 'CLT', teamId: 384 } },
  echl: { home: { abbr: 'ADK', teamId: 74 },  away: { abbr: 'TRE', teamId: 113 } },
}
const NARRATIVE = 'The home side outshot the visitors in a tight opening period.'

// The AHL game with this league's team ids.
function remap(value, ids, parentKey = null) {
  if (Array.isArray(value)) return value.map(v => remap(v, ids, parentKey))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([k, v]) => {
    const isTeamId = ['teamId', 'homeTeamId', 'awayTeamId'].includes(k) || (k === 'id' && parentKey === 'team')
    return [k, isTeamId && ids[v] != null ? ids[v] : remap(v, ids, k)]
  }))
}

LEAGUES.forEach(({ key, label }) => {
  const { home, away } = SIDES[key]
  const ids = { 319: home.teamId, 384: away.teamId }
  const workerUrl = Cypress.expose('WORKER_URL')

  describe(`${label} period and final summaries`, () => {
    let live, summary, period, status, narrativeCalls

    const today = () => [{
      gameId: GAME_ID, gameDate: '2026-10-10', homeTeamId: home.teamId, awayTeamId: away.teamId,
      homeTeamCode: home.abbr, awayTeamCode: away.abbr, homeScore: 0, awayScore: 0, status,
    }]

    beforeEach(() => {
      period = 1
      status = 'live'
      narrativeCalls = []
      cy.readFile(`${FIXTURES}/live.json`).then(json => { live = remap(json, ids) })
      cy.readFile(`${FIXTURES}/summary.json`).then(json => { summary = remap(json, ids) })
      cy.then(() => {
        cy.intercept('GET', `${workerUrl}/${key}/today*`, req => req.reply(today())).as('today')
        cy.intercept('GET', `${workerUrl}/${key}/live/${GAME_ID}`, req => req.reply({
          ...live, gameStatus: status, events: live.events.filter(e => e.period <= period),
        })).as('live')
        cy.intercept('GET', `${workerUrl}/${key}/summary?gameId=${GAME_ID}`, summary)
        cy.intercept('GET', `${workerUrl}/cache/${key}*`, { statusCode: 404, body: {} })
        cy.intercept('POST', `${workerUrl}/${key}/summary/narrative*`, req => {
          narrativeCalls.push(req)
          req.reply({ narrative: NARRATIVE, cardNarrative: null })
        }).as('narrative')
      })
    })

    const visitAs = (path, team) => cy.visit(path, {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', key)
        win.localStorage.setItem(`eyewall:${key}_team`, JSON.stringify(team))
      },
    })
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

    it('opens a period’s summary when the next one starts, with the EyeWall AI narrative and the bell’s chip', () => {
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
      cy.wait('@narrative').then(({ request }) => {
        expect(request.url).to.contain(`gameId=${GAME_ID}`).and.contain('period=1').and.contain(`teamId=${home.teamId}`).and.contain('locale=en')
        expect(request.body).to.include({ carAbbr: home.abbr, oppAbbr: away.abbr, carSOG: 12, oppSOG: 10 })
        expect(request.body).not.to.have.any.keys('carHits', 'carFOPct', 'corsiForPct')
      })
      cy.get('@popup').find('button[aria-label="Close"]').click()

      clearEventPopups()
      cy.get('button.summary-bell').click()
      cy.get('.notif-summary-chip').should('have.length', 1).and('contain', 'P1')
      cy.get('.notif-summary-chip').click()
      cy.get('.hockeytech-summary-overlay').should('contain', 'P1 Summary')
      cy.assertNoErrors()
    })

    it('opens the final’s summary when the game ends: score, scoring by period, goalies, three stars', () => {
      visitAs(`/${key}/shots`, home)
      seesFirstPeriod()
      cy.then(() => { period = 3; status = 'final' })
      push()
      cy.get('.hockeytech-summary-overlay', { timeout: DATA_TIMEOUT }).as('final')
        .should('contain', 'FINAL Summary').and('contain', 'Three Stars').and('contain', 'Scoring by Period')
      cy.get('@final').find('.ps-scoring-by-period').should('contain', 'P3').and('contain', '0–3')
      cy.get('@final').find('.ps-goalie-lines').should('contain', '24 saves on 28 shots')
      cy.get('@final').should('contain', '0/2')                 // the PP, HockeyTech's own
      cy.get('@final').find('button[aria-label="Close"]').click()
      cy.get('.hockeytech-summary-buttons button').should('have.length', 4)
      cy.assertNoErrors()
    })

    it('in a guest view: the guest’s side and narrative, nothing in the followed team’s bell', () => {
      visitAs(`/${key}/game/${GAME_ID}?as=${away.abbr}`, home)
      cy.get('.guest-game-bar', { timeout: DATA_TIMEOUT }).should('contain', `Viewing as ${away.abbr}`)
      seesFirstPeriod()
      cy.then(() => { period = 2 })
      push()
      cy.get('.hockeytech-summary-overlay', { timeout: DATA_TIMEOUT }).should('contain', 'P1 Summary').and('contain', '10–12')
      cy.wait('@narrative').its('request.url').should('contain', `teamId=${away.teamId}`)
      cy.get('.hockeytech-summary-overlay').find('button[aria-label="Close"]').click()
      clearEventPopups()
      cy.get('button.summary-bell').click()
      cy.get('.notif-summary-chip').should('not.exist')
      cy.window().then(win => {
        expect(win.sessionStorage.getItem(`eyewall_${key}_period_summaries:${home.teamId}`)).to.be.null
        expect(win.sessionStorage.getItem(`eyewall_${key}_period_summaries:${away.teamId}`)).to.contain(`${GAME_ID}`)
      })
    })

    it('reads a narrative already written from the Worker’s KV instead of asking for one', () => {
      cy.intercept('GET', `${workerUrl}/cache/${key}%3Anarrative%3A1%3A${GAME_ID}%3A${home.teamId}`,
        { narrative: 'From the cache.', cardNarrative: null }).as('cached')
      visitAs(`/${key}/shots`, home)
      seesFirstPeriod()
      cy.then(() => { period = 2 })
      push()
      cy.wait('@cached')
      cy.get('.hockeytech-summary-overlay .ps-narrative-text', { timeout: DATA_TIMEOUT }).should('have.text', 'From the cache.')
      cy.then(() => expect(narrativeCalls, 'narrative POSTs').to.have.length(0))
    })
  })
})
