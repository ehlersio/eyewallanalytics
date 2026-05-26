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

const CAR_TEAM_ID = 12;
const CAR_ABBR    = 'CAR';

// ✅ Current season: 2025-26
const SEASON = '20252026';

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

// Read from Worker KV cache — returns null if Worker unavailable or key missing
async function kvFetch(key) {
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}/cache/${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null; // 404 = not in KV yet, fall through to direct NHL
    return res.json();
  } catch {
    return null;
  }
}

// ─── SCHEDULE ────────────────────────────────────────────────

// Fetch ALL CAR games for the season (regular + playoffs together)
// Short cache (20s) prevents hammering during rapid successive calls,
// but stays fresh enough to detect live game state changes
async function getAllGames() {
  return cached('allGames', async () => {
    // Try Worker KV first (pre-polled, zero per-user NHL calls)
    const cached_kv = await kvFetch(`schedule:${CAR_ABBR}`);
    if (cached_kv) return cached_kv;
    // Fall back to direct NHL call
    const data = await nhlFetch(`${BASE}/club-schedule-season/${CAR_ABBR}/${SEASON}`);
    return data?.games || [];
  }, TTL.SHORT / 3); // 20 seconds client-side cache
}

// Regular season games only (gameType === 2)
export async function getRegularSeasonGames() {
  const games = await getAllGames();
  return games.filter(g => g.gameType === GAME_TYPE.REGULAR);
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
export async function getLiveGame() {
  const games = await getAllGames();
  return games.find(g => g.gameState === 'LIVE' || g.gameState === 'CRIT') || null;
}

// Is a game finished?
function isCompleted(game) {
  // Only trust explicit completed game states — never infer from score presence
  // (scheduled games have score=0 which falsely triggered the old fallback)
  return ['OFF', 'FINAL', 'F', 'FINAL_OVERTIME', 'FINAL_SHOOTOUT'].includes(game.gameState);
}

// ─── PLAYOFF SERIES ──────────────────────────────────────────

// Get the current playoff bracket/series overview
export async function getPlayoffBracket() {
  return await nhlFetch(`${BASE}/playoff-bracket/${SEASON}`);
}

// Get all playoff series with results
export async function getPlayoffSeries() {
  const data = await nhlFetch(`${BASE}/playoff-series/carousel/${SEASON}`);
  return data?.rounds || [];
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
export async function getTeamStats(teamAbbr = CAR_ABBR) {
  return cached(`teamStats:${teamAbbr}`, () => _getTeamStats(teamAbbr), TTL.TEAM_STATS);
}
async function _getTeamStats(teamAbbr = CAR_ABBR) {
  const standings = await getStandings();
  const team = standings.find(t => t.teamAbbrev?.default === teamAbbr);

  if (!team) {
    console.warn('Could not find team in standings, using fallback');
    return FALLBACK_STATS;
  }

  const gp = team.gamesPlayed || 1;

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

// ─── ROSTER ──────────────────────────────────────────────────

export async function getRoster(teamAbbr = CAR_ABBR) {
  return cached(`roster:${teamAbbr}`, () => _getRoster(teamAbbr), TTL.SCHEDULE);
}
async function _getRoster(teamAbbr = CAR_ABBR) {
  const data = await nhlFetch(`${BASE}/roster/${teamAbbr}/${SEASON}`);
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

// Fetch league-wide skater stats sorted by points.
// limit=-1 returns ALL results (no pagination needed).
// Proxied through /nhl-stats → https://api.nhle.com
async function fetchSkaterLeaders(gameTypeId = 2) {
  const season = '20252026';
  const sort   = encodeURIComponent(JSON.stringify([
    { property: 'points',   direction: 'DESC' },
    { property: 'goals',    direction: 'DESC' },
    { property: 'playerId', direction: 'ASC'  },
  ]));
  const exp = encodeURIComponent(`seasonId=${season} and gameTypeId=${gameTypeId}`);
  // limit=-1 returns all players in one call — no pagination required
  const url = `/nhl-stats/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=${sort}&start=0&limit=-1&cayenneExp=${exp}`;
  return await nhlFetch(url);
}

async function fetchGoalieLeaders(gameTypeId = 2) {
  const season = '20252026';
  // Goalie endpoint only accepts seasonId in cayenneExp (not gameTypeId).
  // We fetch the regular season data (gameTypeId=2 is the default/only accepted).
  // For playoff ranking we still use the reg season leaderboard as context —
  // playoff goalie samples are too small for meaningful rank comparisons.
  const exp = encodeURIComponent(`seasonId=${season} and gameTypeId=2`);
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
  return await nhlFetch(`${BASE}/gamecenter/${gameId}/landing`);
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
  return await nhlFetch(`${BASE}/gamecenter/${gameId}/right-rail`);
}

// Fetch completed game stats — uses landing as primary, with parallel fallbacks.
// The landing endpoint layout varies by game; we search all known locations.
export async function getCompletedGameStats(gameId) {
  // Fetch all four in parallel — landing is richest, PBP needed for Corsi/Fenwick/PDO
  const [landing, boxscore, rightRail, pbp] = await Promise.all([
    getGameLanding(gameId),
    getGameBoxscore(gameId),
    getGameRightRail(gameId),
    getGameDetail(gameId),
  ]);

  const pbg =
    landing?.boxscore?.playerByGameStats  ||
    landing?.playerByGameStats            ||
    boxscore?.playerByGameStats           || null;

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
        isCanes:      d.eventOwnerTeamId === CAR_TEAM_ID,
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
  return game.homeTeam?.abbrev === CAR_ABBR ? game.awayTeam : game.homeTeam;
}

export function isHomeGame(game) {
  return game?.homeTeam?.abbrev === CAR_ABBR;
}

export function getCarScore(game) {
  if (!game) return null;
  return game.homeTeam?.abbrev === CAR_ABBR
    ? game.homeTeam?.score
    : game.awayTeam?.score;
}

export function getOppScore(game) {
  if (!game) return null;
  return game.homeTeam?.abbrev === CAR_ABBR
    ? game.awayTeam?.score
    : game.homeTeam?.score;
}

// ─── OPPONENT SCOUTING ───────────────────────────────────────
export async function getTeamRecentGames(teamAbbr, count = 10, playoffsOnly = false) {
  return cached(`recentGames:${teamAbbr}:${count}:${playoffsOnly}`, async () => {
    const data = await nhlFetch(`${BASE}/club-schedule-season/${teamAbbr}/${SEASON}`);
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
  return cached(`topPlayers:${teamAbbr}:${gameType}:v2`, async () => {
    const data = await nhlFetch(`${BASE}/club-stats/${teamAbbr}/${SEASON}/${gameType}`);
    const skaters = (data?.skaters || [])
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, 5)
      .map(p => ({
        name:    `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(),
        pos:     p.positionCode,
        goals:   p.goals ?? 0,
        assists: p.assists ?? 0,
        points:  p.points ?? 0,
        toi:     p.avgToi,
      }));
    const goalies = (data?.goalies || [])
      .sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0))
      .slice(0, 2)
      .map(g => ({
        name:         `${g.firstName?.default || ''} ${g.lastName?.default || ''}`.trim(),
        wins:         g.wins ?? 0,
        savePct:      g.savePercentage ?? g.savePctg ?? null,
        gaa:          g.goalsAgainstAvg ?? 0,
        shotsAgainst: g.shotsAgainst,
        saves:        g.saves,
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
  UTA: '#69b3e7', BUF: '#003087',
};

// ─── Team advanced stats ──────────────────────────────────────
const TEAM_ID_CAR  = 12; // NHL team ID for CAR (used in team/summary)
const FRANCHISE_CAR = 26; // Franchise ID (Whalers/Hurricanes) for puckPossessions, goalsForAgainst
const STATS_SEASON = '20252026';

// Build URL for team stat endpoints.
// Key: cayenneExp must use seasonId<=X and seasonId>=X (double-bound) not seasonId=X
// Also needs isAggregate and isGame params for report endpoints like puckPossessions
function teamStatsUrl(report, gameTypeId = 2) {
  const s = STATS_SEASON;
  const exp = encodeURIComponent(
    `franchiseId=${FRANCHISE_CAR} and gameTypeId=${gameTypeId} and seasonId<=${s} and seasonId>=${s}`
  );
  return `/nhl-stats/stats/rest/en/team/${report}?isAggregate=false&isGame=false&sort=wins&limit=1&cayenneExp=${exp}`;
}

// Find CAR from an array of team records
function findCAR(data) {
  return data?.find(t =>
    t.teamAbbrevs === 'CAR' ||
    t.teamAbbrev  === 'CAR' ||
    t.teamId === TEAM_ID_CAR ||
    t.franchiseId === FRANCHISE_CAR
  ) || null;
}

// Team summary cached — shared by corsi, pp, pk
async function _getTeamSummary(gameTypeId) {
  const url = teamStatsUrl('summary', gameTypeId);
  const d   = await nhlFetch(url);
  return d?.data?.[0] || null;
}

// Shot differential from team summary (proxy for possession/Corsi)
// puckPossessions and goalsForAgainst team endpoints are broken on api.nhle.com
export async function getTeamCorsi(gameTypeId = 2) {
  const t = await cached(`teamSummary:${gameTypeId}`, () => _getTeamSummary(gameTypeId), TTL.ADVANCED);
  if (!t) return null;
  // Shot% as proxy for Fenwick%
  const sf = t.shotsForPerGame  || 0;
  const sa = t.shotsAgainstPerGame || 0;
  const total = sf + sa;
  return {
    ...t,
    corsiForPct: total > 0 ? sf / total : null,
    fenwickForPct: total > 0 ? sf / total : null, // same proxy
    shotsForPerGame: sf,
    shotsAgainstPerGame: sa,
  };
}

// Realtime stats: blocked shots, hits, giveaways, takeaways
export async function getTeamRealtime(gameTypeId = 2) {
  return cached(`teamRealtime:${gameTypeId}`, async () => {
    const s   = STATS_SEASON;
    const exp = encodeURIComponent(
      `teamId=${CAR_TEAM_ID} and gameTypeId=${gameTypeId} and seasonId<=${s} and seasonId>=${s}`
    );
    const url = `/nhl-stats/stats/rest/en/team/realtime?isAggregate=false&isGame=false&sort=wins&limit=1&cayenneExp=${exp}`;
    const d   = await nhlFetch(url);
    const t   = d?.data?.[0] || null;
    if (t) console.log('[EyeWall] realtime keys:', Object.keys(t));
    return t;
  }, TTL.ADVANCED);
}

// Score-state splits — endpoint broken, returns null gracefully
export async function getTeamScoreState(gameTypeId = 2) {
  return null; // team/goalsForAgainst endpoint unavailable
}

// Power play / Penalty kill — from team/summary
// Available fields: powerPlayPct, powerPlayNetPct, penaltyKillPct, penaltyKillNetPct
// Goals and opportunity counts are NOT in team/summary; derive where possible from standings
export async function getTeamPowerplay(gameTypeId = 2) {
  return cached(`teamSummary:${gameTypeId}`, () => _getTeamSummary(gameTypeId), TTL.ADVANCED);
}

export async function getTeamPenaltyKill(gameTypeId = 2) {
  return cached(`teamSummary:${gameTypeId}`, () => _getTeamSummary(gameTypeId), TTL.ADVANCED);
}

// Home/Away splits from team summary (homeRoadQuery)
export async function getTeamHomeSplit(gameTypeId = 2) {
  return cached(`homeSplit:${gameTypeId}`, () => _getTeamHomeSplit(gameTypeId), TTL.ADVANCED);
}
async function _getTeamHomeSplit(gameTypeId = 2) {
  const homeExp = encodeURIComponent(`seasonId=${STATS_SEASON} and gameTypeId=${gameTypeId} and homeRoad="H"`);
  const awayExp = encodeURIComponent(`seasonId=${STATS_SEASON} and gameTypeId=${gameTypeId} and homeRoad="R"`);
  const [home, away] = await Promise.all([
    nhlFetch(`/nhl-stats/stats/rest/en/team/summary?limit=50&sort=wins&cayenneExp=${homeExp}`),
    nhlFetch(`/nhl-stats/stats/rest/en/team/summary?limit=50&sort=wins&cayenneExp=${awayExp}`),
  ]);
  return {
    home: findCAR(home?.data) || null,
    away: findCAR(away?.data) || null,
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
  const games = await nhlFetch(`${BASE}/club-schedule-season/${CAR_ABBR}/${SEASON}`);
  const allGames = games?.games || [];
  const completed = allGames
    .filter(g => ['OFF','FINAL','F'].includes(g.gameState))
    .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))
    .slice(0, count)
    .reverse(); // chronological

  return completed.map(g => {
    const home    = g.homeTeam?.abbrev === CAR_ABBR;
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


// ─── ODDS (The Odds API) ─────────────────────────────────────
// Free tier: 500 requests/month. Get a key at https://the-odds-api.com
// Add your key to a .env file as: VITE_ODDS_API_KEY=your_key_here
// Without a key, this returns null gracefully.

const ODDS_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_KEY  = import.meta.env.VITE_ODDS_API_KEY || null;

// Fetch NHL moneyline odds for upcoming games
// Returns array of { homeTeam, awayTeam, commence_time, bookmakers }
export async function getNhlOdds() {
  if (!ODDS_KEY) return null;
  try {
    const url = `${ODDS_BASE}/sports/icehockey_nhl/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h&oddsFormat=american`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Find odds for a specific game by matching team names
// oddsData: array from getNhlOdds()
// game: NHL API game object
export function findGameOdds(oddsData, game) {
  if (!oddsData?.length || !game) return null;
  const opp    = getOpponent(game);
  const oppAbbr = opp?.abbrev?.toLowerCase() || '';
  const oppName = (opp?.commonName?.default || opp?.placeName?.default || '').toLowerCase();

  return oddsData.find(od => {
    const home = od.home_team?.toLowerCase() || '';
    const away = od.away_team?.toLowerCase() || '';
    const combined = home + ' ' + away;
    // Match by city/name fragment — "Carolina" or "Hurricanes"
    return combined.includes('carolina') &&
           (combined.includes(oppName) || combined.includes(oppAbbr));
  }) || null;
}

// Extract best available moneyline odds for CAR and opponent
// Returns { carOdds, oppOdds, book } or null
export function extractMoneyline(oddsEntry, isHome) {
  if (!oddsEntry?.bookmakers?.length) return null;
  // Prefer DraftKings, then FanDuel, then first available
  const preferred = ['draftkings','fanduel','betmgm','williamhill'];
  let book = oddsEntry.bookmakers.find(b => preferred.includes(b.key));
  if (!book) book = oddsEntry.bookmakers[0];

  const market = book.markets?.find(m => m.key === 'h2h');
  if (!market?.outcomes?.length) return null;

  const carOut = market.outcomes.find(o =>
    o.name?.toLowerCase().includes('carolina') || o.name?.toLowerCase().includes('hurricanes')
  );
  const oppOut = market.outcomes.find(o => o !== carOut);

  if (!carOut || !oppOut) return null;
  return {
    carOdds: carOut.price,
    oppOdds: oppOut.price,
    book:    book.title || book.key,
  };
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
