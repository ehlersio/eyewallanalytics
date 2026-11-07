// ─── Trade candidacy helpers ─────────────────────────────────
// Pure shaping for the player popup's Candidate signals section and League ›
// Cap's Deadline board, over the Worker's /trade-candidacy and
// /trade-candidacy/board (eyewall-pipeline trade_candidacy.py). Each tiered
// player carries a tier ('several' | 'some') and the signals the pipeline
// wrote as { code, ...params }; this file turns each signal into an i18n key.
// Never a percentage for the player: the backtest behind the tiers didn't
// calibrate well enough for one (methodology page, "Trade fit and
// candidacy"). Everything here exists only from Jan 1 to the trade deadline.

export const CANDIDACY_TIERS = ['several', 'some']
export const BOARD_SHOW = 25

// Held-out traded rates of each tier in the backtest (eyewall-pipeline
// trade_candidacy_model.json, docs/trade_candidacy_backtest_results.md):
// group facts for the method note, never shown as a player's chance.
export const TIER_BACKTEST_RATES = { several: 0.226, some: 0.101 }

const shownPlayer = p => !!p && CANDIDACY_TIERS.includes(p.tier) && Array.isArray(p.signals) && p.signals.length > 0

// The popup section is shown only for a tiered player with a signal.
export function hasCandidacy(data) {
  return !!data && !data.unavailable && shownPlayer(data.player)
}

// The board is offered only when it has players.
export function hasBoard(board) {
  return !!board && !board.unavailable && Array.isArray(board.players) && board.players.some(shownPlayer)
}

// 1023 seconds -> "17:03".
export function fmtToi(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null
  const s = Math.round(Number(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// One signal -> { key, params, note? } for t(), or null for a code this
// version doesn't know (skipped, not shown raw). `short` picks the board's
// one-word labels.
export function signalKey(signal, { short = false } = {}) {
  if (!signal || typeof signal.code !== 'string') return null
  const base = short ? 'deadlineBoard.signals.' : 'playerPopup.candidacy.signals.'
  switch (signal.code) {
    case 'expiring': {
      const type = signal.expiry_type === 'UFA' || signal.expiry_type === 'RFA' ? signal.expiry_type : null
      const out = { key: base + (type ? `expiring${type === 'UFA' ? 'Ufa' : 'Rfa'}` : 'expiring'), params: {} }
      return !short && type && signal.derived ? { ...out, note: { key: base + 'derived', params: {} } } : out
    }
    case 'outside_playoffs':
      return {
        key: base + 'outsidePlayoffs',
        params: { rank: signal.conference_rank ?? '—', conference: signal.conference || '', line: signal.line ?? 8 },
      }
    case 'toi_down':
      return {
        key: base + 'toiDown',
        params: {
          pct: signal.pct == null ? '—' : `${Math.round(Math.abs(Number(signal.pct)) * 100)}%`,
          recent: fmtToi(signal.recent_toi) ?? '—',
          season: fmtToi(signal.season_toi) ?? '—',
        },
      }
    default:
      return null
  }
}

// Position groups present on the board, in order. Only these are offered.
const GROUP_OF = { C: 'forwards', L: 'forwards', R: 'forwards', D: 'defense', G: 'goalies' }
export const BOARD_GROUPS = ['all', 'forwards', 'defense', 'goalies']
export function boardGroups(players) {
  const present = new Set((players || []).map(p => GROUP_OF[p.position]).filter(Boolean))
  const groups = BOARD_GROUPS.filter(g => g === 'all' || present.has(g))
  return groups.length > 2 ? groups : ['all'] // one group: the toggle would offer nothing
}

// "Fits my team" = that team's trade fit tier is strong or possible.
const fits = p => p.fit === 'strong' || p.fit === 'possible'
export function canFilterFit(board) {
  return !!board?.fitTeam && (board.players || []).some(fits)
}

export function filterBoard(players, { group = 'all', fitOnly = false } = {}) {
  return (players || [])
    .filter(shownPlayer)
    .filter(p => group === 'all' || GROUP_OF[p.position] === group)
    .filter(p => !fitOnly || fits(p))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
}
