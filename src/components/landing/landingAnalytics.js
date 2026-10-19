// src/components/landing/landingAnalytics.js
// The landing page renders outside the router, so App.jsx's PageTracker
// never sees it: it sends its own $pageview, and one event per call to
// action with what was tapped.

import { capture } from '../../utils/analytics';

export function trackLandingView(path) {
  capture('$pageview', { path, page_name: 'Landing' });
}

// target: 'app_store' | 'web' | 'methodology' | 'social'
export function trackLandingCta(target, properties = {}) {
  capture('landing_cta', { target, ...properties });
}
