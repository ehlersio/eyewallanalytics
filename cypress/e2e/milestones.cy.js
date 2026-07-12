// cypress/e2e/milestones.cy.js
const WORKER_URL = Cypress.env('WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev';

describe('Milestones feed', () => {
  before(() => {
    // Prime the Worker cache before any test runs — same pattern as
    // news.cy.js's cache-priming, but milestones has no cold-cache
    // retry loop client-side (unlike news), so one request is enough.
    cy.request({ url: `${WORKER_URL}/milestones`, failOnStatusCode: false });
  });

  beforeEach(() => {
    cy.team().then(t => {
      cy.visit('/news');
      cy.contains(t.newsPageTitle, { timeout: 8000 }).should('be.visible');
      cy.get('.news-view-toggle-btn').contains('Milestones').click();
    });
  });

  it('switches to the Milestones tab and shows the header', () => {
    cy.contains('Milestones', { timeout: 8000 }).should('be.visible');
  });

  it('News/Milestones toggle does not collide with source filter chips', () => {
    // Regression guard: toggle buttons and source filter chips must stay
    // on separate classes. If this ever fails, .news-chip.active assertions
    // in news.cy.js will start matching multiple elements again.
    cy.get('.news-view-toggle-btn').should('have.length', 2);
    cy.get('.news-view-toggle-btn.active').should('have.length', 1);
    cy.get('.news-view-toggle-btn.active').should('contain', 'Milestones');
  });

  it('clicking News returns to the news feed', () => {
    cy.get('.news-view-toggle-btn').contains('News').click();
    cy.get('.news-filter-chips', { timeout: 8000 }).should('exist');
  });

  describe('Team filter dropdown', () => {
    it('shows "All Teams" by default', () => {
      cy.get('.ms-team-select-btn').should('contain', 'All Teams');
    });

    it('opens and shows team options with logos', () => {
      cy.get('.ms-team-select-btn').click();
      cy.get('.ms-team-menu', { timeout: 5000 }).should('be.visible');
      cy.get('.ms-team-option').should('have.length.gte', 2); // "All Teams" + at least 1 team
      cy.get('.ms-team-option').first().should('contain', 'All Teams');
    });

    it('closes when clicking outside', () => {
      cy.get('.ms-team-select-btn').click();
      cy.get('.ms-team-menu').should('be.visible');
      cy.get('body').click(0, 0);
      cy.get('.ms-team-menu').should('not.exist');
    });

    it('selecting a team filters the feed and updates the button label', () => {
      cy.get('.ms-team-select-btn').click();
      cy.get('.ms-team-menu', { timeout: 5000 }).should('be.visible');
      cy.get('.ms-team-option').eq(1).invoke('text').then(text => {
        // option text is "ABBR — Short Name"; grab the abbr for assertion
        const abbr = text.trim().split(' ')[0];
        cy.get('.ms-team-option').eq(1).click();
        cy.get('.ms-team-select-btn').should('contain', abbr);
        cy.get('.ms-team-menu').should('not.exist');
      });
    });

    it('resetting to All Teams shows the unfiltered feed again', () => {
      cy.get('.ms-team-select-btn').click();
      cy.get('.ms-team-option').eq(1).click();
      cy.get('.ms-team-select-btn').click();
      cy.get('.ms-team-option').contains('All Teams').click();
      cy.get('.ms-team-select-btn').should('contain', 'All Teams');
    });
  });

  describe('Milestone cards', () => {
    // Milestone data is real and date-dependent (nightly pipeline output),
    // so these assert on structure/behavior when cards exist rather than
    // assuming a specific count — same defensive pattern as news.cy.js's
    // source-chip tests (e.g. "clicking ESPN chip" no-ops if ESPN absent).

    it('shows either milestone cards or the empty state, never a blank screen', () => {
      cy.get('.milestones-feed', { timeout: 10000 }).should($feed => {
        const hasCards = $feed.find('.news-card').length > 0;
        const hasEmpty = $feed.find('.news-empty').length > 0;
        expect(hasCards || hasEmpty, 'has cards or empty state').to.be.true;
      });
    });

    it('each card shows a milestone type badge and a date', () => {
      cy.get('.milestones-feed .news-card').then($cards => {
        if ($cards.length === 0) return; // empty state — nothing to check
        cy.wrap($cards.first()).find('.milestone-icon-badge').should('exist');
        cy.wrap($cards.first()).find('.news-card-time').should('exist');
      });
    });

    it('each card shows a team logo next to the description', () => {
      cy.get('.milestones-feed .news-card').then($cards => {
        if ($cards.length === 0) return;
        cy.wrap($cards.first()).find('.milestone-card-title img, .milestone-card-title svg')
          .should('exist');
      });
    });

    it('tapping a card opens the player popup', () => {
      cy.get('.milestones-feed .news-card').then($cards => {
        if ($cards.length === 0) return;
        cy.wrap($cards.first()).click();
        // Player landing is a real network call (NHL API via Worker proxy),
        // so give it generous room rather than asserting on the transient
        // loading state (which can flash and clear before Cypress queries
        // it if the response is fast/cached).
        cy.get('.popup-backdrop', { timeout: 10000 }).should('exist');
        // Clean up so this doesn't leak into subsequent tests.
        cy.get('.pp-close').click();
        cy.get('.popup-backdrop').should('not.exist');
      });
    });
  });
});

// Session 60 regression: MilestonesFeed's PWHL branch no longer pre-fetches
// /pwhl/player/landing itself before opening the popup — it just passes
// {player_id} and lets PWHLPlayerPopup self-fetch. Confirm that still opens
// a fully-populated popup (identity + stats), not just an empty shell.
describe('PWHL milestones', () => {
  beforeEach(() => {
    cy.setPWHLTeam('BOS');
    cy.visit('/pwhl/news');
    cy.get('.topbar', { timeout: 10000 }).should('exist');
    cy.get('.news-view-toggle-btn').contains('Milestones').click();
  });

  it('tapping a PWHL milestone card opens the popup with self-fetched identity + stats', () => {
    cy.get('.milestones-feed .news-card').then($cards => {
      if ($cards.length === 0) return; // no PWHL milestones today — nothing to check
      cy.wrap($cards.first()).click();
      cy.get('.popup-backdrop', { timeout: 10000 }).should('exist');
      cy.contains('Goals', { timeout: 8000 }).should('exist');
      cy.get('.pp-close').click();
      cy.get('.popup-backdrop').should('not.exist');
    });
  });
});
