// src/hooks/__tests__/useLiveActivityTeams.test.js
// Lock Screen auto-follow registers every followed team, any league, in the
// form eyewall-poller's /live-activity/start-token takes (2026-10).
import { describe, it, expect, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
  registerPlugin: () => ({}),
}));

import { autoFollowTeams } from '../useLiveActivity';

describe('autoFollowTeams', () => {
  it('lists every followed team as league:ABBR, in order', () => {
    expect(autoFollowTeams([
      { sport: 'pwhl', abbr: 'MTL' }, { sport: 'ahl', abbr: 'CHI' }, { sport: 'echl', abbr: 'FLA' }, { sport: 'nhl', abbr: 'CAR' },
    ])).toEqual(['pwhl:MTL', 'ahl:CHI', 'echl:FLA', 'nhl:CAR']);
  });
});
