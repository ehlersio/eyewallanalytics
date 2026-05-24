// ── Advanced Hockey Stats ─────────────────────────────────────
// Corsi, Fenwick, PDO, Puck Luck, GSAx
// All computable from public NHL API data

const CAR_TEAM_ID = 12;

// ── Shot attempt classification ───────────────────────────────
// Corsi  = goals + shots on goal + missed shots + blocked shots
// Fenwick = goals + shots on goal + missed shots (excludes blocked)

export function computeShotAttempts(plays, carTeamId = CAR_TEAM_ID) {
  const counts = {
    car: { goals: 0, sog: 0, missed: 0, blocked: 0 },
    opp: { goals: 0, sog: 0, missed: 0, blocked: 0 },
  };

  plays.forEach(p => {
    const isCar = p.details?.eventOwnerTeamId === carTeamId;
    const side  = isCar ? 'car' : 'opp';
    switch (p.typeDescKey) {
      case 'goal':         counts[side].goals++;   counts[side].sog++;     break;
      case 'shot-on-goal': counts[side].sog++;                             break;
      case 'missed-shot':  counts[side].missed++;                          break;
      case 'blocked-shot': counts[side].blocked++;                         break;
    }
  });

  const carCorsi   = counts.car.goals + counts.car.sog + counts.car.missed + counts.car.blocked;
  const oppCorsi   = counts.opp.goals + counts.opp.sog + counts.opp.missed + counts.opp.blocked;
  const carFenwick = counts.car.goals + counts.car.sog + counts.car.missed;
  const oppFenwick = counts.opp.goals + counts.opp.sog + counts.opp.missed;

  const totalCorsi   = carCorsi   + oppCorsi   || 1;
  const totalFenwick = carFenwick + oppFenwick || 1;

  return {
    car:          counts.car,
    opp:          counts.opp,
    carCorsi,     oppCorsi,
    carFenwick,   oppFenwick,
    corsiForPct:   +(carCorsi   / totalCorsi   * 100).toFixed(1),
    fenwickForPct: +(carFenwick / totalFenwick * 100).toFixed(1),
    corsiDiff:     carCorsi   - oppCorsi,
    fenwickDiff:   carFenwick - oppFenwick,
  };
}

// ── PDO (Percentage of Decisions for/against) ─────────────────
// PDO = team shooting% + team save%
// League average = ~100.0. Above 100 = likely lucky, below = unlucky.
// Regresses strongly to 100 over a season.
export function computePDO(plays, carTeamId = CAR_TEAM_ID) {
  let carGoals = 0, carSOG = 0, oppGoals = 0, oppSOG = 0;

  plays.forEach(p => {
    const isCar = p.details?.eventOwnerTeamId === carTeamId;
    if (p.typeDescKey === 'goal') {
      if (isCar) carGoals++; else oppGoals++;
      if (isCar) carSOG++;   else oppSOG++;
    }
    if (p.typeDescKey === 'shot-on-goal') {
      if (isCar) carSOG++; else oppSOG++;
    }
  });

  const carSH  = carSOG > 0 ? carGoals / carSOG : 0; // shooting %
  const carSV  = oppSOG > 0 ? 1 - (oppGoals / oppSOG) : 0; // save %
  const pdo    = +((carSH + carSV) * 100).toFixed(1);

  return {
    pdo,
    carShPct:   +(carSH * 100).toFixed(1),
    carSvPct:   +(carSV * 100).toFixed(3),
    carGoals,   carSOG,
    oppGoals,   oppSOG,
    // PDO interpretation
    luck: pdo > 102 ? 'Running hot' : pdo < 98 ? 'Running cold' : 'Near average',
    luckColor: pdo > 102 ? 'var(--amber)' : pdo < 98 ? 'var(--blue-bright)' : 'var(--text-muted)',
  };
}

