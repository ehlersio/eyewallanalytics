// ── analytics.js ─────────────────────────────────────────────
// Thin wrapper around PostHog. All event calls go through here
// so we have one place to disable/mock analytics in tests.
//
// Usage:
//   import { capture } from '../utils/analytics';
//   capture('prediction_card_exported', { opponent: 'NYR' });

import posthog from 'posthog-js';

export function capture(event, properties = {}) {
  if (import.meta.env.MODE !== 'production') return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Never let analytics errors affect the UI
  }
}

export function identify(distinctId, properties = {}) {
  try {
    posthog.identify(distinctId, properties);
  } catch {}
}

export default posthog;
