import { describe, expect, it } from 'vitest';
import { parseSummaryLink, withoutSummaryLink } from '../summaryLink';

const params = s => new URLSearchParams(s);

describe('parseSummaryLink', () => {
  it('reads a period summary link', () => {
    expect(parseSummaryLink(params('?summary=2&game=2026020123'))).toEqual({ gameId: 2026020123, period: 2 });
  });

  it('reads a final (game) summary link', () => {
    expect(parseSummaryLink(params('?summary=game&game=2026020123'))).toEqual({ gameId: 2026020123, period: 'game' });
  });

  it('ignores anything malformed', () => {
    for (const s of ['', '?summary=2', '?game=2026020123', '?summary=0&game=1', '?summary=abc&game=1',
      '?summary=2&game=abc', '?summary=2&game=-5', '?summary=1.5&game=1', '?summary=99&game=1']) {
      expect(parseSummaryLink(params(s)), s).toBeNull();
    }
  });
});

describe('withoutSummaryLink', () => {
  it('drops only the link params', () => {
    expect(withoutSummaryLink(params('?summary=2&game=1&mockGame=x')).toString()).toBe('mockGame=x');
  });
});
