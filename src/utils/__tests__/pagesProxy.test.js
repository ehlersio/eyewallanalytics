// The NHL pass-through Pages Functions (functions/_lib/proxy.js and the
// three routes built on it).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest as nhlApi } from '../../../functions/nhl-api/[[path]].js';
import { onRequest as nhlStats } from '../../../functions/nhl-stats/[[path]].js';
import { onRequest as nhlAssets } from '../../../functions/nhl-assets/[[path]].js';

const SITE = 'https://eyewallanalytics.com';

function ctx(path, method = 'GET') {
  return { request: new globalThis.Request(`${SITE}${path}`, { method }) };
}

function upstream(status, contentType, body = '', extra = {}) {
  return new Response(status >= 300 && status < 400 ? null : body, {
    status,
    headers: { ...(contentType && { 'Content-Type': contentType }), ...extra },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('NHL Pages Functions', () => {
  it('passes JSON through with the cache and security headers', async () => {
    const fetchMock = vi.fn(async () => upstream(200, 'application/json', '{"ok":1}'));
    vi.stubGlobal('fetch', fetchMock);
    const res = await nhlApi(ctx('/nhl-api/v1/standings/2026-10-12?x=1'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":1}');
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=20, stale-while-revalidate=60');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe('https://api-web.nhle.com/v1/standings/2026-10-12?x=1');
    expect(init.redirect).toBe('manual');
  });

  it('rejects anything but GET and HEAD', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const res = await nhlStats(ctx('/nhl-stats/stats/rest/en/team/summary', method));
      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toBe('GET, HEAD');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows HEAD', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => upstream(200, 'image/png')));
    const res = await nhlAssets(ctx('/nhl-assets/mugs/nhl/1.png', 'HEAD'));
    expect(res.status).toBe(200);
  });

  it('caps the query string', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await nhlStats(ctx(`/nhl-stats/stats/rest/en/team/summary?cayenneExp=${'a'.repeat(1100)}`));
    expect(res.status).toBe(414);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows the NHL’s same-host /now redirects', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(upstream(307, null, '', { Location: '/v1/standings/2026-10-12' }))
      .mockResolvedValueOnce(upstream(200, 'application/json', '{}'));
    vi.stubGlobal('fetch', fetchMock);
    const res = await nhlApi(ctx('/nhl-api/v1/standings/now'));
    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api-web.nhle.com/v1/standings/2026-10-12');
  });

  it('refuses a redirect off the upstream host, and redirect loops', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => upstream(302, null, '', { Location: 'https://evil.example/x.json' })));
    expect((await nhlApi(ctx('/nhl-api/v1/x'))).status).toBe(502);

    const loop = vi.fn(async () => upstream(307, null, '', { Location: '/v1/again' }));
    vi.stubGlobal('fetch', loop);
    expect((await nhlApi(ctx('/nhl-api/v1/x'))).status).toBe(502);
    expect(loop).toHaveBeenCalledTimes(4);
  });

  it('never forwards a content type the app does not read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => upstream(200, 'text/html', '<script>alert(1)</script>')));
    const ok = await nhlApi(ctx('/nhl-api/v1/x'));
    expect(ok.status).toBe(502);
    expect(await ok.text()).not.toContain('<script>');

    vi.stubGlobal('fetch', vi.fn(async () => upstream(404, 'text/html;charset=iso-8859-1', '<html>nope</html>')));
    const missing = await nhlStats(ctx('/nhl-stats/stats/rest/en/nope'));
    expect(missing.status).toBe(404);
    expect(missing.headers.get('Content-Type')).toMatch(/^text\/plain/);
    expect(await missing.text()).not.toContain('<html>');

    vi.stubGlobal('fetch', vi.fn(async () => upstream(200, 'application/javascript', 'x')));
    expect((await nhlAssets(ctx('/nhl-assets/x.js'))).status).toBe(502);
  });

  it('serves logos and headshots through /nhl-assets, behind a script-proof CSP', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => upstream(200, 'image/svg+xml', '<svg/>')));
    const res = await nhlAssets(ctx('/nhl-assets/logos/nhl/svg/CAR_dark.svg'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400, stale-while-revalidate=604800');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
  });

  it('stays on its own host whatever the path', async () => {
    const fetchMock = vi.fn(async () => upstream(200, 'application/json', '{}'));
    vi.stubGlobal('fetch', fetchMock);
    await nhlApi(ctx('/nhl-api//evil.example/x'));
    expect(new URL(String(fetchMock.mock.calls[0][0])).origin).toBe('https://api-web.nhle.com');
  });
});
