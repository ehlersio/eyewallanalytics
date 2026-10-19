// src/utils/landingGate.js
// Whether App.jsx shows the marketing landing page (views/LandingView.jsx)
// instead of the app. Decided once per page load, before the router:
//
//   /welcome          the landing, for every web visitor (Settings › About
//                     and the footer link here, so it is always reachable)
//   /                 the landing only for a web visitor with no saved team;
//                     a returning visitor gets the app (the Shot Map) as before
//   anything else     never: a shared /game/:id link still opens the team
//                     picker, then the game
//   the iOS app       never: Capacitor serves index.html at / and a fresh
//                     install has no team, so without this every new iOS user
//                     would be asked to download the app they are using
//
// `/` with app state in the query (`/?summary=2&game=…`, the notification
// links) is the app, not the landing. Campaign and click-id parameters that
// social posts and bio links add (utm_*, fbclid, ...) don't count as app
// state, so a stranger arriving from Instagram still gets the landing.

const MARKETING_PARAM = /^(utm_[a-z_]+|fbclid|gclid|igsh|igshid|ref)$/i;

export const LANDING_PATH = '/welcome';

function trimSlash(pathname) {
  const p = pathname || '/';
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

// True when the query carries nothing the app itself reads.
export function hasOnlyMarketingParams(search) {
  const params = new URLSearchParams(search || '');
  for (const key of params.keys()) {
    if (!MARKETING_PARAM.test(key)) return false;
  }
  return true;
}

export function shouldShowLanding({ isNative, pathname, search, hasTeam }) {
  if (isNative) return false;
  const path = trimSlash(pathname);
  if (path === LANDING_PATH) return true;
  return !hasTeam && path === '/' && hasOnlyMarketingParams(search);
}
