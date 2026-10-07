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
  })
})
