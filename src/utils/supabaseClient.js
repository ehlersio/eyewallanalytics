/**
 * supabaseClient.js — NHL analytics data access.
 *
 * Historically fetched Supabase directly from the browser (embedded anon
 * key, no caching, bypassing the Worker layer every other endpoint in this
 * app goes through — see eyewall-analytics/CLAUDE.md). Session 44 moved
 * every read behind eyewall-poller Worker routes instead: same tables,
 * same filters/columns, same row shapes, just server-side now with KV
 * caching and no exposed credential. Every function below keeps its exact
 * original signature and row-transform logic — only the transport changed.
 */

import { CURRENT_SEASON } from './teamConfig';

// Season as a number for filter defaults — actual value normally comes
// from the caller (view components track season state themselves); this
// only matters for the rare call site that omits it. CURRENT_SEASON is a
// live `let` binding (see teamConfig.js) updated in place once the
// Worker's live season resolution resolves — read it fresh via
// currentSeason() at each call rather than caching it in a module-level
// const, which would freeze at whatever value existed when this module
// first evaluated (often before that live resolution finishes).
function currentSeason() {
  return Number(CURRENT_SEASON);
}

const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;

async function workerFetch(path) {
  if (!WORKER_URL) {
    console.warn('supabaseClient: VITE_WORKER_URL not set');
    return null;
  }
  try {
    const res = await fetch(`${WORKER_URL}${path}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Worker ${res.status}: ${path}`);
    return await res.json();
  } catch (err) {
    console.warn(`[supabaseClient] ${path} failed:`, err.message);
    throw err;
  }
}

