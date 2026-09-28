// Alerts for every followed team (utils/alertTeams.js).
import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }));
vi.mock('../supabaseAuth', () => ({ supabaseAuth: { from: vi.fn() } }));

const { alertKey, alertSettingsFor, subscriptionTeams } = await import('../alertTeams');

const CAR = { sport: 'nhl', abbr: 'CAR' };
const MIN = { sport: 'pwhl', abbr: 'MIN' };
const HER = { sport: 'ahl', abbr: 'HER' };
const template = { goal: true, hatTrick: false, periodEnd: true };

describe('alertKey', () => {
  it('is the poller’s LEAGUE:ABBR topic', () => {
    expect(alertKey(CAR)).toBe('NHL:CAR');
    expect(alertKey(MIN)).toBe('PWHL:MIN');
  });
});

describe('alertSettingsFor', () => {
  it('a newly followed team starts on, with the device’s existing choices', () => {
    expect(alertSettingsFor(MIN, {}, template)).toEqual({ on: true, prefs: template });
  });

  it('keeps a team’s own choices over the device’s', () => {
    const stored = { 'PWHL:MIN': { on: false, prefs: { goal: false } } };
    expect(alertSettingsFor(MIN, stored, template)).toEqual({ on: false, prefs: { ...template, goal: false } });
  });
});

describe('subscriptionTeams', () => {
  it('puts the primary first, then the others in the user’s order', () => {
    expect(subscriptionTeams([MIN, CAR, HER], CAR, {}, template).map(t => t.key))
      .toEqual(['NHL:CAR', 'PWHL:MIN', 'AHL:HER']);
  });

  it('leaves out other teams whose alerts are off, never the primary', () => {
    const stored = { 'PWHL:MIN': { on: false }, 'NHL:CAR': { on: false } };
    expect(subscriptionTeams([CAR, MIN, HER], CAR, stored, template).map(t => t.key))
      .toEqual(['NHL:CAR', 'AHL:HER']);
  });

  it('sends each team its own choices', () => {
    const stored = { 'AHL:HER': { on: true, prefs: { goal: false } } };
    const teams = subscriptionTeams([CAR, HER], CAR, stored, template);
    expect(teams[0]).toEqual({ key: 'NHL:CAR', prefs: template });
    expect(teams[1]).toEqual({ key: 'AHL:HER', prefs: { ...template, goal: false } });
  });
});
