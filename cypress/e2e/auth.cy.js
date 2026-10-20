// cypress/e2e/auth.cy.js
// Supabase Auth magic-link sign-in (Session 90). Never hits real Supabase
// Auth — the OTP request is stubbed (same reasoning as draft.cy.js
// stubbing /draft/*: deterministic, and a real signInWithOtp call would
// send a real email against Resend's rate limit on every CI run). The
// signed-in UI state is exercised by injecting a session directly into
// localStorage in the same shape supabase-js persists (see
// supabaseAuth.js's storage key) — supabase-js's getSession() reads that
// straight from storage without a network round-trip when expires_at is
// in the future, so this stays fully offline and deterministic too.
//
// Sign-in uses the PKCE flow (supabaseAuth.js): the OTP request carries a
// code challenge, the verifier stays in localStorage, and the magic link
// comes back as /?code=... which supabase-js trades for a session at
// /auth/v1/token?grant_type=pkce (also stubbed below).
//
// Stubbed POSTs are answered inside the page by answerInPage, not by
// cy.intercept: on some CI Chrome builds a cy.intercept-stubbed POST now and
// then crashes Chrome's network service and Vite reloads the page. That is
// how "Use a different email" once failed with "No request ever occurred"
// for the OTP POST. See cypress/support/answerInPage.js.
import { answerInPage, firstCall } from '../support/answerInPage';

const AUTH_STORAGE_KEY = 'sb-mqgasjzywoibdgxjjkux-auth-token';
const CODE_VERIFIER_KEY = `${AUTH_STORAGE_KEY}-code-verifier`;
const TEST_EMAIL = 'trivia-fan@example.com';

function openSettings() {
  cy.get('.notif-bell').click();
  cy.get('.notif-popup', { timeout: DATA_TIMEOUT }).should('be.visible');
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
  let otp;

  beforeEach(() => {
    otp = { method: 'POST', url: /\.supabase\.co\/auth\/v1\/otp\b/, reply: { statusCode: 200, body: {} } };
    answerInPage([otp]);
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
    cy.get('.account-row-button').contains('Sign in to sync across devices').click();
    cy.get('.account-signin-input').type(TEST_EMAIL);
    cy.get('.account-signin-submit').click();
    firstCall(otp).its('body').should((body) => {
      expect(body.email).to.eq(TEST_EMAIL);
      expect(body.code_challenge).to.be.a('string').and.not.be.empty;
      expect(body.code_challenge_method).to.eq('s256');
    });
    // The verifier that will redeem the link's code stays in this browser.
    cy.window().then((win) => {
      expect(win.localStorage.getItem(CODE_VERIFIER_KEY)).to.be.a('string').and.not.be.empty;
    });

    // .notif-popup is a scrollable panel (overflow-y: auto) — the sent
    // state can render below the current scroll position within it.
    cy.contains('Check your email').scrollIntoView().should('be.visible');
    cy.contains(TEST_EMAIL).should('be.visible');
  });

  it('shows an inline error if the OTP request fails, without crashing', () => {
    otp.reply = {
      statusCode: 429,
      body: { error: 'over_email_send_rate_limit', msg: 'Too many requests' },
    };

    cy.get('.account-row-button').contains('Sign in to sync across devices').click();
    cy.get('.account-signin-input').type(TEST_EMAIL);
    cy.get('.account-signin-submit').click();
    firstCall(otp);

    cy.get('.account-signin-error').scrollIntoView().should('be.visible');
  });

  it('"Use a different email" resets back to the signed-out row', () => {
    cy.get('.account-row-button').contains('Sign in to sync across devices').click();
    cy.get('.account-signin-input').type(TEST_EMAIL);
    cy.get('.account-signin-submit').click();
    firstCall(otp);
    cy.contains('Use a different email').click();

    cy.get('.account-row-button').contains('Sign in to sync across devices').should('be.visible');
  });

  it('"Cancel" from the email form returns to the signed-out row without sending anything', () => {
    cy.get('.account-row-button').contains('Sign in to sync across devices').click();
    cy.get('.account-signin-cancel').contains('Cancel').click();
    cy.get('.account-row-button').contains('Sign in to sync across devices').should('be.visible');
    cy.then(() => expect(otp.calls, 'OTP requests').to.have.length(0));
  });
});

