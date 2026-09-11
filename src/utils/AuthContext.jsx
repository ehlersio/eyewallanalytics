// utils/AuthContext.jsx
// Optional, passwordless sign-in (Supabase Auth magic link) — Phase 0.
//
// Fully additive: nothing else in the app reads from this context yet.
// A signed-out user sees and does exactly what they see and do today.
// Session persistence/refresh is handled entirely by supabase-js itself
// (persistSession/autoRefreshToken in supabaseAuth.js, backed by
// localStorage) — this context just mirrors that state into React so
// components can reactively show signed-in/out UI, it does not implement
// persistence itself.

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { supabaseAuth } from './supabaseAuth';
import { syncFavoriteTeamOnSignIn } from './favoriteTeamSync';
import { syncTriviaAnswersOnSignIn } from './triviaAnswers';
import { syncLocaleOnSignIn } from './localeSync';

// Native magic-link return trip -------------------------------------------
// window.location.origin resolves to capacitor://localhost inside Capacitor's
// WKWebView, a scheme nothing outside the app (Mail, Supabase's own redirect)
// can open, so the OTP email arrives but has nowhere to send the user back.
// A custom URL scheme (registered in ios/App/App/Info.plist as
// CFBundleURLTypes, matching PRODUCT_BUNDLE_IDENTIFIER) plus a
// @capacitor/app 'appUrlOpen' listener replaces that round trip natively.
//
// This app uses supabase-js's default 'implicit' flow (never overridden in
// supabaseAuth.js), so the tokens land in the callback URL's hash fragment,
// e.g. com.eyewallanalytics.app://login-callback#access_token=...&refresh_token=...
// -- same shape a browser tab would get, just handed to us directly instead
// of appearing in window.location, so detectSessionInUrl never sees it and we
// parse+apply it ourselves via the public setSession() API.
const NATIVE_AUTH_REDIRECT = 'com.eyewallanalytics.app://login-callback';

function applyAuthDeepLink(url) {
  if (!url || !url.startsWith(NATIVE_AUTH_REDIRECT)) return;
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return;
  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const access_token  = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    supabaseAuth.auth.setSession({ access_token, refresh_token });
  } else if (params.get('error')) {
    console.warn('[Auth] magic link error:', params.get('error_description') || params.get('error'));
  }
}

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,
  signInWithOtp: async () => ({ error: new Error('AuthProvider not mounted') }),
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // Auth Phase 1 (favorite-team sync) — tracks which signed-in user id has
  // already had a reconcile pass this page load, so a token refresh (which
  // also fires onAuthStateChange with a new session object, same user)
  // doesn't re-trigger it. Reset naturally on every full reload, which is
  // exactly when a fresh reconcile is wanted anyway.
  const reconciledUserId = useRef(null);

  useEffect(() => {
    let cancelled = false;

    supabaseAuth.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabaseAuth.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      setSession(newSession);
      setLoading(false);
    });

    let urlListenerHandle;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', ({ url }) => applyAuthDeepLink(url))
        .then(handle => { urlListenerHandle = handle; });
    }

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
      urlListenerHandle?.remove();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || reconciledUserId.current === userId) return;
    reconciledUserId.current = userId;
    syncFavoriteTeamOnSignIn(userId);
    syncTriviaAnswersOnSignIn(userId);
    syncLocaleOnSignIn(userId);
  }, [session]);

  const signInWithOtp = async (email) => {
    return supabaseAuth.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: Capacitor.isNativePlatform() ? NATIVE_AUTH_REDIRECT : window.location.origin,
      },
    });
  };

  const signOut = async () => {
    await supabaseAuth.auth.signOut();
  };

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    isAuthenticated: !!session,
    signInWithOtp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
