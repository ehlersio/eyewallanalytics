import { describe, it, expect } from 'vitest';

// ── stripHtml (mirrors worker.js) ───────────────────────────────────────────
function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

// ── timeAgo (mirrors NewsView.jsx) ──────────────────────────────────────────
function timeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = (Date.now() - new Date(isoDate)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Google News title cleaning (mirrors worker.js) ───────────────────────────
function cleanGoogleTitle(raw) {
  let title = stripHtml(raw);
  const dashIdx = title.lastIndexOf(' - ');
  let outlet = '';
  if (dashIdx > 20) {
    outlet = title.slice(dashIdx + 3).trim();
    title  = title.slice(0, dashIdx).trim();
  }
  return { title, outlet };
}

// ── ESPN URL cleaning ────────────────────────────────────────────────────────
function cleanUrl(u) {
  return u ? u.replace(/\]\]>.*$/, '').replace(/[>\]]+$/, '').trim() : '';
}

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('decodes HTML entities', () => {
    expect(stripHtml('Canes &amp; Hurricanes')).toBe('Canes & Hurricanes');
    expect(stripHtml('&lt;goal&gt;')).toBe('<goal>');
    expect(stripHtml('it&#039;s')).toBe("it's");
    expect(stripHtml('&quot;quoted&quot;')).toBe('"quoted"');
  });

  it('collapses whitespace', () => {
    expect(stripHtml('hello   \n  world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('strips anchor tags from Google News descriptions', () => {
    const html = '<a href="https://news.google.com/rss/articles/ABC"><ol><li>Story one</li></ol></a>';
    const result = stripHtml(html);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });
});

describe('timeAgo', () => {
  it('returns just now for recent timestamps', () => {
    const now = new Date(Date.now() - 10000).toISOString();
    expect(timeAgo(now)).toBe('just now');
  });

  it('returns minutes for <1hr', () => {
    const ago = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    expect(timeAgo(ago)).toBe('25m ago');
  });

  it('returns hours for <1day', () => {
    const ago = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(timeAgo(ago)).toBe('3h ago');
  });

  it('returns days for <1week', () => {
    const ago = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(timeAgo(ago)).toBe('2d ago');
  });

  it('returns empty string for null', () => {
    expect(timeAgo(null)).toBe('');
  });
});

describe('cleanGoogleTitle', () => {
  it('strips outlet name from Google News title', () => {
    const { title, outlet } = cleanGoogleTitle(
      'How Carolina Hurricanes are disproving heart vs. analytics debate - Sportsnet'
    );
    expect(title).toBe('How Carolina Hurricanes are disproving heart vs. analytics debate');
    expect(outlet).toBe('Sportsnet');
  });

  it('leaves short titles unchanged', () => {
    const { title, outlet } = cleanGoogleTitle('Canes win - ESPN');
    // "Canes win" is only 8 chars before " - ESPN", dashIdx < 20 so no split
    expect(title).toBe('Canes win - ESPN');
    expect(outlet).toBe('');
  });

  it('strips HTML before processing', () => {
    const { title } = cleanGoogleTitle('<b>CAR advances to conference finals</b> - The Athletic');
    expect(title).toBe('CAR advances to conference finals');
  });
});

describe('cleanUrl', () => {
  it('strips ]]> from ESPN URLs', () => {
    const url = 'https://www.espn.com/nhl/story/_/id/48883288/test]]>';
    expect(cleanUrl(url)).toBe('https://www.espn.com/nhl/story/_/id/48883288/test');
  });

  it('leaves clean URLs unchanged', () => {
    const url = 'https://www.espn.com/nhl/story/_/id/123/test';
    expect(cleanUrl(url)).toBe(url);
  });

  it('handles null/empty', () => {
    expect(cleanUrl(null)).toBe('');
    expect(cleanUrl('')).toBe('');
  });
});
