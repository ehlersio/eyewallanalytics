// utils/posthogScrub.js
// PostHog before_send hook (main.jsx): keeps sign-in secrets out of analytics.
//
// A magic link lands on this site with a one-time ?code= (PKCE, see
// supabaseAuth.js), and before the switch to PKCE it carried the session's
// access and refresh tokens in the #fragment. supabase-js strips the code
// from the address bar, but a pageview captured first would still send it
// as $current_url (and as $initial_current_url, $session_entry_url, ...).
// So every URL-looking value an event carries loses its #fragment and its
// auth query parameters. The app routes by path (BrowserRouter), so no
// route lives in the fragment.

const AUTH_PARAMS = [
  'code', 'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token',
  'token', 'token_hash', 'sb_flow_id',
];

export function scrubUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  const found = AUTH_PARAMS.filter(p => url.searchParams.has(p));
  // Untouched URLs go out exactly as they came in.
  if (!url.hash && !value.endsWith('#') && !found.length) return value;
  url.hash = '';
  found.forEach(p => url.searchParams.delete(p));
  return url.toString();
}

function scrubProps(props) {
  if (!props || typeof props !== 'object') return props;
  const out = {};
  for (const [k, v] of Object.entries(props)) out[k] = scrubUrl(v);
  return out;
}

export function scrubAuthFromEvent(event) {
  if (!event) return event;
  return {
    ...event,
    properties: scrubProps(event.properties),
    ...(event.$set && { $set: scrubProps(event.$set) }),
    ...(event.$set_once && { $set_once: scrubProps(event.$set_once) }),
  };
}
