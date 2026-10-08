// cypress/e2e/hockeytech-power-rankings.cy.js
// League › Power rankings (contract C12): AHL/ECHL's tab and the PWHL
// panel's EyeWall AI card. /{league}/power-rankings is stubbed with real
// rows -- the pipeline's own compute_rankings() on AHL 2026-27's standings
// (src/utils/__tests__/fixtures/ahl-power-rankings-94) -- since no nightly
// run had been written yet. ECHL reads the top 30 of the same rows with its
// 30 teams' ids swapped in.

import { LEAGUES, visitAs } from '../support/hockeytech'

const FIXTURE = 'src/utils/__tests__/fixtures/ahl-power-rankings-94/route.json'
const NARRATIVE = 'Two games in, the team sits in the lower half on points and special teams.'
// The ECHL's 30 teams (echlConfig.js), standing in for the AHL ids.
const ECHL_IDS = [74, 108, 82, 76, 17, 113, 99, 77, 10, 8, 52, 79, 61, 102, 18, 107, 5, 60, 65, 50, 21, 25, 66, 11, 68, 114, 70, 106, 71, 72]

LEAGUES.forEach(({ key, label, team }) => {
  const workerUrl = Cypress.expose('WORKER_URL')

  describe(`${label} League › Power rankings`, () => {
    let route

    beforeEach(() => {
      cy.readFile(FIXTURE).then(json => {
        let latest = json.latest
        if (key === 'echl') {
          // The followed team (ADK, ECHL_IDS[0]) takes HER's row, 23rd.
          latest = latest.slice(0, 30)
          const others = ECHL_IDS.slice(1)
          latest = latest.map(r => ({ ...r, team_id: r.team_id === 319 ? team.teamId : others.shift() }))
        }
        // A second run: everyone has a rank from the night before.
        // The followed team was 25th, as its history says.
        latest = latest.map(r => ({
          ...r,
          prior_rank: r.team_id === team.teamId ? 25 : r.rank === 1 ? 3 : r.rank === 3 ? 1 : r.rank,
        }))
        route = {
          latest,
          narrative: { text: NARRATIVE, run_date: '2026-10-08' },
          history: [{ run_date: '2026-10-07', rank: 25 }, { run_date: '2026-10-08', rank: 23 }],
        }
      })
    })

    const stub = body => cy.intercept('GET', `${workerUrl}/${key}/power-rankings*`, body).as('rankings')

    it('ranks every team with its movement, the followed team’s narrative and trend, and how it’s calculated', () => {
      cy.then(() => stub(route))
      visitAs(`/${key}/league`, key, team)
      cy.wait('@rankings').its('request.url').should('contain', `teamId=${team.teamId}`).and('contain', 'locale=en')
      cy.get('.league-tab').contains('Power rankings').click()

      cy.get('.hockeytech-power-rankings .pr-row').should('have.length', key === 'echl' ? 30 : 32)
      cy.get('.pr-row').eq(0).find('.pr-mvmt').should('have.text', '▲2')
      cy.get('.pr-row').eq(2).find('.pr-mvmt').should('have.text', '▼2')
      cy.get('.pr-row').eq(5).find('.pr-mvmt').should('have.text', '—')
      cy.get('.pr-row--you').should('contain', team.abbr).find('.pr-mvmt').should('have.text', '▲2')
      cy.get('.pr-row--you').should('contain', team.abbr).and('contain', '1-1-0').and('contain', '-1.00')

      cy.get('.pr-narrative-card').should('contain', `EyeWall AI — ${team.abbr}`).and('contain', NARRATIVE)
      cy.get('.pr-sparkline').should('contain', '▲2').find('svg').should('exist')
      cy.contains('Rankings from the nightly run of Oct 8').should('exist')

      cy.contains('button', 'How is this calculated?').click()
      cy.get('.pr-how-item').should('have.length', 4)
      cy.get('.pr-how-weight').then($w => expect([...$w].map(e => e.textContent)).to.deep.equal(['41.2%', '23.5%', '23.5%', '11.8%']))
      cy.get('.pr-how-body').should('not.contain', 'Corsi')
      cy.assertNoErrors()
    })

    it('draws the share card from the same rows', () => {
      cy.then(() => stub(route))
      visitAs(`/${key}/league`, key, team)
      cy.get('.league-tab', { timeout: DATA_TIMEOUT }).contains('Power rankings').click()
      cy.window().then(win => {
        // No share sheet or download in the test browser: the card is all
        // that's checked.
        win.navigator.share = undefined
        cy.stub(win.HTMLAnchorElement.prototype, 'click')
      })
      cy.get('.hockeytech-power-rankings').contains('button', /share/i).click()
      cy.get('#pr-export-canvas', { timeout: DATA_TIMEOUT })
        .should('contain', '#23').and('contain', '▲2').and('contain', `of ${key === 'echl' ? 30 : 32} · 1–1–0`).and('contain', NARRATIVE)
        .and('contain', 'L10').and('not.contain', 'xGF%')
    })

    it('offers no tab before the first nightly run', () => {
      stub({ latest: [], narrative: null, history: [] })
      visitAs(`/${key}/league`, key, team)
      cy.wait('@rankings')
      cy.get('.league-tab').contains('Leaders').should('exist')
      cy.get('.league-tab').contains('Power rankings').should('not.exist')
    })

    it('says so when the rankings can’t be read', () => {
      stub({ latest: [], narrative: null, history: [], unavailable: true })
      visitAs(`/${key}/league`, key, team)
      cy.get('.league-tab', { timeout: DATA_TIMEOUT }).contains('Power rankings').click()
      cy.get('.hockeytech-rankings-note').should('contain', "can't be loaded right now")
      cy.get('.pr-row').should('not.exist')
    })
  })
})

describe('PWHL League › Power Rankings: the EyeWall AI card', () => {
  it('shows the followed team’s nightly narrative and rank trend over the table', () => {
    cy.intercept('GET', '**/pwhl/power-rankings*', {
      latest: [{ team_id: 1, rank: 2, prior_rank: 4, score: 0.7, components: {} }],
      narrative: { text: 'The Fleet climbed two places on goal differential.', run_date: '2026-12-10' },
      history: [{ run_date: '2026-12-09', rank: 4 }, { run_date: '2026-12-10', rank: 2 }],
    }).as('pwhlRankings')
    cy.setPWHLTeam('BOS')
    cy.visit('/pwhl/league')
    cy.contains('Power Rankings', { timeout: DATA_TIMEOUT }).click()
    cy.wait('@pwhlRankings').its('request.url').should('contain', 'teamId=1').and('contain', 'locale=en')
    cy.get('.pr-narrative-card').should('contain', 'EyeWall AI — BOS').and('contain', 'climbed two places')
    cy.get('.pr-sparkline').should('contain', '▲2')
  })

  it('shows no card before the first nightly run', () => {
    cy.intercept('GET', '**/pwhl/power-rankings*', { latest: [], narrative: null, history: [] }).as('pwhlRankings')
    cy.setPWHLTeam('BOS')
    cy.visit('/pwhl/league')
    cy.contains('Power Rankings', { timeout: DATA_TIMEOUT }).click()
    cy.wait('@pwhlRankings')
    cy.get('.pr-narrative-card').should('not.exist')
  })
})
