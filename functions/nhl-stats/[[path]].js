import { proxy } from '../_lib/proxy.js';

export function onRequest(context) {
  return proxy(context, {
    prefix:       '/nhl-stats',
    upstream:     'https://api.nhle.com',
    headers:      { 'User-Agent': 'EyeWall-Analytics/1.0' },
    allowType:    type => type === 'application/json',
    cacheControl: 'public, max-age=60, stale-while-revalidate=300',
  });
}
