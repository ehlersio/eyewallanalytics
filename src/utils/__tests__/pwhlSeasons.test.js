// src/utils/__tests__/pwhlSeasons.test.js
// pwhlConfig.js's live season lists: applyPWHLSeasonsConfig() and
// getPWHLSeasonLabel(). The Worker's /config/seasons `pwhl` entries below
// are what it serves (eyewall-poller seasons.js pickPWHLSeasonContext()),
// live against HockeyTech on 2026-10-01 and with the clock at 2026-11-25.

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../seasonClient', () => ({
  // The module-load lookup; tests drive applyPWHLSeasonsConfig() directly.
  fetchSeasonsConfig: vi.fn(() => Promise.reject(new Error('offline in tests'))),
}));

import {
  applyPWHLSeasonsConfig,
  getPWHLSeasonLabel,
  pwhlSeasonsReady,
  PWHL_PLAYOFF_SEASON_MAP,
} from '../pwhlConfig';
import * as pwhlConfig from '../pwhlConfig';

const PRESEASON_10 = { seasonId: 10, seasonType: 'preseason', startYear: 2026, startDate: '2026-10-01' };
const BEFORE_SWITCH = {
  seasonId: 8, seasonType: 'regular', startYear: 2025, startDate: '2025-11-21',
  next: { seasonId: 11, seasonType: 'regular', startYear: 2026, startDate: '2026-12-04', preseason: PRESEASON_10 },
  preseason: { seasonId: 7, seasonType: 'preseason', startYear: 2025, startDate: '2025-06-01' },
};
const AFTER_SWITCH = {
  seasonId: 11, seasonType: 'regular', startYear: 2026, startDate: '2026-12-04',
  next: null,
  preseason: PRESEASON_10,
};
const ids = list => list.map(s => s.id);

afterEach(() => applyPWHLSeasonsConfig(null));

describe('applyPWHLSeasonsConfig', () => {
  it('keeps the upcoming season out of every season list before the switch', () => {
    applyPWHLSeasonsConfig(BEFORE_SWITCH);
    expect(ids(pwhlConfig.PWHL_REGULAR_SEASONS)).toEqual([8, 5, 1]);
    expect(ids(pwhlConfig.PWHL_SEASONS)).not.toContain(11);
    expect(pwhlConfig.PWHL_NEXT_SEASON).toEqual({
      id: 11, label: '2026-27', type: 'regular', startYear: 2026, startDate: '2026-12-04',
    });
    // Already listed as "2026-27 Preseason"; the schedule view won't add it twice.
    expect(pwhlConfig.PWHL_UPCOMING_PRESEASON).toMatchObject({ id: 10, label: '2026-27 Preseason' });
  });

  it('lists the new season, labelled from its start year, once it is current', () => {
    applyPWHLSeasonsConfig(AFTER_SWITCH);
    expect(pwhlConfig.PWHL_REGULAR_SEASONS.slice(0, 2)).toEqual([
      { id: 11, label: '2026-27', type: 'regular' },
      { id: 8, label: '2025-26', type: 'regular' },
    ]);
    expect(pwhlConfig.PWHL_NEXT_SEASON).toBeNull();
    expect(pwhlConfig.PWHL_UPCOMING_PRESEASON).toMatchObject({ id: 10 });
  });

  it('labels a future year with no hand-written entry the same way', () => {
    applyPWHLSeasonsConfig({
      seasonId: 11, seasonType: 'regular', startYear: 2026, startDate: '2026-12-04',
      next: {
        seasonId: 14, seasonType: 'regular', startYear: 2027, startDate: '2027-11-20',
        preseason: { seasonId: 13, seasonType: 'preseason', startYear: 2027, startDate: '2027-10-01' },
      },
      preseason: PRESEASON_10,
    });
    expect(pwhlConfig.PWHL_NEXT_SEASON).toMatchObject({ id: 14, label: '2027-28' });
    expect(pwhlConfig.PWHL_UPCOMING_PRESEASON).toMatchObject({ id: 13, label: '2027-28 Preseason' });
  });

  it('never pairs a live season with a playoff season', () => {
    applyPWHLSeasonsConfig(AFTER_SWITCH);
    expect(PWHL_PLAYOFF_SEASON_MAP).toEqual({ 8: 9, 5: 6, 1: 3 });
  });

  it('adds nothing from a Worker answer without next/preseason or a start year', () => {
    applyPWHLSeasonsConfig({ seasonId: 12, seasonType: 'regular' });
    expect(ids(pwhlConfig.PWHL_REGULAR_SEASONS)).toEqual([8, 5, 1]);
    expect(pwhlConfig.PWHL_NEXT_SEASON).toBeNull();
    expect(pwhlConfig.PWHL_UPCOMING_PRESEASON).toBeNull();
  });
});

describe('getPWHLSeasonLabel', () => {
  it('reads listed seasons, playoffs included', () => {
    expect(getPWHLSeasonLabel(8)).toBe('2025-26');
    expect(getPWHLSeasonLabel(9)).toBe('2025-26 Playoffs');
  });

  it('labels season 11 from data before and after the switch, never "11"', () => {
    applyPWHLSeasonsConfig(BEFORE_SWITCH);
    expect(getPWHLSeasonLabel(11)).toBe('2026-27');
    applyPWHLSeasonsConfig(AFTER_SWITCH);
    expect(getPWHLSeasonLabel('11')).toBe('2026-27');
  });

  it('says "Season N" for an id nothing describes', () => {
    expect(getPWHLSeasonLabel(12)).toBe('Season 12');
  });
});

it('settles the ready promise even when the live lookup fails', async () => {
  await expect(pwhlSeasonsReady).resolves.toEqual({ next: null, preseason: null });
});
