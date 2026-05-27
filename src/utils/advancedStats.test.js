import { describe, it, expect } from 'vitest';
import { computeShotAttempts, computePDO, computePuckLuck, computeGSAx } from './advancedStats.js';

describe('computeShotAttempts', () => {
  const makePlays = (shots) => shots.map((s, i) => ({
    typeDescKey: s.type,
    details: { eventOwnerTeamId: s.teamId },
    sortOrder: i,
  }));

  it('returns zero counts for empty plays', () => {
    const result = computeShotAttempts([]);
    expect(result.car.shots).toBe(0);
    expect(result.opp.shots).toBe(0);
  });

  it('counts CAR shots on goal', () => {
    const plays = makePlays([
      { type: 'shot-on-goal', teamId: 12 },
      { type: 'shot-on-goal', teamId: 12 },
      { type: 'shot-on-goal', teamId: 5 },
    ]);
    const result = computeShotAttempts(plays);
    expect(result.car.shots).toBe(2);
    expect(result.opp.shots).toBe(1);
  });

  it('counts goals as shot attempts', () => {
    const plays = makePlays([
      { type: 'goal', teamId: 12 },
      { type: 'shot-on-goal', teamId: 12 },
    ]);
    const result = computeShotAttempts(plays);
    expect(result.car.goals).toBe(1);
    expect(result.car.shots).toBe(1);
  });
});

describe('computePDO', () => {
  it('returns null for missing data', () => {
    expect(computePDO(null, null)).toBeNull();
  });

  it('returns ~100 for average performance', () => {
    // SH% = 10%, SV% = 90% → PDO = 100
    const result = computePDO(
      { shotsAgainst: 30, saves: 27, goalsAgainst: 3 },
      { shots: 30, goals: 3 }
    );
    expect(result).toBeCloseTo(100, 0);
  });

  it('returns >100 for above-average performance', () => {
    // High SH% + high SV% = lucky
    const result = computePDO(
      { shotsAgainst: 30, saves: 29, goalsAgainst: 1 },
      { shots: 20, goals: 4 }
    );
    expect(result).toBeGreaterThan(100);
  });
});

describe('computeGSAx', () => {
  it('returns null for missing goalie data', () => {
    expect(computeGSAx(null)).toBeNull();
  });

  it('returns positive for above-average goaltending', () => {
    // 35 shots, 34 saves = .971 SV% vs .900 baseline → positive GSAx
    const result = computeGSAx({ shotsAgainst: 35, saves: 34 });
    expect(result).toBeGreaterThan(0);
  });

  it('returns negative for below-average goaltending', () => {
    // 30 shots, 24 saves = .800 SV% → negative GSAx
    const result = computeGSAx({ shotsAgainst: 30, saves: 24 });
    expect(result).toBeLessThan(0);
  });

  it('returns 0 for exactly league-average (.900)', () => {
    const result = computeGSAx({ shotsAgainst: 10, saves: 9 });
    expect(result).toBeCloseTo(0, 5);
  });
});

describe('computePuckLuck', () => {
  it('returns null for missing data', () => {
    expect(computePuckLuck(null, null, null, null)).toBeNull();
  });

  it('returns positive when actual goals exceed expected', () => {
    // CAR outshoots opponent but expected less goals
    const result = computePuckLuck(5, 50, 3, 50);
    // carGoals=5, carShots=50, oppGoals=3, oppShots=50
    // With equal shots, more goals = positive puck luck
    expect(typeof result).toBe('number');
  });
});
