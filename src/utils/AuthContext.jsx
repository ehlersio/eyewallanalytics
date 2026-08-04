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

import { createContext, useContext, useState, useEffect } from 'react';
import { supabaseAuth } from './supabaseAuth';

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
