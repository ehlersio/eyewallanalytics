// utils/ahlConfig.js
// AHL team configuration — parallel structure to pwhlConfig.js/teamConfig.js.
//
// Storage key for selected AHL team: 'eyewall:ahl_team' in localStorage.
//
// Fields:
//   abbr          — HockeyTech team code (matches ahl_players.team_id's code
//                   in eyewall-pipeline's TEAM_ID_MAP)
//   teamId        — HockeyTech numeric team ID
//   division      — one of Atlantic/Central/North/Pacific (AHL has real
//                   conference/division structure, unlike PWHL's flat table)
//   season        — current season ID for API calls (derived from AHL_CURRENT_SEASON)
//   displayName   — full official team name
//   shortName     — common short name / nickname
//   primaryColor / displayColor
//
// AHL_PLACEHOLDER_COLOR is now used for exactly ONE team (Ontario Reign,
// see below) rather than all 32 -- real per-team brand colors landed for
// the other 31 in a follow-up pass. Sourced from each team's Wikipedia
// infobox "colours" field (first-listed = primary, per that template's own
// convention), cross-checked against the raw wikitext for ambiguous
// orderings. displayColor is lightened in HSL space (hue/saturation
// preserved) where primaryColor fails WCAG AA on #101827 -- same method
// PWHL's config uses, see that file's comment.
const AHL_PLACEHOLDER_COLOR = '#6B7280'; // neutral slate, passes WCAG AA on #101827 (7.1:1)

// Five teams' Wikipedia-listed "primary" was a generic near-black/near-gray
// infobox default carrying no real per-team signal -- Providence, Grand
// Rapids, and San Diego all resolved to the *literal identical* #231F20,
// which is the template's own default swatch for the bare word "black",
// not a team-specific sample. Same problem PWHL's Detroit hit (documented
// in pwhlConfig.js): black doesn't work as a UI accent anyway, so these
// five use their real accent color instead (orange/gold/red, sourced from
// teamcolorcodes.com since none of the five expose a hex via Wikipedia or
// their own site's CSS): PRO #FBB337 (gold), LV #F58220 (orange), WBS
// #FEC23D (gold), GR #E51636 (red), SD #FF4C00 (orange).
//
// Ontario Reign is the one team still on AHL_PLACEHOLDER_COLOR: their
// "Inland Blue"/"Empire Gold" rebrand (announced June 2026) has no
// published hex or Pantone spec anywhere checked (official press release,
// Mayor's Manor, teamcolorcodes.com still shows the pre-rebrand
// black/silver scheme) -- flagged as a real follow-up once ONT's new
// branding is actually documented somewhere, not guessed at now.
//
// Contrast notes (WCAG AA on #101827, computed not eyeballed):
//   HFD #00548E (2.25:1) -> #0084E0 (4.55:1)     HER #472A2B (1.38:1) -> #AC7374 (4.62:1)
//   CLT #F5002A (4.16:1) -> #FF0A34 (4.52:1)     SPR #E31837 (3.77:1) -> #EB3E59 (4.54:1)
//   ROC #DF2442 (3.78:1) -> #E44861 (4.57:1)     SYR #1D427C (1.80:1) -> #4D82D5 (4.63:1)
//   TOR #003C7F (1.65:1) -> #0A7EFF (4.60:1)     CLE #115687 (2.29:1) -> #1B87D4 (4.62:1)
//   UTC #CF1F30 (3.29:1) -> #E44857 (4.54:1)     BEL #E4103C (3.75:1) -> #F13159 (4.50:1)
//   LAV #083A81 (1.64:1) -> #3080F2 (4.65:1)     HAM #00539B (2.29:1) -> #0081F2 (4.59:1)
//   MB  #041E41 (1.07:1) -> #297FF2 (4.58:1)     MIL #0E2B58 (1.27:1) -> #4280E1 (4.57:1)
//   GR  #E51636 (3.81:1) -> #EC3D58 (4.55:1)     CHI #50000A (1.14:1) -> #FF0927 (4.50:1)
//   RFD #DA1A32 (3.53:1) -> #E94358 (4.58:1)     TEX #14602D (2.32:1) -> #1F9747 (4.72:1)
//   IA  #004F30 (1.83:1) -> #00965B (4.66:1)     BAK #00205B (1.15:1) -> #327AFF (4.54:1)
//   SJ  #216B74 (2.89:1) -> #2C909C (4.72:1)     TUC #6F263D (1.71:1) -> #C96081 (4.63:1)
//   COL #12368B (1.63:1) -> #4E7CE8 (4.55:1)     ABB #007934 (3.20:1) -> #009841 (4.71:1)
//   CGY #CE0E2D (3.15:1) -> #F13755 (4.58:1)     CV  #001425 (1.05:1) -> #0082F1 (4.62:1)
//   PRO #FBB337 (9.82:1) passes unchanged        LV  #F58220 (6.85:1) passes unchanged
//   WBS #FEC23D (11.0:1) passes unchanged        SD  #FF4C00 (5.32:1) passes unchanged
//   HSK #C3C7C9 (10.4:1) passes unchanged

