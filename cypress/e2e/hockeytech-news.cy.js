// cypress/e2e/hockeytech-news.cy.js
// AHL/ECHL News tab: the league's news feed, source badges and filters.
// Split from hockeytech-routes.cy.js (Phase 3); fixtures and helpers are in
// ../support/hockeytech.js.

import { LEAGUES, visitAs, assertNoLoadFailure } from '../support/hockeytech'

LEAGUES.forEach(({ key, label, team, newsFooter, newsSources }) => {
  describe(`${label} News`, () => {
    it(`/${key}/news renders ${label} News`, () => {
      visitAs(`/${key}/news`, key, team)
      cy.contains(`${label} News`, { timeout: DATA_TIMEOUT }).should('be.visible')
      cy.contains(newsFooter).should('exist')
      cy.get('body', { timeout: DATA_TIMEOUT }).should($body => {
        const settled = $body.find('.news-feed .news-card').length > 0
          || $body.find('.news-empty').length > 0
          || $body.find('.news-error').length > 0
        expect(settled, 'news cards, the empty state or an error').to.equal(true)
      })
      assertNoLoadFailure()
    })

    // HockeyTechNewsView's per-league source badges and filter chips, on a
    // stubbed feed with one article per source.
    it(`/${key}/news badges and filters by ${label} source`, () => {
      const ids = Object.keys(newsSources)
      // The Worker's route only: the page itself is also at /<league>/news.
      cy.intercept('GET', `${Cypress.expose('WORKER_URL')}/${key}/news`, {
        body: ids.map((source, i) => ({
          id: `${source}-${i}`, source, sourceName: newsSources[source], title: `Story ${i} from ${source}`,
          url: 'https://example.com/', excerpt: 'Excerpt', publishedAt: new Date(Date.now() - 3600e3).toISOString(),
        })),
      })
      visitAs(`/${key}/news`, key, team)
      cy.get('.news-card', { timeout: DATA_TIMEOUT }).should('have.length', ids.length)
      cy.get('.news-source-badge').then($b => {
        expect([...$b].map(b => b.textContent).sort()).to.deep.equal(Object.values(newsSources).sort())
      })
      cy.contains('.news-chip', newsSources[ids[0]]).click()
      cy.get('.news-card').should('have.length', 1).and('contain', `from ${ids[0]}`)
      cy.contains('.news-chip', /^All/).click()
      cy.get('.news-card').should('have.length', ids.length)
      assertNoLoadFailure()
    })

    // The view's fetch is league.api.fetchNews, which throws (unlike the
    // other HockeyTech fetches, which resolve to null) so the view keeps
    // its error card and Try again button.
    it(`/${key}/news shows the error card when the Worker fails, and recovers on Try again`, () => {
      const workerUrl = Cypress.expose('WORKER_URL')
      let fail = true
      cy.intercept('GET', `${workerUrl}/${key}/news`, req => {
        if (fail) req.reply(503, {})
        else req.reply([{ id: 'n1', source: Object.keys(newsSources)[0], sourceName: Object.values(newsSources)[0], title: 'Back up', url: 'https://example.com/n1', excerpt: 'x', publishedAt: '2026-10-07T12:00:00+00:00', imageUrl: null }])
      })
      visitAs(`/${key}/news`, key, team)
      cy.get('.news-error', { timeout: DATA_TIMEOUT }).should('contain', 'News not yet available')
      cy.then(() => { fail = false })
      cy.get('.news-error').contains('button', /try again/i).click()
      cy.get('.news-card', { timeout: DATA_TIMEOUT }).should('have.length', 1).and('contain', 'Back up')
    })

    // Milestones and Trivia sub-tabs (contract C5): offered only when the
    // route has something for the league -- none yet before the pipeline's
    // first hockeytech_milestones.py / trivia_questions.py --sport run.
    it(`/${key}/news offers no Milestones or Trivia tab while their routes are empty`, () => {
      const workerUrl = Cypress.expose('WORKER_URL')
      cy.intercept('GET', `${workerUrl}/milestones/latest?sport=${key}*`, { latestId: null, gameDate: null }).as('msLatest')
      cy.intercept('GET', `${workerUrl}/trivia/today?sport=${key}*`, { easy: null, medium: null, hard: null }).as('trivia')
      visitAs(`/${key}/news`, key, team)
      cy.wait(['@msLatest', '@trivia'])
      cy.get('.news-card', { timeout: DATA_TIMEOUT }).should('exist')
      cy.contains('button', /^Milestones/).should('not.exist')
      cy.contains('button', /^Trivia/).should('not.exist')
    })

    it(`/${key}/news shows the ${label} milestones and trivia once their routes have them`, () => {
      const workerUrl = Cypress.expose('WORKER_URL')
      const milestone = { id: 41, game_id: 9001, season: 94, game_date: '2026-10-11', player_id: 9028, team: team.abbr, opponent: 'OPP', milestone_type: 'hat_trick', description: `Hat trick — Test Skater (${team.abbr})`, detail: { goal_count: 3 }, is_pwhl: false, sport: key }
      const question = { id: 99001, question_date: '2026-10-11', tier: 'easy', sport: key, team: 'ALL', question_text: `Which ${label} team has the most wins this season?`, options: ['A', 'B', 'C', 'D'], correct_index: 1, explanation: 'B leads.', locale: 'en' }
      cy.intercept('GET', `${workerUrl}/milestones/latest?sport=${key}*`, { latestId: 41, gameDate: '2026-10-11' })
      cy.intercept('GET', `${workerUrl}/milestones?sport=${key}*`, [milestone]).as('milestones')
      cy.intercept('GET', `${workerUrl}/trivia/today?sport=${key}*`, { easy: question, medium: null, hard: null })
      visitAs(`/${key}/news`, key, team)
      cy.contains('button', /^Milestones/, { timeout: DATA_TIMEOUT }).click()
      cy.wait('@milestones').its('request.url').should('include', `sport=${key}`)
      cy.contains(`Hat trick — Test Skater (${team.abbr})`).should('exist')
      cy.contains('button', /^Trivia/).click()
      cy.contains(question.question_text).should('exist')
      cy.contains('button', /^News/).click()
      cy.get('.news-card', { timeout: DATA_TIMEOUT }).should('exist')
      cy.assertNoErrors()
    })
  })
})
