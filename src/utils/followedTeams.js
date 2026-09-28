// utils/followedTeams.js -- the teams a user follows, from any league, one
// of them primary (Settings redesign, 2026-09).
//
// The primary team is still the one the app runs as: eyewall:sport plus
// that league's team key, read at module load by teamConfig.js and friends
// and only changed by a reload (getLocalSelection/applyLocalSelection in
// favoriteTeamSync.js). This list sits beside it -- eyewall:followed,
// [{ sport, abbr }] in the user's order -- and always includes the
// primary, so existing users start out following just their team.
//
// Signed in, it syncs to user_preferences.followed_teams (jsonb; see
// eyewall-pipeline's docs/followed_teams_column.sql). Two devices'
// lists are merged on sign-in rather than one overwriting the other, so
// a team followed on the phone isn't lost when signing in on the web.
import { supabaseAuth } from './supabaseAuth';
import { ALL_TEAMS } from './teamConfig';
import { PWHL_TEAMS } from './pwhlConfig';
import { AHL_TEAMS } from './ahlConfig';
import { ECHL_TEAMS } from './echlConfig';
import { applyLocalSelection, getLocalSelection, upsertFavoriteTeam } from './favoriteTeamSync';

const STORAGE_KEY = 'eyewall:followed';
export const FOLLOWED_CHANGED_EVENT = 'eyewall:followed-changed';
const TIMEOUT_MS = 5000;

// The leagues a team can be followed in, and their teams. PWHL expansion
// teams not yet playing are left out, as TeamPicker does.
export const LEAGUES = [
  { sport: 'nhl',  label: 'NHL',  root: '/',           teams: ALL_TEAMS },
  { sport: 'pwhl', label: 'PWHL', root: '/pwhl/shots', teams: PWHL_TEAMS.filter(t => !t.comingSoon) },
  { sport: 'ahl',  label: 'AHL',  root: '/ahl/shots',  teams: AHL_TEAMS },
  { sport: 'echl', label: 'ECHL', root: '/echl/shots', teams: ECHL_TEAMS },
];
const leagueOf = sport => LEAGUES.find(l => l.sport === sport);

export function teamFor({ sport, abbr }) {
  return leagueOf(sport)?.teams.find(t => t.abbr === abbr) || null;
}

export const sameTeam = (a, b) => !!a && !!b && a.sport === b.sport && a.abbr === b.abbr;
const isKnown = t => !!teamFor(t);

// ── Pure (unit-tested) ────────────────────────────────────────

// A clean list: known teams only, no repeats, the primary always in it
// (first, if it had to be added).
export function normalizeFollowed(list, primary, known = isKnown) {
  const out = [];
  for (const t of Array.isArray(list) ? list : []) {
    if (!t || typeof t.sport !== 'string' || typeof t.abbr !== 'string') continue;
    const team = { sport: t.sport, abbr: t.abbr };
    if (known(team) && !out.some(o => sameTeam(o, team))) out.push(team);
  }
  if (primary && known(primary) && !out.some(o => sameTeam(o, primary))) out.unshift({ ...primary });
  return out;
}

// Two devices' lists as one: the first's order, then anything only the
// second has.
export function mergeFollowed(first, second) {
  const out = [...(first || [])];
  for (const t of second || []) if (!out.some(o => sameTeam(o, t))) out.push(t);
  return out;
}

export const withTeam = (list, team) => (list.some(t => sameTeam(t, team)) ? list : [...list, team]);

// The primary can't be unfollowed -- make another team primary first.
export const withoutTeam = (list, team, primary) =>
  (sameTeam(team, primary) ? list : list.filter(t => !sameTeam(t, team)));

export function moved(list, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export const sameList = (a, b) => a.length === b.length && a.every((t, i) => sameTeam(t, b[i]));

// ── This device ───────────────────────────────────────────────

function readStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

export function getFollowedTeams() {
  return normalizeFollowed(readStored(), getLocalSelection());
}

// Saves the list on this device and, signed in, to the account.
export function saveFollowedTeams(list, userId) {
  const clean = normalizeFollowed(list, getLocalSelection());
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch { /* private mode etc. */ }
  window.dispatchEvent(new window.CustomEvent(FOLLOWED_CHANGED_EVENT, { detail: clean }));
  if (userId) upsertFollowedTeams(userId, clean);
  return clean;
}

// Makes `team` primary: the app reloads as that team, on its league's
// page -- the same as picking it in TeamPicker. The list keeps every team.
export async function switchPrimaryTeam(team, userId) {
  if (!applyLocalSelection(team)) return;
  localStorage.removeItem('eyewall:team-change-pending');
  if (userId) await upsertFavoriteTeam(userId, team.sport, team.abbr);
  window.location.href = leagueOf(team.sport)?.root || '/';
}

// ── Account sync ──────────────────────────────────────────────

// Never throws. Until the followed_teams column exists (a manual SQL step)
// this just logs, and the list stays on the device.
export async function upsertFollowedTeams(userId, list) {
  try {
    const { error } = await supabaseAuth
      .from('user_preferences')
      .upsert(
        { user_id: userId, followed_teams: list, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (error) console.warn('followedTeams: upsert failed:', error.message);
  } catch (err) {
    console.warn('followedTeams: upsert failed:', err.message);
  }
}

// Once per session (AuthContext.jsx): merge the account's list with this
// device's, keep the result on both.
export async function syncFollowedTeamsOnSignIn(userId) {
  let server;
  try {
    const res = await supabaseAuth
      .from('user_preferences')
      .select('followed_teams')
      .eq('user_id', userId)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
      .maybeSingle();
    if (res.error) {
      console.warn('followedTeams: fetch failed:', res.error.message);
      return;
    }
    server = Array.isArray(res.data?.followed_teams) ? res.data.followed_teams : [];
  } catch (err) {
    console.warn('followedTeams: fetch failed:', err.message);
    return;
  }
  const local = getFollowedTeams();
  const merged = normalizeFollowed(mergeFollowed(server, local), getLocalSelection());
  if (!sameList(merged, local)) saveFollowedTeams(merged);
  if (!sameList(merged, normalizeFollowed(server, null))) await upsertFollowedTeams(userId, merged);
}
