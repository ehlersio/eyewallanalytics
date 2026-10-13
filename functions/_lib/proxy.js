// functions/_lib/proxy.js
// Shared by the three NHL pass-through Functions (/nhl-api, /nhl-stats,
// /nhl-assets). Each one is pinned to a single NHL host; this keeps them
// from being anything more than that:
//   - GET and HEAD only (405 otherwise).
//   - The query string is capped (414) -- the app's longest, a stats report
//     with a JSON sort, is about 400 characters.
//   - Redirects are not followed blindly. api-web.nhle.com answers /now and
//     /current routes with a 307 to a dated URL on the same host, so those are
//     followed (a few hops at most); a redirect anywhere else is a 502.
//   - Only the content types the app actually reads go back out. Anything
//     else (the NHL's 404 pages are text/html) loses its body: a 2xx becomes
//     a 502, an error keeps its status.
//   - nosniff, and a CSP that lets nothing run, on every response: an SVG
//     opened directly on this origin can't execute script.
// _headers doesn't apply to Functions, so the headers are set here.

const MAX_QUERY_LENGTH = 1024;
const MAX_REDIRECTS = 3;

const SECURITY_HEADERS = {
  'X-Content-Type-Options':  'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'Access-Control-Allow-Origin': '*',
};

function plain(status, message, extra = {}) {
  return new Response(message, {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

// prefix: '/nhl-api'; upstream: 'https://api-web.nhle.com';
// allowType(mediaType) -> boolean; cacheControl: the Cache-Control to send.
export async function proxy(context, { prefix, upstream, allowType, cacheControl, headers = {} }) {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return plain(405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  const url = new URL(request.url);
  if (url.search.length > MAX_QUERY_LENGTH) return plain(414, 'URI Too Long');

  const path = url.pathname.slice(prefix.length) || '/';
  const origin = new URL(upstream).origin;
  let target = new URL(`${origin}${path}${url.search}`);
  if (target.origin !== origin) return plain(400, 'Bad Request');

  let res;
  for (let hop = 0; ; hop++) {
    res = await fetch(target, { method: request.method, headers, redirect: 'manual' });
    if (res.status < 300 || res.status > 399) break;
    const location = res.headers.get('Location');
    const next = location ? new URL(location, target) : null;
    if (!next || next.origin !== origin || hop >= MAX_REDIRECTS) return plain(502, 'Bad Gateway');
    target = next;
  }

  const contentType = res.headers.get('Content-Type') || '';
  const mediaType = contentType.split(';')[0].trim().toLowerCase();
  if (!allowType(mediaType)) {
    return res.ok ? plain(502, 'Bad Gateway') : plain(res.status, res.statusText || 'Error');
  }

  return new Response(res.body, {
    status: res.status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type':  contentType,
      'Cache-Control': cacheControl,
    },
  });
}
