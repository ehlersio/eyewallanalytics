// src/utils/__tests__/retryFetch.test.js
// The retry exists because a single stalled Worker request leaves a view on
// a terminal "Failed to load..." card with no way back. These are its only
// real guard: the dev server runs under React StrictMode and double-fires
// every fetch, so a Cypress test cannot tell the retry apart from that.
// What matters here is which failures it retries -- a thrown fetch is the
// network, an HTTP status is the server's answer.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWithRetry, FETCH_TIMEOUT_MS } from '../retryFetch.js';

// No real backoff in tests -- the pause is covered by its own case below.
const NOW = { delayMs: 0 };

const ok      = (body = {}) => new Response(JSON.stringify(body), { status: 200 });
const serverErr = () => new Response('nope', { status: 500 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchWithRetry', () => {
  it('returns the first response when nothing goes wrong', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ roster: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('https://worker/pwhl/players', NOW);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once when the connection stalls, and succeeds', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException('signal timed out', 'TimeoutError'))
      .mockResolvedValueOnce(ok({ roster: [{ player_id: 1 }] }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('https://worker/pwhl/players', NOW);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry and rethrows the last error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('https://worker/pwhl/players', NOW))
      .rejects.toThrow('Failed to fetch');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry an HTTP error -- that is the server answering, not the network', async () => {
    const fetchMock = vi.fn().mockResolvedValue(serverErr());
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('https://worker/pwhl/players', NOW);

    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honours a retries count above one', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('stall'))
      .mockRejectedValueOnce(new Error('stall'))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithRetry('https://worker/x', { ...NOW, retries: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('makes a single attempt when retries is 0', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('stall'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('https://worker/x', { ...NOW, retries: 0 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives every attempt its own timeout signal, so the budget is per attempt', async () => {
    const signals = [];
    const fetchMock = vi.fn((_url, init) => {
      signals.push(init.signal);
      return signals.length === 1
        ? Promise.reject(new Error('stall'))
        : Promise.resolve(ok());
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithRetry('https://worker/x', NOW);

    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it('passes init through but owns the signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);
    const caller = AbortSignal.timeout(50);

    await fetchWithRetry('https://worker/x', { ...NOW, init: { cache: 'no-store', signal: caller } });

    const init = fetchMock.mock.calls[0][1];
    expect(init.cache).toBe('no-store');
    expect(init.signal).not.toBe(caller);
  });

  it('waits between attempts rather than hammering a stalled connection', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('stall'))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    const started = Date.now();
    await fetchWithRetry('https://worker/x', { delayMs: 60 });

    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });

  it('defaults to the 8s budget the API modules relied on before', () => {
    expect(FETCH_TIMEOUT_MS).toBe(8000);
  });
});
