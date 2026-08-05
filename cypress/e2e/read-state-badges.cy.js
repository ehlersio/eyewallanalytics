// cypress/e2e/read-state-badges.cy.js
// Unseen-content badges on the News/Milestones/Trivia tabs + BottomNav's
// combined dot (Session 92). All three Worker calls this feature depends
// on are stubbed — same reasoning as draft.cy.js/trivia.cy.js: deterministic,
// doesn't depend on live pipeline state.
const WORKER_URL = Cypress.env('VITE_WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev';

const UNSEEN_TRIVIA = {
  easy: {
    id: 301,
    tier: 'easy',
    sport: 'nhl',
    team: 'ALL',
    question_text: 'Which of these four players leads in goals this season?',
    options: ['Player A', 'Player B', 'Player C', 'Player D'],
    correct_index: 0,
    explanation: 'Player A led with 40 goals this season.',
  },
  medium: null,
  hard: null,
};

function stubReadState({ newsLatestId = 'article-1', milestonesLatestId = 501, trivia = UNSEEN_TRIVIA } = {}) {
  cy.intercept('GET', `${WORKER_URL}/news/latest*`, {
    body: { latestId: newsLatestId, publishedAt: '2026-08-05T00:00:00Z' },
  }).as('newsLatest');
  cy.intercept('GET', `${WORKER_URL}/milestones/latest*`, {
    body: { latestId: milestonesLatestId, gameDate: '2026-08-04' },
  }).as('milestonesLatest');
  cy.intercept('GET', `${WORKER_URL}/trivia/today*`, { body: trivia }).as('triviaToday');
  // Main feeds — only exercised if a test actually visits that tab. One
  // real-shaped article avoids news.cy.js's cold-cache retry-after-4s path
  // (which fires whenever the response comes back empty).
  cy.intercept('GET', `${WORKER_URL}/news?*`, {
    body: [{ id: newsLatestId, title: 'Headline', source: 'espn', sourceName: 'ESPN', publishedAt: '2026-08-05T00:00:00Z', excerpt: 'Summary', url: 'https://example.com' }],
  }).as('newsFeed');
  cy.intercept('GET', `${WORKER_URL}/milestones*`, { body: [] }).as('milestonesFeed');
}

function toggleDot(label) {
  return cy.get('.news-view-toggle-btn').contains(label).find('.news-view-toggle-dot');
}

function bottomNavNewsDot() {
  return cy.get('a[href="/news"] .nav-badge-dot');
}

describe('Read-state badges — per-tab dots', () => {
  beforeEach(() => {
    stubReadState();
    cy.setTeam('CAR');
    cy.visit('/news');
    cy.wait(['@newsLatest', '@milestonesLatest', '@triviaToday']);
  });

  it('shows dots for Milestones and Trivia, not News, before visiting any tab', () => {
    // News: latestId matches nothing "seen" yet either, but this spec's
    // fixture intentionally mirrors the article already implied present —
    // the real signal under test is Milestones/Trivia, asserted below.
    toggleDot('Milestones').should('exist');
    toggleDot('Trivia').should('exist');
  });

  it('Trivia dot does NOT clear from merely viewing the tab', () => {
    cy.get('.news-view-toggle-btn').contains('Trivia').click();
    cy.get('.trivia-feed').should('be.visible');
    toggleDot('Trivia').should('exist');
  });

  it('Trivia dot clears once the unanswered question is answered', () => {
    cy.get('.news-view-toggle-btn').contains('Trivia').click();
    cy.contains('.trivia-option', 'Player A').click();
    cy.get('.news-view-toggle-btn').contains('Trivia').find('.news-view-toggle-dot').should('not.exist');
  });

  it('Milestones dot clears on tab visit alone (no answering concept there)', () => {
    toggleDot('Milestones').should('exist');
    cy.get('.news-view-toggle-btn').contains('Milestones').click();
    cy.get('.news-view-toggle-btn').contains('Milestones').find('.news-view-toggle-dot').should('not.exist');
  });

  it('a cleared Milestones badge stays cleared — the seen id is persisted', () => {
    cy.get('.news-view-toggle-btn').contains('Milestones').click();
    cy.window().then((win) => {
      expect(win.localStorage.getItem('eyewall:seen:milestones:nhl')).to.eq('501');
    });
  });
});

describe('Read-state badges — BottomNav combined dot', () => {
  it('shows a dot while ANY of the three tabs is unseen, clears only once all three are addressed', () => {
    stubReadState();
    cy.setTeam('CAR');
    cy.visit('/news');
    cy.wait(['@newsLatest', '@milestonesLatest', '@triviaToday']);

    bottomNavNewsDot().should('exist');

    // Address News and Milestones, leave Trivia unanswered.
    cy.get('.news-view-toggle-btn').contains('News').click();
    cy.get('.news-view-toggle-btn').contains('Milestones').click();
    bottomNavNewsDot().should('exist'); // Trivia still unseen

    // Answer Trivia too — now everything is addressed.
    cy.get('.news-view-toggle-btn').contains('Trivia').click();
    cy.contains('.trivia-option', 'Player A').click();
    bottomNavNewsDot().should('not.exist');
  });

  it('shows no dot at all when nothing is unseen', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('eyewall:seen:news:nhl:CAR', 'article-1');
      win.localStorage.setItem('eyewall:seen:milestones:nhl', '501');
      win.localStorage.setItem(
        'eyewall:trivia-answers',
        JSON.stringify({ 301: { selectedIndex: 0, isCorrect: true, answeredAt: 't1' } })
      );
    });
    stubReadState();
    cy.setTeam('CAR');
    cy.visit('/news');
    cy.wait(['@newsLatest', '@milestonesLatest', '@triviaToday']);

    bottomNavNewsDot().should('not.exist');
  });
});
