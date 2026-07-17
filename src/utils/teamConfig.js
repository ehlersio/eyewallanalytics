// src/utils/teamConfig.js
// Runtime team configuration — replaces the static TEAM_CONFIG export in nhlApi.js.
// All views and functions that import TEAM_CONFIG from nhlApi.js will automatically
// pick up the selected team because nhlApi.js re-exports from here.
//
// Storage key: 'eyewall:team' in localStorage.
// Shape stored is the full team object (same shape as TEAM_CONFIG in nhlApi.js).

import { fetchSeasonsConfig } from './seasonClient';

const STORAGE_KEY = 'eyewall:team';

// ── Season constant ───────────────────────────────────────────────────────────
// This used to be the ONE value updated each October. It's now live-resolved
// from the Worker's /config/seasons endpoint (see seasons.js in eyewall-poller),
// which itself resolves it from the NHL API — see that module for the full
// resolution + fallback logic. This constant is now just the fallback seed:
// what the app uses before the fetch below resolves, or if it fails entirely
// (offline, Worker down, etc). It's a `let` (not `const`) so the fetch can
// update it in place once real data comes back.
//
// IMPORTANT: because ALL_TEAMS objects are built once at module load, each
// team's `season` field below is a GETTER (`get season() {...}`), not a
// plain value — this is what lets `team.season` reflect the live value
// automatically everywhere it's read, without every consuming component
// needing to change. The one thing this can't fix: if a component
// destructures `const { season } = someTeam` once and holds onto that local
// variable indefinitely (rather than re-reading `someTeam.season`), it'll
// keep the value from whenever the destructure happened — same as any other
// stale-closure situation in JS, not something unique to this change.
export let CURRENT_SEASON = '20262027';

(async () => {
  try {
    const data = await fetchSeasonsConfig();
    const seasonId = data?.nhl?.seasonId;
    if (seasonId && seasonId !== CURRENT_SEASON) {
      CURRENT_SEASON = String(seasonId);
      // Let any component that cares (e.g. a settings/debug panel) react;
      // nothing subscribes to this today, so this is a no-op by default.
      window.dispatchEvent(new window.CustomEvent('eyewall:nhl-season-updated', { detail: CURRENT_SEASON }));
    }
  } catch (e) {
    console.warn('Live NHL season lookup failed, using fallback:', e.message);
  }
})();

