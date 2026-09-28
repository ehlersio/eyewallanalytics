// Alert preferences on this device (hooks/usePushNotifications.js):
// end-of-period alerts are on by default since 2026-09, and a device that
// saved its own choices keeps them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubBrowserGlobals } from './testHelpers/mockSupabaseAuth.js';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }));

const { DEFAULT_PREFS, loadPrefs, savePrefs, hasSavedPrefs } = await import('../../hooks/usePushNotifications');

describe('alert preferences', () => {
  beforeEach(() => stubBrowserGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('turns end-of-period alerts on by default', () => {
    expect(DEFAULT_PREFS.periodEnd).toBe(true);
    expect(hasSavedPrefs()).toBe(false);
    expect(loadPrefs().periodEnd).toBe(true);
  });

  it('keeps a device’s own choice to have them off', () => {
    savePrefs({ ...DEFAULT_PREFS, periodEnd: false });
    expect(hasSavedPrefs()).toBe(true);
    expect(loadPrefs().periodEnd).toBe(false);
  });
});
