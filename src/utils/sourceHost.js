// src/utils/sourceHost.js
// 'https://www.nhl.com/news/...' -> 'nhl.com', for "source: nhl.com" links
// (the citations eyewall-pipeline's wiki_trades.py stores for trades and
// corrected dates). null for anything that isn't an http(s) URL, so a bad
// value is never rendered as a link.
export function sourceHost(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
