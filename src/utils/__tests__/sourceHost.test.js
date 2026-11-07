import { describe, it, expect } from 'vitest';
import { sourceHost } from '../sourceHost';

describe('sourceHost', () => {
  it('shortens a citation URL to its host', () => {
    expect(sourceHost('https://www.nhl.com/news/patrick-kane-traded-to-new-york-rangers-from-chicago-blackhawks-341625462')).toBe('nhl.com');
    expect(sourceHost('https://x.com/PuckReportNHL/status/1939013129440215507')).toBe('x.com');
    expect(sourceHost('http://www.sportsnet.ca/nhl/article/x/')).toBe('sportsnet.ca');
  });

  it('is null for anything that is not an http(s) URL', () => {
    expect(sourceHost(null)).toBeNull();
    expect(sourceHost('')).toBeNull();
    expect(sourceHost('not a url')).toBeNull();
    expect(sourceHost('javascript:alert(1)')).toBeNull();
  });
});
