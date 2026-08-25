// utils/localeSync.js — cross-device language sync for signed-in users,
// built on the same user_preferences table + RLS as favoriteTeamSync.js
// (Auth Phase 0/1). Mirrors that file's shape exactly:
//   - upsertLocale()       — called the moment a signed-in user picks a
//     language in the Settings popup ("write immediately on switch").
//   - syncLocaleOnSignIn() — called once from AuthContext.jsx whenever a
//     session becomes available. Fetches the server value once and
//     reconciles: first sign-in with no server row yet uploads the local
//     pick; a server value that already exists and differs from local
//     wins and overwrites local.
//
// One difference from favoriteTeamSync.js: that file reloads the page
// after applying a server value, because team config is module-level
// state that only re-initializes on a fresh load. Locale doesn't have
// that constraint -- setLocale() already updates every subscribed
// component live via i18next, so the reconcile just calls it directly.
//
// Deliberately NOT a live subscription, same scope decision as
// favoriteTeamSync.js: a change on another device is picked up on this
// device's next load, not instantly.

import { supabaseAuth } from './supabaseAuth';
import { getLocale, setLocale } from './localeConfig';

const UPSERT_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 5000;

// Fire-and-forget-safe: never throws. A failed sync shouldn't block the
// local language switch it's piggybacking on.
export async function upsertLocale(userId, locale) {
  try {
    const { error } = await supabaseAuth
      .from('user_preferences')
      .upsert(
        { user_id: userId, preferred_locale: locale, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .abortSignal(AbortSignal.timeout(UPSERT_TIMEOUT_MS));
    if (error) console.warn('localeSync: upsert failed:', error.message);
  } catch (err) {
    console.warn('localeSync: upsert failed:', err.message);
  }
}

export async function syncLocaleOnSignIn(userId) {
  let data;
  try {
    const res = await supabaseAuth
      .from('user_preferences')
      .select('preferred_locale')
      .eq('user_id', userId)
      .abortSignal(AbortSignal.timeout(FETCH_TIMEOUT_MS))
      .maybeSingle();
    if (res.error) {
      console.warn('localeSync: fetch failed:', res.error.message);
      return;
    }
    data = res.data;
  } catch (err) {
    console.warn('localeSync: fetch failed:', err.message);
    return;
  }

  const local = getLocale();
  const server = data?.preferred_locale;

  if (server) {
    if (server !== local) setLocale(server);
    return;
  }

  // No server value yet — first sign-in on this account. Upload local so
  // the next device to sign in gets it (same merge decision as
  // favoriteTeamSync.js).
  await upsertLocale(userId, local);
}
