// PostHog before_send (utils/posthogScrub.js): no sign-in secrets in analytics.
import { describe, expect, it } from 'vitest';
import { scrubAuthFromEvent, scrubUrl } from '../posthogScrub';

describe('scrubUrl', () => {
  it('drops the PKCE code and keeps other params', () => {
    expect(scrubUrl('https://eyewallanalytics.com/?code=abc&team=CAR')).toBe('https://eyewallanalytics.com/?team=CAR');
    expect(scrubUrl('https://eyewallanalytics.com/team?code=abc&sb_flow_id=f')).toBe('https://eyewallanalytics.com/team');
  });

  it('drops the fragment, where the implicit flow put the tokens', () => {
    expect(scrubUrl('https://eyewallanalytics.com/#access_token=a&refresh_token=r&type=magiclink'))
      .toBe('https://eyewallanalytics.com/');
  });

  it('drops tokens from query strings too', () => {
    expect(scrubUrl('https://x.supabase.co/auth/v1/verify?token=t&type=magiclink&redirect_to=https://e.com'))
      .toBe('https://x.supabase.co/auth/v1/verify?type=magiclink&redirect_to=https%3A%2F%2Fe.com');
    expect(scrubUrl('https://e.com/?access_token=a&refresh_token=r&token_hash=h')).toBe('https://e.com/');
  });

  it('leaves clean URLs and non-URLs exactly as they were', () => {
    expect(scrubUrl('https://eyewallanalytics.com/game/2025020001?as=pwhl%20x')).toBe('https://eyewallanalytics.com/game/2025020001?as=pwhl%20x');
    expect(scrubUrl('/team')).toBe('/team');
    expect(scrubUrl('code=abc')).toBe('code=abc');
    expect(scrubUrl(42)).toBe(42);
    expect(scrubUrl(null)).toBe(null);
  });
});

describe('scrubAuthFromEvent', () => {
  it('scrubs every URL property, $set and $set_once included', () => {
    const out = scrubAuthFromEvent({
      event: '$pageview',
      properties: {
        $current_url: 'https://eyewallanalytics.com/?code=abc',
        $referrer: 'https://mail.example/#inbox',
        $pathname: '/',
        team: 'CAR',
      },
      $set: { $current_url: 'https://eyewallanalytics.com/?code=abc' },
      $set_once: { $initial_current_url: 'https://eyewallanalytics.com/#access_token=a' },
    });
    expect(out.properties).toEqual({
      $current_url: 'https://eyewallanalytics.com/',
      $referrer: 'https://mail.example/',
      $pathname: '/',
      team: 'CAR',
    });
    expect(out.$set.$current_url).toBe('https://eyewallanalytics.com/');
    expect(out.$set_once.$initial_current_url).toBe('https://eyewallanalytics.com/');
    expect(out.event).toBe('$pageview');
  });

  it('passes a dropped event through', () => {
    expect(scrubAuthFromEvent(null)).toBe(null);
  });

  it('does not add $set when the event had none', () => {
    expect(scrubAuthFromEvent({ event: 'x', properties: {} })).not.toHaveProperty('$set');
  });
});