import { fetchSeasonsConfig } from './seasonClient';

// ── Season constant ───────────────────────────────────────────────────────────
// Same live-resolution pattern as PWHL_CURRENT_SEASON in pwhlConfig.js --
// see that file's comment for the getter-based live-update mechanism this
// mirrors. Fallback seed matches eyewall-poller's seasons.js FALLBACK_AHL.
export let AHL_CURRENT_SEASON = 90;

(async () => {
  try {
    const data = await fetchSeasonsConfig();
    const seasonId = data?.ahl?.seasonId;
    if (seasonId && seasonId !== AHL_CURRENT_SEASON) {
      AHL_CURRENT_SEASON = seasonId;
      window.dispatchEvent(new window.CustomEvent('eyewall:ahl-season-updated', { detail: AHL_CURRENT_SEASON }));
    }
  } catch (e) {
    console.warn('Live AHL season lookup failed, using fallback:', e.message);
  }
})();

// ── Season / playoff-type enumeration ────────────────────────────────────────
// Same NOT-live-resolved convention as PWHL_SEASONS in pwhlConfig.js -- see
// that file's comment. Only the seasons confirmed live during this pass are
// listed; add entries here as further AHL seasons are ingested.
export const AHL_SEASONS = [
  { id: 94, label: '2026-27', type: 'regular' },
  { id: 90, label: '2025-26', type: 'regular' },
  { id: 92, label: '2026 Playoffs', type: 'playoffs' },
];

export const AHL_REGULAR_SEASONS = AHL_SEASONS.filter((s) => s.type === 'regular');
export const AHL_PLAYOFF_SEASONS = AHL_SEASONS.filter((s) => s.type === 'playoffs');

export function isAHLPlayoffSeason(seasonId) {
  return AHL_SEASONS.find((s) => s.id === seasonId)?.type === 'playoffs';
}

// Regular-season season_id -> its corresponding playoff season_id.
// PWHL_PLAYOFF_SEASON_MAP (pwhlConfig.js) derives this positionally by
// zipping PWHL_REGULAR_SEASONS[i] with PWHL_PLAYOFF_SEASONS[i] -- that only
// works because PWHL_SEASONS is declared as adjacent (regular, playoffs)
// pairs in matching order. AHL_SEASONS is declared newest-regular-first
// instead (94, 90, 92) specifically so season-tab lists render newest-first
// -- reordering it to make positional zip work would misorder those tabs.
// Hand-authored instead; only one pair is known so far.
export const AHL_PLAYOFF_SEASON_MAP = { 90: 92 }; // 2025-26 -> 2026 Playoffs

// Reverse of the above -- playoffs season_id -> its regular season_id.
// Needed because AHL's live-resolved "current" season (see
// AHL_CURRENT_SEASON above) can itself BE a playoffs id for most of the
// long AHL off-season (June-October) -- there's no season 94 data yet
// (2026-27 starts 2026-10-02), so the resolver's most-recent-real-data
// answer right now is season 92 (2026 Playoffs), not 90. Any view that
// wants "this season's regular-season numbers" specifically (not just
// whatever's current) needs to map back from 92 -> 90 rather than assume
// currentSeason is already a regular-season id.
export const AHL_REGULAR_SEASON_MAP = Object.fromEntries(
  Object.entries(AHL_PLAYOFF_SEASON_MAP).map(([regId, poId]) => [poId, Number(regId)])
);

