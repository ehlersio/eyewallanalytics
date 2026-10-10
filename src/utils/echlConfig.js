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
// Real per-team brand colors, same method as ahlConfig.js (see that file's
// comment). primaryColor is the first-listed color in each team's
// Wikipedia infobox "colours" field (first-listed = primary, per that
// template's own convention), cross-checked against the raw wikitext.
// displayColor is primaryColor lightened in HSL space (hue/saturation
// preserved, smallest lightness step that clears 4.5:1) where it fails
// WCAG AA on #101827, otherwise identical. All 32 teams (30 current + 2
// historical) have a sourced color, so there is no placeholder left.
//
// Five teams use a different source, preferring the team's own site CSS
// (its `--color-brand-*` theme variables) over teamcolorcodes.com:
//   - Wikipedia lists plain black first (#000000, or IA's #231F20 -- the
//     template's own default swatch for the bare word "black"), which
//     carries no per-team signal and doesn't work as a UI accent anyway,
//     so these use the team's real accent color instead:
//       SAV #57BA47 (green, ghostpirateshockey.com --color-brand-primary)
//       WHL #FCB514 (gold, wheelingnailers.com --color-brand-primary)
//       KC  #F15F22 (orange, kcmavericks.com --color-brand-primary)
//       IA  #FFD103 (yellow, iowaheartlanders.com --color-brand-secondary;
//           its brand-primary is the same #231F20 black)
//   - FLA: Wikipedia names "Kelly Green" first but gives no hex;
//       #00703C is floridaeverblades.com's --color-brand-primary, and
//       teamcolorcodes.com lists the same green.
// TR's first-listed "metal grey" (#D0D2CE) is a real team color, not a
// template default, so it stays -- same call as AHL's HSK silver.
//
// Contrast notes (WCAG AA on #101827, computed not eyeballed):
//   ADK #CE0E2D (3.15:1) -> #F13352 (4.51:1)  GSO #462969 (1.51:1) -> #966EC6 (4.52:1)
//   MNE #00354F (1.37:1) -> #0088CA (4.55:1)  NOR #001E69 (1.18:1) -> #4278FF (4.54:1)
//   REA #5C3896 (2.08:1) -> #916FC9 (4.50:1)  WOR #002856 (1.22:1) -> #0A7CFF (4.52:1)
//   ATL #612022 (1.47:1) -> #CA5F62 (4.50:1)  FLA #00703C (2.86:1) -> #00944F (4.53:1)
//   GVL #011E41 (1.07:1) -> #147DFB (4.53:1)  JAX #223D79 (1.70:1) -> #597ED0 (4.50:1)
//   ORL #522E91 (1.83:1) -> #926ED1 (4.55:1)  SC  #003468 (1.43:1) -> #007DFB (4.51:1)
//   BLM #E11837 (3.71:1) -> #EA3E58 (4.51:1)  CIN #C31F39 (3.03:1) -> #E24860 (4.51:1)
//   IND #B8292F (2.87:1) -> #D95358 (4.51:1)  KAL #E03A3E (4.10:1) -> #E24A4E (4.50:1)
//   ALN #AA182C (2.43:1) -> #E5455B (4.51:1)  IDH #1A3E6E (1.66:1) -> #4381D3 (4.50:1)
//   NM  #79171D (1.65:1) -> #DD4F57 (4.51:1)  RC  #CC2437 (3.28:1) -> #DF4C5C (4.51:1)
//   TUL #11213A (1.10:1) -> #5181CC (4.54:1)  WIC #0055B8 (2.53:1) -> #0B7CFF (4.52:1)
//   UTA #00483A (1.68:1) -> #009276 (4.55:1)
//   TRE #508EC8 (5.11:1) passes unchanged     TR  #D0D2CE (11.67:1) passes unchanged
//   SAV #57BA47 (7.21:1) passes unchanged     FW  #FF7800 (6.72:1) passes unchanged
//   TOL #6799C8 (5.89:1) passes unchanged     WHL #FCB514 (9.95:1) passes unchanged
//   KC  #F15F22 (5.41:1) passes unchanged     TAH #5395CE (5.55:1) passes unchanged
//   IA  #FFD103 (12.16:1) passes unchanged

