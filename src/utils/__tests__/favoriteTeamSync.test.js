// src/utils/__tests__/favoriteTeamSync.test.js
// Covers Phase 1's write-on-switch + reconcile-on-session-load design,
// including the real "Change team" bug found and fixed during Session 91's
// live verification (reconciliation was silently defeating that button for
// signed-in users — see SESSION_91_AUTH_PHASE1_FINDINGS.md item 3).
// supabaseAuth is mocked; localStorage/window are stubbed since this
// repo's Vitest config runs under environment: 'node', not jsdom.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeQueryBuilder, stubBrowserGlobals } from './testHelpers/mockSupabaseAuth.js';

vi.mock('../supabaseAuth', () => ({
  supabaseAuth: { from: vi.fn() },
}));

import { supabaseAuth } from '../supabaseAuth';
import { upsertFavoriteTeam, syncFavoriteTeamOnSignIn } from '../favoriteTeamSync.js';

// Real abbrs from teamConfig.js/pwhlConfig.js — the module looks these up
// for real (applyLocalSelection), so fabricated abbrs would silently no-op.
const NHL_ABBR = 'CAR';
const PWHL_ABBR = 'TOR';

beforeEach(() => {
  stubBrowserGlobals();
  supabaseAuth.from.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('upsertFavoriteTeam', () => {
  it('upserts the given sport/team for the user', async () => {
    const builder = makeQueryBuilder({ error: null });
    supabaseAuth.from.mockImplementation(() => builder);

    await upsertFavoriteTeam('user-a', 'nhl', NHL_ABBR);

    expect(supabaseAuth.from).toHaveBeenCalledWith('user_preferences');
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-a', favorite_team: NHL_ABBR, favorite_sport: 'nhl' }),
      { onConflict: 'user_id' }
    );
  });

  it('never throws, even if the write fails', async () => {
    supabaseAuth.from.mockImplementation(() => makeQueryBuilder({ error: { message: 'down' } }));
    await expect(upsertFavoriteTeam('user-a', 'nhl', NHL_ABBR)).resolves.toBeUndefined();
  });
});

describe('syncFavoriteTeamOnSignIn', () => {
  it('skips entirely while a "Change team" is in progress — the exact bug found in Session 91', async () => {
    localStorage.setItem('eyewall:team-change-pending', '1');
    await syncFavoriteTeamOnSignIn('user-a');
    expect(supabaseAuth.from).not.toHaveBeenCalled();
  });

  it('does nothing when the server value already matches local', async () => {
    localStorage.setItem('eyewall:sport', 'nhl');
    localStorage.setItem('eyewall:team', JSON.stringify({ abbr: NHL_ABBR }));
    supabaseAuth.from.mockImplementationOnce(() =>
      makeQueryBuilder({ data: { favorite_team: NHL_ABBR, favorite_sport: 'nhl' }, error: null })
    );

    await syncFavoriteTeamOnSignIn('user-a');

    expect(window.location.reload).not.toHaveBeenCalled();
    expect(supabaseAuth.from).toHaveBeenCalledTimes(1); // only the fetch, no upsert
  });

  it('server wins on a second device — applies the server value locally and reloads once', async () => {
    // Local (this "device") has TOR/pwhl; server already has CAR/nhl from
    // another device — the documented Phase 0/1 merge decision.
    localStorage.setItem('eyewall:sport', 'pwhl');
    localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: PWHL_ABBR }));
    supabaseAuth.from.mockImplementationOnce(() =>
      makeQueryBuilder({ data: { favorite_team: NHL_ABBR, favorite_sport: 'nhl' }, error: null })
    );

    await syncFavoriteTeamOnSignIn('user-a');

    expect(localStorage.getItem('eyewall:sport')).toBe('nhl');
    expect(JSON.parse(localStorage.getItem('eyewall:team')).abbr).toBe(NHL_ABBR);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('first sign-in, no server value yet — uploads the local pick, no reload', async () => {
    localStorage.setItem('eyewall:sport', 'nhl');
    localStorage.setItem('eyewall:team', JSON.stringify({ abbr: NHL_ABBR }));
    const selectBuilder = makeQueryBuilder({ data: null, error: null });
    const upsertBuilder = makeQueryBuilder({ error: null });
    supabaseAuth.from
      .mockImplementationOnce(() => selectBuilder)
      .mockImplementationOnce(() => upsertBuilder);

    await syncFavoriteTeamOnSignIn('user-a');

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-a', favorite_team: NHL_ABBR, favorite_sport: 'nhl' }),
      { onConflict: 'user_id' }
    );
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('no server value and no local value — no-op, nothing to upload', async () => {
    // Realistically near-impossible (TeamPicker's needsTeam gate means
    // local always has a value by the time this runs) but the function
    // should degrade safely rather than assume `local` is truthy.
    supabaseAuth.from.mockImplementationOnce(() => makeQueryBuilder({ data: null, error: null }));

    await syncFavoriteTeamOnSignIn('user-a');

    expect(supabaseAuth.from).toHaveBeenCalledTimes(1); // only the fetch, never an upsert
  });

  it('leaves local state untouched if the fetch fails', async () => {
    localStorage.setItem('eyewall:sport', 'nhl');
    localStorage.setItem('eyewall:team', JSON.stringify({ abbr: NHL_ABBR }));
    supabaseAuth.from.mockImplementationOnce(() =>
      makeQueryBuilder({ data: null, error: { message: 'timeout' } })
    );

    await syncFavoriteTeamOnSignIn('user-a');

    expect(JSON.parse(localStorage.getItem('eyewall:team')).abbr).toBe(NHL_ABBR);
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
