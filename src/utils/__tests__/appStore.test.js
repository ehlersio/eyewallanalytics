import { describe, expect, it } from 'vitest';
import { APP_STORE_URL, withAppStoreLink } from '../appStore';

describe('withAppStoreLink', () => {
  it('puts the App Store line after the caption, a blank line apart', () => {
    expect(withAppStoreLink('CAR 4–2 NYI', `Get the iPhone app: ${APP_STORE_URL}`))
      .toBe(`CAR 4–2 NYI\n\nGet the iPhone app: ${APP_STORE_URL}`);
  });

  it('is just the App Store line when a card has no caption', () => {
    expect(withAppStoreLink(undefined, 'Get the iPhone app')).toBe('Get the iPhone app');
  });
});
