// utils/summarySeen.js
// Which period/final summaries this device has already seen in the
// notifications bell, so the bell's dot means "something new since you
// last looked". Kept in localStorage, the most recent few only.

const STORAGE_KEY = 'eyewall:summaries-seen';
const KEEP = 60; // a few games' worth

export const summaryKey = s => `${s.gameId}:${s.isGameSummary ? 'game' : s.period}`;

export function loadSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

export const hasUnseen = (summaries, seen) => summaries.some(s => !seen.has(summaryKey(s)));

// `seen` with these summaries added, oldest dropped past KEEP. Saved too.
export function markSeen(summaries, seen) {
  const next = [...seen, ...summaries.map(summaryKey).filter(k => !seen.has(k))].slice(-KEEP);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode etc. */ }
  return new Set(next);
}

// Newest first: the final, then periods from the latest back.
export const newestFirst = summaries => [...summaries].sort((a, b) =>
  (b.isGameSummary ? 1 : 0) - (a.isGameSummary ? 1 : 0) || (b.period || 0) - (a.period || 0));
