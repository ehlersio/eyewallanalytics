// cypress/e2e/admin-health.cy.js
// Admin › Health (/admin/health): the Worker's per-league cron records,
// the pipeline/Worker ops reports and the ops-alerts card (contract C1,
// eyewall-poller ops.js). The owner gate lives in the Worker, so the
// signed-in state is a session injected into localStorage (as auth.cy.js
// does) and /admin/health is stubbed -- the real one 401s anyone else.
// Shapes are the live Worker's on 2026-10-06.
const AUTH_STORAGE_KEY = 'sb-mqgasjzywoibdgxjjkux-auth-token'
const WORKER_URL = Cypress.expose('VITE_WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev'

function fakeSession() {
  return {
    access_token: 'cypress-fake-access-token',
    refresh_token: 'cypress-fake-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'cypress-test-user-id', email: 'owner@example.com', app_metadata: {}, user_metadata: {} },
  }
}

const now = () => new Date().toISOString()
const minsAgo = m => new Date(Date.now() - m * 60_000).toISOString()

function health(extra) {
  return {
    checkedAt: now(),
    sources: [{ key: 'pwhl:espn', consecutiveFailures: 0, itemCount: 12, lastSuccessAt: minsAgo(30) }],
    ...extra,
  }
}

function visitHealth(body) {
  // The Worker's route, not the page's own /admin/health URL.
  cy.intercept('GET', `${WORKER_URL}/admin/health`, req => {
    expect(req.headers.authorization).to.eq('Bearer cypress-fake-access-token')
    req.reply(body)
  }).as('health')
  cy.visit('/admin/health', {
    onBeforeLoad(win) {
      win.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fakeSession()))
    },
  })
  cy.wait('@health')
}

describe('Admin › Health', () => {
  it('shows each league’s cron state, the ops reports and the ops-alerts card', () => {
    visitHealth(health({
      cron: {
        nhl: { lastPollAt: minsAgo(0.5), lastOkAt: minsAgo(0.5), lastError: null },
        pwhl: { lastPollAt: minsAgo(0.5), lastOkAt: minsAgo(0.5), lastError: null },
        ahl: { lastPollAt: minsAgo(0.5), lastOkAt: minsAgo(40), lastError: 'HockeyTech 503', failingSince: minsAgo(39) },
        echl: null,
      },
      ops: {
        'nightly.yml': { status: 'failure', title: 'NHL Nightly failed', body: 'run', url: 'https://github.com/ehlersio/eyewall-pipeline/actions/runs/1', at: minsAgo(60) },
        'worker-cron-pwhl': { status: 'ok', title: 'PWHL poller recovered', body: '', url: null, at: minsAgo(5) },
      },
      opsSubscribers: 2,
    }))

    cy.get('[data-testid="cron-nhl"]').should('have.attr', 'data-state', 'ok')
    cy.get('[data-testid="cron-ahl"]').should('have.attr', 'data-state', 'failing').and('contain', 'HockeyTech 503')
    cy.get('[data-testid="cron-echl"]').should('have.attr', 'data-state', 'none').and('contain', 'no record yet')

    cy.get('[data-testid^="ops-"][data-status]').first().should('contain', 'worker-cron-pwhl') // newest first
    cy.get('[data-testid="ops-nightly.yml"]').should('have.attr', 'data-status', 'failure')
      .find('a[href^="https://github.com/"]').should('exist')

    cy.get('[data-testid="ops-alerts"]').should('contain', '2 devices subscribed')
      .and('contain', 'Send ops alerts to this device')
    cy.get('[data-testid="ops-alerts-unavailable"]').should('not.exist')
    cy.contains('pwhl:espn').should('exist')
    cy.assertNoErrors()
  })

  it('says ops alerts and cron health are unavailable on a Worker without them', () => {
    visitHealth(health())
    cy.get('[data-testid="ops-alerts-unavailable"]').should('exist')
    cy.get('[data-testid="cron-unavailable"]').should('exist')
    cy.get('[data-testid="ops-alerts"]').should('not.exist')
    cy.contains('pwhl:espn').should('exist')
    cy.assertNoErrors()
  })
})
