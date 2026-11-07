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

// 20272028 -> '2027-28'; null without a season.
export function seasonLabel(season) {
  const y = Math.floor(Number(season) / 10000)
  return Number.isFinite(y) && y > 0 ? `${y}-${String(y + 1).slice(2)}` : null
}

// Offseason fit (trade fit Phase 2b): from the day after the deadline the fit
// is for next season, player.season.
export function isOffseason(data) {
  return data?.player?.phase === 'offseason'
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
// a team_needs slot name; `season` is the fit's ('2027-28'), for offseason
// reasons that name it. Unknown codes return null (skipped, not shown raw).
export function reasonKey(reason, slotLabel = s => s, season = null) {
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
      return reason.basis === 'elo'
        ? { key: base + 'windowContenderElo', params: { rank: reason.elo_rank, season: season || '—' } }
        : { key: base + 'windowContender', params: { pct: pct(reason.pct) } }
    case 'window_rental_not':
      return reason.basis === 'elo'
        ? { key: base + 'windowNotContenderElo', params: { rank: reason.elo_rank, season: season || '—' } }
        : { key: base + 'windowNotContender', params: { pct: pct(reason.pct) } }
    case 'window_rights':
      return { key: base + 'windowRights', params: {} }
    case 'window_odds_unknown':
      return { key: base + 'windowOddsUnknown', params: {} }
    case 'cap_fits':
    case 'cap_fits_retained':
    case 'cap_needs_salary': {
      // offseason cap reasons name next season's cap
      const name = { cap_fits: 'capFits', cap_fits_retained: 'capFitsRetained', cap_needs_salary: 'capNeedsSalary' }[reason.code]
      return withNote(reason.season
        ? { key: base + name + 'Season', params: { space: fmtMoney(reason.space), season: reason.season } }
        : { key: base + name, params: { space: fmtMoney(reason.space) } })
    }
    case 'cap_unknown':
      return { key: base + 'capUnknown', params: {} }
    case 'cap_unannounced':
      return { key: base + 'capUnannounced', params: { season: reason.season || season || '—' } }
    case 'cap_rights':
      return withNote({ key: base + 'capRights', params: { space: fmtMoney(reason.space), season: reason.season || season || '—' } })
    case 'hand_right_shot':
      return { key: base + 'handRightShot', params: { count: reason.right_shots ?? 0 } }
    default:
      return null
  }
}

// The player's clause (+ the Worker's clauseStatus for the season) ->
// { key, params }. Without a clause the status says what that means: 'none'
// (a source said so, CapFriendly showed a blank, or he's too young for the
// CBA to allow one: 'ineligible'), 'none_likely' (PuckPedia's breakdown names
// none) or unknown ("no trade clause on record", which may still exist).
export function clauseKey(clause, status = null) {
  const base = 'playerPopup.tradeFit.clause.'
  if (!clause) {
    if (status?.status === 'none') return { key: base + (status.basis === 'ineligible' ? 'noneIneligible' : 'noneKnown'), params: {} }
    if (status?.status === 'none_likely') return { key: base + 'noneLikely', params: {} }
    return { key: base + 'none', params: {} }
  }
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
