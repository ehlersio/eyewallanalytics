// utils/pwhlConfig.js
// PWHL team configuration — parallel structure to teamConfig.js.
//
// Storage key for selected PWHL team: 'eyewall:pwhl_team' in localStorage.
// Shape is intentionally identical to NHL team objects in teamConfig.js so
// all shared components (StatBar, IceRink, etc.) receive the same fields.
//
// Fields:
//   abbr          — HockeyTech team code (matches pwhl_teams.team_code in Supabase)
//   teamId        — HockeyTech numeric team ID (null for expansion teams not yet in HockeyTech)
//   season        — current season ID for API calls (derived from PWHL_CURRENT_SEASON)
//   displayName   — full official team name
//   shortName     — common short name / nickname
//   primaryColor  — canonical brand hex
//   displayColor  — WCAG AA-compliant variant for dark mode (≥4.5:1 on #101827)
//                   equals primaryColor where it already passes; lightened otherwise
//   comingSoon    — true for 2026-27 expansion teams not yet in HockeyTech;
//                   rendered as disabled tiles in TeamPicker
//
// Note on code conflicts with NHL:
//   'NY' conflicts with NYI/NYR, 'OTT' conflicts with Ottawa Senators —
//   disambiguation is handled by SportContext: PWHL and NHL teams are never
//   in the same scope at runtime.

import { fetchSeasonsConfig } from './seasonClient';

// ── Season constant ───────────────────────────────────────────────────────────
// This used to be the ONE value updated each October alongside CURRENT_SEASON
// in teamConfig.js. It's now live-resolved from the Worker's /config/seasons
// endpoint (see seasons.js in eyewall-poller). This constant is now just the
// fallback seed — used before the fetch below resolves, or if it fails.
// It's a `let` so the fetch can update it in place.
//
// Same getter pattern as teamConfig.js: each team's `season` field is a
// GETTER, so `team.season` reflects live updates automatically. See
// teamConfig.js's Season constant comment for the one caveat (destructuring
// `season` into a standalone variable and holding onto it indefinitely).
export let PWHL_CURRENT_SEASON = 8;

// Label form ("2025-26"), derived the same way eyewall-pipeline's
// pwhl_salaries.py computes SEASON_LABEL (f"{start_year}-{start_year+1}").
// This is the format pwhl_salaries.season actually stores in Supabase —
// /pwhl/salaries matches on the label string, not the season_id integer.
// Falls back to a hardcoded seed like PWHL_CURRENT_SEASON does, updated in
// place once live resolution succeeds.
export let PWHL_SEASON_LABEL = '2025-26';

(async () => {
  try {
    const data = await fetchSeasonsConfig();
    const seasonId   = data?.pwhl?.seasonId;
    const startYear  = data?.pwhl?.startYear;
    if (seasonId && seasonId !== PWHL_CURRENT_SEASON) {
      PWHL_CURRENT_SEASON = seasonId;
      window.dispatchEvent(new window.CustomEvent('eyewall:pwhl-season-updated', { detail: PWHL_CURRENT_SEASON }));
    }
    if (startYear) {
      PWHL_SEASON_LABEL = `${startYear}-${String(startYear + 1).slice(2)}`;
    }
  } catch (e) {
    console.warn('Live PWHL season lookup failed, using fallback:', e.message);
  }
})();

// ── Season / playoff-type enumeration ────────────────────────────────────────
// Single source of truth for "which season_ids are playoffs, and which
// regular season each one follows" — this same data used to be duplicated
// independently in PWHLTeamView.jsx (a bare `9` literal), PWHLLeagueView.jsx
// (a `PLAYOFF_SEASON` id->id map), and PWHLScheduleView.jsx (this same
// SEASONS shape). Centralized here (Session 43) so a future season addition
// only needs one edit, not three found via grep-and-hope.
//
// HockeyTech assigns each season's playoffs their own distinct season_id —
// it's not a type flag on the same id as the regular season it follows.
// This list is NOT live-resolved (unlike PWHL_CURRENT_SEASON/PWHL_SEASON_LABEL
// above) — HockeyTech's bootstrap feed doesn't expose "which future/past
// season_id pairs with which," so this still needs a manual entry once a
// season's playoffs actually get a season_id assigned. Same maintenance
// burden as before, just one place to update it instead of three.
export const PWHL_SEASONS = [
  { id: 8, label: '2025-26', type: 'regular' },
  { id: 9, label: '2025-26 Playoffs', type: 'playoffs' },
  { id: 5, label: '2024-25', type: 'regular' },
  { id: 6, label: '2024-25 Playoffs', type: 'playoffs' },
  { id: 1, label: '2023-24', type: 'regular' },
  { id: 3, label: '2023-24 Playoffs', type: 'playoffs' },
];

export const PWHL_REGULAR_SEASONS = PWHL_SEASONS.filter(s => s.type === 'regular');
export const PWHL_PLAYOFF_SEASONS = PWHL_SEASONS.filter(s => s.type === 'playoffs');

