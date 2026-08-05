// utils/triviaAnswers.js — Phase 2: trivia answer tracking + sync.
//
// Anonymous users: localStorage only ('eyewall:trivia-answers'), same
// posture as favorite-team was before Phase 1's sync layer existed.
//
// Signed-in users: synced to trivia_answers (RLS-scoped exactly like
// user_preferences — see docs/session92_trivia_tables.sql). Deliberately
// NOT Phase 1's "server wins on a second device" rule — that rule fits a
// single overwritable value (favorite team); answer history is an
// append-only log, and overwriting local with server on a second device
// would silently delete real answers that device already has. Instead
// this is a union merge on sign-in: local-only answers upload, server-only
// answers download, nothing already answered on either side is ever lost
// or overwritten (trivia_answers rows are immutable once inserted — see
// the DDL comment — so there's never a conflicting value to reconcile,
// only "does a row exist yet or not").

import { supabaseAuth } from './supabaseAuth';

const STORAGE_KEY = 'eyewall:trivia-answers';

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocal(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable — answers just won't persist this session
  }
}

export function getAnsweredMap() {
  return readLocal();
}

export function getStats() {
  const map = readLocal();
  const entries = Object.values(map);
  const correct = entries.filter((a) => a.isCorrect).length;
  return { attempted: entries.length, correct };
}

// Records an answer locally (always) and, for signed-in users, writes it
// through to the server immediately — a single low-frequency insert, no
// batching needed, same reasoning as Phase 1's favorite-team write.
export async function recordAnswer(questionId, selectedIndex, isCorrect, userId) {
  const map = readLocal();
  if (map[questionId]) return; // already answered — immutable, first answer wins
  map[questionId] = { selectedIndex, isCorrect, answeredAt: new Date().toISOString() };
  writeLocal(map);
  // Trivia's read-state badge (see useReadState.js) is answered-derived,
  // not a separate "seen" marker — this tells any mounted badge (e.g.
  // BottomNav) to re-check immediately, same cross-component reactivity
  // convention SportContext.jsx already uses for season updates.
  window.dispatchEvent(new window.CustomEvent('eyewall:read-state-updated'));

  if (!userId) return;
  try {
    const { error } = await supabaseAuth
      .from('trivia_answers')
      .insert({
        user_id: userId,
        question_id: questionId,
        selected_index: selectedIndex,
        is_correct: isCorrect,
      })
      .abortSignal(AbortSignal.timeout(5000));
    if (error) console.warn('triviaAnswers: write failed:', error.message);
  } catch (err) {
    console.warn('triviaAnswers: write failed:', err.message);
  }
}

// Union merge, run once per sign-in/session-load (called from AuthContext,
// same trigger point as favoriteTeamSync's reconcile).
export async function syncTriviaAnswersOnSignIn(userId) {
  let serverRows;
  try {
    const res = await supabaseAuth
      .from('trivia_answers')
      .select('question_id, selected_index, is_correct, answered_at')
      .eq('user_id', userId)
      .abortSignal(AbortSignal.timeout(8000));
    if (res.error) {
      console.warn('triviaAnswers: fetch failed:', res.error.message);
      return;
    }
    serverRows = res.data || [];
  } catch (err) {
    console.warn('triviaAnswers: fetch failed:', err.message);
    return;
  }

  const local = readLocal();
  const serverIds = new Set(serverRows.map((r) => String(r.question_id)));

  // Server-only answers -> pull into local.
  let localChanged = false;
  for (const row of serverRows) {
    const key = String(row.question_id);
    if (!local[key]) {
      local[key] = {
        selectedIndex: row.selected_index,
        isCorrect: row.is_correct,
        answeredAt: row.answered_at,
      };
      localChanged = true;
    }
  }
  if (localChanged) writeLocal(local);

  // Local-only answers -> upload to server.
  const localOnly = Object.entries(local).filter(([qid]) => !serverIds.has(String(qid)));
  if (localOnly.length === 0) return;

  const rows = localOnly.map(([questionId, a]) => ({
    user_id: userId,
    question_id: Number(questionId),
    selected_index: a.selectedIndex,
    is_correct: a.isCorrect,
    answered_at: a.answeredAt,
  }));
  try {
    const { error } = await supabaseAuth
      .from('trivia_answers')
      .insert(rows)
      .abortSignal(AbortSignal.timeout(8000));
    if (error) console.warn('triviaAnswers: upload failed:', error.message);
  } catch (err) {
    console.warn('triviaAnswers: upload failed:', err.message);
  }
}
