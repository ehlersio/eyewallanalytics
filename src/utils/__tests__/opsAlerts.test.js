// Ops alerts, app side (contract C1 with eyewall-poller ops.js, 2026-10):
// the Admin › Health page sends this device's /push/subscribe body to
// /ops/subscribe with the owner's Supabase session, shows the Worker's
// per-league cron records and the ops reports, and copes with a Worker
// that predates the routes (404 -> "unavailable").
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }))

const WORKER = 'https://worker.example'
vi.stubEnv('VITE_WORKER_URL', WORKER)

const { subscriptionPayload } = await import('../../hooks/usePushNotifications')
const { subscribeOps, unsubscribeOps, getAdminHealth } = await import('../adminApi')
const { cronRows, opsRows, opsDeviceId, loadOpsDevice, saveOpsDevice } = await import('../opsHealth')

const WEB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', expirationTime: null, keys: { p256dh: 'p', auth: 'a' } }
const IOS = { platform: 'ios', token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' }

afterEach(() => vi.unstubAllGlobals())

describe('subscriptionPayload (the /push/subscribe body)', () => {
  const teams = [{ key: 'NHL:CAR', prefs: { goal: true } }]

  // Byte-for-byte what usePushNotifications sent before the builder was
  // shared: web `{ ...sub.toJSON(), teamAbbr, prefs, teams? }`, iOS
  // `{ platform, token, teamAbbr, prefs, teams? }`.
  it('matches the bodies the hook always sent', () => {
    expect(JSON.stringify(subscriptionPayload(WEB, { teamAbbr: 'NHL:CAR', prefs: { goal: true }, teams })))
      .toBe(JSON.stringify({ ...WEB, teamAbbr: 'NHL:CAR', prefs: { goal: true }, teams }))
    expect(JSON.stringify(subscriptionPayload(IOS, { teamAbbr: 'NHL:CAR', prefs: { goal: true } })))
      .toBe(JSON.stringify({ platform: 'ios', token: IOS.token, teamAbbr: 'NHL:CAR', prefs: { goal: true } }))
  })

  it('is just the device for ops alerts', () => {
    expect(JSON.parse(JSON.stringify(subscriptionPayload(WEB)))).toEqual(WEB)
    expect(JSON.parse(JSON.stringify(subscriptionPayload(IOS)))).toEqual(IOS)
  })
})

describe('subscribeOps / unsubscribeOps', () => {
  function stubFetch(status, body = { ok: true, count: 1 }) {
    const fetch = vi.fn(async () => ({ ok: status < 400, status, json: async () => body }))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('POSTs the payload to /ops/subscribe with the session bearer', async () => {
    const fetch = stubFetch(200, { ok: true, count: 2 })
    expect(await subscribeOps(subscriptionPayload(WEB), 'tok')).toEqual({ ok: true, count: 2 })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${WORKER}/ops/subscribe`)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' })
    expect(JSON.parse(init.body)).toEqual(WEB)
  })

  it('POSTs { endpoint } or { token } to /ops/unsubscribe', async () => {
    const fetch = stubFetch(200, { ok: true, count: 0 })
    await unsubscribeOps({ token: IOS.token }, 'tok')
    expect(fetch.mock.calls[0][0]).toBe(`${WORKER}/ops/unsubscribe`)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ token: IOS.token })
  })

  it('a Worker without the routes is "unavailable" (404), not a failure', async () => {
    stubFetch(404, { error: 'Not found' })
    await expect(subscribeOps(IOS, 'tok')).rejects.toMatchObject({ status: 404, message: 'Unavailable' })
  })

  it('401 is Unauthorized, as for /admin/health', async () => {
    stubFetch(401)
    await expect(unsubscribeOps({ endpoint: WEB.endpoint }, 'tok')).rejects.toMatchObject({ status: 401, message: 'Unauthorized' })
    await expect(getAdminHealth('tok')).rejects.toMatchObject({ message: 'Unauthorized' })
  })

  it('sends nothing without a session', async () => {
    const fetch = stubFetch(200)
    expect(await subscribeOps(IOS, null)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('cronRows', () => {
  const now = Date.parse('2026-10-06T22:54:30Z')
  // The live /health cron block on 2026-10-06, with ahl failing and echl
  // stopped for the test.
  const cron = {
    nhl: { lastPollAt: '2026-10-06T22:53:24.496Z', lastOkAt: '2026-10-06T22:53:24.496Z', lastError: null },
    pwhl: null,
    ahl: { lastPollAt: '2026-10-06T22:53:24.496Z', lastOkAt: '2026-10-06T21:00:00.000Z', lastError: 'HockeyTech 503', failingSince: '2026-10-06T21:01:00.000Z' },
    echl: { lastPollAt: '2026-10-06T22:40:00.000Z', lastOkAt: '2026-10-06T22:40:00.000Z', lastError: null },
  }

  it('one row per league in a fixed order, with a state', () => {
    expect(cronRows(cron, now).map(r => [r.league, r.state])).toEqual([
      ['nhl', 'ok'], ['pwhl', 'none'], ['ahl', 'failing'], ['echl', 'stale'],
    ])
    expect(cronRows(cron, now)[2]).toMatchObject({ lastError: 'HockeyTech 503', failingSince: '2026-10-06T21:01:00.000Z' })
  })

  it('nothing for a Worker that predates the block', () => {
    expect(cronRows(undefined, now)).toEqual([])
  })
})

describe('opsRows', () => {
  it('newest first, keyed by source', () => {
    const rows = opsRows({
      'nightly.yml': { status: 'failure', title: 'NHL Nightly failed', at: '2026-10-06T12:00:00Z' },
      'worker-cron-ahl': { status: 'ok', title: 'AHL poller recovered', at: '2026-10-06T13:00:00Z' },
      broken: null,
    })
    expect(rows.map(r => r.source)).toEqual(['worker-cron-ahl', 'nightly.yml'])
  })
})

describe('this device’s ops subscription', () => {
  it('is identified by its iOS token or web endpoint', () => {
    expect(opsDeviceId(IOS)).toEqual({ token: IOS.token })
    expect(opsDeviceId(WEB)).toEqual({ endpoint: WEB.endpoint })
    expect(opsDeviceId({})).toBeNull()
  })

  it('is remembered on the device, and forgotten on Stop', () => {
    const store = new Map()
    const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }
    expect(loadOpsDevice(storage)).toBeNull()
    saveOpsDevice({ endpoint: WEB.endpoint }, storage)
    expect(loadOpsDevice(storage)).toEqual({ endpoint: WEB.endpoint })
    saveOpsDevice(null, storage)
    expect(loadOpsDevice(storage)).toBeNull()
  })
})