// ── Player analytics ──────────────────────────────────────────
// Returns analytics object keyed by player_id (string), matching
// the shape the app already expects from moneypuck:skaters KV.
export async function getPlayerAnalytics(season = currentSeason()) {
  const { rows, poRows, statsStale, statsSeason } = await workerFetch(`/player-analytics?season=${season}`);

  // Build playoff defensive map: player_id → { hits, blocked_shots, takeaways, giveaways }
  const poDefMap = {};
  for (const r of (poRows || [])) {
    poDefMap[String(r.player_id)] = {
      hits:         r.hits         ?? null,
      blockedShots: r.blocked_shots ?? null,
      takeaways:    r.takeaways    ?? null,
      giveaways:    r.giveaways    ?? null,
    };
  }

  // Transform into the shape PlayerAnalytics component expects
  const result = {};
  for (const r of rows) {
    result[String(r.player_id)] = {
      war:        r.war,
      gp:         r.games_played,
      gameScore:  r.game_score,
      xGF_pct:    r.ev_off_pct != null ? Math.round(r.ev_off_pct * 1000) / 10 : null,
      xGF60:      r.xgf_per60 != null ? Math.round(r.xgf_per60 * 100) / 100 : null,
      xGA60:      r.xga_per60 != null ? Math.round(r.xga_per60 * 100) / 100 : null,
      hdca60:     r.hdca_per60 != null ? Math.round(r.hdca_per60 * 10) / 10 : null,
      goals60:    r.goals_per60,
      a1_60:      r.a1_per60,
      ppToi:      r.pp_icetime ?? null,
      pkToi:      r.pk_icetime ?? null,
      // Results-vs-process (Session 56) — both null below eyewall-pipeline's
      // GP≥25 guardrail (moneypuck.py::RESULTS_VS_PROCESS_MIN_GP). Treat
      // "null" as "not enough games yet," not a missing-data error.
      onIceGfPct:          r.on_ice_gf_pct != null ? Math.round(r.on_ice_gf_pct * 1000) / 10 : null,
      resultsVsProcessDiff: r.results_vs_process_diff != null ? Math.round(r.results_vs_process_diff * 1000) / 10 : null,
      // Regular season defensive (from realtime)
      hits:         r.hits         ?? null,
      blockedShots: r.blocked_shots ?? null,
      takeaways:    r.takeaways    ?? null,
      giveaways:    r.giveaways    ?? null,
      // Playoff defensive — separate object so frontend can inject per section
      poDef: poDefMap[String(r.player_id)] || null,
      // Whole-season fallback flag (Session 66) — true when the live season
      // had no player_seasons rows at all yet (e.g. schedule released well
      // before puck drop) and every field above came from one season back
      // instead. Stamped onto every player's object since the fallback is
      // whole-season, not per-player — PlayerPopup.jsx uses this to label
      // the radar/tile grid "as of <statsSeason>" rather than presenting a
      // stale percentile as current fact.
      statsStale:  !!statsStale,
      statsSeason: statsSeason ?? null,
      percentiles: {
        evOff:     { pct: r.pct_ev_off,      label: 'EV Offence',   note: 'On-ice expected goals for % at 5-on-5. Measures how often your team generates quality chances when this player is on the ice. Above 50% = your team outshoots in quality. Percentile vs all NHL players at same position.' },
        evDef:     { pct: r.pct_ev_def,      label: 'EV Defence',   note: 'On-ice expected goals against per 60 at 5-on-5 (lower is better, inverted so higher = better defender). How many quality chances does the opponent generate when this player is on the ice? Percentile vs all NHL players at same position.' },
        pp:        { pct: r.pct_pp,          label: 'Power Play',   note: 'Power play expected goals for per 60 minutes. Measures offensive contribution on the man advantage. N/A = not enough PP ice time for a reliable number (min 300 seconds). Percentile vs all NHL players at same position.' },
        pk:        { pct: r.pct_pk,          label: 'Penalty Kill', note: 'Penalty kill expected goals against per 60 minutes (lower is better, inverted). How well does this player suppress scoring chances while killing a penalty? Note: this metric does not adjust for the quality of opposing power plays — players who kill penalties against elite PP units (like McDavid\'s) will appear worse than players with lighter usage. N/A = not enough PK ice time (min 300 seconds). Percentile vs all NHL players at same position.' },
        finishing: { pct: r.pct_finishing,   label: 'Finishing',    note: 'Goals scored above what their shot quality predicts per 60 minutes. Positive = consistently beats goalies beyond expectations. Negative = getting unlucky or taking poor shot selections. Filters out shot quality so only pure shooting talent remains. Percentile vs all NHL players at same position.' },
        goals:     { pct: r.pct_goals,       label: 'Goals',        note: 'Goals scored per 60 minutes of ice time. Removes the effect of playing time — a player with 10 goals in 12 min/game scores at a very different rate than 10 goals in 22 min/game. Percentile vs all NHL players at same position.' },
        a1:        { pct: r.pct_a1,          label: '1st Assists',  note: 'Primary (first) assists per 60 minutes. First assists directly set up the goal and are more meaningful than secondary assists. A high rate reflects strong playmaking. Percentile vs all NHL players at same position.' },
        penalties: { pct: r.pct_penalties,   label: 'Penalties',    note: 'Penalty discipline: penalties drawn minus penalties taken, per 60 minutes. Higher is better — drawing penalties gives your team a power play; taking them gives the opponent one. Percentile vs all NHL players at same position.' },
        comp:      { pct: r.pct_competition, label: 'Competition',  note: 'Quality of opponents faced — average on-ice rating of opposing players. High percentile = plays against the toughest competition in the league. Good stats against tough competition are more impressive than the same stats against easy matchups.' },
        teammates: { pct: r.pct_teammates,   label: 'Teammates',    note: 'Team performance with this player on ice vs. off ice (xGF% delta). Positive = team generates better shot quality with them on the ice. Filters out team quality so you can see an individual\'s actual effect on their linemates.' },
      },
    };
  }
  return result;
}

// ── Player shot events ────────────────────────────────────────
// Returns shot data for one player. team= scopes to that player's own
// shots (a player only ever shoots for one team per row) — not restricted
// to games against any particular opponent.
export async function getPlayerShots(playerId, season = currentSeason(), team = 'CAR') {
  const rows = await workerFetch(`/player-shots?playerId=${playerId}&season=${season}&team=${team}`);

  if (!rows?.length) return null;

  const typeMap = {
    'goal':         'g',
    'shot-on-goal': 's',
    'missed-shot':  'm',
    'blocked-shot': 'b',
  };

  return {
    shots: rows.map(r => ({
      x:  r.x,
      y:  r.y,
      t:  typeMap[r.event_type] || 's',
      p:  r.period,
      st: r.shot_type,
    })),
    games: null,
  };
}

