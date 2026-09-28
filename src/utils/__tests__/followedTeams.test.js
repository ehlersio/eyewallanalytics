// The followed-teams list (utils/followedTeams.js): pure list logic only.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseAuth', () => ({ supabaseAuth: { from: vi.fn() } }));

const { normalizeFollowed, mergeFollowed, withTeam, withoutTeam, moved, sameList, teamFor, LEAGUES } =
  await import('../followedTeams');

const CAR = { sport: 'nhl', abbr: 'CAR' };
const BOS = { sport: 'nhl', abbr: 'BOS' };
const MIN = { sport: 'pwhl', abbr: 'MIN' };
const HER = { sport: 'ahl', abbr: 'HER' };

describe('normalizeFollowed', () => {
  it('starts an existing user out following just their team', () => {
    expect(normalizeFollowed(null, CAR)).toEqual([CAR]);
  });

  it('keeps the user’s order and adds the primary at the front only if missing', () => {
    expect(normalizeFollowed([MIN, CAR], CAR)).toEqual([MIN, CAR]);
    expect(normalizeFollowed([MIN], CAR)).toEqual([CAR, MIN]);
  });

  it('drops repeats, unknown teams and junk', () => {
    expect(normalizeFollowed([CAR, CAR, { sport: 'nhl', abbr: 'ZZZ' }, null, { abbr: 'BOS' }, HER], CAR))
      .toEqual([CAR, HER]);
  });

  it('tells the same abbreviation in two leagues apart', () => {
    // BOS is both the Bruins (NHL) and the Fleet (PWHL).
    expect(normalizeFollowed([BOS, { sport: 'pwhl', abbr: 'BOS' }], BOS)).toHaveLength(2);
  });
});

describe('mergeFollowed', () => {
  it('keeps the first list’s order, then adds what only the second has', () => {
    expect(mergeFollowed([CAR, MIN], [HER, CAR])).toEqual([CAR, MIN, HER]);
  });

  it('handles an account with no list yet', () => {
    expect(mergeFollowed(null, [CAR])).toEqual([CAR]);
  });
});

describe('editing the list', () => {
  it('follows a team once', () => {
    expect(withTeam([CAR], MIN)).toEqual([CAR, MIN]);
    expect(withTeam([CAR, MIN], MIN)).toEqual([CAR, MIN]);
  });

  it('unfollows a team, but never the primary', () => {
    expect(withoutTeam([CAR, MIN], MIN, CAR)).toEqual([CAR]);
    expect(withoutTeam([CAR, MIN], CAR, CAR)).toEqual([CAR, MIN]);
  });

  it('moves a team up or down, and not past either end', () => {
    expect(moved([CAR, MIN, HER], 2, -1)).toEqual([CAR, HER, MIN]);
    expect(moved([CAR, MIN, HER], 0, -1)).toEqual([CAR, MIN, HER]);
    expect(moved([CAR, MIN, HER], 2, 1)).toEqual([CAR, MIN, HER]);
  });

  it('compares lists by team and order', () => {
    expect(sameList([CAR, MIN], [CAR, MIN])).toBe(true);
    expect(sameList([CAR, MIN], [MIN, CAR])).toBe(false);
  });
});

describe('leagues', () => {
  it('finds each league’s teams', () => {
    expect(teamFor(CAR)?.displayName).toBe('Carolina Hurricanes');
    expect(teamFor(MIN)?.displayName).toBe('Minnesota Frost');
    expect(teamFor(HER)?.displayName).toBe('Hershey Bears');
    expect(LEAGUES.map(l => l.sport)).toEqual(['nhl', 'pwhl', 'ahl', 'echl']);
  });
});