describe('Magic-link return', () => {
  it('trades the ?code= for a session, signs in and takes the code out of the URL', () => {
    const pkce = {
      method: 'POST',
      url: /\.supabase\.co\/auth\/v1\/token\?grant_type=pkce$/,
      reply: { statusCode: 200, body: fakeSession() },
    };
    answerInPage([pkce]);

    cy.visit('/?code=cypress-auth-code', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: 'CAR' }));
        // What signInWithOtp left behind (supabase-js stores it JSON-encoded).
        win.localStorage.setItem(CODE_VERIFIER_KEY, JSON.stringify('cypress-code-verifier'));
      },
    });

    firstCall(pkce).its('body').should('deep.equal', {
      auth_code: 'cypress-auth-code',
      code_verifier: 'cypress-code-verifier',
    });
    cy.location('search').should('not.contain', 'code=');
    cy.window().its('localStorage').invoke('getItem', CODE_VERIFIER_KEY).should('be.null');

    openSettings();
    cy.get('.account-badge').should('contain', 'Synced');
    cy.contains('.account-row-label', TEST_EMAIL);
  });

  it('ignores tokens in the URL fragment (the old implicit-flow shape)', () => {
    cy.visit('/#access_token=cypress-fake-access-token&refresh_token=cypress-fake-refresh-token&expires_in=3600&token_type=bearer&type=magiclink', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: 'CAR' }));
      },
    });
    openSettings();
    cy.get('.account-row-button').contains('Sign in to sync across devices').should('be.visible');
    cy.window().then((win) => {
      expect(win.localStorage.getItem(AUTH_STORAGE_KEY)).to.be.null;
    });
  });
});

describe('Account section — signed in', () => {
  let deleteRpc;

  beforeEach(() => {
    deleteRpc = { method: 'POST', url: /\.supabase\.co\/rest\/v1\/rpc\/delete_own_account\b/, reply: { statusCode: 204 } };
    answerInPage([deleteRpc]);
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
    cy.contains('Your teams').should('be.visible');
  });

  // In-app account deletion (App Store Guideline 5.1.1(v)). The RPC is
  // stubbed for the same reason the OTP request is above -- a real call
  // would need a real user to delete.
  it('Delete account asks for confirmation, and Cancel keeps the account', () => {
    cy.contains('.account-delete-row', 'Delete account').click();
    cy.contains('Delete your account?').scrollIntoView().should('be.visible');
    cy.get('.account-signin-cancel').contains('Cancel').click();
    cy.then(() => expect(deleteRpc.calls, 'delete RPCs').to.have.length(0));

    cy.get('.account-badge').should('contain', 'Synced');
    cy.get('.account-delete-row').should('be.visible');
  });

  it('deletes the account via the RPC and reverts to the signed-out row', () => {
    cy.contains('.account-delete-row', 'Delete account').click();
    cy.get('.account-delete-confirm').click();
    firstCall(deleteRpc).its('headers.authorization').should('eq', 'Bearer cypress-fake-access-token');

    cy.get('.account-row-button').contains('Sign in to sync across devices').should('be.visible');
    cy.window().then((win) => {
      expect(win.localStorage.getItem(AUTH_STORAGE_KEY)).to.be.null;
    });
  });

  it('shows an inline error and stays signed in if deletion fails', () => {
    deleteRpc.reply = {
      statusCode: 500,
      body: { code: 'XX000', message: 'boom' },
    };

    cy.contains('.account-delete-row', 'Delete account').click();
    cy.get('.account-delete-confirm').click();
    firstCall(deleteRpc);

    cy.get('.account-signin-error').scrollIntoView().should('contain', 'Could not delete your account');
    cy.get('.account-badge').should('contain', 'Synced');
  });
});
