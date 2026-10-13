// public/_headers' Content-Security-Policy against what the app loads. The
// dev server (and so Cypress) never sends these headers, so drift between
// the CSP and the code would only show up on the deployed site.
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (p) => readFileSync(`${root}${p}`, 'utf8');

const headers = read('public/_headers');
const csp = headers.match(/^\s+Content-Security-Policy: (.+)$/m)?.[1] ?? '';
const directive = (name) => csp.split(';').map(d => d.trim().split(/\s+/)).find(([n]) => n === name)?.slice(1) ?? [];
const originOf = (src, re) => new URL(src.match(re)[1]).origin;

// Bodies of the <script> elements without a src, in any letter case. A
// scan, not a regex: index.html is our own file, and a tag-matching regex
// is what CodeQL's js/bad-tag-filter rule (rightly) distrusts.
function inlineScripts(html) {
  const lower = html.toLowerCase();
  const bodies = [];
  let at = 0;
  while ((at = lower.indexOf('<script', at)) !== -1) {
    const tagEnd = lower.indexOf('>', at);
    const next = lower[at + '<script'.length];
    if (tagEnd === -1) break;
    if (next !== '>' && !/\s/.test(next)) { at = tagEnd; continue; } // <scripttype>, not a script
    const close = lower.indexOf('</script', tagEnd);
    if (close === -1) break;
    const attrs = lower.slice(at + '<script'.length, tagEnd);
    if (!/(^|\s)src\s*=/.test(attrs)) bodies.push(html.slice(tagEnd + 1, close));
    at = close + '</script'.length;
  }
  return bodies;
}

describe('Content-Security-Policy', () => {
  it('is enforced, not report-only', () => {
    expect(csp).toContain("default-src 'self'");
    expect(headers).not.toMatch(/Content-Security-Policy-Report-Only/);
  });

  it('allows each inline <script> in index.html by hash, and nothing else inline', () => {
    const html = read('index.html');
    const inline = inlineScripts(html);
    expect(inline.length).toBeGreaterThan(0);
    const scriptSrc = directive('script-src');
    for (const body of inline) {
      const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
      expect(scriptSrc, 'update the hash in public/_headers after editing index.html\'s inline script').toContain(hash);
    }
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('lets the app reach the Worker, Supabase and PostHog', () => {
    const connect = directive('connect-src');
    expect(connect).toContain(originOf(read('src/utils/seasonClient.js'), /WORKER_BASE = '([^']+)'/));
    expect(connect).toContain(originOf(read('src/utils/supabaseAuth.js'), /VITE_SUPABASE_URL \|\| '([^']+)'/));
    expect(connect).toContain(originOf(read('src/main.jsx'), /api_host:\s*'([^']+)'/));
  });

  it('allows the goal-clip player and the Google Fonts', () => {
    expect(directive('frame-src')).toContain(originOf(read('src/utils/nhlApi.js'), /`(https:\/\/players\.brightcove\.net)\//));
    const fonts = read('index.html').match(/<link rel="stylesheet" href="([^"]+)"/)[1];
    expect(directive('style-src')).toContain(new URL(fonts).origin);
    expect(directive('font-src')).toContain('https://fonts.gstatic.com');
  });

  it('keeps the page out of frames', () => {
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
    expect(headers).toMatch(/^\s+X-Frame-Options: DENY$/m);
  });
});
