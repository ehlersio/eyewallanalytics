import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { stubBrowserGlobals } from './testHelpers/mockSupabaseAuth.js';
import {
  loadPWHLPredictions, savePWHLPrediction, recordPWHLOutcome, getPWHLPredictionStats,
} from '../pwhlPredictionStore';

// This repo's Vitest config runs under environment: 'node', not jsdom --
// localStorage isn't a real global here, so reuse the same in-memory stub
// favoriteTeamSync.test.js already established rather than adding jsdom.
beforeEach(() => {
  stubBrowserGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pwhlPredictionStore', () => {
  it('starts empty', () => {
    expect(loadPWHLPredictions()).toEqual([]);
    expect(getPWHLPredictionStats()).toEqual({ total: 0, correct: 0, pct: null, avgError: null });
  });

  it('saves a prediction and can update it in place by gameId', () => {
    savePWHLPrediction({ gameId: 1, opponent: 'MTL', predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 2 });
    savePWHLPrediction({ gameId: 1, predictedTeamScore: 3.5 });
    const preds = loadPWHLPredictions();
    expect(preds).toHaveLength(1);
    expect(preds[0]).toMatchObject({ gameId: 1, opponent: 'MTL', predictedTeamScore: 3.5 });
  });

  it('records a correct outcome and computes score diff', () => {
    savePWHLPrediction({ gameId: 2, predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 2 });
    recordPWHLOutcome(2, 4, 1);
    const [pred] = loadPWHLPredictions();
    expect(pred.teamWon).toBe(true);
    expect(pred.correct).toBe(true);
    expect(pred.scoreDiff).toBeCloseTo(1 + 1); // |3-4| + |2-1|
  });

  it('records an incorrect outcome', () => {
    savePWHLPrediction({ gameId: 3, predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 2 });
    recordPWHLOutcome(3, 1, 4);
    const [pred] = loadPWHLPredictions();
    expect(pred.teamWon).toBe(false);
    expect(pred.correct).toBe(false);
  });

  it('is a no-op when recording an outcome for an unknown gameId', () => {
    recordPWHLOutcome(999, 3, 2);
    expect(loadPWHLPredictions()).toEqual([]);
  });

  it('aggregates stats only over predictions with a recorded outcome', () => {
    savePWHLPrediction({ gameId: 4, predictedTeamWin: true,  predictedTeamScore: 3, predictedOppScore: 2 });
    savePWHLPrediction({ gameId: 5, predictedTeamWin: false, predictedTeamScore: 2, predictedOppScore: 3 });
    savePWHLPrediction({ gameId: 6, predictedTeamWin: true,  predictedTeamScore: 3, predictedOppScore: 2 }); // no outcome yet
    recordPWHLOutcome(4, 4, 1); // correct
    recordPWHLOutcome(5, 4, 1); // incorrect (predicted loss, team won)

    const stats = getPWHLPredictionStats();
    expect(stats.total).toBe(2);
    expect(stats.correct).toBe(1);
    expect(stats.pct).toBe(50);
    expect(stats.avgError).not.toBeNull();
  });
});