// Regular-season season_id -> its corresponding playoff season_id.
// Derived from PWHL_SEASONS by pairing consecutive regular/playoffs entries
// rather than hand-duplicating the {8:9, 5:6, 1:3} mapping a second time.
export const PWHL_PLAYOFF_SEASON_MAP = Object.fromEntries(
  PWHL_REGULAR_SEASONS.map((reg, i) => [reg.id, PWHL_PLAYOFF_SEASONS[i]?.id])
);

// Is this specific season_id (e.g. a game's own season_id) a playoffs season?
// Used to derive per-game isPlayoff state (period/OT/shootout labeling —
// PWHL regular season ends in a shootout, playoffs never do) without
// needing a new Worker route: games already carry season_id.
export function isPWHLPlayoffSeason(seasonId) {
  return PWHL_SEASONS.find(s => s.id === seasonId)?.type === 'playoffs';
}

// ── Team configs ─────────────────────────────────────────────────────────────
// primaryColor: official brand hex from PWHL branding / Wikipedia sports color module.
// displayColor: lightened where primaryColor fails WCAG AA on #101827 background.
//
// Contrast notes (approximate, verify with contrast checker before shipping):
//   BOS #173F35 → too dark → lightened to #3DA58A
//   MIN #250E62 → too dark → lightened to #A77BCA (official accent, passes AA)
//   MTL #862633 → borderline → lightened to #D4576A
//   NY  #006D6F → borderline → lightened to #00A8AB
//   OTT #BF2B45 → passes AA  → unchanged
//   TOR #003594 → too dark → lightened to #3579FF
//   SEA #2D5F5F → too dark → lightened to #5DB8B8
//   VAN #1A4B7A → too dark → lightened to #4A90D9
//
// Expansion teams — real colors pulled from each team's own *_colors.css
// (verified 2026-07-05, computed contrast, not eyeballed):
//   DET #A6192E → fails AA (2.37:1) → lightened to #E3475E (4.51:1, thin margin)
//   HAM #64111D → fails AA (1.39:1) → lightened to #E14C62 (4.57:1)
//   LV  #686F12 → fails AA (3.28:1) → lightened to #818916 (4.68:1)
//   SJS #0072CE → fails AA (3.64:1) → lightened to #0083ED (4.62:1)

