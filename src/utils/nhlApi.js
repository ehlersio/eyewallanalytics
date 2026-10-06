import { cached, TTL, invalidate } from './cache.js'
import { leagueTeamAverages, teamShotAttempts } from './leagueAverages';
import { NATIVE_ORIGIN } from './nativeOrigin';
import { formatDate } from './formatters.js'
import { isStandingsStale } from './standingsUtils.js'
import { createLiveGameHold } from './liveGameHold.js'
import { isShootoutPlay } from './gamePlays.js'
import { buildTeamGameLog } from './teamTrends.js'

// NHL API utility
// Proxy routes (configured in vite.config.js):
//   /nhl-api  → https://api-web.nhle.com
//   /nhl-stats → https://api.nhle.com
const BASE = '/nhl-api/v1';

// Worker KV cache URL — set VITE_WORKER_URL in Cloudflare Pages environment variables
// e.g. https://eyewall-poller.YOUR_SUBDOMAIN.workers.dev
// When set, hot data (schedule, live PBP, boxscore, standings) is served from KV
// instead of hitting the NHL API per user — dramatically reduces API load during games.
// Vite replaces import.meta.env.VITE_* at build time with the literal string value.
// Set VITE_WORKER_URL in Cloudflare Pages → Settings → Environment variables.
const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;

// Team configuration — driven by user selection, stored in localStorage.
// All 32 teams and the get/set helpers live in teamConfig.js.
// Re-exported here so existing imports of TEAM_CONFIG from nhlApi.js keep working.
export { TEAM_CONFIG, ALL_TEAMS, getTeamConfig, setTeamConfig, hasTeamConfig } from './teamConfig'
import { TEAM_CONFIG, ALL_TEAMS, findTeamSummaryRow } from './teamConfig'
import { fetchWithRetry } from './retryFetch';


// gameType values from NHL API:
//   1 = Preseason, 2 = Regular season, 3 = Playoffs
export const GAME_TYPE = { PRESEASON: 1, REGULAR: 2, PLAYOFFS: 3 };

// ─── FETCH HELPER ────────────────────────────────────────────

// /nhl-api and /nhl-stats are Cloudflare Pages Functions that only exist on the
// deployed site — see utils/nativeOrigin.js for why this needs prefixing natively.
function resolveProxyUrl(url) {
  return (url.startsWith('/nhl-api') || url.startsWith('/nhl-stats')) ? `${NATIVE_ORIGIN}${url}` : url;
}

