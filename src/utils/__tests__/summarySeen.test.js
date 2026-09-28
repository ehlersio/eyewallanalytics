import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubBrowserGlobals } from './testHelpers/mockSupabaseAuth.js';
import { hasUnseen, loadSeen, markSeen, newestFirst, summaryKey } from '../summarySeen';

const p = (period, gameId = 1) => ({ gameId, period });
const final = (gameId = 1) => ({ gameId, period: 3, isGameSummary: true });

describe('summarySeen', () => {
  beforeEach(() => stubBrowserGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('keys a period and the final apart', () => {
    expect(summaryKey(p(3))).toBe('1:3');
    expect(summaryKey(final())).toBe('1:game');
  });

  it('has something new until it’s been seen, and remembers across loads', () => {
    const summaries = [p(1), p(2)];
    expect(hasUnseen(summaries, loadSeen())).toBe(true);
    markSeen(summaries, loadSeen());
    expect(hasUnseen(summaries, loadSeen())).toBe(false);
    expect(hasUnseen([...summaries, p(3)], loadSeen())).toBe(true);
  });

  it('nothing to show is nothing new', () => {
    expect(hasUnseen([], loadSeen())).toBe(false);
  });

  it('keeps only the most recent keys', () => {
    let seen = loadSeen();
    for (let g = 1; g <= 30; g++) seen = markSeen([p(1, g), p(2, g), p(3, g)], seen);
    expect(loadSeen().size).toBe(60);
    expect(loadSeen().has('1:1')).toBe(false);
    expect(loadSeen().has('30:3')).toBe(true);
  });

  it('lists the final first, then periods from the latest back', () => {
    expect(newestFirst([p(1), final(), p(3), p(2)]).map(summaryKey)).toEqual(['1:game', '1:3', '1:2', '1:1']);
  });
});
