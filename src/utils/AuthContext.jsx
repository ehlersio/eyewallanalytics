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
import { supabaseAuth } from './supabaseAuth';
import { syncFavoriteTeamOnSignIn } from './favoriteTeamSync';
import { syncTriviaAnswersOnSignIn } from './triviaAnswers';

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

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || reconciledUserId.current === userId) return;
    reconciledUserId.current = userId;
    syncFavoriteTeamOnSignIn(userId);
    syncTriviaAnswersOnSignIn(userId);
  }, [session]);

  const signInWithOtp = async (email) => {
    return supabaseAuth.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
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
