import { Capacitor } from '@capacitor/core';

// This app's Cloudflare Pages Functions (/nhl-api, /nhl-stats, /nhl-assets, ...)
// proxy to NHL's APIs/CDN and only exist on the deployed site (eyewallanalytics.com).
// Capacitor's WKWebView loads the app from a local origin (capacitor://localhost),
// so any *relative* request to one of those routes has nothing to resolve against
// and fails there. Prefix such requests with the real origin when running natively;
// stay relative (same-origin, so still dev-proxy-friendly) on web.
export const NATIVE_ORIGIN = Capacitor.isNativePlatform() ? 'https://eyewallanalytics.com' : '';
