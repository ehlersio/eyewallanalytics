// utils/siriIntents.js -- what the iOS app's Siri / Shortcuts intents need
// from the web side (App Intents, ios/App/App/Intents/).
//
// The intents are native Swift and run without the web view (often without
// the app open at all), so they can't read localStorage. Two things cross
// over:
//
//   - The teams any intent can be asked about: every team in LEAGUES, written
//     at build time to ios/App/App/Intents/Teams.json by intentTeams().
//     __tests__/siriIntents.test.js fails when that file drifts from the web
//     config, and rewrites it with UPDATE_IOS_TEAMS=1, so there is no third
//     hand-typed team list to go stale.
//   - The followed teams (the default team when someone asks "what's the
//     score?") and the Worker URL, sent to the AppIntents plugin on every
//     launch and whenever the followed teams change (syncIntentContext()).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LEAGUES, getFollowedTeams } from './followedTeams';

const AppIntents = registerPlugin('AppIntents');
const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

// One row per team, every league, in LEAGUES order. `teamId` is the id the
// league's Worker routes take: the NHL's own id, HockeyTech's elsewhere.
export function intentTeams(leagues = LEAGUES) {
  return leagues.flatMap(({ sport, teams }) => teams.map(t => ({
    id: `${sport}:${t.abbr}`,
    league: sport,
    abbr: t.abbr,
    teamId: t.teamId,
    name: t.displayName,
    shortName: t.shortName,
  })));
}

// The followed teams as the intents take them: "nhl:CAR", "ahl:CHI".
export const intentFollowedTeams = (followed = getFollowedTeams()) =>
  followed.map(t => `${t.sport}:${t.abbr}`);

// No-op off iOS. A build without the plugin rejects; that's fine.
export async function syncIntentContext() {
  if (Capacitor.getPlatform() !== 'ios') return;
  await AppIntents.setContext({ teams: intentFollowedTeams(), workerUrl: WORKER_URL });
}
