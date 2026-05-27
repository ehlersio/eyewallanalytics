import { describe, it, expect } from 'vitest';
import { computeShotAttempts, computePDO, computePuckLuck, computeGSAx } from './advancedStats.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makePlay(type, teamId) {
  return { typeDescKey: type, details: { eventOwnerTeamId: teamId } };
}

describe('computeShotAttempts', () => {
  it('returns zero counts for empty plays', () => {
    const result = computeShotAttempts([]);
    expect(result.car.sog).toBe(0);
    expect(result.opp.sog).toBe(0);
    expect(result.corsiForPct).toBe(0);
  });

  it('counts CAR shots on goal', () => {
    const plays = [
      makePlay('shot-on-goal', 12),
      makePlay('shot-on-goal', 12),
      makePlay('shot-on-goal', 5),
    ];
    const result = computeShotAttempts(plays);
    expect(result.car.sog).toBe(2);
    expect(result.opp.sog).toBe(1);
  });

  it('counts goals in both goals and sog', () => {
    const plays = [
      makePlay('goal', 12),
      makePlay('shot-on-goal', 12),
    ];
    const result = computeShotAttempts(plays);
    expect(result.car.goals).toBe(1);
    expect(result.car.sog).toBe(2);
  });

  it('computes corsi percentage correctly', () => {
    const plays = [
      makePlay('shot-on-goal', 12),
      makePlay('shot-on-goal', 12),
      makePlay('shot-on-goal', 12),
      makePlay('shot-on-goal', 5),
    ];
    const result = computeShotAttempts(plays);
    expect(result.corsiForPct).toBe(75);
  });
});

describe('computePDO', () => {
  it('returns an object with pdo property for valid plays', () => {
    const plays = [
      makePlay('shot-on-goal', 12),
      makePlay('goal', 12),
      makePlay('shot-on-goal', 5),
      makePlay('shot-on-goal', 5),
      makePlay('shot-on-goal', 5),
    ];
    const result = computePDO(plays);
    expect(result).toHaveProperty('pdo');
    expect(result).toHaveProperty('carShPct');
    expect(result).toHaveProperty('carSvPct');
    expect(typeof result.pdo).toBe('number');
  });

  it('returns PDO ~100 when shooting and saving at average rates', () => {
    // CAR: 1 goal / 10 sog = 10% SH; OPP: 1 goal / 10 sog → 90% SV
    const plays = [
      ...Array(9).fill(null).map(() => makePlay('shot-on-goal', 12)),
      makePlay('goal', 12),
      ...Array(9).fill(null).map(() => makePlay('shot-on-goal', 5)),
      makePlay('goal', 5),
    ];
    const result = computePDO(plays);
    expect(result.pdo).toBeCloseTo(100, 0);
  });

  it('returns PDO > 100 when CAR shoots well and saves well', () => {
    // CAR: 2 goals / 10 sog = 20% SH; OPP: 0 goals / 10 sog = 100% SV
    const plays = [
      ...Array(8).fill(null).map(() => makePlay('shot-on-goal', 12)),
      makePlay('goal', 12),
      makePlay('goal', 12),
      ...Array(10).fill(null).map(() => makePlay('shot-on-goal', 5)),
    ];
    const result = computePDO(plays);
    expect(result.pdo).toBeGreaterThan(100);
  });
});

describe('computeGSAx', () => {
  it('returns null when shotsAgainst is 0 or null', () => {
    expect(computeGSAx(0, 0)).toBeNull();
    expect(computeGSAx(null, null)).toBeNull();
  });

  it('returns an object with gsax property', () => {
    const result = computeGSAx(35, 34);
    expect(result).toHaveProperty('gsax');
    expect(result).toHaveProperty('actualSvPct');
    expect(result).toHaveProperty('label');
  });

  it('returns positive gsax for above-average goaltending (.971 > .900)', () => {
    const result = computeGSAx(35, 34);
    expect(result.gsax).toBeGreaterThan(0);
  });

  it('returns negative gsax for below-average goaltending (.800 < .900)', () => {
    const result = computeGSAx(30, 24);
    expect(result.gsax).toBeLessThan(0);
  });

  it('returns ~0 gsax for exactly league-average (.900)', () => {
    const result = computeGSAx(10, 9);
    expect(result.gsax).toBeCloseTo(0, 2);
  });
});

describe('computePuckLuck', () => {
  it('returns zero luckDelta for empty plays array', () => {
    const result = computePuckLuck([]);
    expect(result).toHaveProperty('luckDelta');
    expect(result.luckDelta).toBe(0);
    expect(result.actualGF).toBe(0);
  });

  it('returns an object with luckDelta, expectedGF, actualGF', () => {
    const plays = [
      ...Array(6).fill(null).map(() => makePlay('shot-on-goal', 12)),
      makePlay('goal', 12),
      makePlay('goal', 12),
      ...Array(4).fill(null).map(() => makePlay('shot-on-goal', 5)),
    ];
    const result = computePuckLuck(plays);
    expect(result).toHaveProperty('luckDelta');
    expect(result).toHaveProperty('expectedGF');
    expect(result).toHaveProperty('actualGF');
  });

  it('returns positive luckDelta when scoring above shot share suggests', () => {
    // CAR has 40% of shots (4/10) but scores both goals → lucky
    const plays = [
      ...Array(3).fill(null).map(() => makePlay('shot-on-goal', 12)),
      makePlay('goal', 12),
      makePlay('goal', 12),
      ...Array(6).fill(null).map(() => makePlay('shot-on-goal', 5)),
    ];
    const result = computePuckLuck(plays);
    expect(result.luckDelta).toBeGreaterThan(0);
  });
});