export const PWHL_TEAMS = [
  // ── Original eight ───────────────────────────────────────────────────────
  {
    abbr: 'BOS',
    teamId: 1,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'Boston Fleet',
    shortName: 'Fleet',
    primaryColor: '#173F35',
    displayColor: '#3DA58A',
  },
  {
    abbr: 'MIN',
    teamId: 2,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'Minnesota Frost',
    shortName: 'Frost',
    primaryColor: '#250E62',
    displayColor: '#A77BCA',
  },
  {
    abbr: 'MTL',
    teamId: 3,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'Montréal Victoire',
    shortName: 'Victoire',
    primaryColor: '#862633',
    displayColor: '#D4576A',
  },
  {
    abbr: 'NY',
    teamId: 4,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'New York Sirens',
    shortName: 'Sirens',
    primaryColor: '#006D6F',
    displayColor: '#00A8AB',
  },
  {
    abbr: 'OTT',
    teamId: 5,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'Ottawa Charge',
    shortName: 'Charge',
    primaryColor: '#BF2B45',
    displayColor: '#BF2B45',
  },
  {
    abbr: 'TOR',
    teamId: 6,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'Toronto Sceptres',
    shortName: 'Sceptres',
    primaryColor: '#003594',
    displayColor: '#3579FF',
  },
  {
    abbr: 'SEA',
    teamId: 8,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'Seattle Torrent',
    shortName: 'Torrent',
    primaryColor: '#2D5F5F',
    displayColor: '#5DB8B8',
  },
  {
    abbr: 'VAN',
    teamId: 9,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'Vancouver Goldeneyes',
    shortName: 'Goldeneyes',
    primaryColor: '#1A4B7A',
    displayColor: '#4A90D9',
  },
  // ── 2026-27 expansion teams ───────────────────────────────────────────────
  // HockeyTech IDs confirmed 2026-07-04 (docs/hockeytech-api-notes.md) via
  // real signing data + the team-filter dropdown on thepwhl.com/en/stats.
  // Colors are real (pulled from each team's own *_colors.css design
  // tokens). comingSoon flipped to false 2026-07-05 — real roster data
  // confirmed live in HockeyTech for all four (direct per-team roster
  // fetches, not just the bootstrap team list). Logos are still temporary
  // placeholders (no permanent team identity/logo revealed yet) — expected
  // to update once each team's real branding drops, likely this fall.
  {
    abbr: 'DET',
    teamId: 10,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'PWHL Detroit',
    shortName: 'Detroit',
    // Real hex from detroit_colors.css's "primary1"/interactive-accent
    // token. Worth knowing: Detroit's own announcement named black-and-
    // silver as primary with red as an accent, but this red is what the
    // CSS's own design system treats as the interactive/branded color —
    // black doesn't work well as a UI accent, so that's not unusual.
    primaryColor: '#A6192E',
    // Fails WCAG AA on dark mode (2.37:1) — lightened in HSL space to the
    // first step clearing 4.5:1. Margin here is thin (4.51:1, barely over
    // the line) — nudge lighter if you want more headroom than this.
    displayColor: '#E3475E',
    comingSoon: false,
  },
  {
    abbr: 'HAM',
    teamId: 11,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'PWHL Hamilton',
    shortName: 'Hamilton',
    // Real hex pulled from hamilton_colors.css (site design tokens), not
    // guessed from press-release color names. #64111d is the file's own
    // "surface-1"/primary token — the same role primaryColor plays for
    // every other team here. #e2d2b8 (cream) and #f2a900 (gold) are also
    // real if a future design wants them, just not used as primaryColor.
    primaryColor: '#64111d',
    // #64111d fails WCAG AA badly on dark mode (1.39:1) — lightened in HSL
    // space (hue/saturation preserved) to the first step clearing 4.5:1,
    // landing at 4.57:1 — consistent with MTL's own displayColor margin
    // (4.54:1), not an outlier.
    displayColor: '#E14C62',
    comingSoon: false,
  },
  {
    abbr: 'LV',
    teamId: 12,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'PWHL Las Vegas',
    shortName: 'Las Vegas',
    // Real hex from lasvegas_colors.css's "primary1" token — matches the
    // announced "green and gold" (gold #FFB81C shows up as a secondary
    // underline/highlight accent in the file, not used here since this
    // schema is one color pair per team).
    primaryColor: '#686F12',
    // Fails WCAG AA on dark mode (3.28:1) — lightened in HSL space to the
    // first step clearing 4.5:1 (4.68:1, comfortable margin).
    displayColor: '#818916',
    comingSoon: false,
  },
  {
    abbr: 'SJS',
    teamId: 13,
    get season() { return PWHL_CURRENT_SEASON; },
    displayName: 'PWHL San Jose',
    shortName: 'San Jose',
    // Real hex from sanjose_colors.css's "primary1" token — matches the
    // announced "orange, blue, white" (orange #F69245 shows up as a
    // secondary underline/highlight accent in the file, not used here
    // since this schema is one color pair per team).
    primaryColor: '#0072CE',
    // Fails WCAG AA on dark mode (3.64:1) — lightened in HSL space to the
    // first step clearing 4.5:1 (4.62:1, comfortable margin).
    displayColor: '#0083ED',
    comingSoon: false,
  },
];

// ── Logo map ──────────────────────────────────────────────────────────────────
// Files saved to public/ — filenames don't follow a consistent pattern so we
// map explicitly. Four teams have .webp logos; the rest are .svg.
// Usage: `/pwhl-logos/${PWHL_LOGO_FILES[abbr]}`
export const PWHL_LOGO_FILES = {
  BOS: 'pwhl-bos.svg',
  MIN: 'pwhl-min.svg',
  MTL: 'pwhl-mon.svg',
  NY:  'pwhl-ny.svg',
  OTT: 'pwhl-ott.svg',
  TOR: 'pwhl-tor.svg',
  SEA: 'pwhl-sea.webp',
  VAN: 'pwhl-van.webp',
  DET: 'pwhl-det.webp',
  HAM: 'pwhl-ham.svg',
  LV:  'pwhl-lv.webp',
  SJS: 'pwhl-sj.svg',
};

export function pwhlLogoUrl(abbr) {
  const file = PWHL_LOGO_FILES[abbr];
  return file ? `/pwhl-logos/${file}` : null;
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export const PWHL_TEAM_MAP = Object.fromEntries(
  PWHL_TEAMS.map((t) => [t.abbr, t])
);

// team_id (integer, as stored on pwhl_* tables) -> team config. Derived from
// PWHL_TEAMS rather than a second hardcoded map -- CLAUDE.md flags this repo's
// team-ID map as already independently duplicated across eyewall-poller/
// eyewall-pipeline; adding yet another local copy here would make that worse.
export const PWHL_TEAM_BY_ID = Object.fromEntries(
  PWHL_TEAMS.map((t) => [t.teamId, t])
);

export function getPWHLTeamConfig(abbr) {
  return PWHL_TEAM_MAP[abbr] ?? null;
}

export function getPWHLTeamById(teamId) {
  return PWHL_TEAM_BY_ID[teamId] ?? null;
}

export function hasPWHLTeamConfig() {
  return Boolean(localStorage.getItem('eyewall:pwhl_team'));
}

export function getPWHLStoredTeam() {
  try {
    const raw = localStorage.getItem('eyewall:pwhl_team');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
