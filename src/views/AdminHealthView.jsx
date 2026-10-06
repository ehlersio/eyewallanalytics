// views/AdminHealthView.jsx
// News-feed source health — added 2026-09 after a tester asked "can we
// monitor if news feeds are failing." Since 2026-10 also the Worker's
// per-league cron health, the pipeline/Worker ops reports, and a button
// that sends those ops alerts to this device (eyewall-poller ops.js).
// Not linked from BottomNav or any other in-app nav -- reached only by
// navigating directly to /admin/health.
// That's UX hiding, not the real access control: the Worker's own
// GET /admin/health (and /ops/subscribe) independently verifies the
// caller's Supabase session token against an email allowlist (see
// eyewall-poller's shared.js verifyAdminUser()) and returns 401 for anyone
// else, so a signed-out or non-owner visitor sees nothing real regardless
// of this page's own gate.
import { useState } from 'react'
import { useAuth } from '../utils/AuthContext'
import { useFetch } from '../hooks/useFetch'
import { usePushNotifications, requestPushDevice, subscriptionPayload, pushAvailable } from '../hooks/usePushNotifications'
import { getAdminHealth, subscribeOps, unsubscribeOps } from '../utils/adminApi'
import { cronRows, opsRows, opsDeviceId, loadOpsDevice, saveOpsDevice } from '../utils/opsHealth'
import { PAGE_CLASSES } from '../utils/pageClasses'

const TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold mb-[2px]'
const SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)] mb-4'
const SECTION_CLASSES = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-dim)] mt-5 mb-2'
const CARD_CLASSES = 'card mb-2 flex items-center justify-between gap-3 py-2.5 px-3'
const KEY_CLASSES = 'font-mono text-[12px] text-[color:var(--text)]'
const META_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'
const DOT_OK = 'inline-block w-2 h-2 rounded-full bg-[var(--green,#2ecc71)] shrink-0'
const DOT_WARN = 'inline-block w-2 h-2 rounded-full bg-[var(--amber,#f5a623)] shrink-0'
const DOT_BAD = 'inline-block w-2 h-2 rounded-full bg-[var(--red-bright)] shrink-0'
const DOT_NONE = 'inline-block w-2 h-2 rounded-full bg-[var(--text-dim)] shrink-0'
const EMPTY_CLASSES = 'text-[13px] text-[color:var(--text-dim)] py-6 text-center'
const NOTE_CLASSES = 'text-[12px] text-[color:var(--text-dim)] py-2'
const BUTTON_CLASSES = 'py-1.5 px-3 rounded-[8px] text-[12px] font-semibold border-[0.5px] border-[var(--border)] bg-[var(--bg3)] text-[color:var(--text)] cursor-pointer disabled:opacity-50 disabled:cursor-default'

function statusDot(source) {
  if (source.consecutiveFailures >= 3) return DOT_BAD
  if (source.consecutiveFailures > 0) return DOT_WARN
  return DOT_OK
}

const CRON_DOT = { ok: DOT_OK, failing: DOT_BAD, stale: DOT_WARN, none: DOT_NONE }
const OPS_DOT = { ok: DOT_OK, warn: DOT_WARN, failure: DOT_BAD }

function fmt(iso) {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString()
}