// ── Goalie shot events ────────────────────────────────────────
// Returns shots faced by a specific goalie (for heat map).
// No car_game filter — shows all shots faced regardless of opponent.
// goalie_id filter identifies the specific goalie's starts.
export async function getGoalieShots(goalieId, season = currentSeason()) {
  const rows = await workerFetch(`/goalie-shots?goalieId=${goalieId}&season=${season}`);

  if (!rows?.length) return null;

  const typeMap = {
    'goal':         'g',
    'shot-on-goal': 's',
    'missed-shot':  'm',
    'blocked-shot': 'b',
  };

  return {
    shots: rows.map(r => ({
      x:  r.x,
      y:  r.y,
      t:  typeMap[r.event_type] || 's',
      p:  r.period,
      st: r.shot_type,
    })),
    games: null,
  };
}

// ── Season-wide shots for the shot map's "All N" chip ──────────
// Both teams' shots from every game `team` played this season — matches
// what extractShotEvents(pbp) already returns for a single game, just
// aggregated. No shooter/goalie names (shot_events only stores player_id,
// not a name — resolving those would need a season-long roster join this
// view doesn't otherwise need); IceRink renders fine without them.
export async function getSeasonShots(team, season = currentSeason()) {
  const rows = await workerFetch(`/nhl/shots?team=${team}&season=${season}`);
  if (!rows?.length) return [];

  return rows.map(r => ({
    id:           `${r.game_id}-${r.x}-${r.y}-${r.period}-${r.time_in_period}`,
    gameId:       r.game_id,
    x:            r.x,
    y:            r.y,
    type:         r.event_type,
    period:       r.period,
    timeInPeriod: r.time_in_period,
    shotType:     r.shot_type,
    isCanes:      r.team === team,
  }));
}

// ── Goalie analytics ──────────────────────────────────────────
export async function getGoalieAnalytics(season = currentSeason()) {
  const rows = await workerFetch(`/goalie-analytics?season=${season}`);

  const result = {};
  for (const r of (rows || [])) {
    result[String(r.player_id)] = {
      gsax:    r.gsax,
      gsax60:  r.gsax_per60,
      gp:      r.games_played,
      qsPct:   r.qs_pct ?? null,
      qs:      r.qs ?? null,
      evSvPct: r.ev_sv_pct != null ? Math.round(r.ev_sv_pct * 1000) / 10 : null,
      hdSvPct: r.hd_sv_pct != null ? Math.round(r.hd_sv_pct * 1000) / 10 : null,
      mdSvPct: r.md_sv_pct != null ? Math.round(r.md_sv_pct * 1000) / 10 : null,
      pkSvPct: r.pk_sv_pct != null ? Math.round(r.pk_sv_pct * 1000) / 10 : null,
      percentiles: {
        gsax:   { pct: r.pct_gsax,   label: 'GSAX',            note: 'Goals saved above expected — total goals saved vs what an average goalie would save on the same shots (MoneyPuck flurry-adjusted xGoals model). Positive = saving more than expected. The most complete single goalie metric. Percentile vs all NHL goalies (min 10 GP).' },
        gsax60: { pct: r.pct_gsax60, label: 'GSAX/60',         note: 'Goals saved above expected per 60 minutes. Rate-adjusts GSAX so goalies with different workloads can be compared fairly. Useful for backups or goalies who missed time. Percentile vs all NHL goalies (min 10 GP).' },
        evSv:   { pct: r.pct_ev_sv,  label: '5-on-5 SV%',      note: 'Save percentage at even strength (5-on-5 only). Removes special teams situations which can skew overall SV%. The most stable indicator of true goaltending ability. Percentile vs all NHL goalies (min 10 GP).' },
        hdSv:   { pct: r.pct_hd_sv,  label: 'High Danger SV%', note: 'Save percentage on high-danger shots — those taken within ~15 feet of the net, typically the most dangerous scoring chances. The hardest shots to stop; a strong HD SV% is the best quality-adjusted goalie metric. Percentile vs all NHL goalies (min 10 GP).' },
        mdSv:   { pct: r.pct_md_sv,  label: 'Med Danger SV%',  note: 'Save percentage on medium-danger shots (15-30 feet from net). Complements high-danger SV% for a fuller picture of save quality across different shot locations. Percentile vs all NHL goalies (min 10 GP).' },
        pkSv:   { pct: r.pct_pk_sv,  label: 'PK SV%',          note: 'Save percentage while the team is killing a penalty (shorthanded). Penalty kill goaltending requires different positioning and reflexes — some goalies are significantly better in this situation than at even strength. Percentile vs all NHL goalies (min 10 GP).' },
      },
    };
  }
  return result;
}