import { fetchSeasonsConfig, fetchLeagueSeasons } from './seasonClient';
import { seasonsFromWorker, reverseSeasonMap } from './hockeyTechSeasons';

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
// The seed (confirmed live 2026-08-30 via feed=modulekit&view=seasons: 78 =
// 2026-27, 76 = 2026 Kelly Cup Playoffs, 73 = 2025-26), rebuilt from the
// Worker at load -- see "Seasons from the Worker" below. Its oldest id is
// how far back the built list goes.
export let ECHL_SEASONS = [
  { id: 78, label: '2026-27', type: 'regular' },
  { id: 73, label: '2025-26', type: 'regular' },
  { id: 76, label: '2026 Kelly Cup Playoffs', type: 'playoffs' },
];

export let ECHL_REGULAR_SEASONS = ECHL_SEASONS.filter((s) => s.type === 'regular');
export let ECHL_PLAYOFF_SEASONS = ECHL_SEASONS.filter((s) => s.type === 'playoffs');

export function isECHLPlayoffSeason(seasonId) {
  return ECHL_SEASONS.find((s) => s.id === seasonId)?.type === 'playoffs';
}

// Regular-season season_id -> its corresponding playoff season_id.
// Hand-authored, same as AHL_PLAYOFF_SEASON_MAP -- only one pair known so far.
export let ECHL_PLAYOFF_SEASON_MAP = { 73: 76 }; // 2025-26 -> 2026 Kelly Cup Playoffs

// Reverse of the above -- needed because ECHL's live-resolved "current"
// season (see ECHL_CURRENT_SEASON above) is itself a playoffs id for most
// of the off-season (confirmed live 2026-08-30: resolves to 76, not 73,
// since 78 hasn't started yet) -- same recurring AHL/PWHL gotcha.
export let ECHL_REGULAR_SEASON_MAP = reverseSeasonMap(ECHL_PLAYOFF_SEASON_MAP);

// ── Seasons from the Worker (contract C7) ────────────────────────────────────
// The lists and maps above are the seed. At load they're rebuilt from
// /config/seasons/echl-seasons (utils/hockeyTechSeasons.js), from the seed's
// oldest season on, so a new season (a 2027 playoffs, a 2027-28) appears
// without an app release; the `let`s are live bindings, and
// 'eyewall:echl-seasons-updated' tells mounted pickers to re-read them.
// A failed fetch keeps the seed.
const ECHL_SEED_MIN_ID = Math.min(...ECHL_SEASONS.map((s) => s.id));

export function applyECHLSeasons(rows) {
  const built = seasonsFromWorker(rows, { minId: ECHL_SEED_MIN_ID });
  if (!built) return false;
  ECHL_SEASONS = built.seasons;
  ECHL_REGULAR_SEASONS = ECHL_SEASONS.filter((s) => s.type === 'regular');
  ECHL_PLAYOFF_SEASONS = ECHL_SEASONS.filter((s) => s.type === 'playoffs');
  ECHL_PLAYOFF_SEASON_MAP = built.playoffSeasonMap;
  ECHL_REGULAR_SEASON_MAP = reverseSeasonMap(ECHL_PLAYOFF_SEASON_MAP);
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new window.CustomEvent('eyewall:echl-seasons-updated'));
  }
  return true;
}

(async () => {
  try {
    applyECHLSeasons(await fetchLeagueSeasons('echl'));
  } catch (e) {
    console.warn('ECHL season list lookup failed, using the built-in list:', e.message);
  }
})();

