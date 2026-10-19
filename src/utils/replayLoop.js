// src/utils/replayLoop.js
// Looping for GoalTrackingReplay (the landing page's hero plays its goal,
// pauses, and plays it again). Pure, so the rules are tested without a DOM:
//
//   - only a replay that reached its end on its own loops; a viewer who
//     paused, scrubbed or restarted is in charge until it ends again
//   - nothing loops under prefers-reduced-motion (the component already
//     doesn't autoplay there)

export const DEFAULT_LOOP_PAUSE_MS = 4000;

// `loop` prop -> ms to wait before playing again, or null for no loop.
// true means the default pause; a number is the pause in ms.
export function loopDelay(loop, reducedMotion) {
  if (reducedMotion || loop == null || loop === false) return null;
  const ms = loop === true ? DEFAULT_LOOP_PAUSE_MS : Number(loop);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

// One pending restart at a time. Scheduling again replaces it; cancel() is
// for any viewer input and for unmount.
export function createLoopTimer(timers = globalThis) {
  let id = null;
  return {
    schedule(delay, fn) {
      this.cancel();
      if (delay == null) return;
      id = timers.setTimeout(() => { id = null; fn(); }, delay);
    },
    cancel() {
      if (id != null) timers.clearTimeout(id);
      id = null;
    },
    get pending() { return id != null; },
  };
}