// ── Line combinations ─────────────────────────────────────────
// Returns inferred forward lines and D pairs for a team, sorted by rank.
// unit_type 'F' = forward line (3 players), 'D' = defence pair (2 players).
// xgf_pct is null when the unit has too few 5v5 chances for a reliable number.
// Position sort order: LW → C → RW
// NHL API returns 'L', 'C', 'R' as positionCode — but DB values can be null
// for edge cases (mid-season callups, etc.). We always use staticLines.js as the
// authoritative position source and enrich inferred players before sorting.
const FWD_ORDER = { L: 0, LW: 0, C: 1, R: 2, RW: 2 };

function buildStaticPosMap(staticData) {
  // Returns Map<playerName -> pos> from static line data
  const map = new Map();
  for (const line of (staticData?.lines || [])) {
    for (const p of line.players) map.set(p.name, p.pos);
  }
  return map;
}

function sortForwardLine(players, posMap) {
  return [...players]
    .map(p => ({ ...p, pos: posMap?.get(p.name) ?? p.pos }))  // enrich from static map
    .sort((a, b) => {
      const ao = FWD_ORDER[a.pos] ?? 1;
      const bo = FWD_ORDER[b.pos] ?? 1;
      return ao - bo;
    });
}

export async function getTeamLines(team = 'CAR', season = currentSeason(), gameType = 2) {
  // Always load static data upfront so we can use it as position authority
  let staticData = null;
  try {
    const { getStaticLines } = await import('./staticLines.js');
    staticData = getStaticLines(team, gameType);
  } catch {}
  const posMap = buildStaticPosMap(staticData);

  // Try live inferred data from the Worker
  const rows = await workerFetch(`/team-lines?team=${team}&season=${season}`).catch(() => []);

  const inferredLines = (rows || []).filter(r => r.unit_type === 'F').map(r => ({
    rank:     r.rank,
    players:  sortForwardLine([
      { name: r.name_a, pos: r.pos_a },
      { name: r.name_b, pos: r.pos_b },
      { name: r.name_c, pos: r.pos_c },
    ].filter(p => p.name), posMap),
    toiMins:  r.toi_secs != null ? Math.round(r.toi_secs / 60) : null,
    xgfPct:   r.xgf_pct != null  ? Math.round(r.xgf_pct * 1000) / 10 : null,
    isStatic: false,
  }));

  const inferredPairs = (rows || []).filter(r => r.unit_type === 'D').map(r => ({
    rank:     r.rank,
    players:  [
      { name: r.name_a, pos: r.pos_a },
      { name: r.name_b, pos: r.pos_b },
    ].filter(p => p.name),
    toiMins:  r.toi_secs != null ? Math.round(r.toi_secs / 60) : null,
    xgfPct:   r.xgf_pct != null  ? Math.round(r.xgf_pct * 1000) / 10 : null,
    isStatic: false,
  }));

  // If inference has all 4 lines, use it
  if (inferredLines.length >= 4) {
    return { lines: inferredLines, pairs: inferredPairs, isInferred: true };
  }

  // Fall back to static — overlay inferred xGF%/TOI by rank
  if (staticData) {
    const inferredByRank    = Object.fromEntries(inferredLines.map(l => [l.rank, l]));
    const inferredPairsByRank = Object.fromEntries(inferredPairs.map(p => [p.rank, p]));

    const lines = staticData.lines.map(sl => {
      const inf = inferredByRank[sl.rank];
      return { ...sl, toiMins: inf?.toiMins ?? sl.toiMins, xgfPct: inf?.xgfPct ?? sl.xgfPct, isStatic: !inf };
    });
    const pairs = staticData.pairs.map(sp => {
      const inf = inferredPairsByRank[sp.rank];
      return { ...sp, toiMins: inf?.toiMins ?? sp.toiMins, xgfPct: inf?.xgfPct ?? sp.xgfPct, isStatic: !inf };
    });

    return { lines, pairs, isInferred: false };
  }

  if (!inferredLines.length && !inferredPairs.length) return null;
  return { lines: inferredLines, pairs: inferredPairs, isInferred: true };
}

