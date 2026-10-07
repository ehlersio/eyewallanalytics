// cypress/e2e/hockeytech-schedule.cy.js
// AHL/ECHL Schedule tab: the team schedule, a calendar box score, a saved prediction's outcome and an upcoming game's preview.
// Split from hockeytech-routes.cy.js (Phase 3); fixtures and helpers are in
// ../support/hockeytech.js.

import { LEAGUES, visitAs, leagueLogo, assertNoLoadFailure } from '../support/hockeytech'

LEAGUES.forEach(({ key, label, team, teamName, upcoming, final }) => {
  describe(`${label} Schedule`, () => {
    it(`/${key}/schedule renders the ${team.abbr} schedule`, () => {
      visitAs(`/${key}/schedule`, key, team)
      cy.contains('h2', 'Schedule', { timeout: DATA_TIMEOUT })
        .find(leagueLogo(key, team.abbr)).should('exist')
      cy.contains('p', teamName).should('exist')
      cy.get('#main-content', { timeout: DATA_TIMEOUT }).should($main => {
        const cards = $main.find('.card.cursor-pointer').length
        const empty = /No games found\./.test($main.text())
        expect(cards > 0 || empty, 'game cards or the empty state').to.equal(true)
      })
      assertNoLoadFailure()
    })

    // The Elo chip (contract C6): the Worker's schedule rows carry `winProb`
    // only where {league}_game_win_probs has a row, so one upcoming game is
    // given one and every other row's is removed. The browser cache is off
    // for the test: a cached schedule never reaches the intercept.
    it(`/${key}/schedule shows the Elo win-probability chip only on games with a win probability`, () => {
      const workerUrl = Cypress.expose('WORKER_URL')
      if (Cypress.isBrowser({ family: 'chromium' })) {
        cy.wrap(Cypress.automation('remote:debugger:protocol', { command: 'Network.setCacheDisabled', params: { cacheDisabled: true } }))
      }
      cy.intercept('GET', `${workerUrl}/${key}/schedule?teamId=${team.teamId}*`, req => {
        req.on('before:response', res => {
          if (!Array.isArray(res.body)) return
          let given = false
          res.body = res.body.map(({ winProb: _drop, ...g }) => {
            if (given || g.game_state === 'Final') return g
            given = true
            const home = g.home_team_id === team.teamId
            return { ...g, winProb: { home: home ? 0.64 : 0.36, away: home ? 0.36 : 0.64, source: 'elo' } }
          })
        })
      })
      visitAs(`/${key}/schedule`, key, team)
      cy.contains('h2', 'Schedule', { timeout: DATA_TIMEOUT })
      // The upcoming game is in 2026-27: the ECHL still opens on 2025-26.
      cy.contains('button', /^2026-27$/, { timeout: DATA_TIMEOUT }).click()
      cy.get('#main-content', { timeout: DATA_TIMEOUT }).should($main => {
        expect($main.find('.card.cursor-pointer').length, 'game cards').to.be.greaterThan(0)
      })
      cy.get('[data-testid="win-prob-chip"]', { timeout: DATA_TIMEOUT }).should('have.length', 1).and('have.text', `✓ ${team.abbr} 64%`)
      if (Cypress.isBrowser({ family: 'chromium' })) {
        cy.wrap(Cypress.automation('remote:debugger:protocol', { command: 'Network.setCacheDisabled', params: { cacheDisabled: false } }))
      }
      assertNoLoadFailure()
    })

    // Calendar cells and the box-score table (HockeyTechCalendarView /
    // HockeyTechBoxScoreTable). Date is pinned to mid-January so the
    // calendar opens on a month of the completed 2025-26 season.
    it(`/${key}/schedule calendar opens a 2025-26 box score`, () => {
      cy.clock(new Date('2026-01-15T17:00:00Z').getTime(), ['Date'])
      visitAs(`/${key}/schedule`, key, team)
      cy.contains('button', /^2025-26$/, { timeout: DATA_TIMEOUT }).click()
      cy.get('.view-mode-toggle button').eq(1).click()
      cy.contains('.cal-month-label', 'January 2026').should('exist')
      cy.get('.cal-cell.has-game', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      cy.get('.cal-cell.has-game').first().find(`img[src*="/${key}/logos/"]`).should('exist')
      cy.get('.cal-cell.has-game.win, .cal-cell.has-game.loss').first().click()
      cy.get('.pgs-card').should('exist')
      cy.get('.pbs-row', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 5)
      cy.get('.pbs-goalie-row').should('have.length.at.least', 1)
      // HockeyTechGameStatsPopup around it: league logos in the header,
      // period scoring, and the opponent toggle swaps the table.
      cy.get('.pgs-header').find(`img[src*="/${key}/logos/"]`).should('have.length', 2)
      cy.get('.pgs-period-row', { timeout: DATA_TIMEOUT }).should('have.length', 3)
      cy.get('.pbs-row').first().invoke('text').then(first => {
        cy.get('.pgs-toggle-btn').eq(1).click()
        cy.get('.pbs-row').first().invoke('text').should('not.eq', first)
      })
      assertNoLoadFailure()
    })

    // HockeyTechScheduleView fills in a saved prediction's outcome once its
    // game is Final, in the league's own prediction store key.
    it(`/${key}/schedule records a 2025-26 prediction's outcome`, () => {
      const storeKey = `eyewall_${key}_predictions_v1`
      cy.visit(`/${key}/schedule`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', key)
          win.localStorage.setItem(`eyewall:${key}_team`, JSON.stringify(team))
          win.localStorage.setItem(storeKey, JSON.stringify([{ gameId: final.game_id, predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 2 }]))
        },
      })
      cy.contains('button', /^2025-26$/, { timeout: DATA_TIMEOUT }).click()
      cy.window().its('localStorage').invoke('getItem', storeKey).should(raw => {
        const [pred] = JSON.parse(raw)
        expect(pred.teamActual, 'teamActual').to.be.a('number')
        expect(pred.oppActual, 'oppActual').to.be.a('number')
        expect(pred.correct).to.equal(pred.teamWon === true)
      })
      assertNoLoadFailure()
    })

    // HockeyTechGamePreviewPopup. The schedule is stubbed to one upcoming
    // game so the test doesn't depend on where the season is; its preview
    // and prediction come from the live Worker.
    it(`/${key}/schedule opens the preview for an upcoming game`, () => {
      cy.intercept('GET', `**/${key}/schedule?teamId=${team.teamId}&season=*`, {
        body: [{ ...upcoming, home_score: 0, away_score: 0, game_state: '7:00 pm EDT' }],
      })
      visitAs(`/${key}/schedule`, key, team)
      cy.contains('.card', upcoming.venue_name, { timeout: DATA_TIMEOUT }).click()
      cy.get('.pgp-card').should('exist')
      cy.get('.pgp-header').find(leagueLogo(key, team.abbr)).should('exist')
      cy.get('.pgp-card').contains('Prediction').should('exist')
      cy.get('.pgp-winpct', { timeout: DATA_TIMEOUT }).first().should('contain', '%')
      assertNoLoadFailure()
    })
  })
})
