// ── analytics.js ─────────────────────────────────────────────
// Thin wrapper around PostHog. All event calls go through here
// so we have one place to disable/mock analytics in tests.
//
// Usage:
//   import { capture } from '../utils/analytics';
//   capture('prediction_card_exported', { opponent: 'NYR' });

import { useCallback } from 'react';
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

// ── Feature usage (2026-09) ──────────────────────────────────
// One event name per kind, with the feature as a property, so a single
// PostHog insight can break usage down by feature:
//   feature_viewed      { feature, ...props }          -- on screen
//   feature_interacted  { feature, action, ...props }  -- a tap/toggle
// Features: playoff_odds, injury_impact, probable_starters, scorecard,
// trade_tree. Every event also carries the `team` super property
// (main.jsx), so any of these breaks down by selected team.

export function trackFeature(feature, action, properties = {}) {
  capture('feature_interacted', { feature, action, ...properties });
}

// Fires `feature_viewed` once for `el`, the first time it's at least half
// on screen -- a card below the fold that's never scrolled to doesn't count
// as seen. The flag lives on the element, so re-renders don't re-fire; a
// fresh mount (a reload, a new view) counts again.
export function observeFeatureView(el, feature, properties = {}) {
  if (!el || typeof IntersectionObserver === 'undefined' || el.dataset.featureViewed) return null;
  const observer = new IntersectionObserver((entries) => {
    if (el.dataset.featureViewed || !entries.some(e => e.isIntersecting)) return;
    el.dataset.featureViewed = '1';
    capture('feature_viewed', { feature, ...properties });
    observer.disconnect();
  }, { threshold: 0.5 });
  observer.observe(el);
  return observer;
}

// observeFeatureView() as a callback ref (not useRef), so it works for
// elements that mount after a loading state or an early `return null`.
export function useFeatureViewed(feature, properties = {}) {
  const key = JSON.stringify(properties);
  return useCallback(el => { observeFeatureView(el, feature, JSON.parse(key)); }, [feature, key]);
}

export default posthog;
