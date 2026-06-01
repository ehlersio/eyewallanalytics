/**
 * supabaseClient.js — Supabase read-only client for the app.
 * Uses the public anon key — safe to expose in the browser.
 */

const SUPABASE_URL = 'https://mqgasjzywoibdgxjjkux.supabase.co';
const SUPABASE_ANON = 'sb_publishable_e_zwr1UA7GnHq4OuQSas5Q_kO8bQ_Ct';

const HEADERS = {
  'apikey':        SUPABASE_ANON,
  'Authorization': `Bearer ${SUPABASE_ANON}`,
  'Content-Type':  'application/json',
};

async function sbFetch(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${path}`);
  return r.json();
}

// ── Player analytics ──────────────────────────────────────────
// Returns analytics object keyed by player_id (string), matching
// the shape the app already expects from moneypuck:skaters KV.
export async function getPlayerAnalytics(season = 20252026) {
  const rows = await sbFetch(
    `player_seasons?season=eq.${season}&game_type=eq.2` +
    `&war=not.is.null` +
    `&select=player_id,team,war,ev_off_pct,ev_def_inv,pp_xgf60,pk_xga60_inv,pp_icetime,pk_icetime,` +
    `finishing,goals_per60,a1_per60,xgf_per60,penalties_per60,competition,teammates,game_score,` +
    `pct_ev_off,pct_ev_def,pct_pp,pct_pk,pct_finishing,pct_goals,pct_a1,` +
    `pct_penalties,pct_competition,pct_teammates,games_played`
  );

  // Transform into the shape PlayerAnalytics component expects
  const result = {};
  for (const r of rows) {
    result[String(r.player_id)] = {
      war:        r.war,
      gp:         r.games_played,
      gameScore:  r.game_score,
      xGF_pct:    r.ev_off_pct != null ? Math.round(r.ev_off_pct * 1000) / 10 : null,
      xGF60:      r.xgf_per60 != null ? Math.round(r.xgf_per60 * 100) / 100 : null,
      goals60:    r.goals_per60,
      a1_60:      r.a1_per60,
      ppToi:      r.pp_icetime ?? null,
      pkToi:      r.pk_icetime ?? null,
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
// Returns shot data for one CAR player's shots.
// car_game=true ensures we only get shots from CAR games.
// team=CAR ensures we get the shooter (not opponent) rows.
export async function getPlayerShots(playerId, season = 20252026) {
  const rows = await sbFetch(
    `shot_events?player_id=eq.${playerId}&season=eq.${season}` +
    `&car_game=eq.true&team=eq.CAR` +
    `&select=x,y,event_type,period,time_in_period,shot_type&limit=2000`
  );

  if (!rows.length) return null;

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
// car_game=true + goalie_id filter = shots against CAR goalies.
// For opposing goalies: no car_game filter, just goalie_id.
export async function getGoalieShots(goalieId, season = 20252026) {
  const rows = await sbFetch(
    `shot_events?goalie_id=eq.${goalieId}&season=eq.${season}` +
    `&car_game=eq.true` +
    `&select=x,y,event_type,period,time_in_period,shot_type,team&limit=2000`
  );

  if (!rows.length) return null;

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

// ── Goalie analytics ──────────────────────────────────────────
export async function getGoalieAnalytics(season = 20252026) {
  const rows = await sbFetch(
    `goalie_seasons?season=eq.${season}&game_type=eq.2` +
    `&gsax=not.is.null` +
    `&select=player_id,team,games_played,gsax,gsax_per60,` +
    `ev_sv_pct,hd_sv_pct,md_sv_pct,pk_sv_pct,` +
    `pct_gsax,pct_gsax60,pct_ev_sv,pct_hd_sv,pct_md_sv,pct_pk_sv`
  );

  const result = {};
  for (const r of rows) {
    result[String(r.player_id)] = {
      gsax:    r.gsax,
      gsax60:  r.gsax_per60,
      gp:      r.games_played,
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

// ── Game-level xG (MoneyPuck) ─────────────────────────────────
// Returns two rows (CAR + OPP) for a completed game.
// MoneyPuck data available ~2-4h post-game — returns null for live games.
// Frontend falls back to coordinate-estimate xG when this returns null.
export async function getGameXG(gameId) {
  if (!gameId) return null;
  const rows = await sbFetch(
    `game_xg?game_id=eq.${gameId}&situation=eq.5on5` +
    `&select=team,xgf,xga,xgf_pct`
  );
  if (!rows?.length) return null;
  return rows;
}

// ── Game log insights ─────────────────────────────────────────
// Returns team-specific situational stats for Live Insights.
// Requires car_scored_first boolean in game_log (added by nhl_stats.py).
export async function getGameLogInsights(oppAbbr, season = 20252026) {
  const rows = await sbFetch(
    `game_log?season=eq.${season}&select=game_id,opponent,car_score,opp_score,` +
    `car_scored_first,home_team&order=game_id.asc`
  ).catch(() => null);

  if (!rows?.length) return null;

  const completed = rows.filter(r => r.car_score != null && r.opp_score != null);
  const wins      = completed.filter(r => r.car_score > r.opp_score);
  const total     = completed.length;

  // When CAR scored first
  const scoredFirst      = completed.filter(r => r.car_scored_first);
  const scoredFirstWins  = scoredFirst.filter(r => r.car_score > r.opp_score);
  const scoredFirstWinPct = scoredFirst.length > 0
    ? Math.round(scoredFirstWins.length / scoredFirst.length * 100) : null;

  // When CAR did NOT score first
  const didntScoreFirst     = completed.filter(r => r.car_scored_first === false);
  const didntScoreFirstWins = didntScoreFirst.filter(r => r.car_score > r.opp_score);
  const didntScoreFirstWinPct = didntScoreFirst.length > 0
    ? Math.round(didntScoreFirstWins.length / didntScoreFirst.length * 100) : null;

  // Head-to-head vs this opponent (regular season)
  const vsOpp      = completed.filter(r => r.opponent === oppAbbr);
  const vsOppWins  = vsOpp.filter(r => r.car_score > r.opp_score);
  const vsOppRecord = vsOpp.length > 0
    ? { w: vsOppWins.length, l: vsOpp.length - vsOppWins.length, gp: vsOpp.length }
    : null;

  // Series record (playoffs — game_type filter would be better but game_log uses season)
  // Approximate: look for consecutive games vs same opponent near the end of season
  const recentVsOpp = vsOpp.slice(-7); // last 7 games vs this opp (covers a series)
  const seriesWins  = recentVsOpp.filter(r => r.car_score > r.opp_score).length;
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

// ── Team skater stats ─────────────────────────────────────────
export async function getTeamSkaterStatsFromDB(team = 'CAR', season = 20252026, gameType = 2) {
  const [seasonRows, playerRows] = await Promise.all([
    sbFetch(
      `player_seasons?team=eq.${team}&season=eq.${season}&game_type=eq.${gameType}` +
      `&select=player_id,games_played,goals,assists,primary_assists,secondary_assists,` +
      `points,plus_minus,pim,pp_goals,sh_goals,gw_goals,shots,shooting_pct,` +
      `toi_per_game&order=points.desc.nullslast`
    ),
    sbFetch(`players?select=id,name,position`),
  ]);

  const playerMap = {};
  playerRows.forEach(p => { playerMap[p.id] = p; });

  return seasonRows.map(r => {
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
