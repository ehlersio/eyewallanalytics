import { describe, it, expect } from 'vitest';

// ── computeWinPct (inlined for testing — mirrors ScheduleView.jsx) ──────────
function computeWinPct(carStanding, oppStanding, game, playoffSeries) {
  if (!carStanding || !oppStanding) return null;
  const isPlayoff = game?.gameType === 3;
  const isHome    = game?.homeTeam?.abbrev === 'CAR';
  const cgp = carStanding.gamesPlayed || 1;
  const ogp = oppStanding.gamesPlayed || 1;
  const carGpg = (carStanding.goalFor     ?? 0) / cgp;
  const oppGpg = (oppStanding.goalFor     ?? 0) / ogp;
  const carGag = (carStanding.goalAgainst ?? 0) / cgp;
  const oppGag = (oppStanding.goalAgainst ?? 0) / ogp;
  const carSF  = carStanding.shotsForPerGame || 0;
  const oppSF  = oppStanding.shotsForPerGame || 0;
  const carPP  = typeof carStanding.powerPlayPct === 'number'
    ? (carStanding.powerPlayPct <= 1 ? carStanding.powerPlayPct * 100 : carStanding.powerPlayPct) : 22;
  const oppPK  = typeof oppStanding.penaltyKillPct === 'number'
    ? (oppStanding.penaltyKillPct <= 1 ? oppStanding.penaltyKillPct * 100 : oppStanding.penaltyKillPct) : 80;

  let cs = 0, os = 0;
  if (carGpg > oppGpg) cs += 0.7; else os += 0.7;
  if (carGag < oppGag) cs += 0.7; else os += 0.7;
  if (carSF  > oppSF)  cs += 0.5; else os += 0.5;
  if ((carPP - (100 - oppPK)) > 0) cs += 0.4; else os += 0.4;
  if (!isPlayoff) {
    const ptsDiff = (carStanding.points ?? 0) - (oppStanding.points ?? 0);
    if (ptsDiff > 0) cs += Math.min(ptsDiff / 20, 0.5);
    else             os += Math.min(-ptsDiff / 20, 0.5);
  }
  if (carStanding.streakCode === 'W') cs += 0.3;
  if (oppStanding.streakCode === 'W') os += 0.3;
  if (isHome) cs += 0.25; else os += 0.25;

  if (isPlayoff && playoffSeries) {
    const oppAbbr = isHome ? game.awayTeam?.abbrev : game.homeTeam?.abbrev;
    const round   = (() => {
      const id = String(game.id);
      return (id.length === 10 && id.slice(4,6) === '03') ? parseInt(id[7], 10) : null;
    })();
    const s = playoffSeries.find(s => s.round === round && s.opponent?.abbrev === oppAbbr);
    if (s) {
      const lead = s.carWins - s.oppWins;
      if (lead > 0) cs += Math.min(lead * 0.5, 1.0);
      else if (lead < 0) os += Math.min(-lead * 0.5, 1.0);
    }
  }

  const t = cs + os || 1;
  const pct = Math.round(cs / t * 100);
  return { pct, favoured: pct >= 50 };
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const strongCAR = {
  gamesPlayed: 82, goalFor: 280, goalAgainst: 200,
  shotsForPerGame: 33, powerPlayPct: 25, penaltyKillPct: 85,
  points: 110, streakCode: 'W',
};
const weakOPP = {
  gamesPlayed: 82, goalFor: 210, goalAgainst: 260,
  shotsForPerGame: 28, powerPlayPct: 18, penaltyKillPct: 75,
  points: 80, streakCode: 'L',
};
const evenTeam = {
  gamesPlayed: 82, goalFor: 245, goalAgainst: 245,
  shotsForPerGame: 30, powerPlayPct: 22, penaltyKillPct: 80,
  points: 95,
};
const homeGame   = { gameType: 2, homeTeam: { abbrev: 'CAR' }, awayTeam: { abbrev: 'BOS' } };
const awayGame   = { gameType: 2, homeTeam: { abbrev: 'BOS' }, awayTeam: { abbrev: 'CAR' } };
const playoffGame = { id: '2025030311', gameType: 3, homeTeam: { abbrev: 'CAR' }, awayTeam: { abbrev: 'FLA' } };

describe('computeWinPct', () => {
  it('returns null for missing standings', () => {
    expect(computeWinPct(null, weakOPP, homeGame, null)).toBeNull();
    expect(computeWinPct(strongCAR, null, homeGame, null)).toBeNull();
  });

  it('favours the stronger team', () => {
    const result = computeWinPct(strongCAR, weakOPP, homeGame, null);
    expect(result.favoured).toBe(true);
    expect(result.pct).toBeGreaterThan(65);
  });

  it('home ice adds value (when teams are equal on all other factors)', () => {
    // Both teams identical — only home/away differs
    const home = computeWinPct(evenTeam, evenTeam, homeGame, null);
    const away = computeWinPct(evenTeam, evenTeam, awayGame, null);
    // Home pct should be higher since home ice (+0.25) gives CAR the edge
    expect(home.pct).toBeGreaterThanOrEqual(away.pct);
    // Combined they should sum to ~100
    expect(home.pct + away.pct).toBeCloseTo(100, -1);
  });

  it('returns percentage in 0-100 range', () => {
    const result = computeWinPct(strongCAR, weakOPP, homeGame, null);
    expect(result.pct).toBeGreaterThanOrEqual(0);
    expect(result.pct).toBeLessThanOrEqual(100);
  });

  it('excludes standings points in playoffs', () => {
    // In playoffs, a points-heavy regular season team vs equal opponent
    // should not get the standings bonus
    const bigPointsCAR = { ...evenTeam, points: 120 };
    const regResult    = computeWinPct(bigPointsCAR, evenTeam, homeGame, null);
    const poResult     = computeWinPct(bigPointsCAR, evenTeam, playoffGame, null);
    // Regular season: points bonus should push CAR higher
    expect(regResult.pct).toBeGreaterThan(poResult.pct);
  });

  it('series lead boosts win probability in playoffs', () => {
    const seriesUp   = [{ round: 1, carWins: 3, oppWins: 0, opponent: { abbrev: 'FLA' } }];
    const seriesEven = [{ round: 1, carWins: 1, oppWins: 1, opponent: { abbrev: 'FLA' } }];
    const up   = computeWinPct(evenTeam, evenTeam, playoffGame, seriesUp);
    const even = computeWinPct(evenTeam, evenTeam, playoffGame, seriesEven);
    expect(up.pct).toBeGreaterThan(even.pct);
  });

  it('win streak boosts probability', () => {
    const withStreak    = { ...evenTeam, streakCode: 'W' };
    const withoutStreak = { ...evenTeam, streakCode: 'L' };
    const streaking = computeWinPct(withStreak,    evenTeam,     homeGame, null);
    const cold      = computeWinPct(withoutStreak, withStreak,   homeGame, null);
    expect(streaking.pct).toBeGreaterThan(cold.pct);
  });
});
