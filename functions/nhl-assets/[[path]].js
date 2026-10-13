import { proxy } from '../_lib/proxy.js';

// The app loads team logos (SVG) and player headshots (PNG) through here.
// Video and fonts are allowed too, the other kinds assets.nhle.com serves.
const ALLOWED_PREFIXES = ['image/', 'video/', 'font/'];
const ALLOWED_TYPES = ['application/font-woff', 'application/font-woff2', 'application/x-font-ttf', 'application/x-font-otf'];

export function onRequest(context) {
  return proxy(context, {
    prefix:       '/nhl-assets',
    upstream:     'https://assets.nhle.com',
    allowType:    type => ALLOWED_PREFIXES.some(p => type.startsWith(p)) || ALLOWED_TYPES.includes(type),
    cacheControl: 'public, max-age=86400, stale-while-revalidate=604800',
  });
}
