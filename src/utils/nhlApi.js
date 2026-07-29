import { cached, TTL, invalidate } from './cache.js'

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
import { TEAM_CONFIG } from './teamConfig'


// gameType values from NHL API:
//   1 = Preseason, 2 = Regular season, 3 = Playoffs
export const GAME_TYPE = { PRESEASON: 1, REGULAR: 2, PLAYOFFS: 3 };

// ─── FETCH HELPER ────────────────────────────────────────────

async function nhlFetch(url) {
  try {
    const res = await fetch(url);
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
async function kvFetch(key) {
  if (!WORKER_URL) return null;
  try {
    const teamParam = encodeURIComponent(TEAM_CONFIG.abbr);
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
    const res = await fetch(`${WORKER_URL}${path}`, {
      signal: AbortSignal.timeout(8000),
    });
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
export async function getDraftOrder(team = null) {
  const path = team ? `/draft/order?team=${team}` : '/draft/order';
  return workerFetch(path);
}

// ─── SCHEDULE ────────────────────────────────────────────────

// Fetch ALL CAR games for the season (regular + playoffs together)
// Short cache (20s) prevents hammering during rapid successive calls,
// but stays fresh enough to detect live game state changes
export async function getAllGames() {
  return cached('allGames', async () => {
    // Try Worker KV first (pre-polled, zero per-user NHL calls). Key is
    // season-namespaced (Session 77 — schedule:{abbr}:{season}, not the
    // old bare schedule:{abbr}) to match the Worker's /schedule route.
    const cached_kv = await kvFetch(`schedule:${TEAM_CONFIG.abbr}:${TEAM_CONFIG.season}`);
    if (cached_kv) return cached_kv;
    // Fall back to direct NHL call
    const data = await nhlFetch(`${BASE}/club-schedule-season/${TEAM_CONFIG.abbr}/${TEAM_CONFIG.season}`);
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
export async function getRegularSeasonGames() {
  return cached('regularSeasonGames', async () => {
    const games = await getAllGames();
    return games.filter(g => g.gameType === GAME_TYPE.REGULAR);
  }, TTL.SCHEDULE);
}

// Playoff games only (gameType === 3)
export async function getPlayoffGames() {
  return cached('playoffGames', _getPlayoffGames, TTL.PLAYOFF_GAMES);
}
async function _getPlayoffGames() {
  const games = await getAllGames();
  return games.filter(g => g.gameType === GAME_TYPE.PLAYOFFS);
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
export async function getRecentGames(count = 6) {
  const games = await getAllGames();
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
export async function getLiveGame() {
  // ── Dev mock ─────────────────────────────────────────────────
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(window.location.search);
    const mockId = params.get('mockGame');
    if (mockId) {
      const games = await getAllGames();
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
  const games = await getAllGames();
  return games.find(g => g.gameState === 'LIVE' || g.gameState === 'CRIT') || null;
}

// Is a game finished?
export function isCompleted(game) {
  // Only trust explicit completed game states — never infer from score presence
  // (scheduled games have score=0 which falsely triggered the old fallback)
  return ['OFF', 'FINAL', 'F', 'FINAL_OVERTIME', 'FINAL_SHOOTOUT'].includes(game.gameState);
}

// ─── PLAYOFF SERIES ──────────────────────────────────────────

// Get the current playoff bracket/series overview
export async function getPlayoffBracket() {
  return cached('playoffBracket', async () => {
    try {
      const res = await fetch(`${BASE}/playoff-bracket/${TEAM_CONFIG.season}`);
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
  // standings/now redirects to a dated URL which breaks the proxy (CORS on redirect).
  // Use the final regular-season date directly — avoids the redirect entirely.
  // Try most recent season end first, then fall back.
  const dates = ['2026-04-18', '2026-04-17', '2026-04-16', '2025-04-18'];
  for (const date of dates) {
    const data = await nhlFetch(`${BASE}/standings/${date}`);
    if (data?.standings?.length) return data.standings;
  }
  return [];
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
    const exp = encodeURIComponent(`gameTypeId=3 and seasonId<=${TEAM_CONFIG.season} and seasonId>=${TEAM_CONFIG.season}`);
    const url = `/nhl-stats/stats/rest/en/team/summary?isAggregate=false&isGame=false&sort=shotsForPerGame&sortDirection=DESC&limit=32&cayenneExp=${exp}`;
    const data = await nhlFetch(url);
    const team = (data?.data || []).find(t => t.teamFullName && (
      (teamAbbr === TEAM_CONFIG.abbr && t.teamFullName.includes(TEAM_CONFIG.fullNameFragment)) ||
      (teamAbbr === 'VGK' && t.teamFullName.includes('Vegas')) ||
      t.teamAbbrevs === teamAbbr ||
      t.teamFullName.toLowerCase().includes(teamAbbr.toLowerCase())
    ));
    if (!team) return null;
    const gp = team.gamesPlayed || 1;
    return {
      gamesPlayed:         gp,
      wins:                team.wins                ?? 0,
      losses:              team.losses              ?? 0,
      goalsForPerGame:     team.goalsForPerGame      ?? 0,
      goalsAgainstPerGame: team.goalsAgainstPerGame  ?? 0,
      // PP/PK already 0–1 scale in this endpoint
      powerPlayPct:        team.powerPlayPct         ?? 0,
      penaltyKillPct:      team.penaltyKillPct       ?? 0,
      shotsForPerGame:     team.shotsForPerGame       ?? 0,
      shotsAgainstPerGame: team.shotsAgainstPerGame   ?? 0,
      faceoffWinPct:       team.faceoffWinPct         ?? null,
      _raw: team,
    };
  }, TTL.TEAM_STATS);
}
// Faceoff win % isn't on the /standings/now response _getTeamStats() reads
// below at all — pull it from the same team/summary REST endpoint
// getTeamStatsPlayoff() already uses (gameTypeId=2 here instead of 3).
// Best-effort: a failed fetch or unmatched team just leaves this null
// rather than failing the whole getTeamStats() call over one extra field.
async function fetchTeamFaceoffWinPct(teamAbbr) {
  const exp = encodeURIComponent(`gameTypeId=2 and seasonId<=${TEAM_CONFIG.season} and seasonId>=${TEAM_CONFIG.season}`);
  const url = `/nhl-stats/stats/rest/en/team/summary?isAggregate=false&isGame=false&sort=shotsForPerGame&sortDirection=DESC&limit=32&cayenneExp=${exp}`;
  const data = await nhlFetch(url);
  const team = (data?.data || []).find(t => t.teamFullName && (
    (teamAbbr === TEAM_CONFIG.abbr && t.teamFullName.includes(TEAM_CONFIG.fullNameFragment)) ||
    (teamAbbr === 'VGK' && t.teamFullName.includes('Vegas')) ||
    t.teamAbbrevs === teamAbbr ||
    t.teamFullName.toLowerCase().includes(teamAbbr.toLowerCase())
  ));
  return team?.faceoffWinPct ?? null;
}

async function _getTeamStats(teamAbbr = TEAM_CONFIG.abbr) {
  const standings = await getStandings();
  const team = standings.find(t => t.teamAbbrev?.default === teamAbbr);

  if (!team) {
    console.warn('Could not find team in standings, using fallback');
    return FALLBACK_STATS;
  }

  // The NHL's own /standings/now redirects to whatever date it last
  // resolved standings for, independent of our app's season config — it
  // stays pinned to last season's finale for months until real games exist
  // for the new one. Each row carries its own seasonId; a mismatch here
  // means `team` is a genuine, real, but STALE full prior season, not
  // "this season's data" — return null (distinct from "not found") rather
  // than silently feeding a full 82-game record into this season's stats.
  if (team.seasonId != null && String(team.seasonId) !== TEAM_CONFIG.season) {
    return null;
  }

  const gp = team.gamesPlayed || 1;
  const faceoffWinPct = await fetchTeamFaceoffWinPct(teamAbbr).catch(() => null);

  // Field name notes for NHL API standings:
  //   goalFor / goalAgainst = season totals (not per-game averages)
  //   powerPlayPct / penaltyKillPct = 0–100 scale (e.g. 23.5 = 23.5%)
  return {
    gamesPlayed:         gp,
    wins:                team.wins         ?? 0,
    losses:              team.losses       ?? 0,
    otLosses:            team.otLosses     ?? 0,
    points:              team.points       ?? 0,
    goalsForPerGame:     (team.goalFor     ?? 0) / gp,
    goalsAgainstPerGame: (team.goalAgainst ?? 0) / gp,
    powerPlayPct:        (team.powerPlayPct  ?? 22) / 100,
    penaltyKillPct:      (team.penaltyKillPct ?? 80) / 100,
    shotsForPerGame:     team.shotsForPerGame     ?? 31.2,
    shotsAgainstPerGame: team.shotsAgainstPerGame ?? 28.4,
    blockedShotsPerGame: team.blockedShots != null ? team.blockedShots / gp : null,
    faceoffWinPct,
    divisionName:        team.divisionName,
    conferenceName:      team.conferenceName,
    streakCode:          team.streakCode,
    streakCount:         team.streakCount,
    _raw: team,
  };
}

const FALLBACK_STATS = {
  gamesPlayed: 82, wins: 54, losses: 20, otLosses: 8, points: 116,
  goalsForPerGame: 3.52, goalsAgainstPerGame: 2.61,
  powerPlayPct: 0.248, penaltyKillPct: 0.841,
  shotsForPerGame: 33.1, shotsAgainstPerGame: 27.4,
  divisionName: 'Metropolitan', _raw: null,
};

// ─── TEAM SEASON RANKINGS ────────────────────────────────────
// Returns CAR's league rank (1 = best) for key stats.
// gameTypeId: 2 = regular season, 3 = playoffs
export async function getTeamSeasonRankings(gameTypeId = 2) {
  return cached(`teamSeasonRankings:${gameTypeId}`, () => _getTeamSeasonRankings(gameTypeId), TTL.TEAM_STATS);
}
async function _getTeamSeasonRankings(gameTypeId = 2) {
  try {
    const exp = encodeURIComponent(
      `gameTypeId=${gameTypeId} and seasonId<=${TEAM_CONFIG.season} and seasonId>=${TEAM_CONFIG.season}`
    );
    const url = `/nhl-stats/stats/rest/en/team/summary?isAggregate=false&isGame=false` +
      `&sort=shotsForPerGame&sortDirection=DESC&limit=40&cayenneExp=${exp}`;
    const data = await nhlFetch(url);
    const teams = data?.data || [];
    if (!teams.length) return null;

    // Find our team
    const car = teams.find(t => t.teamFullName?.includes(TEAM_CONFIG.fullNameFragment));
    if (!car) return null;

    // Rank helper — 1 = best. higherBetter: sort desc; lowerBetter: sort asc
    const rank = (field, higherBetter = true) => {
      const sorted = [...teams]
        .filter(t => t[field] != null)
        .sort((a, b) => higherBetter ? b[field] - a[field] : a[field] - b[field]);
      const pos = sorted.findIndex(t => t.teamFullName?.includes(TEAM_CONFIG.fullNameFragment));
      return pos === -1 ? null : pos + 1;
    };

    return {
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
  if (!rows) return [];
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
  const data = await nhlFetch(`${BASE}/roster/${teamAbbr}/current`);
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
export function bustLiveGameCache(gameId) {
  invalidate(`pbp:${gameId}`);
  invalidate(`boxscore:${gameId}`);
  invalidate('allGames');
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
    rightRail:  { teamGameStats },
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

export function extractShotEvents(playByPlay) {
  if (!playByPlay?.plays) return [];
  const shotTypes = new Set(['shot-on-goal', 'missed-shot', 'blocked-shot', 'goal']);

  // Name map lives in the same API response — no extra fetch needed
  const playerMap = buildPlayerMap(playByPlay);

  return playByPlay.plays
    .filter(p => shotTypes.has(p.typeDescKey) && p.details?.xCoord != null)
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
        isCanes:      d.eventOwnerTeamId === TEAM_CONFIG.teamId,
        shooterId:    shooterId || null,
        // Player names resolved inline from rosterSpots
        shooterName:  shooterId            ? (playerMap[shooterId]            || null) : null,
        assist1Name:  d.assist1PlayerId    ? (playerMap[d.assist1PlayerId]    || null) : null,
        assist2Name:  d.assist2PlayerId    ? (playerMap[d.assist2PlayerId]    || null) : null,
        blockerName:  d.blockingPlayerId   ? (playerMap[d.blockingPlayerId]   || null) : null,
        goalieName:   d.goalieInNetId      ? (playerMap[d.goalieInNetId]      || null) : null,
        // Shot speed in mph — present on some events via NHL edge data
        shotSpeed:    d.shotSpeed          ?? null,
      };
    });
}

// ─── HELPERS ─────────────────────────────────────────────────

export function formatGameDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatGameTime(utcStr) {
  if (!utcStr) return '';
  return new Date(utcStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });
}

export function getOpponent(game) {
  if (!game) return null;
  return game.homeTeam?.abbrev === TEAM_CONFIG.abbr ? game.awayTeam : game.homeTeam;
}

export function isHomeGame(game) {
  return game?.homeTeam?.abbrev === TEAM_CONFIG.abbr;
}

export function getCarScore(game) {
  if (!game) return null;
  return game.homeTeam?.abbrev === TEAM_CONFIG.abbr
    ? game.homeTeam?.score
    : game.awayTeam?.score;
}

export function getOppScore(game) {
  if (!game) return null;
  return game.homeTeam?.abbrev === TEAM_CONFIG.abbr
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

export const TEAM_COLORS = {
  CAR: '#cc2200', BOS: '#fcb514', NYR: '#0038a8', TBL: '#002868',
  FLA: '#041e42', WSH: '#c8102e', NYI: '#003087', NJD: '#ce1126',
  PHI: '#f74902', PIT: '#cfc493', CBJ: '#002654', BUF: '#003087',
  MTL: '#af1e2d', OTT: '#c52032', TOR: '#003e7e', DET: '#ce1126',
  CHI: '#ce1126', STL: '#002f87', NSH: '#ffb81c', WPG: '#041e42',
  MIN: '#154734', COL: '#6f263d', DAL: '#006847', ARI: '#8c2633',
  VGK: '#b4975a', SEA: '#99d9d9', EDM: '#ff4c00', CGY: '#c8102e',
  VAN: '#00843d', SJS: '#006d75', ANA: '#f47a38', LAK: '#a2aaad',
  UTA: '#69b3e7',
};

// ─── Team advanced stats ──────────────────────────────────────
// Convenience aliases — advanced stats endpoints use teamId and franchiseId directly
const TEAM_ID_ADV   = TEAM_CONFIG.teamId;
const FRANCHISE_ID  = TEAM_CONFIG.franchiseId;
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
function teamStatsUrl(report, gameTypeId = 2) {
  const s = TEAM_CONFIG.season;
  const exp = encodeURIComponent(
    `franchiseId=${FRANCHISE_ID} and gameTypeId=${gameTypeId} and seasonId<=${s} and seasonId>=${s}`
  );
  return `/nhl-stats/stats/rest/en/team/${report}?isAggregate=false&isGame=false&sort=wins&limit=1&cayenneExp=${exp}`;
}

// Find the configured team from an array of team records
function findTeam(data) {
  return data?.find(t =>
    t.teamAbbrevs === TEAM_CONFIG.abbr ||
    t.teamAbbrev  === TEAM_CONFIG.abbr ||
    t.teamId      === TEAM_ID_ADV ||
    t.franchiseId === FRANCHISE_ID
  ) || null;
}

// Team summary cached — shared by corsi, pp, pk
async function _getTeamSummary(gameTypeId) {
  const url = teamStatsUrl('summary', gameTypeId);
  const d   = await nhlFetch(url);
  return d?.data?.[0] || null;
}

// True Corsi/Fenwick using realtime + summary data we already fetch
// shotattempts and puckPossessions endpoints return 500 on NHL API
export async function getTeamCorsi(gameTypeId = 2) {
  const t = await cached(`teamSummary:${gameTypeId}:${TEAM_CONFIG.season}`, () => _getTeamSummary(gameTypeId), TTL.ADVANCED);
  if (!t) return null;

  const sf = t.shotsForPerGame    || 0;
  const sa = t.shotsAgainstPerGame || 0;
  const gp = t.gamesPlayed || 1;

  // Get realtime data which has blockedShots + shotAttemptsBlocked
  const rt = await cached(`teamRealtime:${gameTypeId}:${TEAM_CONFIG.season}`, async () => {
    const s   = TEAM_CONFIG.season;
    const exp = encodeURIComponent(
      `franchiseId=${FRANCHISE_ID} and gameTypeId=${gameTypeId} and seasonId<=${s} and seasonId>=${s}`
    );
    const url = `/nhl-stats/stats/rest/en/team/realtime?isAggregate=false&isGame=false&sort=blockedShots&sortDirection=DESC&limit=1&cayenneExp=${exp}`;
    const d   = await nhlFetch(url).catch(() => null);
    return d?.data?.[0] || null;
  }, TTL.ADVANCED);

  // True Corsi = SOG + missed shots + blocked shots (for and against)
  // We have: SOG for/against from summary, blocked shots from realtime
  // Missing: missed shots — not available at season level, so we approximate:
  // Corsi ≈ SOG + blocked (we have both sides from realtime)
  const blockedFor     = rt?.blockedShots          || 0; // CAR shots blocked by opponents
  const blockedAgainst = rt?.shotAttemptsBlocked   || 0; // Opponent shots blocked by CAR

  // Approximate Corsi per game using what we have
  const satForPerGame     = sf + (blockedFor     / gp); // SOG for + blocked against CAR
  const satAgainstPerGame = sa + (blockedAgainst / gp); // SOG against + blocked by CAR
  const satTotal          = satForPerGame + satAgainstPerGame;
  const corsiForPct       = satTotal > 0 ? satForPerGame / satTotal : null;

  // Fenwick = unblocked attempts only (exclude blocked shots)
  // FF% = SOG for / (SOG for + SOG against) — same as our proxy but labeled correctly
  const sogTotal    = sf + sa;
  const fenwickForPct = sogTotal > 0 ? sf / sogTotal : null;

  return {
    ...t,
    corsiForPct,
    fenwickForPct,
    satForPerGame:     satTotal > 0 ? satForPerGame     : null,
    satAgainstPerGame: satTotal > 0 ? satAgainstPerGame : null,
    shotsForPerGame:   sf,
    shotsAgainstPerGame: sa,
    // True Corsi if we have realtime blocked data, proxy otherwise
    isProxyCorsi: !rt || (blockedFor === 0 && blockedAgainst === 0),
  };
}

// Realtime stats: blocked shots, hits, giveaways, takeaways
export async function getTeamRealtime(gameTypeId = 2) {
  return cached(`teamRealtime:${gameTypeId}:${TEAM_CONFIG.season}`, async () => {
    const s   = TEAM_CONFIG.season;
    // Try multiple known report names that include blocked shots
    // The NHL stats API 'realtime' report includes blockedShots, hits, giveaways, takeaways
    // Use same franchiseId filter as working team/summary endpoint
    const exp = encodeURIComponent(
      `franchiseId=${FRANCHISE_ID} and gameTypeId=${gameTypeId} and seasonId<=${s} and seasonId>=${s}`
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
export async function getTeamPowerplay(gameTypeId = 2) {
  return cached(`teamSummary:${gameTypeId}:${TEAM_CONFIG.season}`, () => _getTeamSummary(gameTypeId), TTL.ADVANCED);
}

export async function getTeamPenaltyKill(gameTypeId = 2) {
  return cached(`teamSummary:${gameTypeId}:${TEAM_CONFIG.season}`, () => _getTeamSummary(gameTypeId), TTL.ADVANCED);
}

// Home/Away splits from team summary (homeRoadQuery)
export async function getTeamHomeSplit(gameTypeId = 2) {
  return cached(`homeSplit:${gameTypeId}:${TEAM_CONFIG.season}`, () => _getTeamHomeSplit(gameTypeId), TTL.ADVANCED);
}
async function _getTeamHomeSplit(gameTypeId = 2) {
  const homeExp = encodeURIComponent(`seasonId=${TEAM_CONFIG.season} and gameTypeId=${gameTypeId} and homeRoad="H"`);
  const awayExp = encodeURIComponent(`seasonId=${TEAM_CONFIG.season} and gameTypeId=${gameTypeId} and homeRoad="R"`);
  const [home, away] = await Promise.all([
    nhlFetch(`/nhl-stats/stats/rest/en/team/summary?limit=50&sort=wins&cayenneExp=${homeExp}`),
    nhlFetch(`/nhl-stats/stats/rest/en/team/summary?limit=50&sort=wins&cayenneExp=${awayExp}`),
  ]);
  return {
    home: findTeam(home?.data) || null,
    away: findTeam(away?.data) || null,
  };
}

// Playoff team stats (same endpoints with gameTypeId=3)
export async function getTeamPlayoffStats() {
  const [corsi, scoreState, pp, pk] = await Promise.all([
    getTeamCorsi(3),
    getTeamScoreState(3),
    getTeamPowerplay(3),
    getTeamPenaltyKill(3),
  ]);
  return { corsi, scoreState, pp, pk };
}

// Rolling game-by-game results for trend chart
// Returns the last N completed games with GF, GA, shots, outcome
export async function getTeamGameLog(count = 20) {
  return cached(`gameLog:${count}`, () => _getTeamGameLog(count), TTL.SCHEDULE);
}
async function _getTeamGameLog(count = 20) {
  const games = await nhlFetch(`${BASE}/club-schedule-season/${TEAM_CONFIG.abbr}/${TEAM_CONFIG.season}`);
  const allGames = games?.games || [];
  const completed = allGames
    .filter(g => ['OFF','FINAL','F'].includes(g.gameState))
    .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))
    .slice(0, count)
    .reverse(); // chronological

  return completed.map(g => {
    const home    = g.homeTeam?.abbrev === TEAM_CONFIG.abbr;
    const carScore = home ? (g.homeTeam?.score ?? 0) : (g.awayTeam?.score ?? 0);
    const oppScore = home ? (g.awayTeam?.score ?? 0) : (g.homeTeam?.score ?? 0);
    const opp      = home ? g.awayTeam?.abbrev : g.homeTeam?.abbrev;
    const won      = carScore > oppScore;
    const ot       = !won && carScore === oppScore - 1 && g.periodDescriptor?.number > 3;
    return {
      date:     g.gameDate,
      gameId:   g.id,
      opp,
      carScore,
      oppScore,
      home,
      won,
      ot,
      result:   won ? 'W' : (ot ? 'OTL' : 'L'),
      isPlayoff: g.gameType === 3,
    };
  });
}


// ─── ODDS (Odds Persistence Writer) ──────────────────────────
// Was: this file called The Odds API directly from every visitor's
// browser (cached only per-session, 5-min TTL) against a shared
// 500-requests/month free-tier key — every concurrent visitor
// independently burned from the same budget. Now: a Worker-side scheduled
// writer (fetchOdds()/persistOddsToSupabase() in eyewall-poller's nhl.js)
// fetches on its own throttled cadence and persists to Supabase; this just
// reads the result. See ODDS_PERSISTENCE_WRITER_SCOPE.md for the full design.

// Fetch NHL moneyline odds for upcoming games from the Worker's persisted
// table — already flattened/matched by team abbr server-side (home_abbr,
// away_abbr, commence_time, moneyline_home, moneyline_away, book), no
// team-name fuzzy matching needed here anymore. Still cached client-side
// (same TTL tier as standings) on top of the Worker's own edge cache —
// cheap either way now, since this is a table read, not a live API call.
export async function getNhlOdds() {
  return cached('nhlOdds', _getNhlOdds, TTL.STANDINGS);
}
async function _getNhlOdds() {
  return (await workerFetch('/nhl/odds')) || [];
}

// Find odds for a specific game — exact match by team abbr, resolved
// server-side already (no more fuzzy team-name/fragment matching).
// oddsData: array from getNhlOdds()
// game: NHL API game object
export function findGameOdds(oddsData, game) {
  if (!oddsData?.length || !game) return null;
  const homeAbbr = game.homeTeam?.abbrev;
  const awayAbbr = game.awayTeam?.abbrev;
  return oddsData.find(od => od.home_abbr === homeAbbr && od.away_abbr === awayAbbr) || null;
}

// Extract moneyline odds for CAR (or whichever team is TEAM_CONFIG) and
// its opponent from an already-flattened odds row.
// Returns { carOdds, oppOdds, book } or null
export function extractMoneyline(oddsEntry, isHome) {
  if (!oddsEntry) return null;
  const carOdds = isHome ? oddsEntry.moneyline_home : oddsEntry.moneyline_away;
  const oppOdds = isHome ? oddsEntry.moneyline_away : oddsEntry.moneyline_home;
  if (carOdds == null || oppOdds == null) return null;
  return { carOdds, oppOdds, book: oddsEntry.book };
}

// Convert American odds to implied probability %
export function oddsToImplied(american) {
  if (!american) return null;
  if (american > 0) return Math.round((100 / (american + 100)) * 100);
  return Math.round((Math.abs(american) / (Math.abs(american) + 100)) * 100);
}

// Format American odds for display: +150, -220 etc.
export function fmtOdds(american) {
  if (american == null) return '—';
  return american > 0 ? `+${american}` : `${american}`;
}