async function nhlFetch(url) {
  try {
    const res = await fetch(resolveProxyUrl(url));
    if (!res.ok) {
      console.warn(`NHL API ${res.status}: ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('NHL fetch error:', url, err.message);
    return null;
  }
}

// Read from Worker KV cache — appends ?team= so the Worker resolves the right config.
// Returns null if Worker unavailable or key missing.
async function kvFetch(key, team = TEAM_CONFIG) {
  if (!WORKER_URL) return null;
  try {
    const teamParam = encodeURIComponent(team.abbr);
    const res = await fetch(
      `${WORKER_URL}/cache/${encodeURIComponent(key)}?team=${teamParam}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null; // 404 = not in KV yet, fall through to direct NHL
    return res.json();
  } catch {
    return null;
  }
}


// Call a Worker endpoint directly (not via KV cache passthrough).
// Used for routes the Worker owns end-to-end: /draft/*, /news, etc.
async function workerFetch(path) {
  if (!WORKER_URL) return null;
  try {
    // One retry on a stalled connection -- see retryFetch.js. kvFetch above
    // deliberately does NOT get this: its short budget exists so it can fail
    // fast and fall through to the NHL API, which a retry would undo.
    const res = await fetchWithRetry(`${WORKER_URL}${path}`);
    if (!res.ok) {
      console.warn(`Worker ${res.status}: ${path}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error('Worker fetch error:', path, err.message);
    return null;
  }
}

// ─── DRAFT ────────────────────────────────────────────

// Fetch NHL Central Scouting rankings.
// category: 1=NA Skater, 2=Intl Skater, 3=NA Goalie, 4=Intl Goalie
// Omit category to get all 4 grouped by category_id: { 1: [...], 2: [...], 3: [...], 4: [...] }
export async function getDraftRankings(category = null) {
  const path = category ? `/draft/rankings?category=${category}` : '/draft/rankings';
  return workerFetch(path);
}

// Fetch live/completed draft picks from Supabase (via Worker).
// team: team abbrev filter e.g. 'CAR' — omit for full board
// round: round number filter e.g. 1 — omit for all rounds
// Returns [] pre-draft (no picks yet), populates live on June 26.
export async function getDraftPicks(team = null, round = null) {
  const params = new URLSearchParams();
  if (team)  params.set('team', team);
  if (round) params.set('round', String(round));
  const qs = params.size ? `?${params}` : '';
  return workerFetch(`/draft/picks${qs}`);
}

// Fetch confirmed R1 pick order (pre-draft placeholder slots).
// team: team abbrev filter e.g. 'CAR' — omit for all 32 teams
// Returns rows from draft_pick_order_2026 including original_team for traded picks.
// Where a team's recent draft picks came from and went -- the Worker's
// /draft/pick-history route (eyewall-pipeline's draft_history.py, from the
// NHL's own draft records). Returns { team, sinceYear, made, tradedAway }
// over the last 5 drafts, each pick carrying its pick_chain (original owner
// first, drafting team last). Not memoized client-side -- the Worker's 6hr
// KV cache is the cache. Returns null on any Worker failure.
export async function getDraftPickHistory(team = TEAM_CONFIG.abbr) {
  return workerFetch(`/draft/pick-history?team=${encodeURIComponent(team)}`);
}

export async function getDraftOrder(team = null) {
  const path = team ? `/draft/order?team=${team}` : '/draft/order';
  return workerFetch(path);
}

// ─── SCHEDULE ────────────────────────────────────────────────

// Fetch ALL CAR games for the season (regular + playoffs together)
// Short cache (20s) prevents hammering during rapid successive calls,
// but stays fresh enough to detect live game state changes.
//
// Cache key is team+season-scoped, not a bare 'allGames' -- CURRENT_SEASON
// starts at a hardcoded fallback seed and updates in place once the live
// /config/seasons fetch resolves (see teamConfig.js). A flat key meant a
// call that raced ahead of that update (common on a cold page load) cached
// the WRONG season's games under a key every later call -- even ones
// firing after CURRENT_SEASON had already self-corrected -- would keep
// hitting for the rest of this TTL window. Scoping the key by team+season
// makes a corrected season value a genuine cache miss instead of a stale
// hit, so a reactive re-fetch (see ScheduleView.jsx's useFetch calls)
// actually gets fresh data instead of the first call's mistake.
//
// `team` defaults to the user's favorite; the game view passes the team
// it's watching from (see GameTeamContext.jsx), which is someone else's
// when following another game off the Scoreboard. Same for every
// `team = TEAM_CONFIG` parameter below.
export async function getAllGames(team = TEAM_CONFIG) {
  return cached(`allGames:${team.abbr}:${team.season}`, async () => {
    // Try Worker KV first (pre-polled, zero per-user NHL calls). Key is
    // season-namespaced (Session 77 — schedule:{abbr}:{season}, not the
    // old bare schedule:{abbr}) to match the Worker's /schedule route.
    const cached_kv = await kvFetch(`schedule:${team.abbr}:${team.season}`, team);
    if (cached_kv) return cached_kv;
    // Fall back to direct NHL call
    const data = await nhlFetch(`${BASE}/club-schedule-season/${team.abbr}/${team.season}`);
    return data?.games || [];
  }, TTL.SHORT / 3); // 20 seconds client-side cache
}

// Fetch a specific team's schedule for a specific (possibly historical)
// season — the shot map's season/game history selector (Session 77).
// Unlike getAllGames() (always the live-resolved current season, via the
// KV-passthrough+direct-NHL-fallback pattern above), this hits the
// Worker's dedicated /schedule route directly, same shape as PWHL's
// fetchPWHLSchedule(teamId, season) in pwhlApi.js. That route serves
// historical seasons synchronously (single one-off upstream call, then a
// 60-day KV TTL) — see nhl.js's /schedule route comment for why that
// differs from the current-season's fire-and-forget-background pattern.
export async function getScheduleForSeason(teamAbbr, season) {
  const data = await workerFetch(`/schedule?team=${encodeURIComponent(teamAbbr)}&season=${encodeURIComponent(season)}`);
  return data || [];
}

// Regular season games only (gameType === 2)
// Cache key team+season-scoped -- see getAllGames()'s comment above.
export async function getRegularSeasonGames() {
  return cached(`regularSeasonGames:${TEAM_CONFIG.abbr}:${TEAM_CONFIG.season}`, async () => {
    const games = await getAllGames();
    return games.filter(g => g.gameType === GAME_TYPE.REGULAR);
  }, TTL.SCHEDULE);
}

// Preseason games only (gameType === 1)
// Cache key team+season-scoped -- see getAllGames()'s comment above.
export async function getPreseasonGames() {
  return cached(`preseasonGames:${TEAM_CONFIG.abbr}:${TEAM_CONFIG.season}`, async () => {
    const games = await getAllGames();
    return games.filter(g => g.gameType === GAME_TYPE.PRESEASON);
  }, TTL.SCHEDULE);
}

// Playoff games only (gameType === 3)
// Cache key team+season-scoped -- see getAllGames()'s comment above.
export async function getPlayoffGames(team = TEAM_CONFIG) {
  return cached(`playoffGames:${team.abbr}:${team.season}`, () => _getPlayoffGames(team), TTL.PLAYOFF_GAMES);
}
async function _getPlayoffGames(team) {
  const games = await getAllGames(team);
  return games.filter(g => g.gameType === GAME_TYPE.PLAYOFFS);
}

// Is training camp / preseason currently on for this team? The schedule
// already carries gameType 1 for preseason games (see GAME_TYPE above) but
// nothing in this app read it before now -- a tester flagged the roster
// ballooning during camp with no explanation why. "Preseason" here means
// "today is on/after this season's first scheduled preseason game and
// before its first regular-season game" -- covers camp announcement
// through opening night, not just game days themselves.
export async function getPreseasonInfo() {
  return cached('preseasonInfo', _getPreseasonInfo, TTL.SCHEDULE);
}
async function _getPreseasonInfo() {
  const games = await getAllGames();
  const preseasonGames = games.filter(g => g.gameType === GAME_TYPE.PRESEASON);
  if (!preseasonGames.length) return { isPreseason: false, gameCount: 0 };
  const regularGames = games.filter(g => g.gameType === GAME_TYPE.REGULAR);
  const firstRegularDate = regularGames.length
    ? regularGames.reduce((min, g) => (g.gameDate < min ? g.gameDate : min), regularGames[0].gameDate)
    : null;
  const today = new Date().toISOString().slice(0, 10);
  const isPreseason = firstRegularDate ? today < firstRegularDate : true;
  return { isPreseason, gameCount: preseasonGames.length };
}

// Upcoming games (future date, not yet played) — checks both reg + playoffs
export async function getUpcomingGames(count = 8) {
  const games = await getAllGames();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return games
    .filter(g => {
      const d = new Date(g.gameDate + 'T12:00:00');
      return d >= today && !isCompleted(g);
    })
    .slice(0, count);
}

// Recently completed games, newest first
export async function getRecentGames(count = 6, team = TEAM_CONFIG) {
  const games = await getAllGames(team);
  const today = new Date();

  return games
    .filter(g => {
      const d = new Date(g.gameDate + 'T12:00:00');
      return d < today && isCompleted(g);
    })
    .slice(-count)
    .reverse();
}

// Live game if one is in progress
// DEV: add ?mockGame=GAME_ID to URL to simulate a live game with a completed game's data
export async function getLiveGame(team = TEAM_CONFIG) {
  // ── Dev mock ─────────────────────────────────────────────────
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(window.location.search);
    const mockId = params.get('mockGame');
    if (mockId) {
      const games = await getAllGames(team);
      // Try to find it in the schedule first
      let mockGame = games.find(g => String(g.id) === String(mockId));
      // If not in schedule, fetch it directly from the NHL API
      if (!mockGame) {
        const data = await nhlFetch(`${BASE}/gamecenter/${mockId}/landing`);
        if (data) {
          mockGame = {
            id:        data.id || Number(mockId),
            gameType:  data.gameType || 2,
            gameDate:  data.gameDate || new Date().toISOString().slice(0, 10),
            gameState: 'LIVE',
            homeTeam:  data.homeTeam,
            awayTeam:  data.awayTeam,
          };
        }
      }
      if (mockGame) {
        return { ...mockGame, gameState: 'LIVE' };
      }
    }
  }
  // ── Normal live detection ─────────────────────────────────────
  const games = await getAllGames(team);
  const live = games.find(g => g.gameState === 'LIVE' || g.gameState === 'CRIT') || null;
  return holdFor(team)(live, games);
}

// See liveGameHold.js -- one live read that comes back empty or behind no
// longer drops the shot map out of live mode. One hold per team: a hold
// remembers the last live game it saw, and a single shared one would let
// a guest team's game stand in for the favorite's (or the reverse) on
// the first empty read after switching between them.
const liveGameHolds = new Map();
function holdFor(team) {
  if (!liveGameHolds.has(team.abbr)) liveGameHolds.set(team.abbr, createLiveGameHold(isCompleted));
  return liveGameHolds.get(team.abbr);
}

// Is a game finished?
export function isCompleted(game) {
  // Only trust explicit completed game states — never infer from score presence
  // (scheduled games have score=0 which falsely triggered the old fallback)
  return ['OFF', 'FINAL', 'F', 'FINAL_OVERTIME', 'FINAL_SHOOTOUT'].includes(game.gameState);
}

// ─── PLAYOFF SERIES ──────────────────────────────────────────

// One year's playoff bracket. `endYear` is the year the playoffs are
// played in -- 2027 for 20262027. The season id this used to send 404s, so
// the League tab never had a real bracket and fell back to a hardcoded one.
// Before a season's playoffs the NHL answers 200 with `series: []`.
export async function getPlayoffBracket(endYear) {
  return cached(`playoffBracket:${endYear}`, async () => {
    try {
      const res = await fetch(resolveProxyUrl(`${BASE}/playoff-bracket/${endYear}`));
      if (!res.ok) return null; // 404 expected during offseason — no log
      return await res.json();
    } catch {
      return null;
    }
  }, TTL.PLAYOFF_GAMES);
}

// Get all playoff series with results (carousel — win counts only, no game scores)
export async function getPlayoffSeries(season = TEAM_CONFIG.season) {
  return cached(`playoffSeries:${season}`, async () => {
    const data = await nhlFetch(`${BASE}/playoff-series/carousel/${season}`);
    return data?.rounds || [];
  }, TTL.PLAYOFF_GAMES);
}

/**
 * Fetch game-by-game results for one playoff series.
 *
 * Game ID formula: {seasonStart}03{round}{seriesNum}{gameNum}
 *   seriesNum = letter position in alphabet (A=1 ... O=15, never resets per round)
 *   round     = 1-4 (1=R1, 2=R2, 3=CF, 4=SCF)
 *   gameNum   = 1-7
 *
 * Returns array of normalised game objects, completed games only:
 *   { gameId, gameDate, awayAbbrev, homeAbbrev, awayScore, homeScore, periodType }
 *   periodType: 'REG' | 'OT' | 'SO'
 */
export async function getPlayoffSeriesGames(season, seriesLetter, round) {
  const cacheKey = `seriesGames:${season}:${seriesLetter}:${round}`;
  return cached(cacheKey, async () => {
    const seasonStart = String(season).slice(0, 4);
    // seriesNum is position within the round (resets to 1 each round):
    //   R1: A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8
    //   R2: I=1, J=2, K=3, L=4
    //   R3: M=1, N=2
    //   R4: O=1
    // Each round starts at a new base letter: R1=A(1), R2=I(9), R3=M(13), R4=O(15)
    const ROUND_BASE  = [0, 1, 9, 13, 15]; // index = round number
    const letterNum   = seriesLetter.toUpperCase().charCodeAt(0) - 64; // A=1
    const seriesNum   = letterNum - (ROUND_BASE[round] ?? 0) + 1;
    const COMPLETED   = ['OFF', 'FINAL', 'F', 'FINAL_OVERTIME', 'FINAL_SHOOTOUT'];

    const fetches = Array.from({ length: 7 }, (_, i) => {
      const gameNum = i + 1;
      const roundPad = String(round).padStart(2, '0');
      const gameId  = `${seasonStart}03${roundPad}${seriesNum}${gameNum}`;
      return nhlFetch(`${BASE}/gamecenter/${gameId}/landing`)
        .then(d => {
          if (!d || !COMPLETED.includes(d.gameState)) return null;
          const periodType = d.periodDescriptor?.periodType ?? 'REG';
          return {
            gameId,
            gameDate:   d.gameDate,
            awayAbbrev: d.awayTeam?.abbrev,
            homeAbbrev: d.homeTeam?.abbrev,
            awayScore:  d.awayTeam?.score ?? 0,
            homeScore:  d.homeTeam?.score ?? 0,
            periodType,
          };
        })
        .catch(() => null);
    });

    const results = await Promise.all(fetches);
    return results.filter(Boolean);
  }, TTL.PLAYOFF_GAMES);
}

// ─── LEAGUE LEADERS ──────────────────────────────────────────

// Skater scoring leaders (points) for the given season + game type.
// gameType: "2" = regular season, "3" = playoffs
export async function getScoringLeaders(season = TEAM_CONFIG.season, limit = 10, gameType = '2') {
  return cached(`scoringLeaders:${season}:${gameType}`, async () => {
    const data = await nhlFetch(`${BASE}/skater-stats-leaders/${season}/${gameType}?categories=points&limit=${limit}`);
    return data?.points ?? [];
  }, TTL.STANDINGS);
}

// Goal leaders
export async function getGoalLeaders(season = TEAM_CONFIG.season, limit = 10, gameType = '2') {
  return cached(`goalLeaders:${season}:${gameType}`, async () => {
    const data = await nhlFetch(`${BASE}/skater-stats-leaders/${season}/${gameType}?categories=goals&limit=${limit}`);
    return data?.goals ?? [];
  }, TTL.STANDINGS);
}

// Goalie leaders — category: "savePctg" or "goalsAgainstAverage"
// NOTE: the URL param must be "goalsAgainstAverage" (not "goalsAgainstAvg")
export async function getGoalieLeaders(category = 'savePctg', season = TEAM_CONFIG.season, limit = 10, gameType = '2') {
  return cached(`goalieLeaders:${category}:${season}:${gameType}`, async () => {
    const data = await nhlFetch(`${BASE}/goalie-stats-leaders/${season}/${gameType}?categories=${category}&limit=${limit}`);
    return data?.[category] ?? [];
  }, TTL.STANDINGS);
}

// Decode the playoff round from an NHL game ID.
// Format: YYYY 03 0R SGG  (10 digits, e.g. 2025030111)
//   [0-3]  season start year (2025)
//   [4-5]  game type '03' = playoffs
//   [6]    always '0'
//   [7]    round number (1=First Round, 2=Second, 3=Conf Finals, 4=SCF)
//   [8-9]  series + game number
function playoffRoundFromId(gameId) {
  if (!gameId) return null;
  const id = String(gameId);
  if (id.length === 10 && id.slice(4, 6) === '03') {
    return parseInt(id[7], 10);  // digit at index 7, not 6
  }
  return null;
}

const ROUND_LABELS = {
  1: 'First Round',
  2: 'Second Round',
  3: 'Conference Finals',
  4: 'Stanley Cup Final',
};

// Build a summary of CAR's playoff series from their game results
export function buildCarPlayoffSummary(playoffGames) {
  if (!playoffGames?.length) return [];

  // Group games by round number + opponent so we handle same opponent in different rounds
  const seriesMap = {};

  playoffGames.forEach(game => {
    const opp    = getOpponent(game);
    const oppAbbr = opp?.abbrev || 'UNK';
    const round   = playoffRoundFromId(game.id) || 0;
    const key     = `${round}-${oppAbbr}`;

    if (!seriesMap[key]) {
      seriesMap[key] = { opponent: opp, games: [], carWins: 0, oppWins: 0, round };
    }
    seriesMap[key].games.push(game);

    if (isCompleted(game)) {
      const carScore = getCarScore(game);
      const oppScore = getOppScore(game);
      if (carScore != null && oppScore != null) {
        if (carScore > oppScore) seriesMap[key].carWins++;
        else seriesMap[key].oppWins++;
      }
    }
  });

  return Object.values(seriesMap)
    .sort((a, b) => a.round - b.round)   // always in round order
    .map(s => ({
      ...s,
      roundLabel: ROUND_LABELS[s.round] || (s.round ? `Round ${s.round}` : 'Playoffs'),
      isActive:   s.carWins < 4 && s.oppWins < 4,
      carAdvance: s.carWins === 4,
      eliminated: s.oppWins === 4,
      seriesScore: `CAR ${s.carWins}–${s.oppWins} ${s.opponent?.abbrev}`,
    }));
}

// ─── STANDINGS & STATS ───────────────────────────────────────

export async function getStandings() {
  return cached('standings', _getStandings, TTL.STANDINGS);
}
async function _getStandings() {
  // Try Worker KV first
  const kv = await kvFetch('standings');
  if (kv) return kv;
  return fetchLatestStandings();
}

// The NHL's own standings when the Worker's copy is missing. That happens
// routinely, not just when the Worker is down: its 'standings' key expires
// every 5 minutes and /cache/standings 404s until the next poll refills it,
// and kvFetch() gives up after 3s on a slow cold start.
//
// This used to read fixed dates ('2026-04-18', '2026-04-17', ...) -- last
// season's finale. On 2026-10-05, with 2026-27 under way, a fresh install
// that hit that gap got CAR's 2025-26 53-22-7 record, and getTeamStats()
// (seeing a prior-season row) switched the whole Team page to 2025-26 while
// the header still said 2026-27. An hour earlier, same build, it showed
// 2026-27's 1-1-1.
//
// standings/now would give the right date, but it answers with a redirect
// (see the CORS note this replaced), so ask /standings-season instead: it
// lists every season's standings window plus today's date. The newest season
// whose standings have started is the current one in season and last season
// in the summer -- the same season standings/now resolves to -- and its
// standings as of min(today, its last day) are the latest real ones.
// Nothing hardcoded, so it doesn't go stale at the next rollover.
export async function fetchLatestStandings() {
  const data = await nhlFetch(`${BASE}/standings-season`);
  const today = data?.currentDate;
  const seasons = Array.isArray(data?.seasons) ? data.seasons : [];
  const latest = seasons
    .filter(s => s?.standingsStart && s?.standingsEnd && (!today || s.standingsStart <= today))
    .sort((a, b) => (a.standingsStart < b.standingsStart ? 1 : -1))[0];
  if (!latest) return [];
  const date = today && today < latest.standingsEnd ? today : latest.standingsEnd;
  const standings = await nhlFetch(`${BASE}/standings/${date}`);
  return standings?.standings || [];
}

/**
 * Today's NHL games, with a derived pre/live/final status. Same normalized
 * shape as fetchPWHLToday/fetchAHLToday/fetchECHLToday (pwhlApi.js/ahlApi.js/
 * echlApi.js): [{ gameId, homeTeamCode, awayTeamCode, homeScore, awayScore,
 * status }]. No client-side cache wrapper -- the Worker's own /nhl/today
 * route already sits on a 60s KV TTL, and the Scoreboard tab polls this
 * directly, so an extra cache layer here would just serve stale data
 * between poll ticks instead of a fresh fetch.
 */
// The alerts eyewall-poller sent for these teams (['NHL:CAR', 'PWHL:MIN'])
// in the last 3 days, newest first -- the notifications bell's Recent
// alerts (utils/recentAlerts.js). [] if the Worker has none or is down.
export async function getRecentAlerts(teamKeys) {
  if (!teamKeys?.length) return [];
  const data = await workerFetch(`/alerts/recent?teams=${encodeURIComponent(teamKeys.join(','))}`);
  return Array.isArray(data) ? data : [];
}

export async function getTodaysGames() {
  return (await workerFetch('/nhl/today')) || [];
}

// Get team stats, shaped consistently for our components
// gameType: 2 = regular season stats, 3 = playoff stats
export async function getTeamStats(teamAbbr = TEAM_CONFIG.abbr) {
  return cached(`teamStats:${teamAbbr}`, () => _getTeamStats(teamAbbr), TTL.TEAM_STATS);
}

// Playoff team stats — uses NHL stats REST API with gameTypeId=3
// Returns same shape as getTeamStats for drop-in use in ScoutingTab
export async function getTeamStatsPlayoff(teamAbbr = TEAM_CONFIG.abbr) {
  return cached(`teamStatsPlayoff:${teamAbbr}`, async () => {
    const rows = await fetchTeamSummaryRows(3, TEAM_CONFIG.season).catch(() => []);
    const team = findTeamSummaryRow(rows, teamAbbr);
    if (!team) return null;
    // A field the endpoint leaves out is null (shown as "—"), not 0.
    return {
      gamesPlayed:         team.gamesPlayed          ?? 0,
      wins:                team.wins                ?? 0,
      losses:              team.losses              ?? 0,
      goalsForPerGame:     team.goalsForPerGame      ?? null,
      goalsAgainstPerGame: team.goalsAgainstPerGame  ?? null,
      // PP/PK already 0–1 scale in this endpoint
      powerPlayPct:        team.powerPlayPct         ?? null,
      penaltyKillPct:      team.penaltyKillPct       ?? null,
      shotsForPerGame:     team.shotsForPerGame       ?? null,
      shotsAgainstPerGame: team.shotsAgainstPerGame   ?? null,
      faceoffWinPct:       team.faceoffWinPct         ?? null,
      _raw: team,
    };
  }, TTL.TEAM_STATS);
}
// /standings/now carries record/goals only -- no PP%, PK%, shots or
// faceoffs. Those come from team/summary (the same REST endpoint
// getTeamStatsPlayoff() uses, gameTypeId=2 here), for the season the
// standings row actually belongs to. Before this, PP/PK/shots silently fell
// through to hardcoded league-average defaults for every team.
// Best-effort: a failed fetch or unmatched team returns null rather than
// failing the whole getTeamStats() call.
async function fetchTeamSummaryRow(standingsRow, teamAbbr, season) {
  const rows = await fetchTeamSummaryRows(2, season);
  return findTeamSummaryRow(rows, teamAbbr, standingsRow.teamName?.default);
}

// Every team's row in the NHL stats REST team/summary for one season and
// game type (2 regular, 3 playoffs). Shared by the Team page (stats, rank
// badges, playoff scouting) and League > Power rankings (PP%/PK%). Rows
// carry teamId but no abbreviation -- match with findTeamSummaryRow().
// Throws when the request fails; callers decide what "unavailable" means.
function fetchTeamSummaryRows(gameTypeId, season) {
  return cached(`teamSummaryRows:${gameTypeId}:${season}`, async () => {
    const exp = encodeURIComponent(`gameTypeId=${gameTypeId} and seasonId<=${season} and seasonId>=${season}`);
    const url = `/nhl-stats/stats/rest/en/team/summary?isAggregate=false&isGame=false&sort=shotsForPerGame&sortDirection=DESC&limit=40&cayenneExp=${exp}`;
    const data = await nhlFetch(url);
    if (!data) throw new Error('team/summary unavailable');
    return data.data || [];
  }, TTL.TEAM_STATS);
}

// Each team's PP% and PK% (0-1) for a season's regular season, keyed by
// abbreviation, from team/summary -- standings carry neither, which left
// the Power rankings' Special Teams component at 0 for every team (audit
// 2026-10-05 #25). A team the NHL has no number for is left out (null),
// never 0. {} when team/summary can't be reached.
export async function getTeamSpecialTeams(season = TEAM_CONFIG.season, gameTypeId = 2) {
  const rows = await fetchTeamSummaryRows(gameTypeId, season).catch(() => []);
  const out = {};
  for (const team of ALL_TEAMS) {
    const row = findTeamSummaryRow(rows, team.abbr);
    if (!row) continue;
    out[team.abbr] = {
      ppPct: row.powerPlayPct ?? null,
      pkPct: row.penaltyKillPct ?? null,
    };
  }
  return out;
}

async function _getTeamStats(teamAbbr = TEAM_CONFIG.abbr) {
  const standings = await getStandings();
  const team = standings.find(t => t.teamAbbrev?.default === teamAbbr);

  // No standings row, no stats: callers show an "unavailable" state. This
  // used to return a hardcoded 54-20-8 record with invented rates, which
  // every team rendered as its own whenever standings failed to load.
  if (!team) {
    console.warn(`Could not find ${teamAbbr} in standings; team stats unavailable`);
    return null;
  }

  // The NHL's own /standings/now redirects to whatever date it last
  // resolved standings for, independent of our app's season config — it
  // stays pinned to last season's finale for months until real games exist
  // for the new one. Each row carries its own seasonId; a mismatch here
  // means `team` is a genuine, real, but STALE full prior season, not
  // "this season's data".
  //
  // Previously returned null here (distinct from "not found"), reasoning
  // that silently feeding a full 82-game record into "this season's"
  // stats would be worse than showing nothing. That reasoning was right
  // about not mislabeling it -- but wrong about the alternative: once
  // TEAM_CONFIG.season itself is resolved ahead of live standings data
  // (see eyewall-poller's nextSeasonHasImminentSchedule, added so
  // schedule/roster UI can show the new season once camp is imminent,
  // not just once real games exist), this mismatch became the EXPECTED
  // state for the first few weeks of every new season, not a rare edge
  // case -- and returning null broke the whole stat-comparison section
  // AND silently starved ScoutingShareCanvas of the props it needs to
  // attach its ref (see ScoutingTab.jsx), breaking the Share button too.
  // Real last-season numbers, clearly tagged, is strictly more useful
  // than nothing -- same "carry forward the last known-good real data,
  // labeled" pattern already used for line combinations
  // (eyewall-pipeline's line_combinations.py prior-season blend) and for
  // this app's own isStatic/isInferred line-data flags. Callers that
  // need to react to it (a "last season" badge, primarily) check
  // isPriorSeason; callers that don't can use these numbers exactly as
  // before -- the field shape is unchanged.
  // Reuses the same explicit-mismatch-only rule ScheduleView/TeamView/
  // LeagueView/PlayersView already apply via isStandingsStale() against
  // the full standings array -- same check, just against the one row
  // already found here rather than re-deriving it inline.
  const isPriorSeason = isStandingsStale([team], TEAM_CONFIG.season);

  const gp = team.gamesPlayed ?? 0;
  const statsSeasonId = team.seasonId != null ? String(team.seasonId) : TEAM_CONFIG.season;
  const summary = await fetchTeamSummaryRow(team, teamAbbr, statsSeasonId).catch(() => null);
  const perGame = total => (total != null && gp > 0 ? total / gp : null);
  const pct100 = v => (v != null ? v / 100 : null);

  // Field name notes for NHL API standings:
  //   goalFor / goalAgainst = season totals (not per-game averages)
  //   powerPlayPct / penaltyKillPct = 0–100 scale (e.g. 23.5 = 23.5%)
  // A rate neither team/summary nor standings carries is null, never a
  // made-up league-average default.
  return {
    gamesPlayed:         gp,
    wins:                team.wins         ?? 0,
    losses:              team.losses       ?? 0,
    otLosses:            team.otLosses     ?? 0,
    points:              team.points       ?? 0,
    // team/summary's rates match the league's official GF/GP (standings'
    // goalFor counts a shootout win as a goal) and what the rank badges use.
    goalsForPerGame:     summary?.goalsForPerGame     ?? perGame(team.goalFor),
    goalsAgainstPerGame: summary?.goalsAgainstPerGame ?? perGame(team.goalAgainst),
    // team/summary first (0-1 scale); the standings fields below are only
    // reached if that fetch fails.
    powerPlayPct:        summary?.powerPlayPct   ?? pct100(team.powerPlayPct),
    penaltyKillPct:      summary?.penaltyKillPct ?? pct100(team.penaltyKillPct),
    shotsForPerGame:     summary?.shotsForPerGame     ?? team.shotsForPerGame     ?? null,
    shotsAgainstPerGame: summary?.shotsAgainstPerGame ?? team.shotsAgainstPerGame ?? null,
    blockedShotsPerGame: perGame(team.blockedShots),
    faceoffWinPct:       summary?.faceoffWinPct ?? null,
    divisionName:        team.divisionName,
    conferenceName:      team.conferenceName,
    streakCode:          team.streakCode,
    streakCount:         team.streakCount,
    isPriorSeason,
    statsSeasonId,
    _raw: team,
  };
}

// ─── TEAM SEASON RANKINGS ────────────────────────────────────
// Returns CAR's league rank (1 = best) for key stats.
// gameTypeId: 2 = regular season, 3 = playoffs
// season: rank within this season -- pass getTeamStats()'s statsSeasonId so
// the ranks describe the same season as the numbers beside them. Early in a
// new season getTeamStats() carries last season forward (isPriorSeason)
// while team/summary for TEAM_CONFIG.season is still empty, which left every
// stat card with no rank at all.
// team: the team to rank (default the selected team). Matched by team id
// (findTeamSummaryRow) -- the old name-fragment match never found NYI, NYR
// or SJS, so their Overview cards had no rank badges.
export async function getTeamSeasonRankings(gameTypeId = 2, season = TEAM_CONFIG.season, team = TEAM_CONFIG) {
  return cached(`teamSeasonRankings:${team.abbr}:${gameTypeId}:${season}`, () => _getTeamSeasonRankings(gameTypeId, season, team), TTL.TEAM_STATS);
}
async function _getTeamSeasonRankings(gameTypeId, season, team) {
  try {
    const teams = await fetchTeamSummaryRows(gameTypeId, season);
    if (!teams.length) return null;

    const mine = findTeamSummaryRow(teams, team.abbr);
    if (!mine) return null;

    // Rank helper — 1 = best: one plus the teams strictly better, so tied
    // teams share a rank (two teams at the same PP% used to get different
    // ranks from whichever order the endpoint listed them in).
    const rank = (field, higherBetter = true) => {
      const v = mine[field];
      if (v == null) return null;
      return 1 + teams.filter(t => t[field] != null && (higherBetter ? t[field] > v : t[field] < v)).length;
    };

    return {
      teamCount:       teams.length,  // the field each rank is out of (RankBadge's colour tiers)
      goalsForPG:      rank('goalsForPerGame',     true),
      goalsAgainstPG:  rank('goalsAgainstPerGame', false),  // lower = better
      ppPct:           rank('powerPlayPct',         true),
      pkPct:           rank('penaltyKillPct',       true),
      shotsForPG:      rank('shotsForPerGame',      true),
      shotsAgainstPG:  rank('shotsAgainstPerGame',  false), // lower = better
    };
  } catch (e) {
    console.warn('getTeamSeasonRankings failed:', e.message);
    return null;
  }
}

// ─── SEASON-OVER-SEASON TEAM COMPARISON (Session 64) ───────────
// Box-score fields only -- see eyewall-poller's /team-seasons/compare for
// why (xgf_pct/roster_war_score are null across every season right now).
// Not cached via cache.js's TTL layer like most of this file -- comparison
// season lists are user-picked and vary per call, so there's no stable
// cache key worth the complexity; the Worker's own KV cache (1hr) already
// covers repeat requests for the same team+season combination.
export async function fetchTeamSeasonsCompare(team, seasons) {
  if (!seasons?.length) return [];
  const rows = await workerFetch(`/team-seasons/compare?team=${encodeURIComponent(team)}&seasons=${seasons.join(',')}`);
  // null when the request failed -- unknown, not "no seasons".
  if (!rows) return null;
  return rows.map(r => ({
    season:        r.season,
    gamesPlayed:   r.games_played,
    wins:          r.wins,
    losses:        r.losses,
    otLosses:      r.ot_losses,
    points:        r.points,
    goalsFor:      r.goals_for,
    goalsAgainst:  r.goals_against,
    ppPct:         r.pp_pct,
    pkPct:         r.pk_pct,
  }));
}

// ─── TEAM vs TEAM COMPARISON (Session 86) ───────────
// Two teams, one season -- mirrors fetchTeamSeasonsCompare's shape but
// keyed by team instead of season, backed by /team-seasons/compare-teams.
export async function fetchTeamSeasonsCompareTeams(teamA, teamB, season) {
  if (!teamA || !teamB || !season) return [];
  const rows = await workerFetch(`/team-seasons/compare-teams?teams=${encodeURIComponent(teamA)},${encodeURIComponent(teamB)}&season=${season}`);
  if (!rows) return [];
  return rows.map(r => ({
    team:          r.team,
    season:        r.season,
    gamesPlayed:   r.games_played,
    wins:          r.wins,
    losses:        r.losses,
    otLosses:      r.ot_losses,
    points:        r.points,
    goalsFor:      r.goals_for,
    goalsAgainst:  r.goals_against,
    ppPct:         r.pp_pct,
    pkPct:         r.pk_pct,
  }));
}

// ─── HEAD-TO-HEAD (Session 88) ───────────
// All-time record/streak/recent-window between two teams, across every
// season on record. Backed by /team-seasons/head-to-head, which already
// returns a clean camelCase shape (record/streak/window computed
// server-side so there's one definition shared with PWHL) -- no
// snake_case remapping needed here, unlike this file's other fetchers.
export async function fetchTeamHeadToHead(teamA, teamB) {
  if (!teamA || !teamB) return null;
  return workerFetch(`/team-seasons/head-to-head?teams=${encodeURIComponent(teamA)},${encodeURIComponent(teamB)}`);
}

export async function getTeamSkaterStats(gameTypeId = 2) {
  return cached(`teamSkaterStats:${gameTypeId}`, () => _getTeamSkaterStats(gameTypeId), TTL.PLAYER_STATS);
}
async function _getTeamSkaterStats(gameTypeId = 2) {
  const exp    = encodeURIComponent(`seasonId=${TEAM_CONFIG.season} and gameTypeId=${gameTypeId} and teamAbbrevs="${TEAM_CONFIG.abbr}"`);
  const sort   = encodeURIComponent(JSON.stringify([{property:'points',direction:'DESC'},{property:'goals',direction:'DESC'},{property:'playerId',direction:'ASC'}]));

  const [summary, scoring] = await Promise.all([
    nhlFetch(`/nhl-stats/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=${sort}&start=0&limit=100&cayenneExp=${exp}`),
    nhlFetch(`/nhl-stats/stats/rest/en/skater/scoringpergame?isAggregate=false&isGame=false&sort=${sort}&start=0&limit=100&cayenneExp=${exp}`),
  ]);

  const scoringMap = {};
  (scoring?.data || []).forEach(p => { scoringMap[p.playerId] = p; });

  return (summary?.data || []).map(p => ({
    ...p,
    primaryAssists:   scoringMap[p.playerId]?.totalPrimaryAssists   ?? null,
    secondaryAssists: scoringMap[p.playerId]?.totalSecondaryAssists ?? null,
  }));
}


export async function getRoster(teamAbbr = TEAM_CONFIG.abbr) {
  return cached(`roster:${teamAbbr}`, () => _getRoster(teamAbbr), TTL.SCHEDULE);
}
async function _getRoster(teamAbbr = TEAM_CONFIG.abbr) {
  // NOTE: intentionally NOT /roster/{team}/{season} — that endpoint returns a
  // frozen snapshot of who was on the roster during that specific season, so
  // players who change teams via trade/UFA signing never show up for their
  // new team until that season's roster actually gets populated (which can
  // lag well into the following season). /current is season-agnostic and
  // reflects the real active roster as of today.
  //
  // Worker's /roster route first (added 2026-09, KV-cached 1hr server-side)
  // -- this call used to hit NHL directly with zero caching anywhere in the
  // chain, unlike getAllGames()/getStandings() below, which both check the
  // Worker first. Every Players-view page load was a genuinely fresh live
  // fetch, the root cause of repeated Cypress flakiness against a real,
  // uncached third-party API. Falls back to the direct NHL call if the
  // Worker itself is unreachable, matching this file's general resilience
  // pattern elsewhere (see kvFetch/workerFetch's own null-on-failure
  // contract) -- this is a route the Worker fetches-and-caches on a miss
  // itself (unlike kvFetch's plain KV-passthrough shape), so a single call
  // here is enough; no separate "check cache, else fetch direct" split.
  const data = await workerFetch(`/roster?team=${encodeURIComponent(teamAbbr)}`)
    || await nhlFetch(`${BASE}/roster/${teamAbbr}/current`);
  if (!data) return { forwards: [], defensemen: [], goalies: [], all: [] };

  const forwards   = data.forwards   || [];
  const defensemen = data.defensemen || [];
  const goalies    = data.goalies    || [];
  return { forwards, defensemen, goalies, all: [...forwards, ...defensemen, ...goalies] };
}

// Per-player scratch summary for one team-season -- the Worker's /scratches
// route, backed by eyewall-pipeline's nightly scratches.py (the NHL's own
// right-rail scratch lists, each classified healthy/injured/suspended/
// unknown against that day's injury report). gameType 2 = regular season
// (default), 3 = playoffs. With no games yet this season the Worker falls
// back to last season and sets `stale`. Not memoized client-side -- the
// Worker's 1hr KV cache is the cache. Returns null on any Worker failure.
export async function getTeamScratches(teamAbbr = TEAM_CONFIG.abbr, gameType = 2) {
  return workerFetch(`/scratches?team=${encodeURIComponent(teamAbbr)}&gameType=${gameType}`);
}

// Simulated playoff odds for one team -- the Worker's /playoff-odds route,
// backed by eyewall-pipeline's nightly playoff_odds.py (the rest of the
// regular season simulated from team Elo ratings). Returns { team, season,
// runDate, stale, latest, history, nextGames }: latest is null before the
// season's first run, `stale` means no run for a few days (season over),
// `unavailable` means the Worker's own read failed. Not memoized
// client-side -- the Worker's 1hr KV cache is the cache. Returns null on
// any Worker failure.
export async function getPlayoffOdds(teamAbbr = TEAM_CONFIG.abbr) {
  return workerFetch(`/playoff-odds?team=${encodeURIComponent(teamAbbr)}`);
}

// Season-to-date man-games and WAR lost to injury for one team -- the
// Worker's /injury-impact route, backed by eyewall-pipeline's nightly
// injury_impact.py (a player on the day's injury report who didn't dress,
// valued at his WAR per game). Returns { team, season, impact, league }:
// impact is null before the 2026-27 regular season's first game (injury
// history starts 2026-09-12), `unavailable` means the Worker's own read
// failed. Not memoized client-side -- the Worker's 1hr KV cache is the
// cache. Returns null on any Worker failure.
// Call-up watch: who's out on the NHL team by position group and the AHL
// affiliate's players next in line (Worker /nhl/callup-watch, a ranking
// from real stats -- not a probability). `ahlTeamId` is the affiliate's
// HockeyTech id (teamHistory.js affiliates -> ahlConfig.js). Null on any
// failure; the Worker's 1hr KV cache is the cache.
export async function getCallupWatch(teamAbbr, ahlTeamId) {
  if (!teamAbbr || !ahlTeamId) return null;
  return workerFetch(`/nhl/callup-watch?team=${encodeURIComponent(teamAbbr)}&ahlTeamId=${ahlTeamId}`);
}

export async function getInjuryImpact(teamAbbr = TEAM_CONFIG.abbr) {
  return workerFetch(`/injury-impact?team=${encodeURIComponent(teamAbbr)}`);
}

// Probable starting goalies for one game -- the Worker's /probable-starters
// route, backed by eyewall-pipeline's nightly starting_goalie.py (each
// team's next regular-season game once it's within 2 days). Returns
// { gameId, gameDate, runDate, teams: { ABBR: [{ goalie_id, goalie_name,
// start_prob, factors }] } } -- teams is {} until the game is inside that
// window; `unavailable` means the Worker's own read failed. Not memoized
// client-side -- the Worker's 1hr KV cache is the cache. Returns null on any
// Worker failure.
export async function getProbableStarters(gameId) {
  return workerFetch(`/probable-starters?game=${encodeURIComponent(gameId)}`);
}

// Projected lines for a team's next game -- the Worker's /projected-lines
// route, backed by eyewall-pipeline's nightly projected_lines.py (last game's
// pairings in-season, pooled preseason pairings before the team's first
// game). Returns { team, basis: 'last_game' | 'preseason' | null, basisGameId,
// basisGames, generatedAt, lines, pairs } -- units of { rank, players: [{ id,
// name, pos, filled }] }; basis null = no projection yet. Not memoized
// client-side -- the Worker's 1hr KV cache is the cache. Returns null on any
// Worker failure.
export async function getProjectedLines(teamAbbr = TEAM_CONFIG.abbr) {
  return workerFetch(`/projected-lines?team=${encodeURIComponent(teamAbbr)}`);
}

// The public prediction scorecard -- the Worker's /scorecard route, backed by
// eyewall-pipeline's nightly prediction_scorecard.py. Returns { models:
// { game_winner | starting_goalie | playoff_odds: { live, backtest } },
// updatedAt }: live rows are 'pending' until something's been graded;
// `unavailable` means the Worker's own read failed. Not memoized client-side
// -- the Worker's 1hr KV cache is the cache. Returns null on any Worker failure.
export async function getScorecard() {
  return workerFetch('/scorecard');
}

// Every team's Elo rating + the home advantage -- the Worker's /elo/ratings
// route. Feed it to utils/eloWinProb.js's teamWinPct() for the game
// preview's win bar and the schedule's chips: the same formula the Worker's
// /prediction/analyze and eyewall-pipeline's win_probs.py use, so what the
// app shows is what the public scorecard grades. Memoized for a few minutes
// so the schedule and every preview share one fetch. Null on Worker failure.
export async function getEloRatings() {
  return cached('eloRatings', () => workerFetch('/elo/ratings'), TTL.STANDINGS);
}

// NHL transactions feed -- the Worker's /transactions route, backed by
// eyewall-pipeline's nightly ESPN ingestion (transactions.py). The Worker
// already pairs each trade's two per-team halves into one { kind: 'trade' }
// item. Not memoized client-side, same as PWHL's fetchPWHLTransactions: the
// Worker's own 1hr KV cache is the cache, and the feed's refresh button
// should genuinely refetch. Returns null on any Worker failure.
export async function getTransactions(scope = 'team', teamAbbr = TEAM_CONFIG.abbr) {
  return workerFetch(scope === 'league'
    ? '/transactions?scope=league'
    : `/transactions?team=${encodeURIComponent(teamAbbr)}`);
}

// One trade and where every asset went next -- the Worker's /trades/tree
// route, backed by eyewall-pipeline's nightly trade_trees.py. `txId` is any
// row id from getTransactions()' items (a trade's ids[0], or a move's id).
// Returns { found, root, trades: { id: { date, teams, sides: [{ team,
// received: [asset] }] } }, origins, truncated }; `unavailable` means the
// Worker's own read failed.
export async function getTradeTree(txId) {
  return workerFetch(`/trades/tree?tx=${encodeURIComponent(txId)}`);
}

export async function getTeamInjuries(teamAbbr = TEAM_CONFIG.abbr) {
  return cached(`injuries:${teamAbbr}`, () => _getTeamInjuries(teamAbbr), TTL.SCHEDULE);
}
async function _getTeamInjuries(teamAbbr = TEAM_CONFIG.abbr) {
  // NHL has no official injuries endpoint -- eyewall-pipeline's injuries.py
  // ingests nightly from ESPN's undocumented API into Supabase's
  // player_injuries table, and the Worker's /injuries route (KV-cached 1hr
  // server-side) serves it. Same shape as getRoster above: the Worker
  // fetches-and-caches on its own, so a single call here is enough. No
  // direct-fetch fallback exists (unlike getRoster/getAllGames) -- there is
  // no third-party endpoint to fall back to, so degrade to [] on any
  // Worker failure rather than throwing.
  const data = await workerFetch(`/injuries?team=${encodeURIComponent(teamAbbr)}`);
  return data || [];
}

// Normalize a player name for injury-status matching against
// line-combination data (which only carries names, no playerId) --
// mirrors eyewall-pipeline's injuries.py normalize_name(): lowercase,
// strip diacritics, drop punctuation, collapse whitespace.
function normalizePlayerName(name) {
  return (name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Build a lookup from getTeamInjuries() rows, keyed both by playerId (set
// server-side when injuries.py matched the ESPN row to a real roster
// player) and by normalized name (fallback for consumers like
// getTeamLines() that only carry names, no playerId).
export function buildInjuryIndex(rows) {
  const byId = new Map();
  const byName = new Map();
  for (const row of rows || []) {
    if (row.player_id != null) byId.set(String(row.player_id), row);
    const key = normalizePlayerName(row.player_name);
    if (key) byName.set(key, row);
  }
  return {
    forPlayer(playerId, name) {
      return (playerId != null && byId.get(String(playerId)))
        || (name && byName.get(normalizePlayerName(name)))
        || null;
    },
  };
}

export async function getProspects(teamAbbr = TEAM_CONFIG.abbr) {
  return cached(`prospects:${teamAbbr}`, () => _getProspects(teamAbbr), TTL.SCHEDULE);
}
async function _getProspects(teamAbbr = TEAM_CONFIG.abbr) {
  // Not season-scoped -- this is the team's current prospect pool (signed
  // but not on the active NHL roster), a different concept from both the
  // active roster (getRoster, above) and draft-eligible rankings.
  const data = await nhlFetch(`${BASE}/prospects/${teamAbbr}`);
  if (!data) return { forwards: [], defensemen: [], goalies: [], all: [] };

  const forwards   = data.forwards   || [];
  const defensemen = data.defensemen || [];
  const goalies    = data.goalies    || [];
  return { forwards, defensemen, goalies, all: [...forwards, ...defensemen, ...goalies] };
}

export async function getHistoricalRoster(teamAbbr, season) {
  return cached(`roster:${teamAbbr}:${season}`, () => _getHistoricalRoster(teamAbbr, season), TTL.SCHEDULE);
}
async function _getHistoricalRoster(teamAbbr, season) {
  // Unlike getRoster (above), THIS is the right endpoint for a genuinely
  // historical season -- it's frozen data by definition, so the /current
  // endpoint's trade/UFA-lag concern doesn't apply here.
  const data = await nhlFetch(`${BASE}/roster/${teamAbbr}/${season}`);
  if (!data) return { forwards: [], defensemen: [], goalies: [], all: [] };

  const forwards   = data.forwards   || [];
  const defensemen = data.defensemen || [];
  const goalies    = data.goalies    || [];
  return { forwards, defensemen, goalies, all: [...forwards, ...defensemen, ...goalies] };
}

export async function getPlayerStats(playerId) {
  return cached(`playerStats:${playerId}`, () => _getPlayerStats(playerId), TTL.PLAYER_STATS);
}
async function _getPlayerStats(playerId) {
  return await nhlFetch(`${BASE}/player/${playerId}/landing`);
}

// Per-game log for one player/season/gameType (Session 70 — player Compare
// tab trend charts). Same proxy + shape family as getPlayerStats above, just
// a different NHL API path. Response shape: { gameLog: [{ gameId, goals,
// assists, points, plusMinus, powerPlayGoals, powerPlayPoints,
// shorthandedGoals, gameWinningGoals, shots, pim, toi, ... }] } for skaters,
// or { gameLog: [{ decision, shotsAgainst, goalsAgainst, savePctg,
// shutouts, gamesStarted, toi, ... }] } for goalies — same endpoint serves
// both, shape just differs by the player's real position. Returns null (not
// []) on failure, same as every other nhlFetch call here — callers already
// handle that via optional chaining.
export async function getPlayerGameLog(playerId, season, gameTypeId = GAME_TYPE.REGULAR) {
  return cached(
    `playerGameLog:${playerId}:${season}:${gameTypeId}`,
    () => _getPlayerGameLog(playerId, season, gameTypeId),
    TTL.PLAYER_STATS
  );
}
async function _getPlayerGameLog(playerId, season, gameTypeId) {
  return await nhlFetch(`${BASE}/player/${playerId}/game-log/${season}/${gameTypeId}`);
}

// Fetch league-wide skater stats sorted by points.
// limit=-1 returns ALL results (no pagination needed).
// Proxied through /nhl-stats → https://api.nhle.com
async function fetchSkaterLeaders(gameTypeId = 2) {
  const sort   = encodeURIComponent(JSON.stringify([
    { property: 'points',   direction: 'DESC' },
    { property: 'goals',    direction: 'DESC' },
    { property: 'playerId', direction: 'ASC'  },
  ]));
  const exp = encodeURIComponent(`seasonId=${TEAM_CONFIG.season} and gameTypeId=${gameTypeId}`);
  // limit=-1 returns all players in one call — no pagination required
  const url = `/nhl-stats/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=${sort}&start=0&limit=-1&cayenneExp=${exp}`;
  return await nhlFetch(url);
}

async function fetchGoalieLeaders(_gameTypeId = 2) {
  // Goalie endpoint only accepts seasonId in cayenneExp (not gameTypeId).
  // We fetch the regular season data (gameTypeId=2 is the default/only accepted).
  // For playoff ranking we still use the reg season leaderboard as context —
  // playoff goalie samples are too small for meaningful rank comparisons.
  const exp = encodeURIComponent(`seasonId=${TEAM_CONFIG.season} and gameTypeId=2`);
  const url = `/nhl-stats/stats/rest/en/goalie/summary?limit=100&sort=wins&cayenneExp=${exp}`;
  const data = await nhlFetch(url);
  // Sort client-side by savePctg descending for SV%-based ranking
  if (data?.data?.length) {
    data.data.sort((a, b) => (b.savePctg ?? 0) - (a.savePctg ?? 0));
  }
  return data;
}

// Compute division, conference, league rank for a player.
// teamInfo should have { divisionAbbrev, conferenceAbbrev } from standings.
export async function fetchPlayerRankings(playerId, isGoalie, isPlayoffs, teamAbbrev, standings) {
  const key = `rankings:${playerId}:${isGoalie}:${isPlayoffs}`;
  return cached(key, () => _fetchPlayerRankings(playerId, isGoalie, isPlayoffs, teamAbbrev, standings), TTL.RANKINGS);
}
async function _fetchPlayerRankings(playerId, isGoalie, isPlayoffs, teamAbbrev, standings) {
  const gameTypeId = isPlayoffs ? 3 : 2;
  const statLabel  = isGoalie ? 'SV%' : 'points';

  // Get team's division/conference from standings
  const teamStanding = standings?.find(t =>
    (t.teamAbbrev?.default || t.teamAbbrev) === teamAbbrev
  );
  const divAbbrev  = teamStanding?.divisionAbbrev || null;
  const confAbbrev = teamStanding?.conferenceName  || null;

  // Fetch the sorted leaderboard
  // Use a high limit — regular season has 800+ skaters with stats
  const data = isGoalie
    ? await fetchGoalieLeaders(gameTypeId)
    : await fetchSkaterLeaders(gameTypeId);

  const players = data?.data || [];
  if (!players.length) return null;

  // IMPORTANT: coerce both IDs to Number for comparison.
  // The roster gives string IDs; the stats/rest API returns numeric IDs.
  const pid = Number(playerId);
  const leagueIdx = players.findIndex(p => Number(p.playerId) === pid);

  // If not found, player may not have stats this season — return null
  if (leagueIdx === -1) return null;
  const leagueRank = leagueIdx + 1;

  // Division rank
  const divTeams = (standings || [])
    .filter(t => t.divisionAbbrev === divAbbrev)
    .map(t => t.teamAbbrev?.default || t.teamAbbrev)
    .filter(Boolean);

  const divPlayers = players.filter(p => {
    const abbrevs = String(p.teamAbbrevs || '').split(',').map(a => a.trim());
    return abbrevs.some(a => divTeams.includes(a));
  });
  const divIdx  = divPlayers.findIndex(p => Number(p.playerId) === pid);
  const divRank = divIdx >= 0 ? divIdx + 1 : null;

  // Conference rank
  const confTeams = (standings || [])
    .filter(t => t.conferenceName === confAbbrev)
    .map(t => t.teamAbbrev?.default || t.teamAbbrev)
    .filter(Boolean);

  const confPlayers = players.filter(p => {
    const abbrevs = String(p.teamAbbrevs || '').split(',').map(a => a.trim());
    return abbrevs.some(a => confTeams.includes(a));
  });
  const confIdx  = confPlayers.findIndex(p => Number(p.playerId) === pid);
  const confRank = confIdx >= 0 ? confIdx + 1 : null;

  if (!isGoalie) {
    return { league: leagueRank, division: divRank, conference: confRank, statLabel };
  }

  // For goalies: also compute GAA rank (lower = better, so reverse sort)
  const gaaPlayers = [...players].sort((a, b) => (a.goalsAgainstAverage ?? 99) - (b.goalsAgainstAverage ?? 99));
  const gaaLeagueIdx  = gaaPlayers.findIndex(p => Number(p.playerId) === pid);
  const gaaLeagueRank = gaaLeagueIdx >= 0 ? gaaLeagueIdx + 1 : null;

  const gaaDivPlayers = gaaPlayers.filter(p => {
    const abbrevs = String(p.teamAbbrevs || '').split(',').map(a => a.trim());
    return abbrevs.some(a => divTeams.includes(a));
  });
  const gaaDivIdx  = gaaDivPlayers.findIndex(p => Number(p.playerId) === pid);
  const gaaDivRank = gaaDivIdx >= 0 ? gaaDivIdx + 1 : null;

  const gaaConfPlayers = gaaPlayers.filter(p => {
    const abbrevs = String(p.teamAbbrevs || '').split(',').map(a => a.trim());
    return abbrevs.some(a => confTeams.includes(a));
  });
  const gaaConfIdx  = gaaConfPlayers.findIndex(p => Number(p.playerId) === pid);
  const gaaConfRank = gaaConfIdx >= 0 ? gaaConfIdx + 1 : null;

  return {
    league: leagueRank, division: divRank, conference: confRank,
    statLabel,
    gaa: { league: gaaLeagueRank, division: gaaDivRank, conference: gaaConfRank },
  };
}

// Keep extractRankings as a no-op shim — replaced by fetchPlayerRankings above
export function extractRankings() { return null; }

// ─── GAME DETAIL / SHOT EVENTS ───────────────────────────────

export async function getGameDetail(gameId) {
  return cached(`pbp:${gameId}`, async () => {
    // Try Worker KV first
    const kv = await kvFetch(`pbp:${gameId}`);
    if (kv) return kv;
    return nhlFetch(`${BASE}/gamecenter/${gameId}/play-by-play`);
  }, TTL.GAME_DATA);
}

// Call this to force-refresh live game data (bypasses cache)
export function bustLiveGameCache(gameId, team = TEAM_CONFIG) {
  invalidate(`pbp:${gameId}`);
  invalidate(`boxscore:${gameId}`);
  bustScheduleCache(team);
}

// Next getAllGames()/getLiveGame() reads the Worker again, not the 20s
// in-memory copy -- for a re-check that has to see a game that just went live.
export function bustScheduleCache(team = TEAM_CONFIG) {
  // getAllGames()'s real key -- this used to invalidate a bare 'allGames',
  // which nothing has been stored under since that key became team+season
  // scoped, so it was a silent no-op.
  invalidate(`allGames:${team.abbr}:${team.season}`);
}

export async function getGameLanding(gameId) {
  return cached(`landing:${gameId}`, async () => {
    const kv = await kvFetch(`landing:${gameId}`);
    if (kv) return kv;
    return nhlFetch(`${BASE}/gamecenter/${gameId}/landing`);
  }, TTL.GAME_DATA);
}

// Boxscore: player stats by game (goals, assists, shots, TOI, +/-, etc.)
// Returns playerByGameStats.homeTeam/awayTeam.forwards/defensemen/goalies
export async function getGameBoxscore(gameId) {
  return cached(`boxscore:${gameId}`, async () => {
    const kv = await kvFetch(`boxscore:${gameId}`);
    if (kv) return kv;
    return nhlFetch(`${BASE}/gamecenter/${gameId}/boxscore`);
  }, TTL.GAME_DATA);
}

// Right-rail: team-level game stats (shots, hits, faceoffs, PPs, etc.)
export async function getGameRightRail(gameId) {
  return cached(`rightRail:${gameId}`, () => nhlFetch(`${BASE}/gamecenter/${gameId}/right-rail`), TTL.GAME_DATA);
}

// Fetch completed game stats — uses landing as primary, with parallel fallbacks.
// The landing endpoint layout varies by game; we search all known locations.
export async function getCompletedGameStats(gameId) {
  return cached(`completedStats:${gameId}`, () => _getCompletedGameStats(gameId), TTL.GAME_DATA);
}
async function _getCompletedGameStats(gameId) {
  // Fetch all four in parallel — landing is richest, PBP needed for Corsi/Fenwick/PDO
  const [landing, boxscore, rightRail, pbp] = await Promise.all([
    getGameLanding(gameId),
    getGameBoxscore(gameId),
    getGameRightRail(gameId),
    getGameDetail(gameId),
  ]);

  // Prefer boxscore for playerByGameStats — landing only includes notable/scoring players
  // Boxscore has all skaters with full stats
  const pbg =
    boxscore?.playerByGameStats           ||
    landing?.boxscore?.playerByGameStats  ||
    landing?.playerByGameStats            || null;

  const teamGameStats =
    landing?.teamGameStats                    ||
    landing?.boxscore?.teamGameStats          ||
    rightRail?.teamGameStats                  ||
    boxscore?.teamGameStats                   || [];

  const summary =
    landing?.summary ||
    boxscore?.summary || null;

  return {
    boxscore: {
      summary,
      playerByGameStats: pbg,
      linescore: landing?.boxscore?.linescore || boxscore?.linescore,
    },
    rightRail:  { teamGameStats, gameInfo: rightRail?.gameInfo || null },
    pbp,        // play-by-play — used for Corsi/Fenwick/PDO/PuckLuck
    homeTeamId: landing?.homeTeam?.id || pbp?.homeTeam?.id,
    awayTeamId: landing?.awayTeam?.id || pbp?.awayTeam?.id,
  };
}

// Build playerId -> "First Last" map from the rosterSpots array
// that the NHL play-by-play includes inline — no separate roster fetch needed
export function buildPlayerMap(playByPlay) {
  const map = {};
  const spots = playByPlay?.rosterSpots || [];
  spots.forEach(s => {
    if (s.playerId) {
      const first = s.firstName?.default || s.firstName || '';
      const last  = s.lastName?.default  || s.lastName  || '';
      map[s.playerId] = `${first} ${last}`.trim();
    }
  });
  return map;
}

export function extractShotEvents(playByPlay, team = TEAM_CONFIG) {
  if (!playByPlay?.plays) return [];
  const shotTypes = new Set(['shot-on-goal', 'missed-shot', 'blocked-shot', 'goal']);

  // Name map lives in the same API response — no extra fetch needed
  const playerMap = buildPlayerMap(playByPlay);

  // Shootout attempts aren't shots -- see gamePlays.js.
  return playByPlay.plays
    .filter(p => shotTypes.has(p.typeDescKey) && p.details?.xCoord != null && !isShootoutPlay(p))
    .map(p => {
      const d = p.details;
      // Goals use scoringPlayerId; all other shots use shootingPlayerId
      const shooterId = d.scoringPlayerId || d.shootingPlayerId || null;
      return {
        id:           p.eventId,
        type:         p.typeDescKey,
        period:       p.periodDescriptor?.number,
        timeInPeriod: p.timeInPeriod,
        x:            d.xCoord,
        y:            d.yCoord,
        teamId:       d.eventOwnerTeamId,
        shotType:     d.shotType,
        zoneCode:     d.zoneCode,
        isCanes:      d.eventOwnerTeamId === team.teamId,
        shooterId:    shooterId || null,
        // Player names resolved inline from rosterSpots
        shooterName:  shooterId            ? (playerMap[shooterId]            || null) : null,
        assist1Name:  d.assist1PlayerId    ? (playerMap[d.assist1PlayerId]    || null) : null,
        assist2Name:  d.assist2PlayerId    ? (playerMap[d.assist2PlayerId]    || null) : null,
        blockerName:  d.blockingPlayerId   ? (playerMap[d.blockingPlayerId]   || null) : null,
        goalieName:   d.goalieInNetId      ? (playerMap[d.goalieInNetId]      || null) : null,
        // No shotSpeed: the NHL's play-by-play has no per-shot speed (NHL
        // EDGE publishes only a player's season top-10 hardest shots), so
        // the shot popup leaves its speed row out.
      };
    });
}

// Brightcove embed — autoplay=false prevents simultaneous playback
export function buildBrightcoveUrl(clipId) {
  return `https://players.brightcove.net/6415718365001/EXtG1xJ7H_default/index.html?videoId=${clipId}&autoplay=false`;
}

// One goal's player and puck tracking (NHL EDGE) for the Tracking replay,
// via the Worker's /nhl/goal-replay -- or null when the goal has none
// (every goal before 2023-24, or a live one the NHL hasn't published yet).
// Callers offer Tracking only when this returns data.
export async function getGoalReplay(gameId, eventId) {
  if (!gameId || eventId == null) return null;
  const data = await workerFetch(`/nhl/goal-replay/${gameId}/${eventId}`);
  return data?.available ? data : null;
}

// Attaches a Brightcove embed URL to each 'goal' event in shotEvents (from
// extractShotEvents), matched against landing data's summary.scoring[]
// .goals by eventId — both feeds give a goal the same id (checked against
// real games, 2026-09). It used to pair them by period + in-period order,
// which is right only as long as landing lists a period's goals in exactly
// the play-by-play's order and neither feed omits one; matching on the id
// both already carry has nothing to get out of step. Non-goal events and
// goals with no discreteClip in landing pass through unchanged.
export function attachGoalVideos(shotEvents, landingData) {
  const scoring = landingData?.summary?.scoring;
  if (!scoring?.length) return shotEvents;

  const clipByEventId = new Map();
  for (const period of scoring) {
    for (const g of period.goals || []) {
      if (g.eventId != null && g.discreteClip) clipByEventId.set(g.eventId, g.discreteClip);
    }
  }
  if (!clipByEventId.size) return shotEvents;

  return shotEvents.map(e => {
    const clip = e.type === 'goal' ? clipByEventId.get(e.id) : null;
    return clip ? { ...e, videoUrl: buildBrightcoveUrl(clip) } : e;
  });
}

// ─── HELPERS ─────────────────────────────────────────────────

export function formatGameDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatGameTime(utcStr) {
  if (!utcStr) return '';
  return new Date(utcStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function getOpponent(game, team = TEAM_CONFIG) {
  if (!game) return null;
  return game.homeTeam?.abbrev === team.abbr ? game.awayTeam : game.homeTeam;
}

export function isHomeGame(game, team = TEAM_CONFIG) {
  return game?.homeTeam?.abbrev === team.abbr;
}

// game.venue.default is the arena name wherever the game is actually played
// (i.e. the home team's arena) -- same field regardless of which team you're
// rooting for, so no home/away branching needed here.
export function getVenue(game) {
  return game?.venue?.default || '';
}

// Dedupes game.tvBroadcasts[] (which can list the same network more than
// once across market/countryCode combinations, e.g. a national US feed
// alongside a Canadian regional one) down to a flat, ordered list of
// network names for display. Returns [] when the schedule hasn't had
// broadcasts assigned yet (common for games far in the future).
export function getBroadcasts(game) {
  if (!Array.isArray(game?.tvBroadcasts)) return [];
  const seen = new Set();
  const networks = [];
  for (const b of game.tvBroadcasts) {
    if (b?.network && !seen.has(b.network)) {
      seen.add(b.network);
      networks.push(b.network);
    }
  }
  return networks;
}

// game.winningGoalie / game.winningGoalScorer / game.threeMinRecap /
// game.condensedGame / game.neutralSite all come from the schedule object
// (club-schedule-season) -- NOT from the landing/boxscore endpoints -- so
// they're already present on the `game` prop every completed-game consumer
// already has. No new fetch needed for any of these.
export function getWinningGoalie(game) {
  const g = game?.winningGoalie;
  if (!g?.lastName?.default) return '';
  return `${g.firstInitial?.default || ''} ${g.lastName.default}`.trim();
}

export function getWinningGoalScorer(game) {
  const g = game?.winningGoalScorer;
  if (!g?.lastName?.default) return '';
  return `${g.firstInitial?.default || ''} ${g.lastName.default}`.trim();
}

// threeMinRecap/condensedGame are relative NHL.com paths (e.g.
// "/video/njd-at-car-recap-..."), not full URLs.
export function getRecapLinks(game) {
  const base = 'https://www.nhl.com';
  return {
    recap:     game?.threeMinRecap ? `${base}${game.threeMinRecap}` : null,
    condensed: game?.condensedGame ? `${base}${game.condensedGame}` : null,
  };
}

export function isNeutralSite(game) {
  return game?.neutralSite === true;
}

// The game with its score taken from that game's play-by-play, when it's
// the one given. The schedule's score is only as fresh as its cached copy
// (eyewall-poller restamps it once a minute), while pbp polls every 10s
// live -- a goal popped up from pbp with the score bar still a goal behind.
export function withPbpScore(game, pbp) {
  if (!game || !pbp || String(pbp.id) !== String(game.id)) return game;
  const home = pbp.homeTeam?.score, away = pbp.awayTeam?.score;
  if (home == null || away == null) return game;
  if (home === game.homeTeam?.score && away === game.awayTeam?.score) return game;
  return { ...game, homeTeam: { ...game.homeTeam, score: home }, awayTeam: { ...game.awayTeam, score: away } };
}

export function getCarScore(game, team = TEAM_CONFIG) {
  if (!game) return null;
  return game.homeTeam?.abbrev === team.abbr
    ? game.homeTeam?.score
    : game.awayTeam?.score;
}

export function getOppScore(game, team = TEAM_CONFIG) {
  if (!game) return null;
  return game.homeTeam?.abbrev === team.abbr
    ? game.awayTeam?.score
    : game.homeTeam?.score;
}

// ─── OPPONENT SCOUTING ───────────────────────────────────────
export async function getTeamRecentGames(teamAbbr, count = 10, playoffsOnly = false) {
  return cached(`recentGames:${teamAbbr}:${count}:${playoffsOnly}`, async () => {
    const data = await nhlFetch(`${BASE}/club-schedule-season/${teamAbbr}/${TEAM_CONFIG.season}`);
    const games = (data?.games || [])
      .filter(g => isCompleted(g) && (!playoffsOnly || g.gameType === 3))
      .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))
      .slice(0, count);
    return games.map(g => {
      const home      = g.homeTeam?.abbrev === teamAbbr;
      const teamScore = home ? (g.homeTeam?.score ?? 0) : (g.awayTeam?.score ?? 0);
      const oppScore  = home ? (g.awayTeam?.score ?? 0) : (g.homeTeam?.score ?? 0);
      const won       = teamScore > oppScore;
      const opp       = home ? g.awayTeam?.abbrev : g.homeTeam?.abbrev;
      return {
        date: g.gameDate, opp, teamScore, oppScore, won, home,
        result: won ? 'W' : (teamScore === oppScore - 1 && g.periodDescriptor?.number > 3 ? 'OTL' : 'L'),
      };
    });
  }, TTL.SCHEDULE);
}

export async function getTeamTopPlayers(teamAbbr, gameType = 2) {
  return cached(`topPlayers:${teamAbbr}:${gameType}:v3`, async () => {
    const data = await nhlFetch(`${BASE}/club-stats/${teamAbbr}/${TEAM_CONFIG.season}/${gameType}`);
    const skaters = (data?.skaters || [])
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, 5)
      .map(p => ({
        playerId: p.playerId,
        name:     `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(),
        pos:      p.positionCode,
        goals:    p.goals ?? 0,
        assists:  p.assists ?? 0,
        points:   p.points ?? 0,
        toi:      p.avgToi,
      }));
    const goalies = (data?.goalies || [])
      .sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0))
      .slice(0, 2)
      .map(g => ({
        playerId:     g.playerId,
        name:         `${g.firstName?.default || ''} ${g.lastName?.default || ''}`.trim(),
        wins:         g.wins ?? 0,
        savePct:      g.savePercentage ?? g.savePctg ?? null,
        gaa:          g.goalsAgainstAverage ?? g.goalsAgainstAvg ?? null,
        shotsAgainst: g.shotsAgainst ?? null,
        saves:        g.saves ?? null,
      }));
    return { skaters, goalies };
  }, TTL.PLAYER_STATS);
}

// Team colors: use teamConfig.js's teamTextColor(abbr) -- each team's
// WCAG AA displayColor on dark, primaryColor on light. The raw brand-color
// TEAM_COLORS map that used to live here was removed (2026-09): FLA/WPG's
// #041e42 and the other blue primaries were unreadable as text on the dark
// card, and it had drifted from teamConfig.js's colors since Light Mode.

// ─── Team advanced stats ──────────────────────────────────────
// Advanced stats endpoints use teamId and franchiseId directly -- read off
// `team` (the favorite unless a caller passes another) at each point of
// use. These were module-level TEAM_ID_ADV/FRANCHISE_ID consts, which
// pinned every function below to the favorite no matter who asked.
// TEAM_CONFIG.season is a live getter (see teamConfig.js) -- read it
// directly at each point of use below rather than caching it into its own
// const the way this file used to (a `STATS_SEASON` const here froze at
// module-load time and never picked up the live-resolved value).
//
// Consequence for the cached() calls below: season is now included in the
// `teamSummary:`/`teamRealtime:`/`homeSplit:` cache keys, not just
// gameTypeId. This isn't a drive-by cleanup -- it's required by the fix
// above. Once TEAM_CONFIG.season can genuinely change mid-session (a KV
// override, or the real Sept/Oct boundary), a cache keyed only on
// gameTypeId would serve up to 10 minutes (TTL.ADVANCED) of the WRONG
// season's data under a key that now silently means something different
// than it did when it was cached. Shipping the const removal without this
// would trade one staleness bug for a shorter-lived, harder-to-notice one.

// Build URL for team stat endpoints.
// Key: cayenneExp must use seasonId<=X and seasonId>=X (double-bound) not seasonId=X
// Also needs isAggregate and isGame params for report endpoints like puckPossessions
function teamStatsUrl(report, gameTypeId = 2, season = TEAM_CONFIG.season, team = TEAM_CONFIG) {
  const s = season;
  const exp = encodeURIComponent(
    `franchiseId=${team.franchiseId} and gameTypeId=${gameTypeId} and seasonId<=${s} and seasonId>=${s}`
  );
  return `/nhl-stats/stats/rest/en/team/${report}?isAggregate=false&isGame=false&sort=wins&limit=1&cayenneExp=${exp}`;
}

// Find the configured team from an array of team records
function findTeam(data, team = TEAM_CONFIG) {
  return data?.find(t =>
    t.teamAbbrevs === team.abbr ||
    t.teamAbbrev  === team.abbr ||
    t.teamId      === team.teamId ||
    t.franchiseId === team.franchiseId
  ) || null;
}

// Team summary cached — shared by corsi, pp, pk
async function _getTeamSummary(gameTypeId, season = TEAM_CONFIG.season, team = TEAM_CONFIG) {
  const url = teamStatsUrl('summary', gameTypeId, season, team);
  const d   = await nhlFetch(url);
  return d?.data?.[0] || null;
}

// Shot share for the Team page's Advanced tab, from the NHL's own reports:
// Corsi from the realtime report's totalShotAttempts (shots + missed + own
// attempts blocked) and satPct (CF%), attempts against derived from the two
// (see leagueAverages.js teamShotAttempts); SF% is shots on goal for over
// all shots on goal. Until 2026-10 "Corsi" here was SOG + the team's OWN
// blocks (realtime blockedShots is blocks made by the team's skaters, not
// its attempts that got blocked) and left out missed shots, and "FF%" was
// this SOG share labelled Fenwick -- unblocked attempts against can't be
// derived exactly from these reports (skater-credited blocks undercount
// blocked attempts by ~9%), so it's shown as what it is.
// season: defaults to the current season. The Team page's Advanced and Splits
// tabs pass getTeamStats()'s statsSeasonId instead, so out of season they
// show last season (labelled) rather than an empty current one -- same as
// Overview. Applies to getTeamPowerplay/PenaltyKill/HomeSplit below too.
export async function getTeamCorsi(gameTypeId = 2, season = TEAM_CONFIG.season, team = TEAM_CONFIG) {
  const t = await cached(`teamSummary:${team.abbr}:${gameTypeId}:${season}`, () => _getTeamSummary(gameTypeId, season, team), TTL.ADVANCED);
  if (!t) return null;

  const sf = t.shotsForPerGame    || 0;
  const sa = t.shotsAgainstPerGame || 0;
  const rt = await getTeamRealtime(gameTypeId, season, team).catch(() => null);
  const attempts = teamShotAttempts(rt, t.gamesPlayed);
  const sogTotal = sf + sa;

  return {
    ...t,
    corsiForPct:       attempts?.corsiForPct ?? null,
    satForPerGame:     attempts?.satForPerGame ?? null,
    satAgainstPerGame: attempts?.satAgainstPerGame ?? null,
    shotsForPct:       sogTotal > 0 ? sf / sogTotal : null,
    shotsForPerGame:   sf,
    shotsAgainstPerGame: sa,
    // No realtime shot-attempt data: only the SOG-based share is shown
    isProxyCorsi: !attempts,
  };
}

// League averages for the Advanced tab -- every team's NHL report rows for
// the season and game type, aggregated by leagueTeamAverages(). null when
// the NHL has nothing for it (the tab then shows no average or rating).
export async function getLeagueTeamAverages(gameTypeId = 2, season = TEAM_CONFIG.season) {
  return cached(`leagueTeamAverages:${gameTypeId}:${season}`, async () => {
    const exp = encodeURIComponent(`gameTypeId=${gameTypeId} and seasonId<=${season} and seasonId>=${season}`);
    // Each report only accepts a sort field it actually has.
    const report = (name, sort) =>
      nhlFetch(`/nhl-stats/stats/rest/en/team/${name}?isAggregate=false&isGame=false&sort=${sort}&limit=50&cayenneExp=${exp}`)
        .then(d => d?.data || [])
        .catch(() => []);
    const [summary, realtime, powerplay, penaltykill] = await Promise.all([
      report('summary', 'wins'), report('realtime', 'hits'),
      report('powerplay', 'powerPlayGoalsFor'), report('penaltykill', 'penaltyKillPct'),
    ]);
    return leagueTeamAverages({ summary, realtime, powerplay, penaltykill });
  }, TTL.ADVANCED);
}

// Realtime stats: blocked shots, hits, giveaways, takeaways
// season: defaults to the current season; the Overview stat card passes
// getTeamStats()'s statsSeasonId so Blks/GP describes the same season as the
// cards around it (empty for the current season until games are played).
export async function getTeamRealtime(gameTypeId = 2, season = TEAM_CONFIG.season, team = TEAM_CONFIG) {
  return cached(`teamRealtime:${team.abbr}:${gameTypeId}:${season}`, async () => {
    const s   = season;
    // Try multiple known report names that include blocked shots
    // The NHL stats API 'realtime' report includes blockedShots, hits, giveaways, takeaways
    // Use same franchiseId filter as working team/summary endpoint
    const exp = encodeURIComponent(
      `franchiseId=${team.franchiseId} and gameTypeId=${gameTypeId} and seasonId<=${s} and seasonId>=${s}`
    );
    const url = `/nhl-stats/stats/rest/en/team/realtime?isAggregate=false&isGame=false&sort=blockedShots&sortDirection=DESC&limit=1&cayenneExp=${exp}`;
    const d   = await nhlFetch(url);
    const t   = d?.data?.[0] || null;
    return t;
  }, TTL.ADVANCED);
}

// Score-state splits — endpoint broken, returns null gracefully
export async function getTeamScoreState(_gameTypeId = 2) {
  return null; // team/goalsForAgainst endpoint unavailable
}

// Power play / Penalty kill — from team/summary
// Available fields: powerPlayPct, powerPlayNetPct, penaltyKillPct, penaltyKillNetPct
// Goals and opportunity counts are NOT in team/summary; derive where possible from standings
export async function getTeamPowerplay(gameTypeId = 2, season = TEAM_CONFIG.season, team = TEAM_CONFIG) {
  return cached(`teamSummary:${team.abbr}:${gameTypeId}:${season}`, () => _getTeamSummary(gameTypeId, season, team), TTL.ADVANCED);
}

export async function getTeamPenaltyKill(gameTypeId = 2, season = TEAM_CONFIG.season, team = TEAM_CONFIG) {
  return cached(`teamSummary:${team.abbr}:${gameTypeId}:${season}`, () => _getTeamSummary(gameTypeId, season, team), TTL.ADVANCED);
}

// Home/Away splits from team summary (homeRoadQuery)
export async function getTeamHomeSplit(gameTypeId = 2, season = TEAM_CONFIG.season) {
  return cached(`homeSplit:${gameTypeId}:${season}`, () => _getTeamHomeSplit(gameTypeId, season), TTL.ADVANCED);
}
async function _getTeamHomeSplit(gameTypeId = 2, season = TEAM_CONFIG.season) {
  const homeExp = encodeURIComponent(`seasonId=${season} and gameTypeId=${gameTypeId} and homeRoad="H"`);
  const awayExp = encodeURIComponent(`seasonId=${season} and gameTypeId=${gameTypeId} and homeRoad="R"`);
  const [home, away] = await Promise.all([
    nhlFetch(`/nhl-stats/stats/rest/en/team/summary?limit=50&sort=wins&cayenneExp=${homeExp}`),
    nhlFetch(`/nhl-stats/stats/rest/en/team/summary?limit=50&sort=wins&cayenneExp=${awayExp}`),
  ]);
  return {
    home: findTeam(home?.data) || null,
    away: findTeam(away?.data) || null,
  };
}

// One team's totals for exactly one season and game type -- the shot map's
// "All N" cards, which describe whatever season and Regular/Playoffs is on
// screen. They used to mix sources that didn't follow the selection:
// hits/penalties from the regular-season team_seasons row, faceoff/PP/PK
// from getTeamStats() (always the latest regular season), so 2025-26
// Playoffs showed "82 GP" regular-season numbers. Three NHL team reports,
// each filtered to the franchise, season and gameTypeId. null when the
// NHL has nothing for that combination (e.g. a team that missed the
// playoffs).
export async function getTeamSelectionTotals(team, season, gameTypeId) {
  return cached(`selectionTotals:${team.abbr}:${season}:${gameTypeId}`, async () => {
    const exp = encodeURIComponent(
      `franchiseId=${team.franchiseId} and gameTypeId=${gameTypeId} and seasonId<=${season} and seasonId>=${season}`
    );
    // Each report only accepts a sort field it actually has.
    const report = (name, sort) =>
      nhlFetch(`/nhl-stats/stats/rest/en/team/${name}?isAggregate=false&isGame=false&sort=${sort}&limit=1&cayenneExp=${exp}`)
        .then(d => d?.data?.[0] || null);
    const [summary, realtime, penalties] = await Promise.all([
      report('summary', 'wins'), report('realtime', 'hits'), report('penalties', 'penalties'),
    ]);
    if (!summary) return null;
    return {
      gamesPlayed:    summary.gamesPlayed ?? null,
      faceoffWinPct:  summary.faceoffWinPct ?? null,
      powerPlayPct:   summary.powerPlayPct ?? null,
      penaltyKillPct: summary.penaltyKillPct ?? null,
      hits:           realtime?.hits ?? null,
      penalties:      penalties?.penalties ?? null,
    };
  }, TTL.ADVANCED);
}

// Playoff team stats (same endpoints with gameTypeId=3)
export async function getTeamPlayoffStats(team = TEAM_CONFIG) {
  const [corsi, scoreState, pp, pk] = await Promise.all([
    getTeamCorsi(3, TEAM_CONFIG.season, team),
    getTeamScoreState(3),
    getTeamPowerplay(3, TEAM_CONFIG.season, team),
    getTeamPenaltyKill(3, TEAM_CONFIG.season, team),
  ]);
  return { corsi, scoreState, pp, pk };
}

// Rolling game-by-game results for trend chart
// Returns the last N completed games of ONE game type (2 regular season,
// 3 playoffs) with GF, GA and outcome -- preseason never counts (audit
// 2026-10-05 #8: CAR's 4 preseason games were shown as its last 10).
export async function getTeamGameLog(count = 20, gameType = GAME_TYPE.REGULAR) {
  return cached(`gameLog:${TEAM_CONFIG.abbr}:${TEAM_CONFIG.season}:${gameType}:${count}`, () => _getTeamGameLog(count, gameType), TTL.SCHEDULE);
}
async function _getTeamGameLog(count, gameType) {
  const games = await nhlFetch(`${BASE}/club-schedule-season/${TEAM_CONFIG.abbr}/${TEAM_CONFIG.season}`);
  return buildTeamGameLog(games?.games, TEAM_CONFIG.abbr, gameType, count);
}

// Sportsbook odds (getNhlOdds/findGameOdds/extractMoneyline/oddsToImplied/
// fmtOdds, reading the Worker's /nhl/odds) were removed 2026-09 -- the app
// shows no betting content (App Store review + product direction). The
// Worker-side odds writer and /nhl/odds route were removed from
// eyewall-poller in the same change.
