// utils/tour.js -- the app tour (driver.js): a short walk through what's on
// the team's home page. New users get it right after picking their first
// team; everyone who was already using the app is invited once
// (TourHost.jsx); Settings > Help replays it any time.
//
// State: eyewall:tour = { done, invited, pending } on this device.
// Every stop is found by selector when the tour starts; a stop that isn't
// on screen (no live game yet, no second team to switch to, ECHL's page
// without a score card) is left out, never pointed at empty space.
import { capture } from './analytics';

const STORAGE_KEY = 'eyewall:tour';
export const START_TOUR_EVENT = 'eyewall:start-tour';

// The team's home page in each league, where every stop lives.
export const TOUR_ROOTS = { nhl: '/', pwhl: '/pwhl/shots', ahl: '/ahl/shots', echl: '/echl/shots' };

// In tour order. `key` looks up tour.steps.<key>.{title,body}.
export const TOUR_STOPS = [
  { key: 'score',    selector: '.score-card' },
  { key: 'rink',     selector: '[data-tour="rink"]' },
  { key: 'nav',      selector: '.bottom-nav' },
  { key: 'search',   selector: '.topbar .player-search-toggle' },
  { key: 'switcher', selector: 'button.team-switcher' },
  { key: 'bell',     selector: 'button.summary-bell' },
  { key: 'settings', selector: 'button.notif-bell' },
];

export function loadTourState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function saveTourState(patch) {
  const next = { ...loadTourState(), ...patch };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode etc. */ }
  return next;
}

// What happens on a home page: 'start' the tour (just picked a first
// team), 'invite' (was using the app before the tour existed), or nothing.
export function tourAction(state) {
  if (state.done) return null;
  if (state.pending) return 'start';
  if (!state.invited) return 'invite';
  return null;
}

// The stops present on the page right now, in order.
export function presentStops(doc = document) {
  return TOUR_STOPS
    .map(stop => ({ ...stop, element: doc.querySelector(stop.selector) }))
    .filter(stop => stop.element);
}

// Starts the tour on what's on screen. `trigger`: 'firstTeam' | 'invite' |
// 'settings', for PostHog. Resolves once it's set up (driver.js loads only
// when a tour actually runs).
// One tour at a time: two starts close together (React running an effect
// twice in development, a quick page change) would otherwise stack two
// popovers.
let starting = false;
let activeTour = null;

export async function startTour(t, trigger) {
  if (starting || activeTour?.isActive()) return false;
  const stops = presentStops();
  if (!stops.length) return false;
  starting = true;
  let driver;
  try {
    ({ driver } = await import('driver.js'));
    await import('driver.js/dist/driver.css');
  } finally {
    starting = false;
  }

  let reached = 0;
  saveTourState({ pending: false, invited: true });
  capture('tour_started', { trigger, stops: stops.length });

  const tour = driver({
    popoverClass: 'eyewall-tour',
    showProgress: true,
    progressText: t('tour.progress', { current: '{{current}}', total: '{{total}}' }),
    nextBtnText: t('tour.next'),
    prevBtnText: t('tour.back'),
    doneBtnText: t('tour.done'),
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 12,
    smoothScroll: true,
    steps: stops.map(stop => ({
      element: stop.selector,
      popover: { title: t(`tour.steps.${stop.key}.title`), description: t(`tour.steps.${stop.key}.body`) },
    })),
    onHighlighted: (_el, _step, { state }) => {
      reached = Math.max(reached, (state.activeIndex ?? 0) + 1);
      capture('tour_step', { index: state.activeIndex, key: stops[state.activeIndex]?.key });
    },
    // Not onDestroyed: driver.js only calls that when it still has a
    // current element and step, so closing at some points skipped it and
    // the tour came back. onDestroyStarted runs for every way out (Done,
    // ✕, Escape, the backdrop); it then has to close the tour itself.
    onDestroyStarted: () => {
      saveTourState({ done: true });
      capture(reached >= stops.length ? 'tour_completed' : 'tour_skipped', { reached, stops: stops.length, trigger });
      tour.destroy();
      activeTour = null;
    },
  });
  activeTour = tour;
  tour.drive();
  return true;
}