// All 32 NHL teams.
// Fields:
//   abbr             — NHL API abbreviation (used in all API calls)
//   teamId           — NHL API numeric team ID
//   franchiseId      — NHL API numeric franchise ID (used in advanced stats endpoints)
//   season           — current season string for API calls (derived from CURRENT_SEASON)
//   displayName      — full official team name
//   shortName        — common short name / nickname
//   fullNameFragment — partial string to match NHL API full-name fields (e.g. city name)
//   primaryColor     — canonical brand hex (used for light mode, storage, branding reference)
//   displayColor     — WCAG AA-compliant variant for dark mode (≥4.5:1 on #101827 / bg2)
//                      equals primaryColor where it already passes; lightened otherwise
export const ALL_TEAMS = [
  // Atlantic
  { abbr: 'BOS', teamId:  6, franchiseId:  6, get season() { return CURRENT_SEASON; }, displayName: 'Boston Bruins',           shortName: 'Bruins',        fullNameFragment: 'Boston',       primaryColor: '#FFB81C', displayColor: '#FFB81C' },
  { abbr: 'BUF', teamId:  7, franchiseId: 19, get season() { return CURRENT_SEASON; }, displayName: 'Buffalo Sabres',          shortName: 'Sabres',        fullNameFragment: 'Buffalo',      primaryColor: '#003087', displayColor: '#307aff' },
  { abbr: 'DET', teamId: 17, franchiseId: 12, get season() { return CURRENT_SEASON; }, displayName: 'Detroit Red Wings',       shortName: 'Red Wings',     fullNameFragment: 'Detroit',      primaryColor: '#CE1126', displayColor: '#ef384c' },
  { abbr: 'FLA', teamId: 13, franchiseId: 33, get season() { return CURRENT_SEASON; }, displayName: 'Florida Panthers',        shortName: 'Panthers',      fullNameFragment: 'Florida',      primaryColor: '#041E42', displayColor: '#2a7ef2' },
  { abbr: 'MTL', teamId:  8, franchiseId:  1, get season() { return CURRENT_SEASON; }, displayName: 'Montréal Canadiens',      shortName: 'Canadiens',     fullNameFragment: 'Montréal',     primaryColor: '#AF1E2D', displayColor: '#e04b5b' },
  { abbr: 'OTT', teamId:  9, franchiseId: 30, get season() { return CURRENT_SEASON; }, displayName: 'Ottawa Senators',         shortName: 'Senators',      fullNameFragment: 'Ottawa',       primaryColor: '#C52032', displayColor: '#e24b5b' },
  { abbr: 'TBL', teamId: 14, franchiseId: 31, get season() { return CURRENT_SEASON; }, displayName: 'Tampa Bay Lightning',     shortName: 'Lightning',     fullNameFragment: 'Tampa Bay',    primaryColor: '#002868', displayColor: '#287bff' },
  { abbr: 'TOR', teamId: 10, franchiseId:  5, get season() { return CURRENT_SEASON; }, displayName: 'Toronto Maple Leafs',     shortName: 'Maple Leafs',   fullNameFragment: 'Toronto',      primaryColor: '#003E7E', displayColor: '#007dfd' },
  // Metropolitan
  { abbr: 'CAR', teamId: 12, franchiseId: 26, get season() { return CURRENT_SEASON; }, displayName: 'Carolina Hurricanes',     shortName: 'Canes',         fullNameFragment: 'Carolina',     primaryColor: '#CC0000', displayColor: '#ff0f0f' },
  { abbr: 'CBJ', teamId: 29, franchiseId: 36, get season() { return CURRENT_SEASON; }, displayName: 'Columbus Blue Jackets',   shortName: 'Blue Jackets',  fullNameFragment: 'Columbus',     primaryColor: '#002654', displayColor: '#0f7cff' },
  { abbr: 'NJD', teamId:  1, franchiseId: 23, get season() { return CURRENT_SEASON; }, displayName: 'New Jersey Devils',       shortName: 'Devils',        fullNameFragment: 'New Jersey',   primaryColor: '#CE1126', displayColor: '#ef384c' },
  { abbr: 'NYI', teamId:  2, franchiseId: 22, get season() { return CURRENT_SEASON; }, displayName: 'New York Islanders',      shortName: 'Islanders',     fullNameFragment: 'NY Islanders', primaryColor: '#003087', displayColor: '#307aff' },
  { abbr: 'NYR', teamId:  3, franchiseId: 10, get season() { return CURRENT_SEASON; }, displayName: 'New York Rangers',        shortName: 'Rangers',       fullNameFragment: 'NY Rangers',   primaryColor: '#0038A8', displayColor: '#3579ff' },
  { abbr: 'PHI', teamId:  4, franchiseId: 16, get season() { return CURRENT_SEASON; }, displayName: 'Philadelphia Flyers',     shortName: 'Flyers',        fullNameFragment: 'Philadelphia', primaryColor: '#F74902', displayColor: '#F74902' },
  { abbr: 'PIT', teamId:  5, franchiseId: 17, get season() { return CURRENT_SEASON; }, displayName: 'Pittsburgh Penguins',     shortName: 'Penguins',      fullNameFragment: 'Pittsburgh',   primaryColor: '#FCB514', displayColor: '#FCB514' },
  { abbr: 'WSH', teamId: 15, franchiseId: 24, get season() { return CURRENT_SEASON; }, displayName: 'Washington Capitals',     shortName: 'Capitals',      fullNameFragment: 'Washington',   primaryColor: '#041E42', displayColor: '#2a7ef2' },
  // Central
  { abbr: 'CHI', teamId: 16, franchiseId: 11, get season() { return CURRENT_SEASON; }, displayName: 'Chicago Blackhawks',      shortName: 'Blackhawks',    fullNameFragment: 'Chicago',      primaryColor: '#CF0A2C', displayColor: '#f52c4e' },
  { abbr: 'COL', teamId: 21, franchiseId: 27, get season() { return CURRENT_SEASON; }, displayName: 'Colorado Avalanche',      shortName: 'Avalanche',     fullNameFragment: 'Colorado',     primaryColor: '#6F263D', displayColor: '#c85e80' },
  { abbr: 'DAL', teamId: 25, franchiseId: 15, get season() { return CURRENT_SEASON; }, displayName: 'Dallas Stars',            shortName: 'Stars',         fullNameFragment: 'Dallas',       primaryColor: '#006847', displayColor: '#009365' },
  { abbr: 'MIN', teamId: 30, franchiseId: 37, get season() { return CURRENT_SEASON; }, displayName: 'Minnesota Wild',          shortName: 'Wild',          fullNameFragment: 'Minnesota',    primaryColor: '#154734', displayColor: '#2b926b' },
  { abbr: 'NSH', teamId: 18, franchiseId: 34, get season() { return CURRENT_SEASON; }, displayName: 'Nashville Predators',     shortName: 'Predators',     fullNameFragment: 'Nashville',    primaryColor: '#FFB81C', displayColor: '#FFB81C' },
  { abbr: 'STL', teamId: 19, franchiseId: 18, get season() { return CURRENT_SEASON; }, displayName: 'St. Louis Blues',         shortName: 'Blues',         fullNameFragment: 'St. Louis',    primaryColor: '#002F87', displayColor: '#337aff' },
  { abbr: 'UTA', teamId: 59, franchiseId: 28, get season() { return CURRENT_SEASON; }, displayName: 'Utah Mammoth',            shortName: 'Mammoth',       fullNameFragment: 'Utah',         primaryColor: '#6CAEDF', displayColor: '#6CAEDF' },
  { abbr: 'WPG', teamId: 52, franchiseId: 35, get season() { return CURRENT_SEASON; }, displayName: 'Winnipeg Jets',           shortName: 'Jets',          fullNameFragment: 'Winnipeg',     primaryColor: '#041E42', displayColor: '#2a7ef2' },
  // Pacific
  { abbr: 'ANA', teamId: 24, franchiseId: 32, get season() { return CURRENT_SEASON; }, displayName: 'Anaheim Ducks',           shortName: 'Ducks',         fullNameFragment: 'Anaheim',      primaryColor: '#F47A38', displayColor: '#F47A38' },
  { abbr: 'CGY', teamId: 20, franchiseId: 21, get season() { return CURRENT_SEASON; }, displayName: 'Calgary Flames',          shortName: 'Flames',        fullNameFragment: 'Calgary',      primaryColor: '#C8102E', displayColor: '#ef3654' },
  { abbr: 'EDM', teamId: 22, franchiseId: 25, get season() { return CURRENT_SEASON; }, displayName: 'Edmonton Oilers',         shortName: 'Oilers',        fullNameFragment: 'Edmonton',     primaryColor: '#FF4C00', displayColor: '#FF4C00' },
  { abbr: 'LAK', teamId: 26, franchiseId: 14, get season() { return CURRENT_SEASON; }, displayName: 'Los Angeles Kings',       shortName: 'Kings',         fullNameFragment: 'Los Angeles',  primaryColor: '#111111', displayColor: '#818181' },
  { abbr: 'SJS', teamId: 28, franchiseId: 29, get season() { return CURRENT_SEASON; }, displayName: 'San Jose Sharks',         shortName: 'Sharks',        fullNameFragment: 'San José',     primaryColor: '#006D75', displayColor: '#008e99' },
  { abbr: 'SEA', teamId: 55, franchiseId: 39, get season() { return CURRENT_SEASON; }, displayName: 'Seattle Kraken',          shortName: 'Kraken',        fullNameFragment: 'Seattle',      primaryColor: '#99D9D9', displayColor: '#99D9D9' },
  { abbr: 'VAN', teamId: 23, franchiseId: 20, get season() { return CURRENT_SEASON; }, displayName: 'Vancouver Canucks',       shortName: 'Canucks',       fullNameFragment: 'Vancouver',    primaryColor: '#00843D', displayColor: '#009645' },
  { abbr: 'VGK', teamId: 54, franchiseId: 38, get season() { return CURRENT_SEASON; }, displayName: 'Vegas Golden Knights',    shortName: 'Golden Knights', fullNameFragment: 'Vegas',       primaryColor: '#B4975A', displayColor: '#B4975A' },
];