// ── Ops alerts on this device ─────────────────────────────────
function OpsAlerts({ accessToken, available, subscriberCount }) {
  const { supported } = usePushNotifications() // registers the service worker on the web
  const [device, setDevice] = useState(loadOpsDevice)
  const [count, setCount] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [unavailable, setUnavailable] = useState(false)

  const shownCount = count ?? subscriberCount

  if (!available || unavailable) {
    return (
      <p className={NOTE_CLASSES} data-testid="ops-alerts-unavailable">
        Ops alerts are unavailable: this Worker doesn&rsquo;t serve them yet.
      </p>
    )
  }

  function fail(err) {
    if (err?.status === 404) setUnavailable(true)
    else setMessage(err?.status === 401 ? 'Not authorized.' : `Failed: ${err?.message || err}`)
  }

  async function start() {
    setBusy(true)
    setMessage(null)
    try {
      const { permission, device: pushDevice } = await requestPushDevice()
      if (!pushDevice) {
        setMessage(permission === 'denied'
          ? 'Notifications are blocked here — allow them in the browser or iOS settings.'
          : 'Permission not granted.')
        return
      }
      const res = await subscribeOps(subscriptionPayload(pushDevice), accessToken)
      const id = opsDeviceId(pushDevice)
      saveOpsDevice(id)
      setDevice(id)
      setCount(res?.count ?? null)
      setMessage('This device will get ops alerts.')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await unsubscribeOps(device, accessToken)
      saveOpsDevice(null)
      setDevice(null)
      setCount(res?.count ?? null)
      setMessage('Ops alerts stopped on this device.')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const canPush = supported && pushAvailable()
  return (
    <div className="card mb-2 py-2.5 px-3" data-testid="ops-alerts">
      <div className="flex items-center justify-between gap-3">
        <div className={META_CLASSES}>
          {device ? 'This device gets ops alerts.' : 'Pipeline failures and Worker cron alerts, pushed to your devices.'}
          {shownCount != null && <div>{shownCount} device{shownCount === 1 ? '' : 's'} subscribed</div>}
        </div>
        {device ? (
          <button type="button" className={BUTTON_CLASSES} disabled={busy} onClick={stop}>
            {busy ? 'Working…' : 'Stop'}
          </button>
        ) : (
          <button type="button" className={BUTTON_CLASSES} disabled={busy || !canPush} onClick={start}>
            {busy ? 'Working…' : 'Send ops alerts to this device'}
          </button>
        )}
      </div>
      {!device && !canPush && (
        <p className={NOTE_CLASSES}>Push isn&rsquo;t available here (needs the installed app, or a browser with notifications and the VAPID key).</p>
      )}
      {message && <p className={NOTE_CLASSES} data-testid="ops-alerts-message">{message}</p>}
    </div>
  )
}

function CronPanel({ cron }) {
  const rows = cronRows(cron)
  if (!rows.length) {
    return <p className={NOTE_CLASSES} data-testid="cron-unavailable">Cron health is unavailable: this Worker doesn&rsquo;t report it yet.</p>
  }
  return rows.map(r => (
    <div key={r.league} className={CARD_CLASSES} data-testid={`cron-${r.league}`} data-state={r.state}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={CRON_DOT[r.state]} />
        <span className={KEY_CLASSES}>{r.league.toUpperCase()}</span>
      </div>
      <div className={`${META_CLASSES} text-right min-w-0`}>
        {r.state === 'none' ? <div>no record yet</div> : (
          <>
            {r.state === 'failing' && (
              <div className="text-[color:var(--red-bright)] break-words">
                failing{r.failingSince ? ` since ${fmt(r.failingSince)}` : ''} — {r.lastError}
              </div>
            )}
            {r.state === 'stale' && <div className="text-[color:var(--amber,#f5a623)]">no tick since {fmt(r.lastPollAt)}</div>}
            <div>last ok {fmt(r.lastOkAt)}</div>
            <div>last poll {fmt(r.lastPollAt)}</div>
          </>
        )}
      </div>
    </div>
  ))
}

function OpsReports({ ops }) {
  if (ops == null) return null
  const rows = opsRows(ops)
  if (!rows.length) return <p className={NOTE_CLASSES}>No reports yet.</p>
  return rows.map(r => (
    <div key={r.source} className={CARD_CLASSES} data-testid={`ops-${r.source}`} data-status={r.status}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={OPS_DOT[r.status] || DOT_NONE} />
        <div className="min-w-0">
          <div className={KEY_CLASSES}>{r.source}</div>
          <div className={META_CLASSES}>{r.title}</div>
        </div>
      </div>
      <div className={`${META_CLASSES} text-right min-w-0`}>
        <div>{fmt(r.at)}</div>
        {/^https?:\/\//.test(r.url || '') ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">details</a>
        ) : r.body ? <div className="break-words">{r.body}</div> : null}
      </div>
    </div>
  ))
}

export default function AdminHealthView() {
  const { user, session, loading: authLoading } = useAuth()
  const accessToken = session?.access_token || null

  const { data, loading, error } = useFetch(
    () => accessToken ? getAdminHealth(accessToken) : Promise.resolve(null),
    [accessToken]
  )

  if (authLoading) return <div className={PAGE_CLASSES}><p className={EMPTY_CLASSES}>Loading…</p></div>

  if (!user) {
    return (
      <div className={PAGE_CLASSES}>
        <h2 className={TITLE_CLASSES}>Health</h2>
        <p className={EMPTY_CLASSES}>Sign in to view this page.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={PAGE_CLASSES}>
        <h2 className={TITLE_CLASSES}>Health</h2>
        <p className={EMPTY_CLASSES}>
          {error === 'Unauthorized' ? 'Not authorized.' : `Failed to load: ${error}`}
        </p>
      </div>
    )
  }

  const sources = data?.sources || []
  const failing = sources.filter(s => s.consecutiveFailures > 0)

  return (
    <div className={PAGE_CLASSES}>
      <h2 className={TITLE_CLASSES}>🩺 Health</h2>
      <p className={SUB_CLASSES}>
        {loading ? 'Loading…' : `checked ${fmt(data?.checkedAt)}`}
      </p>

      {!loading && data && (
        <>
          <h3 className={SECTION_CLASSES}>Ops alerts</h3>
          {/* opsSubscribers is only in a Worker with the ops routes. */}
          <OpsAlerts accessToken={accessToken} available={'opsSubscribers' in data} subscriberCount={data.opsSubscribers ?? null} />

          <h3 className={SECTION_CLASSES}>Worker cron</h3>
          <CronPanel cron={data.cron} />

          {data.ops != null && (
            <>
              <h3 className={SECTION_CLASSES}>Pipeline and Worker reports</h3>
              <OpsReports ops={data.ops} />
            </>
          )}
        </>
      )}

      <h3 className={SECTION_CLASSES}>News feeds</h3>
      <p className={SUB_CLASSES}>
        {loading ? 'Loading…' : `${sources.length} sources tracked · ${failing.length} currently failing`}
      </p>

      {!loading && !sources.length && (
        <p className={EMPTY_CLASSES}>No health data recorded yet — check back after the next scheduled fetch.</p>
      )}

      {sources.map(s => (
        <div key={s.key} className={CARD_CLASSES}>
          <div className="flex items-center gap-2 min-w-0">
            <span className={statusDot(s)} />
            <span className={KEY_CLASSES}>{s.key}</span>
          </div>
          <div className={`${META_CLASSES} text-right shrink-0`}>
            {s.consecutiveFailures > 0 ? (
              <div className="text-[color:var(--red-bright)]">{s.consecutiveFailures} failure{s.consecutiveFailures === 1 ? '' : 's'} in a row — {s.lastError}</div>
            ) : (
              <div>{s.itemCount ?? 0} items</div>
            )}
            <div>last success {fmt(s.lastSuccessAt)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
