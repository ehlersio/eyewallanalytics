// cypress/e2e/auth.cy.js
// Supabase Auth magic-link sign-in (Session 90). Never hits real Supabase
// Auth — the OTP request is intercepted (same reasoning as draft.cy.js
// stubbing /draft/*: deterministic, and a real signInWithOtp call would
// send a real email against Resend's rate limit on every CI run). The
// signed-in UI state is exercised by injecting a session directly into
// localStorage in the same shape supabase-js persists (see
// supabaseAuth.js's storage key) — supabase-js's getSession() reads that
// straight from storage without a network round-trip when expires_at is
// in the future, so this stays fully offline and deterministic too.
const SUPABASE_URL = 'https://mqgasjzywoibdgxjjkux.supabase.co';
const AUTH_STORAGE_KEY = 'sb-mqgasjzywoibdgxjjkux-auth-token';
const TEST_EMAIL = 'trivia-fan@example.com';

function openSettings() {
  cy.get('.notif-bell').click();
  cy.get('.notif-popup', { timeout: 8000 }).should('be.visible');
}

function fakeSession(email = TEST_EMAIL) {
  return {
    access_token: 'cypress-fake-access-token',
    refresh_token: 'cypress-fake-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'cypress-test-user-id', email, app_metadata: {}, user_metadata: {} },
  };
}

describe('Account section — signed out', () => {
  beforeEach(() => {
    cy.setTeam('CAR');
    cy.visit('/');
    openSettings();
  });

  it('shows the signed-out row', () => {
    cy.get('.account-row-button').contains('Sign in to sync across devices').should('be.visible');
  });

  it('opens the two-step email form on click', () => {
    cy.get('.account-row-button').contains('Sign in to sync across devices').click();
    cy.get('.account-signin-form').should('be.visible');
    cy.get('.account-signin-input').should('be.visible');
  });

  it('sends the OTP request and shows the check-your-email state', () => {
    cy.intercept('POST', `${SUPABASE_URL}/auth/v1/otp*`, { statusCode: 200, body: {} }).as('otpRequest');

    cy.get('.account-row-button').contains('Sign in to sync across devices').click();
    cy.get('.account-signin-input').type(TEST_EMAIL);
    cy.get('.account-signin-submit').click();
    cy.wait('@otpRequest');

    // .notif-popup is a scrollable panel (overflow-y: auto) — the sent
    // state can render below the current scroll position within it.
    cy.contains('Check your email').scrollIntoView().should('be.visible');
    cy.contains(TEST_EMAIL).should('be.visible');
  });

  it('shows an inline error if the OTP request fails, without crashing', () => {
    cy.intercept('POST', `${SUPABASE_URL}/auth/v1/otp*`, {
      statusCode: 429,
      body: { error: 'over_email_send_rate_limit', msg: 'Too many requests' },
    }).as('otpFailure');

    cy.get('.account-row-button').contains('Sign in to sync across devices').click();
    cy.get('.account-signin-input').type(TEST_EMAIL);
    cy.get('.account-signin-submit').click();
    cy.wait('@otpFailure');

    cy.get('.account-signin-error').scrollIntoView().should('be.visible');
  });

  it('"Use a different email" resets back to the signed-out row', () => {
    cy.intercept('POST', `${SUPABASE_URL}/auth/v1/otp*`, { statusCode: 200, body: {} }).as('otpRequest');

    cy.get('.account-row-button').contains('Sign in to sync across devices').click();
    cy.get('.account-signin-input').type(TEST_EMAIL);
    cy.get('.account-signin-submit').click();
    cy.wait('@otpRequest');
    cy.contains('Use a different email').click();

    cy.get('.account-row-button').contains('Sign in to sync across devices').should('be.visible');
  });

  it('"Cancel" from the email form returns to the signed-out row without sending anything', () => {
    cy.get('.account-row-button').contains('Sign in to sync across devices').click();
    cy.get('.account-signin-cancel').contains('Cancel').click();
    cy.get('.account-row-button').contains('Sign in to sync across devices').should('be.visible');
  });
});

describe('Account section — signed in', () => {
  beforeEach(() => {
    cy.setTeam('CAR');
    cy.visit('/');
    cy.window().then((win) => {
      win.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fakeSession()));
    });
    cy.reload();
    openSettings();
  });

  it('shows the avatar initial, email, and Synced badge', () => {
    cy.get('.account-avatar').should('contain', 'T'); // first letter of trivia-fan@example.com
    cy.contains('.account-row-label', TEST_EMAIL);
    cy.get('.account-badge').should('contain', 'Synced');
  });

  it('signs out and reverts to the signed-out row, with no broken UI state elsewhere in Settings', () => {
    cy.contains('.account-row-button', 'Sign out').click();

    cy.get('.account-row-button').contains('Sign in to sync across devices').should('be.visible');
    cy.window().then((win) => {
      expect(win.localStorage.getItem(AUTH_STORAGE_KEY)).to.be.null;
    });
    // Regression check — the rest of Settings (unrelated to auth) still renders.
    cy.contains('My Team').should('be.visible');
  });
});