// ── Game-level xG (MoneyPuck) ─────────────────────────────────
// Returns two rows (CAR + OPP) for a completed game.
// MoneyPuck data available ~2-4h post-game — returns null for live games.
// Frontend falls back to coordinate-estimate xG when this returns null.
export async function getGameXG(gameId) {
  if (!gameId) return null;
  const rows = await workerFetch(`/game-xg?gameId=${gameId}`);
  if (!rows?.length) return null;
  return rows;
}

// ── Game log insights ─────────────────────────────────────────
// Returns team-specific situational stats for Live Insights.
// Requires team_scored_first boolean in game_log (added by nhl_stats.py).
export async function getGameLogInsights(oppAbbr, season = currentSeason(), teamAbbr = 'CAR') {
  const rows = await workerFetch(`/game-log?team=${teamAbbr}&season=${season}`).catch(() => null);

  if (!rows?.length) return null;

  const completed = rows.filter(r => r.team_score != null && r.opp_score != null);
  const wins      = completed.filter(r => r.team_score > r.opp_score);
  const total     = completed.length;

  // When team scored first
  const scoredFirst      = completed.filter(r => r.team_scored_first);
  const scoredFirstWins  = scoredFirst.filter(r => r.team_score > r.opp_score);
  const scoredFirstWinPct = scoredFirst.length > 0
    ? Math.round(scoredFirstWins.length / scoredFirst.length * 100) : null;

  // When team did NOT score first
  const didntScoreFirst     = completed.filter(r => r.team_scored_first === false);
  const didntScoreFirstWins = didntScoreFirst.filter(r => r.team_score > r.opp_score);
  const didntScoreFirstWinPct = didntScoreFirst.length > 0
    ? Math.round(didntScoreFirstWins.length / didntScoreFirst.length * 100) : null;

  // Head-to-head vs this opponent (regular season)
  const vsOpp      = completed.filter(r => r.opponent === oppAbbr);
  const vsOppWins  = vsOpp.filter(r => r.team_score > r.opp_score);
  const vsOppRecord = vsOpp.length > 0
    ? { w: vsOppWins.length, l: vsOpp.length - vsOppWins.length, gp: vsOpp.length }
    : null;

  // Series record (playoffs — last 7 games vs same opponent covers a series)
  const recentVsOpp = vsOpp.slice(-7);
  const seriesWins  = recentVsOpp.filter(r => r.team_score > r.opp_score).length;
  const seriesRecord = recentVsOpp.length >= 2
    ? { w: seriesWins, l: recentVsOpp.length - seriesWins, gp: recentVsOpp.length }
    : null;

  return {
    total,
    wins: wins.length,
    scoredFirstWinPct,
    scoredFirstGames:  scoredFirst.length,
    didntScoreFirstWinPct,
    vsOppRecord,
    seriesRecord,
  };
}

