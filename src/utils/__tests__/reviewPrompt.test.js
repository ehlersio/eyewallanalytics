import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
  registerPlugin: () => ({ requestReview: vi.fn() }),
}));
vi.mock('../analytics', () => ({ capture: vi.fn() }));

const { withAppOpen, shouldAskForReview } = await import('../reviewPrompt');

const DAY = 24 * 3600 * 1000;
const T0 = Date.UTC(2026, 9, 1, 18); // 2026-10-01

// A user who opened the app on each of `n` consecutive days from T0.
const usedDays = n => Array.from({ length: n }, (_, i) => T0 + i * DAY)
  .reduce((s, t) => withAppOpen(s, t), null);

describe('withAppOpen', () => {
  it('counts a day once however many times the app opens that day', () => {
    const s = [T0, T0 + 3600e3, T0 + 2 * 3600e3].reduce((acc, t) => withAppOpen(acc, t), null);
    expect(s.days).toEqual(['2026-10-01']);
    expect(s.firstSeen).toBe(T0);
  });

  it('keeps firstSeen from the first open and only the last few days', () => {
    const s = usedDays(6);
    expect(s.firstSeen).toBe(T0);
    expect(s.days).toHaveLength(3);
    expect(s.days.at(-1)).toBe('2026-10-06');
  });
});

describe('shouldAskForReview', () => {
  it('waits for a regular: 3 days used, 3+ days after first open', () => {
    expect(shouldAskForReview(null, T0, '1.4.0')).toBe(false);
    expect(shouldAskForReview(usedDays(2), T0 + 5 * DAY, '1.4.0')).toBe(false);
    // 3 distinct days, but the third is only 2 days after the first.
    expect(shouldAskForReview(usedDays(3), T0 + 2 * DAY, '1.4.0')).toBe(false);
    expect(shouldAskForReview(usedDays(3), T0 + 3 * DAY, '1.4.0')).toBe(true);
  });

  it('asks at most once per version and 120 days apart', () => {
    const asked = { ...usedDays(3), lastAsked: T0 + 3 * DAY, askedVersion: '1.4.0' };
    expect(shouldAskForReview(asked, T0 + 200 * DAY, '1.4.0')).toBe(false);
    expect(shouldAskForReview(asked, T0 + 30 * DAY, '1.5.0')).toBe(false);
    expect(shouldAskForReview(asked, T0 + 124 * DAY, '1.5.0')).toBe(true);
  });
});
