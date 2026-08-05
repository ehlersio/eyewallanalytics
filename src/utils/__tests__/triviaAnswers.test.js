// src/utils/__tests__/triviaAnswers.test.js
// Covers the correctness-critical piece of Phase 2 (Session 92): the
// union-merge sync on sign-in. Verified live with real accounts during
// Session 92 (see SESSION_92_TRIVIA_PHASE2_FINDINGS.md) — this locks that
// behavior in as a regression test. supabaseAuth is mocked (vi.mock) since
// its real client would try to hit actual Supabase Auth config at import
// time; localStorage/window are stubbed since this repo's Vitest config
// runs under environment: 'node', not jsdom (see vite.config.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeQueryBuilder, stubBrowserGlobals } from './testHelpers/mockSupabaseAuth.js';

vi.mock('../supabaseAuth', () => ({
  supabaseAuth: { from: vi.fn() },
}));

import { supabaseAuth } from '../supabaseAuth';
import {
  getAnsweredMap,
  getStats,
  recordAnswer,
  syncTriviaAnswersOnSignIn,
} from '../triviaAnswers.js';

const STORAGE_KEY = 'eyewall:trivia-answers';

beforeEach(() => {
  stubBrowserGlobals();
  supabaseAuth.from.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getAnsweredMap / getStats', () => {
  it('return empty when nothing answered yet', () => {
    expect(getAnsweredMap()).toEqual({});
    expect(getStats()).toEqual({ attempted: 0, correct: 0 });
  });

  it('reflect what is in localStorage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        1: { selectedIndex: 0, isCorrect: true, answeredAt: 't1' },
        2: { selectedIndex: 1, isCorrect: false, answeredAt: 't2' },
        3: { selectedIndex: 2, isCorrect: true, answeredAt: 't3' },
      })
    );
    expect(getAnsweredMap()).toHaveProperty('2');
    expect(getStats()).toEqual({ attempted: 3, correct: 2 });
  });
});

describe('recordAnswer — anonymous (no userId)', () => {
  it('writes locally and never touches supabaseAuth', async () => {
    await recordAnswer(19, 1, true, undefined);
    expect(getAnsweredMap()['19']).toMatchObject({ selectedIndex: 1, isCorrect: true });
    expect(supabaseAuth.from).not.toHaveBeenCalled();
  });

  it('is immutable — a second answer to the same question is a no-op', async () => {
    await recordAnswer(19, 1, true, undefined);
    await recordAnswer(19, 3, false, undefined);
    expect(getAnsweredMap()['19']).toMatchObject({ selectedIndex: 1, isCorrect: true });
  });
});

describe('recordAnswer — signed-in', () => {
  it('writes locally and inserts to trivia_answers', async () => {
    supabaseAuth.from.mockImplementation(() => makeQueryBuilder({ error: null }));

    await recordAnswer(19, 1, true, 'user-a');

    expect(getAnsweredMap()['19']).toMatchObject({ selectedIndex: 1, isCorrect: true });
    expect(supabaseAuth.from).toHaveBeenCalledWith('trivia_answers');
    const builder = supabaseAuth.from.mock.results[0].value;
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-a',
        question_id: 19,
        selected_index: 1,
        is_correct: true,
      })
    );
  });

  it('does not throw if the write fails', async () => {
    supabaseAuth.from.mockImplementation(() =>
      makeQueryBuilder({ error: { message: 'network down' } })
    );
    await expect(recordAnswer(19, 1, true, 'user-a')).resolves.toBeUndefined();
    // Local write already happened before the network call — a failed
    // sync doesn't roll back the local answer.
    expect(getAnsweredMap()['19']).toBeTruthy();
  });
});

describe('syncTriviaAnswersOnSignIn — union merge', () => {
  it('pulls server-only answers into local AND uploads local-only answers to the server, losing nothing either direction', async () => {
    // Local already has 19 (pre-existing) and 22 (answered on this "device"
    // before signing in) — mirrors the exact Session 92 live-verification
    // scenario (a second device with one local-only answer, signing into
    // an account that already has other answers on the server).
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        19: { selectedIndex: 0, isCorrect: false, answeredAt: 't19' },
        22: { selectedIndex: 2, isCorrect: true, answeredAt: 't22' },
      })
    );

    const serverRows = [
      { question_id: 19, selected_index: 0, is_correct: false, answered_at: 't19' },
      { question_id: 25, selected_index: 1, is_correct: true, answered_at: 't25' },
      { question_id: 29, selected_index: 0, is_correct: true, answered_at: 't29' },
    ];

    const selectBuilder = makeQueryBuilder({ data: serverRows, error: null });
    const insertBuilder = makeQueryBuilder({ error: null });
    supabaseAuth.from
      .mockImplementationOnce(() => selectBuilder) // the fetch
      .mockImplementationOnce(() => insertBuilder); // the local-only upload

    await syncTriviaAnswersOnSignIn('user-a');

    // Server-only (25, 29) pulled into local; local-only (22) untouched;
    // 19 already matched on both sides.
    const merged = getAnsweredMap();
    expect(Object.keys(merged).sort()).toEqual(['19', '22', '25', '29']);
    expect(merged['25']).toMatchObject({ selectedIndex: 1, isCorrect: true });

    // Local-only (22) uploaded — and only 22, not the ones already on the server.
    expect(insertBuilder.insert).toHaveBeenCalledTimes(1);
    const uploaded = insertBuilder.insert.mock.calls[0][0];
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]).toMatchObject({ user_id: 'user-a', question_id: 22, selected_index: 2 });
  });

  it('does not call insert at all when there is nothing local-only to upload', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ 19: { selectedIndex: 0, isCorrect: false, answeredAt: 't19' } })
    );
    const serverRows = [{ question_id: 19, selected_index: 0, is_correct: false, answered_at: 't19' }];
    supabaseAuth.from.mockImplementationOnce(() => makeQueryBuilder({ data: serverRows, error: null }));

    await syncTriviaAnswersOnSignIn('user-a');

    // Only the select call happened — from() called exactly once.
    expect(supabaseAuth.from).toHaveBeenCalledTimes(1);
  });

  it('leaves localStorage untouched if the initial fetch fails', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ 19: { selectedIndex: 0, isCorrect: false, answeredAt: 't19' } })
    );
    supabaseAuth.from.mockImplementationOnce(() =>
      makeQueryBuilder({ data: null, error: { message: 'timeout' } })
    );

    await syncTriviaAnswersOnSignIn('user-a');

    expect(Object.keys(getAnsweredMap())).toEqual(['19']);
    expect(supabaseAuth.from).toHaveBeenCalledTimes(1); // never reached the upload branch
  });
});
