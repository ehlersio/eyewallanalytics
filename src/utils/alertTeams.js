// utils/alertTeams.js -- alerts for every followed team (Settings
// redesign step 5, 2026-09). Each followed team has its own alert choices
// on this device, and every team but the primary its own on/off (the
// primary's alerts are the Alerts screen's main on/off: push itself).
//
// What's sent to eyewall-poller's /push/subscribe is `teams`:
// [{ key: 'NHL:CAR', prefs }], primary first -- the poller sends someone
// following both teams in a game each alert once, from the side of the
// team first in this list.
import { loadPrefs } from '../hooks/usePushNotifications';
import { sameTeam } from './followedTeams';

const STORAGE_KEY = 'eyewall:notif:teams';

export const alertKey = team => `${team.sport.toUpperCase()}:${team.abbr}`;

export function loadAlertTeams() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

// A team's { on, prefs }. Not set yet: on, with this device's existing
// alert choices -- a newly followed team gets alerts the way the user
// already set them up.
export function alertSettingsFor(team, stored = loadAlertTeams(), template = loadPrefs()) {
  const s = stored[alertKey(team)];
  return { on: s?.on !== false, prefs: { ...template, ...(s?.prefs || {}) } };
}

export function saveAlertSettings(team, settings, stored = loadAlertTeams()) {
  const next = { ...stored, [alertKey(team)]: settings };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode etc. */ }
  return next;
}

// The subscription's teams: the primary first (always, when there is
// one), then the other followed teams whose alerts are on, in order.
export function subscriptionTeams(followed, primary, stored = loadAlertTeams(), template = loadPrefs()) {
  const ordered = primary
    ? [...followed.filter(t => sameTeam(t, primary)), ...followed.filter(t => !sameTeam(t, primary))]
    : followed;
  return ordered
    .map(team => ({ team, ...alertSettingsFor(team, stored, template) }))
    .filter(({ team, on }) => on || sameTeam(team, primary))
    .map(({ team, prefs }) => ({ key: alertKey(team), prefs }));
}

// What this device last got the poller to store, so the subscription is
// only re-sent when its teams or choices actually changed.
const SYNCED_KEY = 'eyewall:notif:synced';
export function lastSynced() {
  try { return localStorage.getItem(SYNCED_KEY); } catch { return null; }
}
export function setLastSynced(sig) {
  try {
    if (sig) localStorage.setItem(SYNCED_KEY, sig);
    else localStorage.removeItem(SYNCED_KEY);
  } catch { /* private mode etc. */ }
}
