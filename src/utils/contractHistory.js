// ─── Year-by-year contract rows ──────────────────────────────
// Picks the season breakdown (cap hit, salary, signing bonus, clause per
// season) to show under a player's current contract in PlayerPopup, from
// the Worker's GET /contracts/player/:id payload (nhlApi.js
// getPlayerContract): `current` is the chosen contract, `history` every
// contract the dataset has for the player, each with its `seasons`.
//
// Two dataset facts decide the rules (see the Worker's contracts.js):
// - history rows are matched to the player by id OR by name, so a player
//   can carry someone else's deals (Carolina's Sebastian Aho's history
//   lists the Islanders' Sebastian Aho's two-way contracts). The breakdown
//   therefore comes from the row with the current contract's exact key,
//   never from "the newest row".
// - the same signing can appear twice: an id-keyed row (tier B, from the
//   club, usually with NO season rows) and a name-keyed row (tier E,
//   archived CapFriendly) that has them. When the exact row has no
//   seasons, the breakdown falls back to another row for the SAME SIGNING:
//   first a row whose key shares the current one's `|TEAM|YYYY-MM` suffix
//   (the signing team and month: "8476958|CAR|2024-07" and "jaccob
//   slavin|CAR|2024-07" are one deal), else a same-team row that has a
//   season row for the season being shown; best tier first; and says so
//   (`source: 'alternate'`). A previous contract that merely touches the
//   span (Slavin's 2017 deal ends 2024-25, his current one starts then)
//   never qualifies. Nothing is filled in for seasons the row lacks.

import { isReported } from './capTable';

const TIER_RANK = { A: 0, B: 1, C: 2, D: 3, E: 4 };
const tierRank = (t) => TIER_RANK[t] ?? 5;

// 'jaccob slavin|CAR|2024-07' -> '|CAR|2024-07' (signing team and month).
function signingSuffix(contractKey) {
  const i = String(contractKey || '').indexOf('|');
  return i >= 0 ? String(contractKey).slice(i) : null;
}

function shapeSeason(s) {
  return {
    season: s.season,
    capHit: s.capHit ?? null,
    baseSalary: s.baseSalary ?? null,
    signingBonus: s.signingBonus ?? null,
    performanceBonus: s.performanceBonus ?? null,
    totalSalary: s.totalSalary ?? null,
    minorsSalary: s.minorsSalary ?? null,
    twoWay: s.oneWay === false,
    clause: s.clause || null,
    tier: s.tier || null,
    reported: isReported(s),
  };
}

// payload -> { seasons: [...], source: 'contract' | 'alternate' | null,
//              contractKey: the row the seasons came from, tier: its tier }
export function contractSeasons(payload) {
  const current = payload?.current;
  const history = Array.isArray(payload?.history) ? payload.history : [];
  const none = { seasons: [], source: null, contractKey: null, tier: null };
  if (!current?.contractKey) return none;

  const exact = history.find(h => h.contractKey === current.contractKey);
  if (exact?.seasons?.length) {
    return { seasons: exact.seasons.map(shapeSeason), source: 'contract', contractKey: exact.contractKey, tier: exact.tier || null };
  }

  const suffix = signingSuffix(current.contractKey);
  const season = payload?.season || null;
  const alternates = history
    .filter(h => h.contractKey !== current.contractKey && h.team === current.team && h.seasons?.length)
    .map(h => ({
      h,
      sameSigning: !!suffix && signingSuffix(h.contractKey) === suffix,
      hasSeason: !!season && h.seasons.some(s => s.season === season),
    }))
    .filter(c => c.sameSigning || c.hasSeason)
    .sort((a, b) => (b.sameSigning - a.sameSigning)
      || (tierRank(a.h.tier) - tierRank(b.h.tier))
      || (b.h.seasons.length - a.h.seasons.length));
  if (!alternates.length) return none;
  const alt = alternates[0].h;
  return { seasons: alt.seasons.map(shapeSeason), source: 'alternate', contractKey: alt.contractKey, tier: alt.tier || null };
}

// ─── Bought-out note ─────────────────────────────────────────
// The dataset ends a bought-out contract at its last PAID season (the
// row's end season, `expiresAfter` in the Worker's shape) and keeps the
// signed end in `endSeasonSigned`, flagged `boughtOut: true`. Such a deal
// stops covering the current season, so `current` is null and the popup
// would show no contract at all. This picks the bought-out deal that
// would still have run this season, so the popup can say why instead.
//
// payload -> { team, endSeason, endSeasonSigned, reported } | null
// Only when `current` is null; the best tier wins, then the latest start.
const endSeasonOf = (row) => row?.expiresAfter ?? row?.endSeason ?? row?.end_season ?? null;

export function boughtOutNote(payload) {
  if (!payload || payload.current) return null;
  const season = payload.season || null;
  const history = Array.isArray(payload.history) ? payload.history : [];
  if (!season || !history.length) return null;
  const hits = history
    .filter(h => h?.boughtOut === true && h.endSeasonSigned && h.startSeason
      && h.startSeason <= season && season <= h.endSeasonSigned)
    .sort((a, b) => (tierRank(a.tier) - tierRank(b.tier))
      || String(b.startSeason).localeCompare(String(a.startSeason)));
  if (!hits.length) return null;
  const row = hits[0];
  return {
    team: row.team || null,
    endSeason: endSeasonOf(row),
    endSeasonSigned: row.endSeasonSigned,
    reported: isReported(row),
  };
}
