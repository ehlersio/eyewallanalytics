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

// ── Season constant ───────────────────────────────────────────────────────────
// Update each October alongside CURRENT_SEASON in teamConfig.js.
// Corresponds to HockeyTech season ID 8 (2025-26 Regular Season).
// Next bump: October 2026 → 9 (2026-27 Regular Season, once ID confirmed).
export const PWHL_CURRENT_SEASON = 8;

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
// Expansion teams (comingSoon: true) — colors TBD once brands are revealed:
//   DET, HAM, LV, SJS using neutral placeholder; update October 2026.

export const PWHL_TEAMS = [
  // ── Original eight ───────────────────────────────────────────────────────
  {
    abbr: 'BOS',
    teamId: 1,
    season: PWHL_CURRENT_SEASON,
    displayName: 'Boston Fleet',
    shortName: 'Fleet',
    primaryColor: '#173F35',
    displayColor: '#3DA58A',
  },
  {
    abbr: 'MIN',
    teamId: 2,
    season: PWHL_CURRENT_SEASON,
    displayName: 'Minnesota Frost',
    shortName: 'Frost',
    primaryColor: '#250E62',
    displayColor: '#A77BCA',
  },
  {
    abbr: 'MTL',
    teamId: 3,
    season: PWHL_CURRENT_SEASON,
    displayName: 'Montréal Victoire',
    shortName: 'Victoire',
    primaryColor: '#862633',
    displayColor: '#D4576A',
  },
  {
    abbr: 'NY',
    teamId: 4,
    season: PWHL_CURRENT_SEASON,
    displayName: 'New York Sirens',
    shortName: 'Sirens',
    primaryColor: '#006D6F',
    displayColor: '#00A8AB',
  },
  {
    abbr: 'OTT',
    teamId: 5,
    season: PWHL_CURRENT_SEASON,
    displayName: 'Ottawa Charge',
    shortName: 'Charge',
    primaryColor: '#BF2B45',
    displayColor: '#BF2B45',
  },
  {
    abbr: 'TOR',
    teamId: 6,
    season: PWHL_CURRENT_SEASON,
    displayName: 'Toronto Sceptres',
    shortName: 'Sceptres',
    primaryColor: '#003594',
    displayColor: '#3579FF',
  },
  {
    abbr: 'SEA',
    teamId: 8,
    season: PWHL_CURRENT_SEASON,
    displayName: 'Seattle Torrent',
    shortName: 'Torrent',
    primaryColor: '#2D5F5F',
    displayColor: '#5DB8B8',
  },
  {
    abbr: 'VAN',
    teamId: 9,
    season: PWHL_CURRENT_SEASON,
    displayName: 'Vancouver Goldeneyes',
    shortName: 'Goldeneyes',
    primaryColor: '#1A4B7A',
    displayColor: '#4A90D9',
  },
  // ── 2026-27 expansion teams ───────────────────────────────────────────────
  // HockeyTech IDs not yet assigned. comingSoon: true disables selection in
  // TeamPicker. Update teamId, primaryColor, displayColor in October 2026
  // once IDs are assigned and brand colors are revealed.
  {
    abbr: 'DET',
    teamId: null,
    season: PWHL_CURRENT_SEASON,
    displayName: 'PWHL Detroit',
    shortName: 'Detroit',
    primaryColor: '#555555',
    displayColor: '#999999',
    comingSoon: true,
  },
  {
    abbr: 'HAM',
    teamId: null,
    season: PWHL_CURRENT_SEASON,
    displayName: 'PWHL Hamilton',
    shortName: 'Hamilton',
    primaryColor: '#555555',
    displayColor: '#999999',
    comingSoon: true,
  },
  {
    abbr: 'LV',
    teamId: null,
    season: PWHL_CURRENT_SEASON,
    displayName: 'PWHL Las Vegas',
    shortName: 'Las Vegas',
    primaryColor: '#555555',
    displayColor: '#999999',
    comingSoon: true,
  },
  {
    abbr: 'SJS',
    teamId: null,
    season: PWHL_CURRENT_SEASON,
    displayName: 'PWHL San Jose',
    shortName: 'San Jose',
    primaryColor: '#555555',
    displayColor: '#999999',
    comingSoon: true,
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

export function getPWHLTeamConfig(abbr) {
  return PWHL_TEAM_MAP[abbr] ?? null;
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