export async function getTeamGameLog(count = 120, season = currentSeason(), teamAbbr = 'CAR') {
  const rows = await workerFetch(`/game-log?team=${teamAbbr}&season=${season}&limit=${count}`).catch(() => null);
  if (!rows?.length) return null;
  return rows.map(r => ({
    gameId:          r.game_id,
    date:            r.game_date,
    opp:             r.opponent,
    carScore:        r.team_score,
    oppScore:        r.opp_score,
    home:            r.home_team === teamAbbr,
    won:             r.team_score > r.opp_score,
    ot:              false,
    result:          r.team_score > r.opp_score ? 'W' : 'L',
    isPlayoff:       r.game_type === 3,
    scoredFirst:     r.team_scored_first,
    ppGoals:         r.pp_goals,
    ppOpps:          r.pp_opps,
    pkGoalsAgainst:  r.pk_goals_against,
    pkOpps:          r.pk_opps,
  }));
}

// Fetches team_seasons data needed for power rankings (xgf_pct +
// roster_war_score) and the Standings tab's magic/tragic number display
// (Session 59) for all 32 teams in one call.
// Replaces the earlier getTeamSeasonXg — same call, extra columns.
export async function getTeamSeasonData(season = currentSeason()) {
  const rows = await workerFetch(`/team-seasons?season=${season}`).catch(() => []);
  const map = {};
  for (const r of (rows || [])) {
    map[r.team] = {
      xgfPct:       r.xgf_pct,
      rosterWar:    r.roster_war_score,
      gp:           r.games_played,
      magicNumber:  r.magic_number,
      tragicNumber: r.tragic_number,
      clinched:     r.clinched,
      eliminated:   r.eliminated,
    };
  }
  return map;
}

// Fetches the most recent power rankings narrative for the user's team.
// Returns { narrative, rank, prior_rank, generated_date } or null.
export async function getPowerRankingsNarrative(teamAbbr, season = currentSeason()) {
  const rows = await workerFetch(`/power-rankings?team=${teamAbbr}&season=${season}&limit=1`).catch(() => []);
  return rows?.[0] ?? null;
}

// Fetches rank history for the sparkline — last 28 days.
// Returns array of { generated_date, rank } oldest-first.
export async function getPowerRankingsHistory(teamAbbr, season = currentSeason()) {
  const rows = await workerFetch(`/power-rankings?team=${teamAbbr}&season=${season}&limit=28`).catch(() => []);
  return (rows || []).reverse(); // oldest first for charting
}

// ── Game matchup analysis ────────────────────────────────────
// Returns the AI-generated line/player matchup analysis, or null if none exists.
export async function getGameMatchup(gameId) {
  if (!gameId) return null;
  const rows = await workerFetch(`/game-predictions?gameId=${gameId}`)
    .catch(e => { console.warn('[getGameMatchup] fetch error:', e.message); return null; });
  if (!rows?.length || !rows[0]?.matchup_text) return null;
  return { text: rows[0].matchup_text, generatedAt: rows[0].generated_at };
}

// ── Game prediction ───────────────────────────────────────────
// Returns the AI-generated pre-game prediction narrative, or null if none exists.
export async function getGamePrediction(gameId) {
  if (!gameId) return null;
  const rows = await workerFetch(`/game-predictions?gameId=${gameId}`).catch(() => []);
  if (!rows?.length || !rows[0]?.prediction_text) return null;
  return { text: rows[0].prediction_text, generatedAt: rows[0].generated_at };
}

// ── Game summary ──────────────────────────────────────────────
// Returns the AI-generated post-game summary for a team, or null if none exists.
export async function getGameSummary(gameId, team) {
  if (!gameId || !team) return null;
  const rows = await workerFetch(`/game-summary?gameId=${gameId}&team=${team}`).catch(() => []);
  if (!rows?.length) return null;
  return { text: rows[0].summary_text, cardText: rows[0].card_text || null, generatedAt: rows[0].generated_at };
}

// ── Player scouting blurb ─────────────────────────────────────
// Returns the AI-generated scouting blurb for a player, or null if none exists.
export async function getScoutingBlurb(playerId, season = currentSeason()) {
  const rows = await workerFetch(`/player-scouting?playerId=${playerId}&season=${season}`).catch(() => []);
  if (!rows?.length) return null;
  return { blurb: rows[0].scouting_text, generatedAt: rows[0].generated_at };
}

