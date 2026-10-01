// src/utils/__tests__/edgeApi.test.js
// getPlayerEdge tells "no data" (a 404: nothing to show, don't ask again)
// from "failed" (a 5xx or a network error: retried, then thrown).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPlayerEdge } from '../edgeApi.js'

const opts = { workerUrl: 'https://worker', delays: [0, 0] }
const res = (status, body) => new Response(body ? JSON.stringify(body) : 'x', { status })
const body = { available: true, kind: 'skater', metrics: { topSpeed: null } }

afterEach(() => vi.unstubAllGlobals())

describe('getPlayerEdge', () => {
  it('returns the data on a 200, from the right route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, body))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getPlayerEdge('skater', 8478402, '20252026', 2, opts)).toEqual({ status: 'ok', data: body })
    expect(fetchMock.mock.calls[0][0]).toBe('https://worker/nhl/edge/skater/8478402/20252026/2')
  })

  it('reports no data on a 404 without asking again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(404, { available: false }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getPlayerEdge('goalie', 8478406, '20202021', 2, opts)).toEqual({ status: 'none' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a 502 and recovers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(res(502))
      .mockResolvedValueOnce(res(200, body))
    vi.stubGlobal('fetch', fetchMock)
    expect((await getPlayerEdge('skater', 8478402, '20252026', 2, opts)).status).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws once every attempt has failed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(502))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getPlayerEdge('skater', 8478402, '20252026', 2, opts)).rejects.toThrow('EDGE 502')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('never asks for the preseason, which EDGE does not cover', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await getPlayerEdge('skater', 8478402, '20252026', 1, opts)).toEqual({ status: 'none' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
