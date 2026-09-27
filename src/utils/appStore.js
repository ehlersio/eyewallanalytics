// utils/appStore.js
// The iOS app's App Store page. index.html's Smart App Banner uses the
// same id (6811195260).
export const APP_STORE_URL = 'https://apps.apple.com/app/eyewall-analytics/id6811195260';

// A share's text with the App Store link on the end, so every shared card
// points at the app.
export function withAppStoreLink(text, getTheAppLine) {
  return [text, getTheAppLine].filter(Boolean).join('\n\n');
}
