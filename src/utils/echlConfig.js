// utils/echlConfig.js
// ECHL team configuration — parallel structure to ahlConfig.js/pwhlConfig.js.
//
// Storage key for selected ECHL team: 'eyewall:echl_team' in localStorage.
//
// Fields:
//   abbr          — HockeyTech team code (matches echl_players.team_id's
//                   code in eyewall-pipeline's TEAM_ID_MAP)
//   teamId        — HockeyTech numeric team ID
//   division      — one of North/South/Central/Mountain (ECHL's real
//                   division structure, confirmed live)
//   season        — current season ID for API calls (derived from ECHL_CURRENT_SEASON)
//   displayName   — full official team name
//   shortName     — common short name / nickname
//   primaryColor / displayColor
//
// Foundation-pass scope (user's explicit choice): real per-team brand
// colors are NOT researched here -- every team uses one shared neutral
// placeholder, same convention AHL's own config still uses for its one
// remaining un-researched team (Ontario Reign, see that file's comment).
// "Real per-team ECHL colors" is an explicit follow-up, matching AHL's
// own two-pass history (colors landed as a dedicated pass well after
// AHL's initial display shipped, not as part of it).
const ECHL_PLACEHOLDER_COLOR = '#6B7280'; // neutral slate, passes WCAG AA on #101827 (7.1:1)

import { fetchSeasonsConfig } from './seasonClient';

// ── Season constant ───────────────────────────────────────────────────────────
// Same live-resolution pattern as AHL_CURRENT_SEASON in ahlConfig.js.
// Fallback seed matches eyewall-poller's seasons.js FALLBACK_ECHL.
export let ECHL_CURRENT_SEASON = 73;

(async () => {
  try {
    const data = await fetchSeasonsConfig();
    const seasonId = data?.echl?.seasonId;
    if (seasonId && seasonId !== ECHL_CURRENT_SEASON) {
      ECHL_CURRENT_SEASON = seasonId;
      window.dispatchEvent(new window.CustomEvent('eyewall:echl-season-updated', { detail: ECHL_CURRENT_SEASON }));
    }
  } catch (e) {
    console.warn('Live ECHL season lookup failed, using fallback:', e.message);
  }
})();

// ── Season / playoff-type enumeration ────────────────────────────────────────
// Confirmed live 2026-08-30 via feed=modulekit&view=seasons: 78 = 2026-27
// Regular Season (not started), 76 = 2026 Kelly Cup Playoffs (ECHL's own
// single-calendar-year playoff-label convention, same as AHL's "2026
// Playoffs"), 73 = 2025-26 Regular Season (last fully completed).
export const ECHL_SEASONS = [
  { id: 78, label: '2026-27', type: 'regular' },
  { id: 73, label: '2025-26', type: 'regular' },
  { id: 76, label: '2026 Kelly Cup Playoffs', type: 'playoffs' },
];

export const ECHL_REGULAR_SEASONS = ECHL_SEASONS.filter((s) => s.type === 'regular');
export const ECHL_PLAYOFF_SEASONS = ECHL_SEASONS.filter((s) => s.type === 'playoffs');

export function isECHLPlayoffSeason(seasonId) {
  return ECHL_SEASONS.find((s) => s.id === seasonId)?.type === 'playoffs';
}

// Regular-season season_id -> its corresponding playoff season_id.
// Hand-authored, same as AHL_PLAYOFF_SEASON_MAP -- only one pair known so far.
export const ECHL_PLAYOFF_SEASON_MAP = { 73: 76 }; // 2025-26 -> 2026 Kelly Cup Playoffs

// Reverse of the above -- needed because ECHL's live-resolved "current"
// season (see ECHL_CURRENT_SEASON above) is itself a playoffs id for most
// of the off-season (confirmed live 2026-08-30: resolves to 76, not 73,
// since 78 hasn't started yet) -- same recurring AHL/PWHL gotcha.
export const ECHL_REGULAR_SEASON_MAP = Object.fromEntries(
  Object.entries(ECHL_PLAYOFF_SEASON_MAP).map(([regId, poId]) => [poId, Number(regId)])
);

