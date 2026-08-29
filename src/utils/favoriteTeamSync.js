// utils/favoriteTeamSync.js — Auth Phase 1: favorite-team sync for signed-in
// users, built on top of the user_preferences table + RLS from Phase 0.
//
// Two entry points, matching the two distinct moments this needs to run
// (see SESSION_90_AUTH_PHASE0_FINDINGS.md for the merge-behavior decision
// this implements):
//   - upsertFavoriteTeam()      — called from TeamPicker.jsx the moment a
//     signed-in user picks a team ("write immediately on switch").
//   - syncFavoriteTeamOnSignIn() — called once from AuthContext.jsx whenever
//     a session becomes available (fresh sign-in, or an existing session
//     found on page load). Fetches the server value once and reconciles:
//     first sign-in with no server row yet uploads the local pick; a
//     server value that already exists and differs from local wins and
//     overwrites local (then reloads, same as every other team-switch path
//     in this app — see teamConfig.js/pwhlConfig.js's module-level
//     constants, which only re-initialize on a full reload).
//
// Deliberately NOT a live subscription — server changes on another device
// are picked up on this device's next load, not instantly. That's a scope
// decision (see the Phase 1 brief), not an oversight.

import { supabaseAuth } from './supabaseAuth';
import { ALL_TEAMS } from './teamConfig';
import { PWHL_TEAM_MAP } from './pwhlConfig';
import { AHL_TEAM_MAP } from './ahlConfig';

const UPSERT_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 5000;

function getLocalSelection() {
  const sport = localStorage.getItem('eyewall:sport') || 'nhl';
  try {
    if (sport === 'pwhl') {
      const raw = localStorage.getItem('eyewall:pwhl_team');
      const team = raw ? JSON.parse(raw) : null;
      return team?.abbr ? { sport: 'pwhl', abbr: team.abbr } : null;
    }
    if (sport === 'ahl') {
      const raw = localStorage.getItem('eyewall:ahl_team');
      const team = raw ? JSON.parse(raw) : null;
      return team?.abbr ? { sport: 'ahl', abbr: team.abbr } : null;
    }
    const raw = localStorage.getItem('eyewall:team');
    const team = raw ? JSON.parse(raw) : null;
    return team?.abbr ? { sport: 'nhl', abbr: team.abbr } : null;
  } catch {
    return null;
  }
}

// Mirrors TeamPicker.jsx's own write pattern exactly, so a server-wins
// reconcile looks identical to a manual pick in that same picker.
function applyLocalSelection({ sport, abbr }) {
  if (sport === 'pwhl') {
    const team = PWHL_TEAM_MAP[abbr];
    if (!team) return false;
    localStorage.setItem('eyewall:sport', 'pwhl');
    localStorage.setItem('eyewall:pwhl_team', JSON.stringify(team));
    return true;
  }
  if (sport === 'ahl') {
    const team = AHL_TEAM_MAP[abbr];
    if (!team) return false;
    localStorage.setItem('eyewall:sport', 'ahl');
    localStorage.setItem('eyewall:ahl_team', JSON.stringify(team));
    return true;
  }
  const team = ALL_TEAMS.find((t) => t.abbr === abbr);
  if (!team) return false;
  localStorage.setItem('eyewall:sport', 'nhl');
  localStorage.setItem('eyewall:team', JSON.stringify(team));
  return true;
}

// Fire-and-forget-safe: never throws. A failed sync shouldn't block the
// local team switch it's piggybacking on.
export async function upsertFavoriteTeam(userId, sport, abbr) {
  try {
    const { error } = await supabaseAuth
      .from('user_preferences')
      .upsert(
        { user_id: userId, favorite_team: abbr, favorite_sport: sport, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .abortSignal(AbortSignal.timeout(UPSERT_TIMEOUT_MS));
    if (error) console.warn('favoriteTeamSync: upsert failed:', error.message);
  } catch (err) {
    console.warn('favoriteTeamSync: upsert failed:', err.message);
  }
}

export async function syncFavoriteTeamOnSignIn(userId) {
  // A "Change team" in progress (see NotificationBell.jsx) clears local
  // storage on purpose so TeamPicker can show. Without this check, that
  // looks identical to "fresh device, no local opinion yet" and this
  // function would silently re-apply the old server value before the user
  // gets a chance to pick — defeating the Change button entirely.
  // TeamPicker clears the flag itself once a new pick is made.
  if (localStorage.getItem('eyewall:team-change-pending')) return;

  let data;
  try {
    const res = await supabaseAuth
      .from('user_preferences')
      .select('favorite_team, favorite_sport')
      .eq('user_id', userId)
      .abortSignal(AbortSignal.timeout(FETCH_TIMEOUT_MS))
      .maybeSingle();
    if (res.error) {
      console.warn('favoriteTeamSync: fetch failed:', res.error.message);
      return;
    }
    data = res.data;
  } catch (err) {
    console.warn('favoriteTeamSync: fetch failed:', err.message);
    return;
  }

  const local = getLocalSelection();
  const serverSelection = data?.favorite_team && data?.favorite_sport
    ? { sport: data.favorite_sport, abbr: data.favorite_team }
    : null;

  if (serverSelection) {
    const matchesLocal = local
      && local.sport === serverSelection.sport
      && local.abbr === serverSelection.abbr;
    if (!matchesLocal && applyLocalSelection(serverSelection)) {
      window.location.reload();
    }
    return;
  }

  // No server value yet — first sign-in on this account. Upload local so
  // the next device to sign in gets it (per the documented merge decision).
  if (local) {
    await upsertFavoriteTeam(userId, local.sport, local.abbr);
  }
}
