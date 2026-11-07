// ─── Team needs helpers ──────────────────────────────────────
// Pure shaping for the Team view's Needs tab, over the Worker's /team-needs
// (eyewall-pipeline team_needs.py): each lineup slot -- top-6 / bottom-6
// centers and wingers, top-4 / third-pair D, 1A / 1B goalies -- with its
// players' ratings and the slot's league rank. Ratings are WAR per 82 games
// for skaters and GSAx per 60 for goalies, this season's or last season's
// (ratingBasis), and an unrated player stays unrated: nothing here fills a
// number in.

export const SLOT_GROUPS = [
  { key: 'forwards', slots: ['F_TOP6_C', 'F_TOP6_W', 'F_BOT6_C', 'F_BOT6_W'] },
  { key: 'defense', slots: ['D_TOP4', 'D_BOT2'] },
  { key: 'goalies', slots: ['G_1A', 'G_1B'] },
]

export const isGoalieSlot = slot => typeof slot === 'string' && slot.startsWith('G_')

// The tab is offered only when the Worker answered with slots (no dead options).
export function hasTeamNeeds(data) {
  return !!data && !data.unavailable && Array.isArray(data.slots) && data.slots.length > 0
}

// +0.42 / −0.10 / null. Two decimals for both scales: WAR per 82 runs about
// −0.5..+1.8, GSAx per 60 about −0.6..+0.8.
export function fmtRating(rating) {
  if (rating == null || !Number.isFinite(Number(rating))) return null
  const v = Number(rating)
  const s = Math.abs(v).toFixed(2)
  if (s === '0.00') return '0.00'
  return `${v > 0 ? '+' : '−'}${s}`
}

// 'need' (bottom third), 'top' (top third), 'mid', or null when unranked.
export function rankTone(slot) {
  if (!slot || slot.leagueRank == null || !slot.leagueTeams) return null
  if (slot.need) return 'need'
  if (slot.leagueRank <= Math.ceil(slot.leagueTeams / 3)) return 'top'
  return 'mid'
}

// Slots grouped for display, each group only with the slots the team has.
// Groups with none are left out.
export function groupSlots(slots) {
  const bySlot = new Map((slots || []).map(s => [s.slot, s]))
  return SLOT_GROUPS
    .map(g => ({ key: g.key, slots: g.slots.map(s => bySlot.get(s)).filter(Boolean) }))
    .filter(g => g.slots.length > 0)
}

// The slots flagged as needs, weakest rank first, for the summary line.
export function needSlots(slots) {
  return (slots || [])
    .filter(s => s.need)
    .sort((a, b) => (b.leagueRank / b.leagueTeams) - (a.leagueRank / a.leagueTeams))
}