// ── Team configs ─────────────────────────────────────────────────────────────
// team_id/code/division/name confirmed live via
// feed=modulekit&view=teamsbyseason 2026-08-30 (season 77) -- see
// eyewall-pipeline's echl_stats.py TEAM_ID_MAP, which this mirrors.
export const ECHL_TEAMS = [
  // ── North ─────────────────────────────────────────────────────────────────
  { abbr: 'ADK', teamId: 74, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Adirondack Thunder', shortName: 'Thunder', primaryColor: '#CE0E2D', displayColor: '#F13352' },
  { abbr: 'GSO', teamId: 108, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Greensboro Gargoyles', shortName: 'Gargoyles', primaryColor: '#462969', displayColor: '#966EC6' },
  { abbr: 'MNE', teamId: 82, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Maine Mariners', shortName: 'Mariners', primaryColor: '#00354F', displayColor: '#0088CA' },
  { abbr: 'NOR', teamId: 76, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Norfolk Admirals', shortName: 'Admirals', primaryColor: '#001E69', displayColor: '#4278FF' },
  { abbr: 'REA', teamId: 17, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Reading Royals', shortName: 'Royals', primaryColor: '#5C3896', displayColor: '#916FC9' },
  { abbr: 'TRE', teamId: 113, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Trenton Ironhawks', shortName: 'Ironhawks', primaryColor: '#508EC8', displayColor: '#508EC8' },
  { abbr: 'TR', teamId: 99, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Trois-Rivières Lions', shortName: 'Lions', primaryColor: '#D0D2CE', displayColor: '#D0D2CE' },
  { abbr: 'WOR', teamId: 77, division: 'North', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Worcester Railers', shortName: 'Railers', primaryColor: '#002856', displayColor: '#0A7CFF' },
  // ── South ─────────────────────────────────────────────────────────────────
  { abbr: 'ATL', teamId: 10, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Atlanta Gladiators', shortName: 'Gladiators', primaryColor: '#612022', displayColor: '#CA5F62' },
  { abbr: 'FLA', teamId: 8, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Florida Everblades', shortName: 'Everblades', primaryColor: '#00703C', displayColor: '#00944F' },
  { abbr: 'GVL', teamId: 52, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Greenville Swamp Rabbits', shortName: 'Swamp Rabbits', primaryColor: '#011E41', displayColor: '#147DFB' },
  { abbr: 'JAX', teamId: 79, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Jacksonville Icemen', shortName: 'Icemen', primaryColor: '#223D79', displayColor: '#597ED0' },
  { abbr: 'ORL', teamId: 61, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Orlando Solar Bears', shortName: 'Solar Bears', primaryColor: '#522E91', displayColor: '#926ED1' },
  { abbr: 'SAV', teamId: 102, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Savannah Ghost Pirates', shortName: 'Ghost Pirates', primaryColor: '#57BA47', displayColor: '#57BA47' },
  { abbr: 'SC', teamId: 18, division: 'South', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'South Carolina Stingrays', shortName: 'Stingrays', primaryColor: '#003468', displayColor: '#007DFB' },
  // ── Central ───────────────────────────────────────────────────────────────
  { abbr: 'BLM', teamId: 107, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Bloomington Bison', shortName: 'Bison', primaryColor: '#E11837', displayColor: '#EA3E58' },
  { abbr: 'CIN', teamId: 5, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Cincinnati Cyclones', shortName: 'Cyclones', primaryColor: '#C31F39', displayColor: '#E24860' },
  { abbr: 'FW', teamId: 60, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Fort Wayne Komets', shortName: 'Komets', primaryColor: '#FF7800', displayColor: '#FF7800' },
  { abbr: 'IND', teamId: 65, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Indy Fuel', shortName: 'Fuel', primaryColor: '#B8292F', displayColor: '#D95358' },
  { abbr: 'KAL', teamId: 50, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Kalamazoo Wings', shortName: 'Wings', primaryColor: '#E03A3E', displayColor: '#E24A4E' },
  { abbr: 'TOL', teamId: 21, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Toledo Walleye', shortName: 'Walleye', primaryColor: '#6799C8', displayColor: '#6799C8' },
  { abbr: 'WHL', teamId: 25, division: 'Central', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Wheeling Nailers', shortName: 'Nailers', primaryColor: '#FCB514', displayColor: '#FCB514' },
  // ── Mountain ──────────────────────────────────────────────────────────────
  { abbr: 'ALN', teamId: 66, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Allen Americans', shortName: 'Americans', primaryColor: '#AA182C', displayColor: '#E5455B' },
  { abbr: 'IDH', teamId: 11, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Idaho Steelheads', shortName: 'Steelheads', primaryColor: '#1A3E6E', displayColor: '#4381D3' },
  { abbr: 'KC', teamId: 68, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Kansas City Mavericks', shortName: 'Mavericks', primaryColor: '#F15F22', displayColor: '#F15F22' },
  { abbr: 'NM', teamId: 114, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'New Mexico Goatheads', shortName: 'Goatheads', primaryColor: '#79171D', displayColor: '#DD4F57' },
  { abbr: 'RC', teamId: 70, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Rapid City Rush', shortName: 'Rush', primaryColor: '#CC2437', displayColor: '#DF4C5C' },
  { abbr: 'TAH', teamId: 106, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Tahoe Knight Monsters', shortName: 'Knight Monsters', primaryColor: '#5395CE', displayColor: '#5395CE' },
  { abbr: 'TUL', teamId: 71, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Tulsa Oilers', shortName: 'Oilers', primaryColor: '#11213A', displayColor: '#5181CC' },
  { abbr: 'WIC', teamId: 72, division: 'Mountain', get season() { return ECHL_CURRENT_SEASON; }, displayName: 'Wichita Thunder', shortName: 'Thunder', primaryColor: '#0055B8', displayColor: '#0B7CFF' },
];

// 2025-26 teams not in 2026-27 -- they still appear in season 73/76 games,
// standings and player rows. Resolvable by id (and abbr, for logos) only;
// deliberately left out of ECHL_TEAMS so they never show up as a pickable
// team. Same pattern as ahlConfig.js's AHL_HISTORICAL_TEAMS.
export const ECHL_HISTORICAL_TEAMS = [
  { abbr: 'IA', teamId: 98, division: 'Central', season: 73, displayName: 'Iowa Heartlanders', shortName: 'Heartlanders', primaryColor: '#FFD103', displayColor: '#FFD103', historical: true },
  { abbr: 'UTA', teamId: 23, division: 'Mountain', season: 73, displayName: 'Utah Grizzlies', shortName: 'Grizzlies', primaryColor: '#00483A', displayColor: '#009276', historical: true },
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
  98: '98.png', 23: '23.png', // historical (IA, UTA), confirmed live 2026-09-19
};

export function echlLogoUrl(teamId) {
  const file = ECHL_LOGO_FILES[teamId];
  return file ? `https://assets.leaguestat.com/echl/logos/${file}` : null;
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export const ECHL_TEAM_MAP = Object.fromEntries(ECHL_TEAMS.map((t) => [t.abbr, t]));
export const ECHL_TEAM_BY_ID = Object.fromEntries(
  [...ECHL_HISTORICAL_TEAMS, ...ECHL_TEAMS].map((t) => [t.teamId, t])
);

export function getECHLTeamConfig(abbr) {
  return ECHL_TEAM_MAP[abbr] ?? null;
}

// Display-only lookup (logos, labels) that also resolves ECHL_HISTORICAL_TEAMS
// -- never use this to pick or validate a user's team.
const ECHL_HISTORICAL_TEAM_MAP = Object.fromEntries(ECHL_HISTORICAL_TEAMS.map((t) => [t.abbr, t]));
export function getECHLTeamForDisplay(abbr) {
  return ECHL_TEAM_MAP[abbr] ?? ECHL_HISTORICAL_TEAM_MAP[abbr] ?? null;
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
