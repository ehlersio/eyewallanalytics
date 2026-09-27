// utils/goalUpdates.js
// Telling a new goal apart from a correction to one already shown.
//
// The NHL often posts a goal before its assists (or with the wrong
// scorer) and fixes the same play a minute later. Each goal is tracked
// by a signature, `${eventId}:${scorer}:${assists}`. Only an eventId
// that's never been seen is a new goal -- horn and all. A known eventId
// with a different signature is an update to that goal: shown, but
// labelled as a correction and without the horn.

export const goalSignature = (eventId, scorer, assists) =>
  `${eventId}:${scorer}:${assists.join(',')}`;

// 'new' | 'update' | 'seen'. `shown` is the set of signatures already shown.
export function classifyGoal(shown, eventId, sig) {
  if (shown.has(sig)) return 'seen';
  const prefix = `${eventId}:`;
  for (const s of shown) if (s.startsWith(prefix)) return 'update';
  return 'new';
}

// `shown` with this goal's signature in place of any earlier one.
export function recordGoal(shown, eventId, sig) {
  const prefix = `${eventId}:`;
  const next = new Set([...shown].filter(s => !s.startsWith(prefix)));
  next.add(sig);
  return next;
}
