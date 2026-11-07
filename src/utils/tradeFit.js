// ─── Trade fit helpers ───────────────────────────────────────
// Pure shaping for the player popup's Trade fit section, over the Worker's
// /trade-fit (eyewall-pipeline trade_fit.py): which of the other 31 teams a
// player fits, in tiers, with structured reasons the pipeline wrote as
// { code, ...params }. This file turns each reason into an i18n key and its
// params. A fit, not a prediction: no percentage or score is shown for the
// fit itself.

export const TIER_ORDER = ['strong', 'possible', 'long_shot']
export const TOP_N = 5

// The section is shown only when the Worker returned the player and teams.
export function hasTradeFit(data) {
  return !!data && !data.unavailable && !!data.player && Array.isArray(data.teams) && data.teams.length > 0
}

// −$5.21M / $3.00M; null without a number.
export function fmtMoney(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return null
  const v = Number(amount)
  return `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1_000_000).toFixed(2)}M`
}

const pct = p => (p == null ? null : `${Math.round(Number(p) * 100)}%`)
const gap = g => (g == null ? null : `+${Number(g).toFixed(2)}`)

// A cap reason's coverage note: when some of the team's roster cap hits
// aren't public, the space estimate counts them as $0, so it reads high.
function capNote(reason, base) {
  const { known, roster } = reason
  if (known == null || roster == null || known >= roster) return null
  return { key: base + 'capMissing', params: { count: roster - known } }
}

// One reason -> { key, params, note? } for t(). `slotLabel(slot)` translates
// a team_needs slot name. Unknown codes return null (skipped, not shown raw).
export function reasonKey(reason, slotLabel = s => s) {
  if (!reason || typeof reason.code !== 'string') return null
  const base = 'playerPopup.tradeFit.reasons.'
  const withNote = out => {
    const note = capNote(reason, base)
    return note ? { ...out, note } : out
  }
  switch (reason.code) {
    case 'need_upgrade':
      return { key: base + (reason.slot_need ? 'needSlotNeed' : 'needAboveAverage'), params: { slot: slotLabel(reason.slot), gap: gap(reason.gap) } }
    case 'need_depth':
      return { key: base + 'needDepth', params: { slot: slotLabel(reason.slot), gap: gap(reason.gap) } }
    case 'need_none':
      return { key: base + 'needNone', params: {} }
    case 'need_unrated':
      return { key: base + 'needUnrated', params: {} }
    case 'window_term':
      return { key: base + 'windowTerm', params: { season: reason.expires_after || '—' } }
    case 'window_rental_contender':
      return { key: base + 'windowContender', params: { pct: pct(reason.pct) } }
    case 'window_rental_not':
      return { key: base + 'windowNotContender', params: { pct: pct(reason.pct) } }
    case 'window_odds_unknown':
      return { key: base + 'windowOddsUnknown', params: {} }
    case 'cap_fits':
      return withNote({ key: base + 'capFits', params: { space: fmtMoney(reason.space) } })
    case 'cap_fits_retained':
      return withNote({ key: base + 'capFitsRetained', params: { space: fmtMoney(reason.space) } })
    case 'cap_needs_salary':
      return withNote({ key: base + 'capNeedsSalary', params: { space: fmtMoney(reason.space) } })
    case 'cap_unknown':
      return { key: base + 'capUnknown', params: {} }
    case 'hand_right_shot':
      return { key: base + 'handRightShot', params: { count: reason.right_shots ?? 0 } }
    default:
      return null
  }
}

// The player's clause -> { key, params }. No clause on record is its own
// line: the dataset can't tell "none" from "not reported".
export function clauseKey(clause) {
  const base = 'playerPopup.tradeFit.clause.'
  if (!clause) return { key: base + 'none', params: {} }
  if (clause.kind === 'NMC' || clause.kind === 'M-NMC') return { key: base + 'nmc', params: {} }
  if (clause.kind === 'NTC') return { key: base + 'ntc', params: {} }
  if (clause.kind === 'M-NTC') {
    return clause.listSize
      ? { key: base + 'mntcSized', params: { count: clause.listSize } }
      : { key: base + 'mntc', params: {} }
  }
  return { key: base + 'none', params: {} }
}

// Teams to show: the top TOP_N, or all when expanded.
export function visibleTeams(teams, expanded) {
  const list = [...(teams || [])].sort((a, b) => a.rank - b.rank)
  return expanded ? list : list.slice(0, TOP_N)
}

// Count per tier, in tier order, for the summary line.
export function tierCounts(teams) {
  const counts = Object.fromEntries(TIER_ORDER.map(t => [t, 0]))
  for (const t of teams || []) if (t.tier in counts) counts[t.tier] += 1
  return counts
}
