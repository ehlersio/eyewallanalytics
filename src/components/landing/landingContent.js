// src/components/landing/landingContent.js
// What the landing page (views/LandingView.jsx) links to and shows, in one
// place. Copy lives in the locale files under `landing.*`.
//
// Feature media: each entry is { type: 'image' | 'video', ... } and
// LandingMedia.jsx draws either. A screenshot is a dark and a light capture
// (src / srcLight; the page shows the one matching the theme). A clip is
// muted H.264 with a poster frame, and `still` lists the screenshots shown
// in its place under prefers-reduced-motion.
//
// Every file in public/landing/ carries the first 8 hex digits of its
// SHA-256 in its name and is served immutable (public/_headers), so a
// recapture is a new name. The captures, the cutting and the copy step
// (landing-assets/tools/publish.sh, which prints these hashes) are written
// up in landing-assets/NOTES.md, next to this repo in the workspace.

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
export const HERO_REPLAY_FALLBACK = '/landing/hero-replay.63a70588.json';
export const HERO_LOOP_PAUSE_MS = 4000;

export const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/eyewallanalytics' },
  { key: 'x', label: 'X', href: 'https://x.com/eyewallstats' },
  { key: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61590095322617' },
];

const shot = (name, [dark, light], altKey) => ({
  type: 'image',
  src: `/landing/${name}-dark.${dark}.jpg`,
  srcLight: `/landing/${name}-light.${light}.jpg`,
  width: 460,
  height: 1000,
  altKey,
});

const clip = (name, [video, poster], altKey, still) => ({
  type: 'video',
  src: `/landing/${name}.${video}.mp4`,
  poster: `/landing/${name}-poster.${poster}.jpg`,
  width: 720,
  height: 1560,
  altKey,
  still,
});

// Captured 2026-10-19 in the iPhone 17 Pro Max simulator, logos on. The
// clips and the replay stills replay BOS @ CAR, 2026-04-07 (the hero's game)
// through the dev-only /dev route; the summary is CAR @ CGY, 2026-10-16.
const SHOTS = {
  live: shot('live', ['e38cb5a8', '6c8745cc'], 'landing.live.alt'),
  replayVideo: shot('replay-video', ['7aad67d8', '51344781'], 'landing.replays.videoAlt'),
  replayTracking: shot('replay-tracking', ['4615826d', '4c63e92f'], 'landing.replays.trackingAlt'),
  bell: shot('bell', ['32f712e4', 'f90f811c'], 'landing.lock.alt'),
  tracking: shot('tracking', ['0c894741', '254679c3'], 'landing.advanced.trackingAlt'),
  compare: shot('compare', ['99591294', 'f8e184d0'], 'landing.advanced.alt'),
  callup: shot('callup', ['4b832f1d', '5b5ec6b2'], 'landing.teams.alt'),
  summary: shot('summary', ['1675a25e', 'c8b8ee27'], 'landing.ai.alt'),
  pwhl: shot('pwhl', ['cd0ea8dd', 'd2e9ca72'], 'landing.leaguesBand.pwhlAlt'),
  ahl: shot('ahl', ['f0db256a', 'a1a71555'], 'landing.leaguesBand.ahlAlt'),
};

// Shot maps from two of the other leagues, under the league logos.
export const LEAGUE_SHOTS = [SHOTS.pwhl, SHOTS.ahl];

// Page order. `media` is drawn in phone frames; `id` is the section anchor.
export const FEATURE_SECTIONS = [
  { id: 'live', key: 'live', media: [clip('live-rink', ['4d9de27c', 'd87d2675'], 'landing.live.clipAlt', [SHOTS.live])] },
  {
    id: 'replays',
    key: 'replays',
    media: [clip('replay-switch', ['5116fead', 'c904a4d4'], 'landing.replays.alt', [SHOTS.replayVideo, SHOTS.replayTracking])],
  },
  {
    id: 'lock-screen',
    key: 'lock',
    media: [SHOTS.bell],
    liveActivity: { type: 'image', src: '/landing/lock-screen-live.4fa23861.png', width: 510, height: 228, altKey: 'landing.lock.liveActivityAlt' },
  },
  { id: 'advanced', key: 'advanced', media: [SHOTS.tracking, SHOTS.compare] },
  { id: 'teams', key: 'teams', media: [SHOTS.callup] },
  { id: 'ai', key: 'ai', media: [SHOTS.summary] },
];
