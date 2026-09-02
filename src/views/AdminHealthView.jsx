// views/AdminHealthView.jsx
// News-feed source health — added 2026-09 after a tester asked "can we
// monitor if news feeds are failing." Not linked from BottomNav or any
// other in-app nav -- reached only by navigating directly to /admin/health.
// That's UX hiding, not the real access control: the Worker's own
// GET /admin/health independently verifies the caller's Supabase session
// token against an email allowlist (see eyewall-poller's shared.js
// verifyAdminUser()) and returns 401 for anyone else, so a signed-out or
// non-owner visitor sees nothing real regardless of this page's own gate.
import { useAuth } from '../utils/AuthContext'
import { useFetch } from '../hooks/useFetch'
import { getAdminHealth } from '../utils/adminApi'
import { PAGE_CLASSES } from '../utils/pageClasses'

const TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[20px] font-bold mb-[2px]'
const SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)] mb-4'
const CARD_CLASSES = 'card mb-2 flex items-center justify-between gap-3 py-2.5 px-3'
const KEY_CLASSES = 'font-mono text-[12px] text-[color:var(--text)]'
const META_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'
const DOT_OK = 'inline-block w-2 h-2 rounded-full bg-[var(--green,#2ecc71)] shrink-0'
const DOT_WARN = 'inline-block w-2 h-2 rounded-full bg-[var(--amber,#f5a623)] shrink-0'
const DOT_BAD = 'inline-block w-2 h-2 rounded-full bg-[var(--red-bright)] shrink-0'
const EMPTY_CLASSES = 'text-[13px] text-[color:var(--text-dim)] py-6 text-center'

function statusDot(source) {
  if (source.consecutiveFailures >= 3) return DOT_BAD
  if (source.consecutiveFailures > 0) return DOT_WARN
  return DOT_OK
}

function fmt(iso) {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString()
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
        <h2 className={TITLE_CLASSES}>Feed Health</h2>
        <p className={EMPTY_CLASSES}>Sign in to view this page.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={PAGE_CLASSES}>
        <h2 className={TITLE_CLASSES}>Feed Health</h2>
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
      <h2 className={TITLE_CLASSES}>🩺 Feed Health</h2>
      <p className={SUB_CLASSES}>
        {loading ? 'Loading…' : `${sources.length} sources tracked · ${failing.length} currently failing · checked ${fmt(data?.checkedAt)}`}
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
