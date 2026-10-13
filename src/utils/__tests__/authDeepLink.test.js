// The iOS magic-link callback (utils/authDeepLink.js): PKCE code exchange only.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NATIVE_AUTH_REDIRECT, applyAuthDeepLink } from '../authDeepLink';

function fakeAuth(result = { data: {}, error: null }) {
  return {
    exchangeCodeForSession: vi.fn(async () => result),
    setSession: vi.fn(),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('applyAuthDeepLink', () => {
  it('exchanges the ?code= for a session', async () => {
    const auth = fakeAuth();
    await applyAuthDeepLink(`${NATIVE_AUTH_REDIRECT}?code=abc-123`, auth);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc-123', undefined);
  });

  it('passes the flow id along when supabase-js put one on the link', async () => {
    const auth = fakeAuth();
    await applyAuthDeepLink(`${NATIVE_AUTH_REDIRECT}?sb_flow_id=f1&code=abc`, auth);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc', { flowId: 'f1' });
  });

  it('never trusts tokens handed over in the link', async () => {
    const auth = fakeAuth();
    await applyAuthDeepLink(`${NATIVE_AUTH_REDIRECT}#access_token=a&refresh_token=r&token_type=bearer`, auth);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('logs a failed link (query or fragment) instead of exchanging anything', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const auth = fakeAuth();
    await applyAuthDeepLink(`${NATIVE_AUTH_REDIRECT}?error=access_denied&error_description=Email+link+is+invalid+or+has+expired`, auth);
    await applyAuthDeepLink(`${NATIVE_AUTH_REDIRECT}#error=access_denied&error_code=otp_expired`, auth);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[Auth] magic link error:', 'Email link is invalid or has expired');
    expect(warn).toHaveBeenCalledWith('[Auth] magic link error:', 'access_denied');
  });

  it('ignores other URLs', async () => {
    const auth = fakeAuth();
    await applyAuthDeepLink('com.eyewallanalytics.app://game/123?code=abc', auth);
    await applyAuthDeepLink('https://evil.example/login-callback?code=abc', auth);
    await applyAuthDeepLink(undefined, auth);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('does not throw when the exchange fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await applyAuthDeepLink(`${NATIVE_AUTH_REDIRECT}?code=abc`, fakeAuth({ data: {}, error: new Error('PKCE code verifier not found in storage') }));
    const throwing = { exchangeCodeForSession: vi.fn(async () => { throw new Error('offline'); }) };
    await expect(applyAuthDeepLink(`${NATIVE_AUTH_REDIRECT}?code=abc`, throwing)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
