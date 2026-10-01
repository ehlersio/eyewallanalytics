import { describe, expect, it } from 'vitest';
import { parseSummaryLink, summaryHref, withAlertTeam, withoutSummaryLink } from '../summaryLink';

const params = s => new URLSearchParams(s);

describe('parseSummaryLink', () => {
  it('reads a period summary link', () => {
    expect(parseSummaryLink(params('?summary=2&game=2026020123'))).toEqual({ gameId: 2026020123, period: 2 });
  });

  it('reads a final (game) summary link', () => {
    expect(parseSummaryLink(params('?summary=game&game=2026020123'))).toEqual({ gameId: 2026020123, period: 'game' });
  });

  it("reads the alert's team", () => {
    expect(parseSummaryLink(params('?summary=2&game=1&team=mtl'))).toEqual({ gameId: 1, period: 2, team: 'MTL' });
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
    expect(withoutSummaryLink(params('?as=MTL&summary=2&game=1&team=MTL')).toString()).toBe('as=MTL');
  });
});

describe('summaryHref', () => {
  it("opens the favorite's own game at /, a followed team's from that team's side", () => {
    expect(summaryHref({ gameId: 1, period: 2 }, 'CAR')).toBe('/?summary=2&game=1');
    expect(summaryHref({ gameId: 1, period: 'game', team: 'CAR' }, 'CAR')).toBe('/?summary=game&game=1');
    expect(summaryHref({ gameId: 1, period: 'game', team: 'MTL' }, 'CAR')).toBe('/game/1?as=MTL&summary=game&game=1');
  });
});

describe('withAlertTeam', () => {
  it('adds an NHL team to a summary link that has none', () => {
    expect(withAlertTeam('/?summary=1&game=5', 'NHL:PIT')).toBe('/?summary=1&game=5&team=PIT');
    expect(withAlertTeam('/?summary=1&game=5&team=CAR', 'NHL:PIT')).toBe('/?summary=1&game=5&team=CAR');
    expect(withAlertTeam('/pwhl/shots', 'NHL:PIT')).toBe('/pwhl/shots');
    expect(withAlertTeam('/?summary=1&game=5', 'PWHL:MIN')).toBe('/?summary=1&game=5');
  });
});