// ── Team configs ─────────────────────────────────────────────────────────────
// team_id/code/division/name confirmed live via
// feed=modulekit&view=teamsbyseason 2026-08-30 (season 77) -- see
// eyewall-pipeline's echl_stats.py TEAM_ID_MAP, which this mirrors.
export const ECHL_TEAMS = [
  // ── North ─────────────────────────────────────────────────────────────────
  { abbr: 'ADK', teamId: 74, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Adirondack Thunder', shortName: 'Thunder', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'GSO', teamId: 108, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Greensboro Gargoyles', shortName: 'Gargoyles', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'MNE', teamId: 82, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Maine Mariners', shortName: 'Mariners', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'NOR', teamId: 76, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Norfolk Admirals', shortName: 'Admirals', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'REA', teamId: 17, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Reading Royals', shortName: 'Royals', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'TRE', teamId: 113, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Trenton Ironhawks', shortName: 'Ironhawks', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'TR', teamId: 99, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Trois-Rivières Lions', shortName: 'Lions', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'WOR', teamId: 77, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Worcester Railers', shortName: 'Railers', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  // ── South ─────────────────────────────────────────────────────────────────
  { abbr: 'ATL', teamId: 10, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Atlanta Gladiators', shortName: 'Gladiators', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'FLA', teamId: 8, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Florida Everblades', shortName: 'Everblades', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'GVL', teamId: 52, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Greenville Swamp Rabbits', shortName: 'Swamp Rabbits', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'JAX', teamId: 79, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Jacksonville Icemen', shortName: 'Icemen', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'ORL', teamId: 61, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Orlando Solar Bears', shortName: 'Solar Bears', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'SAV', teamId: 102, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Savannah Ghost Pirates', shortName: 'Ghost Pirates', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'SC', teamId: 18, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'South Carolina Stingrays', shortName: 'Stingrays', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  // ── Central ───────────────────────────────────────────────────────────────
  { abbr: 'BLM', teamId: 107, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Bloomington Bison', shortName: 'Bison', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'CIN', teamId: 5, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Cincinnati Cyclones', shortName: 'Cyclones', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'FW', teamId: 60, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Fort Wayne Komets', shortName: 'Komets', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'IND', teamId: 65, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Indy Fuel', shortName: 'Fuel', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'KAL', teamId: 50, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Kalamazoo Wings', shortName: 'Wings', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'TOL', teamId: 21, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Toledo Walleye', shortName: 'Walleye', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'WHL', teamId: 25, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Wheeling Nailers', shortName: 'Nailers', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  // ── Mountain ──────────────────────────────────────────────────────────────
  { abbr: 'ALN', teamId: 66, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Allen Americans', shortName: 'Americans', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'IDH', teamId: 11, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Idaho Steelheads', shortName: 'Steelheads', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'KC', teamId: 68, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Kansas City Mavericks', shortName: 'Mavericks', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'NM', teamId: 114, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'New Mexico Goatheads', shortName: 'Goatheads', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'RC', teamId: 70, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Rapid City Rush', shortName: 'Rush', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'TAH', teamId: 106, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Tahoe Knight Monsters', shortName: 'Knight Monsters', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'TUL', teamId: 71, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Tulsa Oilers', shortName: 'Oilers', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
  { abbr: 'WIC', teamId: 72, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Wichita Thunder', shortName: 'Thunder', primaryColor: ECHL_PLACEHOLDER_COLOR, displayColor: ECHL_PLACEHOLDER_COLOR },
];

// ── Logos ─────────────────────────────────────────────────────────────────────
// Hosted directly from HockeyTech's own asset CDN, same convention as
// AHL's ahlLogoUrl(). NOT a bare `{teamId}.png` per team -- confirmed
// live 2026-08-30 that 4 of 30 teams (JAX/79, NM/114, TAH/106, TRE/113,
// all recent expansion/relocation teams) are season-suffixed instead
// (e.g. "79_77.png") -- same real gotcha AHL's own logo map already
// documents (a logo file gets a season-id suffix whenever it changes for
// a given season, and the old bare filename isn't reliably kept as an
// alias). This map is the feed's own `team_logo_url` field's real values
// (feed=modulekit&view=teamsbyseason, season=77) for every team, not a
// guessed pattern -- re-pull and update on a future season flip if new
// 404s show up.
const ECHL_LOGO_FILES = {
  74: '74.png', 66: '66.png', 10: '10.png', 107: '107.png', 5: '5.png',
  8: '8.png', 60: '60.png', 108: '108.png', 52: '52.png', 11: '11.png',
  65: '65.png', 79: '79_77.png', 50: '50.png', 68: '68.png', 82: '82.png',
  114: '114_77.png', 76: '76.png', 61: '61.png', 70: '70.png', 17: '17.png',
  102: '102.png', 18: '18.png', 106: '106_77.png', 21: '21.png',
  113: '113_77.png', 99: '99.png', 71: '71.png', 25: '25.png', 72: '72.png',
  77: '77.png',
};

export function echlLogoUrl(teamId) {
  const file = ECHL_LOGO_FILES[teamId];
  return file ? `https://assets.leaguestat.com/echl/logos/${file}` : null;
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export const ECHL_TEAM_MAP = Object.fromEntries(ECHL_TEAMS.map((t) => [t.abbr, t]));
export const ECHL_TEAM_BY_ID = Object.fromEntries(ECHL_TEAMS.map((t) => [t.teamId, t]));

export function getECHLTeamConfig(abbr) {
  return ECHL_TEAM_MAP[abbr] ?? null;
}

export function getECHLTeamById(teamId) {
  return ECHL_TEAM_BY_ID[teamId] ?? null;
}

export function hasECHLTeamConfig() {
  return Boolean(localStorage.getItem('eyewall:echl_team'));
}

export function getECHLStoredTeam() {
  try {
    const raw = localStorage.getItem('eyewall:echl_team');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
