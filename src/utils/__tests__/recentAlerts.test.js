import { describe, expect, it } from 'vitest';
import { alertAge, alertId, alertLink, clearAllAlerts, dedupeAlerts, dismissAlert, hasNewAlerts, loadCleared, visibleAlerts } from '../recentAlerts';

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

describe('clearing alerts', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  const NOW = 10 * 24 * 3600 * 1000;
  const a1 = { team: 'NHL:PIT', type: 'goal', at: NOW - 60_000 };
  const a2 = { team: 'NHL:PIT', type: 'penalty', at: NOW - 30_000 };
  const later = { team: 'NHL:MTL', type: 'win', at: NOW + 60_000 };

  it('hides one alert, and keeps it hidden across loads', () => {
    store.clear();
    const c = dismissAlert(loadCleared(), a1, NOW);
    expect(visibleAlerts([a2, a1], c)).toEqual([a2]);
    expect(visibleAlerts([a2, a1], loadCleared())).toEqual([a2]);
  });

  it('clear all hides everything so far, not what comes after', () => {
    store.clear();
    const c = clearAllAlerts([a2, a1]);
    expect(visibleAlerts([later, a2, a1], c)).toEqual([later]);
    expect(loadCleared().at).toBe(a2.at);
  });

  it('forgets ids older than the 3-day log', () => {
    store.clear();
    const old = { team: 'NHL:CAR', type: 'goal', at: NOW - 4 * 24 * 3600 * 1000 };
    const c = dismissAlert(dismissAlert(loadCleared(), old, NOW), a1, NOW);
    expect([...c.ids]).toEqual([alertId(a1)]);
  });
});