// ── Team configs ─────────────────────────────────────────────────────────────
// team_id/code/division confirmed live via feed=modulekit&view=teamsbyseason
// 2026-08-29 (season 94) -- see eyewall-pipeline's ahl_stats.py TEAM_ID_MAP,
// which this mirrors. team_id 317 (BRI, Bridgeport Islanders) is the
// pre-2026-27-relocation identity of 457 (HAM, Hamilton Hammers) -- included
// here too so historical-season views (e.g. season 90) can still resolve it.
export const AHL_TEAMS = [
  // ── Atlantic ──────────────────────────────────────────────────────────────
  { abbr: 'HFD', teamId: 307, division: 'Atlantic', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Hartford Wolf Pack', shortName: 'Wolf Pack', primaryColor: '#00548E', displayColor: '#0084E0' },
  { abbr: 'PRO', teamId: 309, division: 'Atlantic', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Providence Bruins', shortName: 'Bruins', primaryColor: '#FBB337', displayColor: '#FBB337' },
  { abbr: 'LV', teamId: 313, division: 'Atlantic', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Lehigh Valley Phantoms', shortName: 'Phantoms', primaryColor: '#F58220', displayColor: '#F58220' },
  { abbr: 'WBS', teamId: 316, division: 'Atlantic', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Wilkes-Barre/Scranton Penguins', shortName: 'Penguins', primaryColor: '#FEC23D', displayColor: '#FEC23D' },
  { abbr: 'HER', teamId: 319, division: 'Atlantic', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Hershey Bears', shortName: 'Bears', primaryColor: '#472A2B', displayColor: '#AC7374' },
  { abbr: 'CLT', teamId: 384, division: 'Atlantic', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Charlotte Checkers', shortName: 'Checkers', primaryColor: '#F5002A', displayColor: '#FF0A34' },
  { abbr: 'SPR', teamId: 411, division: 'Atlantic', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Springfield Thunderbirds', shortName: 'Thunderbirds', primaryColor: '#E31837', displayColor: '#EB3E59' },
  // ── North ─────────────────────────────────────────────────────────────────
  { abbr: 'ROC', teamId: 323, division: 'North', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Rochester Americans', shortName: 'Americans', primaryColor: '#DF2442', displayColor: '#E44861' },
  { abbr: 'SYR', teamId: 324, division: 'North', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Syracuse Crunch', shortName: 'Crunch', primaryColor: '#1D427C', displayColor: '#4D82D5' },
  { abbr: 'TOR', teamId: 335, division: 'North', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Toronto Marlies', shortName: 'Marlies', primaryColor: '#003C7F', displayColor: '#0A7EFF' },
  { abbr: 'CLE', teamId: 373, division: 'North', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Cleveland Monsters', shortName: 'Monsters', primaryColor: '#115687', displayColor: '#1B87D4' },
  { abbr: 'UTC', teamId: 390, division: 'North', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Utica Comets', shortName: 'Comets', primaryColor: '#CF1F30', displayColor: '#E44857' },
  { abbr: 'BEL', teamId: 413, division: 'North', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Belleville Senators', shortName: 'Senators', primaryColor: '#E4103C', displayColor: '#F13159' },
  { abbr: 'LAV', teamId: 415, division: 'North', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Laval Rocket', shortName: 'Rocket', primaryColor: '#083A81', displayColor: '#3080F2' },
  { abbr: 'HAM', teamId: 457, division: 'North', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Hamilton Hammers', shortName: 'Hammers', primaryColor: '#00539B', displayColor: '#0081F2' },
  // ── Central ───────────────────────────────────────────────────────────────
  { abbr: 'MB', teamId: 321, division: 'Central', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Manitoba Moose', shortName: 'Moose', primaryColor: '#041E41', displayColor: '#297FF2' },
  { abbr: 'MIL', teamId: 327, division: 'Central', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Milwaukee Admirals', shortName: 'Admirals', primaryColor: '#0E2B58', displayColor: '#4280E1' },
  { abbr: 'GR', teamId: 328, division: 'Central', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Grand Rapids Griffins', shortName: 'Griffins', primaryColor: '#E51636', displayColor: '#EC3D58' },
  { abbr: 'CHI', teamId: 330, division: 'Central', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Chicago Wolves', shortName: 'Wolves', primaryColor: '#50000A', displayColor: '#FF0927' },
  { abbr: 'RFD', teamId: 372, division: 'Central', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Rockford IceHogs', shortName: 'IceHogs', primaryColor: '#DA1A32', displayColor: '#E94358' },
  { abbr: 'TEX', teamId: 380, division: 'Central', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Texas Stars', shortName: 'Stars', primaryColor: '#14602D', displayColor: '#1F9747' },
  { abbr: 'IA', teamId: 389, division: 'Central', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Iowa Wild', shortName: 'Wild', primaryColor: '#004F30', displayColor: '#00965B' },
  // ── Pacific ───────────────────────────────────────────────────────────────
  { abbr: 'BAK', teamId: 402, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Bakersfield Condors', shortName: 'Condors', primaryColor: '#00205B', displayColor: '#327AFF' },
  { abbr: 'ONT', teamId: 403, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Ontario Reign', shortName: 'Reign', primaryColor: AHL_PLACEHOLDER_COLOR, displayColor: AHL_PLACEHOLDER_COLOR },
  { abbr: 'SD', teamId: 404, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'San Diego Gulls', shortName: 'Gulls', primaryColor: '#FF4C00', displayColor: '#FF4C00' },
  { abbr: 'SJ', teamId: 405, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'San Jose Barracuda', shortName: 'Barracuda', primaryColor: '#216B74', displayColor: '#2C909C' },
  { abbr: 'TUC', teamId: 412, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Tucson Roadrunners', shortName: 'Roadrunners', primaryColor: '#6F263D', displayColor: '#C96081' },
  { abbr: 'COL', teamId: 419, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Colorado Eagles', shortName: 'Eagles', primaryColor: '#12368B', displayColor: '#4E7CE8' },
  { abbr: 'HSK', teamId: 437, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Henderson Silver Knights', shortName: 'Silver Knights', primaryColor: '#C3C7C9', displayColor: '#C3C7C9' },
  { abbr: 'ABB', teamId: 440, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Abbotsford Canucks', shortName: 'Canucks', primaryColor: '#007934', displayColor: '#009841' },
  { abbr: 'CGY', teamId: 444, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Calgary Wranglers', shortName: 'Wranglers', primaryColor: '#CE0E2D', displayColor: '#F13755' },
  { abbr: 'CV', teamId: 445, division: 'Pacific', get season() { return AHL_CURRENT_SEASON; }, displayName: 'Coachella Valley Firebirds', shortName: 'Firebirds', primaryColor: '#001425', displayColor: '#0082F1' },
];

// ── Logos ─────────────────────────────────────────────────────────────────────
// Hosted directly from HockeyTech's own asset CDN rather than bundling 32
// local files the way PWHL's PWHL_LOGO_FILES does -- theahl.com's own site
// uses these same URLs directly, and AHL team logos are stable/official
// (unlike PWHL's early-days placeholder logos), so there's no "swap once
// real branding drops" reason to self-host a copy.
//
// NOT a bare `{teamId}.png` per team -- confirmed live 2026-08-29 that 9 of
// 32 teams 404 on that pattern. HockeyTech versions a team's logo file with
// a season-id suffix (e.g. "335_94.png") whenever the logo changes for a
// given season (a rebrand), and does NOT reliably keep the old bare
// filename as an alias -- 3 of those 9 (TEX/ONT/SJ) happen to still have a
// stale bare-filename file that also resolves, which is exactly why a
// same-day smoke test of "does a few team logos load" can miss this: it
// has to be checked against the feed's own `team_logo_url` field for
// EVERY team, not guessed from a pattern that happens to work for most.
// This map is that field's real values (feed=modulekit&view=teamsbyseason,
// season=94) -- re-pull and update on a future season flip if new 404s
// show up, same maintenance reality PWHL_LOGO_FILES already documents.
const AHL_LOGO_FILES = {
  307: '307.png', 309: '309.png', 313: '313.png', 316: '316_94.png',
  319: '319.png', 321: '321_94.png', 323: '323.png', 324: '324.png',
  327: '327.png', 328: '328_94.png', 330: '330.png', 335: '335_94.png',
  372: '372_94.png', 373: '373_94.png', 380: '380_94.png', 384: '384.png',
  389: '389.png', 390: '390_94.png', 402: '402_94.png', 403: '403_94.png',
  404: '404.png', 405: '405_94.png', 411: '411_94.png', 412: '412_94.png',
  413: '413.png', 415: '415.png', 419: '419.png', 437: '437.png',
  440: '440.png', 444: '444.png', 445: '445.png', 457: '457.png',
};

export function ahlLogoUrl(teamId) {
  const file = AHL_LOGO_FILES[teamId];
  return file ? `https://assets.leaguestat.com/ahl/logos/${file}` : null;
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export const AHL_TEAM_MAP = Object.fromEntries(AHL_TEAMS.map((t) => [t.abbr, t]));
export const AHL_TEAM_BY_ID = Object.fromEntries(AHL_TEAMS.map((t) => [t.teamId, t]));

export function getAHLTeamConfig(abbr) {
  return AHL_TEAM_MAP[abbr] ?? null;
}

export function getAHLTeamById(teamId) {
  return AHL_TEAM_BY_ID[teamId] ?? null;
}

export function hasAHLTeamConfig() {
  return Boolean(localStorage.getItem('eyewall:ahl_team'));
}

export function getAHLStoredTeam() {
  try {
    const raw = localStorage.getItem('eyewall:ahl_team');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