const DEFAULT_TEAM = ALL_TEAMS.find(t => t.abbr === 'CAR');

export function getTeamConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate it's a known team (guards against stale/malformed data)
      const known = ALL_TEAMS.find(t => t.abbr === parsed.abbr);
      if (known) return known; // always return canonical data, not stored data
    }
  } catch {
    // localStorage unavailable or JSON parse failed — fall through to default
  }
  return DEFAULT_TEAM;
}

export function setTeamConfig(teamOrAbbr) {
  const abbr = typeof teamOrAbbr === 'string' ? teamOrAbbr : teamOrAbbr.abbr;
  const team = ALL_TEAMS.find(t => t.abbr === abbr);
  if (!team) {
    console.warn(`setTeamConfig: unknown team abbr "${abbr}"`);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(team));
  } catch {
    console.warn('setTeamConfig: localStorage unavailable');
  }
}

export function hasTeamConfig() {
  try {
    const sport = localStorage.getItem('eyewall:sport') || 'nhl';
    if (sport === 'pwhl') {
      return localStorage.getItem('eyewall:pwhl_team') !== null;
    }
    return localStorage.getItem('eyewall:team') !== null;
  } catch {
    return false;
  }
}

// Module-level export — same name as the old nhlApi.js constant so all
// existing imports continue to work without changes.
export const TEAM_CONFIG = getTeamConfig();
