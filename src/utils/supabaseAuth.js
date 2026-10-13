/**
 * supabaseAuth.js — the one place this app talks to Supabase Auth directly.
 *
 * Everything else in this app reads data through eyewall-poller's Worker
 * (see supabaseClient.js) — that proxy exists to keep credentials
 * server-side and add KV caching, neither of which apply here.
 * signInWithOtp/session handling is inherently a browser-to-Supabase-Auth
 * flow (a magic-link click lands back in this tab and supabase-js exchanges
 * it for a session) — there's no Worker route to proxy it through, and the
 * anon/publishable key is already safe to expose client-side by design
 * (same key PeriodSummary.jsx/PredictionShareCanvas.jsx already use for
 * direct DB-first lookups).
 *
 * Do not use this client for data reads — use supabaseClient.js.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mqgasjzywoibdgxjjkux.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || 'sb_publishable_e_zwr1UA7GnHq4OuQSas5Q_kO8bQ_Ct';

// PKCE, not the implicit flow: the magic link comes back with a one-time
// ?code= instead of the access/refresh tokens in the URL fragment, so the
// tokens never sit in the address bar, browser history or analytics, and a
// code is useless without the verifier signInWithOtp left in this browser's
// localStorage. On the web detectSessionInUrl exchanges the code and removes
// it from the URL; the iOS app gets it through its deep link (authDeepLink.js).
// The catch: the link has to be opened in the browser (or app) that asked
// for it.
export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
