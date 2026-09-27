// utils/reviewPrompt.js
// Asks for an App Store rating, in the iOS app only, at a good moment
// (the favorite team just won, a card was just shared) and only from
// someone who's clearly a regular.
//
// The ask itself is Apple's own rating sheet (AppReviewPlugin in
// ios/App/App/SceneDelegate.swift). iOS decides whether it actually
// appears -- at most 3 times a year per app, never in TestFlight -- and
// never says whether it did, so the gates below are about not wasting
// those few chances, not about counting them.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { capture } from './analytics';

const AppReview = registerPlugin('AppReview');

const STORAGE_KEY = 'eyewall:review';
const DAY_MS = 24 * 3600 * 1000;
export const MIN_DAYS_USED = 3;      // distinct days the app was opened
export const MIN_DAYS_SINCE_FIRST = 3;
export const MIN_DAYS_BETWEEN_ASKS = 120;
const DAYS_KEPT = MIN_DAYS_USED;     // only ever need to know "at least N"

const dayKey = now => new Date(now).toISOString().slice(0, 10);

// ── Pure (unit-tested) ────────────────────────────────────────

// `state` with today counted as a day the app was used.
export function withAppOpen(state, now) {
  const s = state || {};
  const today = dayKey(now);
  const days = (s.days || []).includes(today) ? s.days : [...(s.days || []), today].slice(-DAYS_KEPT);
  return { ...s, firstSeen: s.firstSeen ?? now, days };
}

export function shouldAskForReview(state, now, version) {
  if (!state?.firstSeen) return false;
  if ((state.days || []).length < MIN_DAYS_USED) return false;
  if (now - state.firstSeen < MIN_DAYS_SINCE_FIRST * DAY_MS) return false;
  if (state.lastAsked && now - state.lastAsked < MIN_DAYS_BETWEEN_ASKS * DAY_MS) return false;
  // Once per version: a rating is shown against the version it was left on.
  if (version && state.askedVersion === version) return false;
  return true;
}

// ── Device-side ───────────────────────────────────────────────

const isIOSApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
const appVersion = () => (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null);

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}
function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode etc. */ }
}

// Once per app launch (App.jsx).
export function recordAppOpen(now = Date.now()) {
  if (!isIOSApp()) return;
  save(withAppOpen(load(), now));
}

// `trigger`: what just happened ('win', 'share'), for PostHog.
export function maybeRequestReview(trigger, now = Date.now()) {
  if (!isIOSApp()) return;
  const state = load();
  const version = appVersion();
  if (!shouldAskForReview(state, now, version)) return;
  save({ ...state, lastAsked: now, askedVersion: version });
  capture('review_prompt_requested', { trigger });
  AppReview.requestReview().catch(() => {});
}