// ── Puck Luck (game-level) ────────────────────────────────────
// Compares actual outcomes to expected based on shot share.
// If CAR controls 60% of shot attempts but only 40% of goals → unlucky.
// "Expected goals from shot share" = fenwick% × total goals in game.
export function computePuckLuck(plays, carTeamId = CAR_TEAM_ID) {
  const sa   = computeShotAttempts(plays, carTeamId);
  const pdo  = computePDO(plays, carTeamId);

  const totalGoals  = pdo.carGoals + pdo.oppGoals;
  const expectedGF  = +(sa.fenwickForPct / 100 * totalGoals).toFixed(1);
  const actualGF    = pdo.carGoals;
  const luckDelta   = +(actualGF - expectedGF).toFixed(1);

  return {
    expectedGF,
    actualGF,
    luckDelta,    // positive = luckier than shot share suggests
    fenwickForPct: sa.fenwickForPct,
    pdo:           pdo.pdo,
    label: luckDelta > 0.5
      ? `+${luckDelta} above expected`
      : luckDelta < -0.5
      ? `${luckDelta} below expected`
      : 'Near expected',
    color: luckDelta > 0.5 ? 'var(--amber)'
         : luckDelta < -0.5 ? 'var(--blue-bright)'
         : 'var(--green)',
  };
}

// ── GSAx (Goals Saved Above Expected) ────────────────────────
// True GSAx requires tracking data (xG per shot location/type).
// Public API approximation: compare goalie's actual SV% to league average.
// League average SV% ≈ .900 for regular season, .905 for playoffs.
// GSAx = (actualSV% - leagueAvgSV%) × shots faced
//
// This is an approximation — real GSAx weights by shot danger.
// Clearly label it as estimated.
const LEAGUE_AVG_SV = 0.900;

export function computeGSAx(shotsAgainst, saves, leagueAvgSv = LEAGUE_AVG_SV) {
  if (!shotsAgainst || shotsAgainst === 0) return null;
  const actualSvPct  = saves / shotsAgainst;
  const expectedSaves = leagueAvgSv * shotsAgainst;
  const gsax          = +(saves - expectedSaves).toFixed(2);
  return {
    gsax,
    actualSvPct: +(actualSvPct * 100).toFixed(1),
    expectedSaves: +expectedSaves.toFixed(1),
    label: gsax > 0 ? `+${gsax}` : `${gsax}`,
    color: gsax >= 1  ? 'var(--green)'
         : gsax <= -1 ? 'var(--red-bright)'
         : 'var(--text-muted)',
    note: 'Estimated — true GSAx requires tracking data (shot danger per location)',
  };
}

// ── Season-level Puck Luck (from team summary stats) ──────────
// PDO season proxy: using season SH% and SV% from standings/summary
export function seasonPDO(teamSummary) {
  if (!teamSummary) return null;
  // team/summary has goalsFor, shotsForPerGame, goalsAgainst, shotsAgainstPerGame
  // Approximate season SH% and SV%
  const gp    = teamSummary.gamesPlayed || 1;
  const gf    = teamSummary.goalsFor    || 0;
  const ga    = teamSummary.goalsAgainst|| 0;
  const sfpg  = teamSummary.shotsForPerGame    || 0;
  const sapg  = teamSummary.shotsAgainstPerGame|| 0;
  const sf    = sfpg * gp;
  const sa    = sapg * gp;

  const shPct = sf > 0 ? gf / sf : 0;
  const svPct = sa > 0 ? 1 - (ga / sa) : 0;
  const pdo   = +((shPct + svPct) * 100).toFixed(1);

  return {
    pdo,
    shPct: +(shPct * 100).toFixed(1),
    svPct: +(svPct * 100).toFixed(3),
    luck:  pdo > 102 ? 'Running hot 🔥' : pdo < 98 ? 'Running cold 🥶' : 'Near average',
    color: pdo > 102 ? 'var(--amber)' : pdo < 98 ? 'var(--blue-bright)' : 'var(--text-muted)',
    note: 'PDO = SH% + SV%. League average = 100. Values far from 100 tend to regress.',
  };
}
