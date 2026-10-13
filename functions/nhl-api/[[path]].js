import { proxy } from '../_lib/proxy.js';

export function onRequest(context) {
  return proxy(context, {
    prefix:       '/nhl-api',
    upstream:     'https://api-web.nhle.com',
    headers:      { 'User-Agent': 'EyeWall-Analytics/1.0' },
    allowType:    type => type === 'application/json',
    cacheControl: 'public, max-age=20, stale-while-revalidate=60',
  });
}
