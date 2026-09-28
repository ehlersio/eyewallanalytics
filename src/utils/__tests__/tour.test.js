import { describe, expect, it, vi } from 'vitest';

vi.mock('../analytics', () => ({ capture: vi.fn() }));
const { tourAction, TOUR_STOPS } = await import('../tour');

describe('tourAction', () => {
  it('starts right after a first team is picked', () => {
    expect(tourAction({ pending: true })).toBe('start');
  });

  it('invites someone who was using the app before, once', () => {
    expect(tourAction({})).toBe('invite');
    expect(tourAction({ invited: true })).toBeNull();
  });

  it('does nothing once it’s been taken or closed', () => {
    expect(tourAction({ done: true, pending: true })).toBeNull();
  });
});

describe('TOUR_STOPS', () => {
  it('has a selector and copy key for every stop, ending on Settings (where it can be replayed)', () => {
    expect(TOUR_STOPS.every(s => s.key && s.selector)).toBe(true);
    expect(TOUR_STOPS.at(-1).key).toBe('settings');
  });
});
