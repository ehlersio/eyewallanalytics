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
    `&select=player_id,team,war,ev_off_pct,ev_def_inv,pp_xgf60,pk_xga60_inv,` +
    `finishing,goals_per60,a1_per60,penalties_per60,competition,teammates,game_score,` +
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
      goals60:    r.goals_per60,
      a1_60:      r.a1_per60,
      ppToi:      r.pp_xgf60 != null ? 1 : 0, // presence flag — actual TOI not stored
      pkToi:      r.pk_xga60_inv != null ? 1 : 0,
      percentiles: {
        evOff:     { pct: r.pct_ev_off,     label: 'EV Offence',   note: 'On-ice xGF% at 5-on-5' },
        evDef:     { pct: r.pct_ev_def,     label: 'EV Defence',   note: 'On-ice xGA/60 at 5-on-5' },
        pp:        { pct: r.pct_pp,         label: 'Power Play',   note: 'PP xGF/60' },
        pk:        { pct: r.pct_pk,         label: 'Penalty Kill', note: 'PK xGA/60' },
        finishing: { pct: r.pct_finishing,  label: 'Finishing',    note: 'Goals above xGoals per 60' },
        goals:     { pct: r.pct_goals,      label: 'Goals',        note: 'Goals per 60 min' },
        a1:        { pct: r.pct_a1,         label: '1st Assists',  note: 'Primary assists per 60 min' },
        penalties: { pct: r.pct_penalties,  label: 'Penalties',    note: 'Penalty discipline' },
        comp:      { pct: r.pct_competition,label: 'Competition',  note: 'Quality of competition faced' },
        teammates: { pct: r.pct_teammates,  label: 'Teammates',    note: 'On-ice vs off-ice xGF% delta' },
      },
    };
  }
  return result;
}

// ── Player shot events ────────────────────────────────────────
// Returns shot data for one player in the shape the heat map expects.
export async function getPlayerShots(playerId, season = 20252026) {
  const rows = await sbFetch(
    `shot_events?player_id=eq.${playerId}&season=eq.${season}` +
    `&select=x,y,event_type,period,time_in_period,shot_type&limit=1000`
  );

  if (!rows.length) return null;

  // Convert to compact format matching existing heat map component
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
    games: null, // we don't store this separately
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