// ── Results-vs-process narrative (Session 56, NHL skaters only) ──
// Returns the AI-generated "results vs. process" blurb for a player, or
// null if none exists yet (either not enough games, or not generated yet).
export async function getResultsVsProcessNarrative(playerId, season = currentSeason()) {
  const rows = await workerFetch(`/player-results-vs-process?playerId=${playerId}&season=${season}`).catch(() => []);
  if (!rows?.length) return null;
  return { blurb: rows[0].narrative_text, generatedAt: rows[0].generated_at };
}

export async function getTeamSkaterStatsFromDB(team = 'CAR', season = currentSeason(), gameType = 2) {
  const [seasonRows, playerRows] = await Promise.all([
    workerFetch(`/team-skaters?team=${team}&season=${season}&gameType=${gameType}`),
    workerFetch('/players-list'),
  ]);

  const playerMap = {};
  (playerRows || []).forEach(p => { playerMap[p.id] = p; });

  return (seasonRows || []).map(r => {
    const p = playerMap[r.player_id] || {};
    return {
      ...r,
      skaterFullName:   p.name || String(r.player_id),
      positionCode:     p.position || '—',
      playerId:         r.player_id,
      gamesPlayed:      r.games_played,
      primaryAssists:   r.primary_assists,
      secondaryAssists: r.secondary_assists,
      plusMinus:        r.plus_minus,
      penaltyMinutes:   r.pim,
      ppGoals:          r.pp_goals,
      shGoals:          r.sh_goals,
      gameWinningGoals: r.gw_goals,
      shootingPct:      r.shooting_pct,
    };
  });
}

// ── Special teams units ───────────────────────────────────────
// Returns PP/PK unit compositions for all teams keyed by abbr.
// Shape: { CAR: { PP: { 1: [ids], 2: [ids] }, PK: { 1: [ids], 2: [ids] } }, ... }
//
// Old version of this function checked a Worker-KV-first path via
// `/cache/pp_units:all`, reading `kv.value` off the response — but that
// route returns the parsed KV value directly (see shared.js's kvGet,
// which already does its own JSON.parse), not wrapped in `{ value }`. So
// `kv?.value` was always undefined and this silently fell through to a
// direct Supabase call on *every* invocation — the KV-first path was
// dead code the whole time. /special-teams (added Session 44) does the
// same KV read correctly server-side and needs no client-side unwrapping.
export async function getSpecialTeamsUnits() {
  const map = await workerFetch('/special-teams').catch(() => null);
  return map || {};
}

// ── xGF% per-game trend ───────────────────────────────────────
// Returns { season: [...], last10: [...] } for the sparkline.
// Each item: { gameId, date, opponent, teamScore, oppScore, xgfPct }
// Joins game_xg (5on5) with game_log for date + opponent.
// Both arrays are chronological (oldest first).
export async function getTeamXgTrend(team = 'CAR', season = currentSeason()) {
  const [xgRows, logRows] = await Promise.all([
    workerFetch(`/xg-trend?team=${team}&season=${season}`).catch(() => []),
    workerFetch(`/game-log?team=${team}&season=${season}`).catch(() => []),
  ]);

  if (!xgRows?.length || !logRows?.length) return null;

  // Build game_log map keyed by game_id
  const logMap = {};
  for (const r of logRows) logMap[r.game_id] = r;

  // Join, filter to completed games with xg data, sort by date
  const joined = xgRows
    .map(r => {
      const log = logMap[r.game_id];
      if (!log || log.team_score == null) return null;
      return {
        gameId:    r.game_id,
        date:      log.game_date,
        opponent:  log.opponent,
        teamScore: log.team_score,
        oppScore:  log.opp_score,
        xgfPct:   Math.round(parseFloat(r.xgf_pct) * 1000) / 10, // e.g. 54.3
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    season: joined,
    last10: joined.slice(-10),
  };
}
