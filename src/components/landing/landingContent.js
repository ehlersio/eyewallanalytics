// src/components/landing/landingContent.js
// What the landing page (views/LandingView.jsx) links to and shows, in one
// place. Copy lives in the locale files under `landing.*`.
//
// Feature media: each entry is { type: 'image' | 'video', ... } and
// LandingMedia.jsx draws either, so swapping a screenshot for a recorded
// clip is one line here, e.g.
//   { type: 'video', src: '/landing/live-rink.mp4', poster: '/landing/live-rink.jpg', width: 720, height: 1560 }
// The screenshots are the App Store set (logos off) until the capture
// session replaces them.

import { APP_STORE_URL } from '../../utils/appStore';

export { APP_STORE_URL };
export const WEB_APP_PATH = '/app';
export const METHODOLOGY_PATH = '/methodology';
export const PRIVACY_PATH = '/privacy.html';
export const DELETE_ACCOUNT_PATH = '/delete-account.html';

// The hero's goal: Jaccob Slavin's overtime winner, BOS @ CAR, 2026-04-07
// (CAR won 6-5). Pinned by id so it never changes under the page. The
// Worker caches a finished game's replay for a year; the same JSON is
// bundled as a fallback.
export const HERO_GOAL = { gameId: 2025021237, eventId: 1113 };
export const HERO_REPLAY_FALLBACK = '/landing/hero-replay.json';
export const HERO_LOOP_PAUSE_MS = 4000;

export const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/eyewallanalytics' },
  { key: 'x', label: 'X', href: 'https://x.com/eyewallstats' },
  { key: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61590095322617' },
];

const shot = (name, altKey) => ({
  type: 'image',
  src: `/landing/${name}.jpg`,
  width: 460,
  height: 1000,
  altKey,
});

// Page order. `media` is drawn in phone frames; `id` is the section anchor.
export const FEATURE_SECTIONS = [
  { id: 'live', key: 'live', media: [shot('live', 'landing.live.alt')] },
  { id: 'replays', key: 'replays', media: [] },
  {
    id: 'lock-screen',
    key: 'lock',
    media: [shot('bell', 'landing.lock.alt')],
    liveActivity: { type: 'image', src: '/landing/lock-screen-live.png', width: 510, height: 228, altKey: 'landing.lock.liveActivityAlt' },
  },
  {
    id: 'advanced',
    key: 'advanced',
    media: [shot('advanced', 'landing.advanced.alt'), shot('tracking', 'landing.advanced.trackingAlt')],
  },
  { id: 'teams', key: 'teams', media: [shot('callup', 'landing.teams.alt')] },
  { id: 'ai', key: 'ai', media: [shot('summary', 'landing.ai.alt')] },
];
