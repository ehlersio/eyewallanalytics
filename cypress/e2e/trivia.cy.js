// cypress/e2e/trivia.cy.js
// Daily Trivia tab (Session 92). Stubs GET /trivia/today with fixture
// questions — same reasoning as draft.cy.js's stubbing of /draft/*:
// deterministic, doesn't depend on live season/pipeline state (NHL
// genuinely has zero real trivia data outside the regular season, same
// gap /draft/* has pre-draft).
const WORKER_URL = Cypress.env('VITE_WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev';

function makeQuestion(overrides = {}) {
  return {
    id: 1,
    question_date: '2026-08-05',
    tier: 'easy',
    sport: 'nhl',
    team: 'ALL',
    question_text: 'Which of these four players leads in goals this season?',
    options: ['Player A', 'Player B', 'Player C', 'Player D'],
    correct_index: 2,
    explanation: 'Player C led with 45 goals this season.',
    source: 'ai',
    ...overrides,
  };
}

const FULL_TRIVIA = {
  easy: makeQuestion({ id: 101, tier: 'easy', team: 'ALL' }),
  medium: makeQuestion({
    id: 102,
    tier: 'medium',
    team: 'CAR',
    question_text: 'Which of these four skaters leads the team in assists this season?',
    options: ['Skater A', 'Skater B', 'Skater C', 'Skater D'],
    correct_index: 0,
    explanation: 'Skater A led with 30 assists this season.',
  }),
  hard: makeQuestion({
    id: 103,
    tier: 'hard',
    team: 'ALL',
    question_text: 'True or False: The NHL was founded in 1917.',
    options: ['True', 'False'],
    correct_index: 0,
    explanation: 'The NHL was founded on November 26, 1917, in Montreal.',
    source: 'curated',
  }),
};

function openTriviaTab() {
  cy.setTeam('CAR');
  cy.visit('/news');
  cy.get('.news-view-toggle-btn').contains('Trivia').click();
  cy.get('.trivia-feed', { timeout: 8000 }).should('be.visible');
}

describe('Trivia tab', () => {
  beforeEach(() => {
    cy.intercept('GET', `${WORKER_URL}/trivia/today*`, { body: FULL_TRIVIA }).as('getTrivia');
    openTriviaTab();
    cy.wait('@getTrivia');
  });

  it('renders three tier cards with question text and options', () => {
    cy.get('.trivia-card').should('have.length', 3);
    cy.contains('.trivia-tier-badge', 'Easy');
    cy.contains('.trivia-tier-badge', 'Medium');
    cy.contains('.trivia-tier-badge', 'Hard');
    cy.contains('.trivia-question-text', FULL_TRIVIA.easy.question_text);
    FULL_TRIVIA.easy.options.forEach((opt) => {
      cy.contains('.trivia-option', opt);
    });
  });

  it('shows a team logo on the medium card, not a team name in the question text', () => {
    cy.get('.trivia-card').eq(1).within(() => {
      cy.get('.trivia-tier-badge img, .trivia-tier-badge .team-logo').should('exist');
      cy.get('.trivia-question-text').should('not.contain', 'CAR');
    });
  });

  it('highlights correct/incorrect and reveals the explanation after answering', () => {
    cy.get('.trivia-card').first().within(() => {
      cy.contains('.trivia-option', 'Player A').click(); // wrong — correct is index 2 ("Player C")
      cy.contains('.trivia-option', 'Player A').should('have.class', 'incorrect');
      cy.contains('.trivia-option', 'Player C').should('have.class', 'correct');
      cy.contains('.trivia-result-badge', 'Incorrect');
      cy.contains('.trivia-explanation', FULL_TRIVIA.easy.explanation);
    });
  });

  it('does not allow re-answering once a pick is made', () => {
    cy.get('.trivia-card').first().within(() => {
      cy.contains('.trivia-option', 'Player C').click();
      cy.get('.trivia-option').should('be.disabled');
    });
  });

  it('updates the aggregate stats line after answering', () => {
    cy.get('.news-updated').should('not.exist');
    cy.get('.trivia-card').eq(2).within(() => {
      cy.contains('.trivia-option', 'True').click(); // correct
    });
    cy.contains('.news-updated', '1/1 correct');
  });
});

describe('Trivia tab — empty state', () => {
  it('shows a per-tier "check back soon" message instead of crashing when nothing is published yet', () => {
    cy.intercept('GET', `${WORKER_URL}/trivia/today*`, {
      body: { easy: null, medium: null, hard: null },
    }).as('getEmptyTrivia');
    openTriviaTab();
    cy.wait('@getEmptyTrivia');

    cy.get('.trivia-card').should('have.length', 3);
    cy.get('.trivia-empty-msg').should('have.length', 3);
    cy.get('.trivia-option').should('not.exist');
  });
});

describe('PWHL Trivia tab', () => {
  it('renders three tier cards for a PWHL team', () => {
    const pwhlTrivia = {
      easy: makeQuestion({ id: 201, tier: 'easy', sport: 'pwhl', team: 'ALL' }),
      medium: makeQuestion({ id: 202, tier: 'medium', sport: 'pwhl', team: 'BOS' }),
      hard: makeQuestion({
        id: 203,
        tier: 'hard',
        sport: 'pwhl',
        team: 'ALL',
        question_text: 'True or False: The PWHL played its inaugural season in 2023-24.',
        options: ['True', 'False'],
        correct_index: 0,
        source: 'curated',
      }),
    };
    cy.intercept('GET', `${WORKER_URL}/trivia/today*`, { body: pwhlTrivia }).as('getPwhlTrivia');
    cy.setPWHLTeam('BOS');
    cy.visit('/pwhl/news');
    cy.get('.news-view-toggle-btn').contains('Trivia').click();
    cy.wait('@getPwhlTrivia');

    cy.get('.trivia-card').should('have.length', 3);
    cy.contains('.trivia-question-text', pwhlTrivia.hard.question_text);
  });
});
