// Netlify Edge Function — NHL API proxy
// Runs at the CDN edge (Deno runtime), so no cold start penalty.
//
// Handles three route prefixes:
//   /nhl-api/*    → https://api-web.nhle.com/*
//   /nhl-stats/*  → https://api.nhle.com/*
//   /nhl-assets/* → https://assets.nhle.com/*

const ROUTES = {
  '/nhl-api':    'https://api-web.nhle.com',
  '/nhl-stats':  'https://api.nhle.com',
  '/nhl-assets': 'https://assets.nhle.com',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Find which upstream host to use
  let upstream = null;
  let stripped  = null;
  for (const [prefix, host] of Object.entries(ROUTES)) {
    if (path.startsWith(prefix)) {
      upstream = host;
      stripped  = path.slice(prefix.length) || '/';
      break;
    }
  }

  if (!upstream) {
    return new Response('Not found', { status: 404 });
  }

  // Build the upstream URL — preserve query string
  const targetUrl = `${upstream}${stripped}${url.search}`;

  // Forward the request, stripping browser-only headers that confuse the upstream
  const headers = new Headers();
  for (const [k, v] of request.headers) {
    const lower = k.toLowerCase();
    // Drop headers that would cause issues upstream
    if (['host', 'origin', 'referer', 'x-forwarded-host'].includes(lower)) continue;
    headers.set(k, v);
  }
  // Identify ourselves politely
  headers.set('User-Agent', 'EyeWall-Analytics/1.0');

  let upstreamRes;
  try {
    upstreamRes = await fetch(targetUrl, {
      method:  request.method,
      headers,
      body:    ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    });
  } catch (err) {
    return new Response(`Upstream fetch failed: ${err.message}`, { status: 502 });
  }

  // Build response headers — add CORS so the browser accepts it
  const resHeaders = new Headers(upstreamRes.headers);
  resHeaders.set('Access-Control-Allow-Origin',  '*');
  resHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  resHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
  // Cache at the edge: static assets longer, API responses shorter
  const isAsset = path.startsWith('/nhl-assets');
  resHeaders.set('Cache-Control', isAsset
    ? 'public, max-age=86400, stale-while-revalidate=604800'   // 1 day / 1 week
    : 'public, max-age=30,    stale-while-revalidate=60');     // 30s / 1min

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: resHeaders });
  }

  return new Response(upstreamRes.body, {
    status:  upstreamRes.status,
    headers: resHeaders,
  });
}

export const config = {
  path: ['/nhl-api/*', '/nhl-stats/*', '/nhl-assets/*'],
};
