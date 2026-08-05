// testHelpers/mockSupabaseAuth.js — shared mock for tests exercising
// favoriteTeamSync.js / triviaAnswers.js, both of which call
// supabaseAuth.from(table).<verb>(...).abortSignal(...) chains that
// resolve like a real postgrest-js query builder (chainable, then
// awaited for {data, error}).
//
// Not a full postgrest-js reimplementation — just enough of the chain
// shape these two modules actually call.
import { vi } from 'vitest';

export function makeQueryBuilder(resolvedValue) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    abortSignal: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve) => resolve(resolvedValue),
  };
  return builder;
}

// Minimal in-memory localStorage — this repo's Vitest config runs under
// environment: 'node' (see vite.config.js), not jsdom, so `localStorage`/
// `window` aren't real globals here. Stubbed via vi.stubGlobal() rather
// than adding a jsdom devDependency for two test files.
export function stubBrowserGlobals() {
  let store = {};
  vi.stubGlobal('localStorage', {
    getItem: (k) => (Object.hasOwn(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  });
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn(),
    CustomEvent: class MockCustomEvent {
      constructor(name, opts) {
        this.name = name;
        this.opts = opts;
      }
    },
    location: { reload: vi.fn() },
  });
}
