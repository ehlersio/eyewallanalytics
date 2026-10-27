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
import { NATIVE_AUTH_REDIRECT, applyAuthDeepLink } from './authDeepLink';
import { syncFavoriteTeamOnSignIn } from './favoriteTeamSync';
import { syncFollowedTeamsOnSignIn } from './followedTeams';
import { syncTriviaAnswersOnSignIn } from './triviaAnswers';
import { syncLocaleOnSignIn } from './localeSync';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,
  signInWithOtp: async () => ({ error: new Error('AuthProvider not mounted') }),
  signOut: async () => {},
  deleteAccount: async () => ({ error: new Error('AuthProvider not mounted') }),
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
      CapacitorApp.addListener('appUrlOpen', ({ url }) => applyAuthDeepLink(url, supabaseAuth.auth))
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
    syncFollowedTeamsOnSignIn(userId);
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

  // Permanent, immediate account deletion (App Store Guideline 5.1.1(v)).
  // delete_own_account() is a security-definer Postgres function scoped to
  // auth.uid() (eyewall-pipeline's docs/sql/delete_own_account_rpc.sql);
  // user_preferences/trivia_answers cascade from auth.users. The session is
  // then cleared locally only -- the user it belonged to no longer exists,
  // so there's nothing server-side left to revoke. Local-only settings
  // (team, theme, locale, local trivia answers) stay on the device, same
  // as for anyone who never signed in.
  const deleteAccount = async () => {
    const { error } = await supabaseAuth.rpc('delete_own_account');
    if (error) return { error };
    await supabaseAuth.auth.signOut({ scope: 'local' });
    return { error: null };
  };

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    isAuthenticated: !!session,
    signInWithOtp,
    signOut,
    deleteAccount,
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
