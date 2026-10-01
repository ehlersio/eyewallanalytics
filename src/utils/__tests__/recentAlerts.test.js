import { describe, expect, it } from 'vitest';
import { alertAge, alertLink, dedupeAlerts, hasNewAlerts } from '../recentAlerts';

const goal = { team: 'NHL:CAR', vs: 'NHL:BOS', type: 'goal', at: 3, url: '/' };
const oppGoal = { team: 'NHL:BOS', vs: 'NHL:CAR', type: 'oppGoal', at: 3, url: '/' };
const frost = { team: 'PWHL:MIN', vs: 'PWHL:BOS', type: 'win', at: 2, url: '/' };

describe('dedupeAlerts', () => {
  it('shows a fan of both teams each event once, from their first team’s side', () => {
    expect(dedupeAlerts([goal, oppGoal, frost], ['NHL:CAR', 'NHL:BOS', 'PWHL:MIN'])).toEqual([goal, frost]);
    expect(dedupeAlerts([goal, oppGoal], ['NHL:BOS', 'NHL:CAR'])).toEqual([oppGoal]);
  });

  it('keeps both when the other team isn’t followed', () => {
    expect(dedupeAlerts([goal, frost], ['NHL:CAR', 'PWHL:MIN'])).toEqual([goal, frost]);
  });
});

describe('alertAge', () => {
  const now = Date.UTC(2026, 9, 10, 20, 0);
  it('reads as now, minutes, hours, then a weekday', () => {
    expect(alertAge(now - 20 * 1000, now)).toBe('now');
    expect(alertAge(now - 8 * 60000, now)).toBe('8 min');
    expect(alertAge(now - 3 * 3600000, now)).toBe('3 h');
    expect(alertAge(now - 30 * 3600000, now)).toMatch(/^[A-Z][a-z]{2}$/);
  });
});

describe('alertLink', () => {
  it('only links to an in-app page other than home', () => {
    expect(alertLink({ url: '/?summary=1&game=2026020001' })).toBe('/?summary=1&game=2026020001');
    expect(alertLink({ url: '/' })).toBeNull();
    expect(alertLink({ url: '//evil.example' })).toBeNull();
    expect(alertLink({ url: 'https://example.com' })).toBeNull();
  });

  // MTL Win! with CAR primary (2026-09-30): the link had only the game, so
  // the favorite's view couldn't find it and the row did nothing.
  it("puts the alert's team on a summary link", () => {
    expect(alertLink({ team: 'NHL:MTL', url: '/?summary=game&game=2026010042' })).toBe('/?summary=game&game=2026010042&team=MTL');
    expect(alertLink({ team: 'NHL:MTL', url: '/?summary=2&game=1&team=MTL' })).toBe('/?summary=2&game=1&team=MTL');
    expect(alertLink({ team: 'PWHL:MIN', url: '/pwhl/shots' })).toBe('/pwhl/shots');
  });
});

describe('hasNewAlerts', () => {
  it('is new only after something newer than what was seen, never on a first look', () => {
    expect(hasNewAlerts([{ at: 10 }], null)).toBe(false);
    expect(hasNewAlerts([{ at: 10 }], 10)).toBe(false);
    expect(hasNewAlerts([{ at: 11 }], 10)).toBe(true);
  });
});
