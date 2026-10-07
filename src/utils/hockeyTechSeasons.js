// utils/hockeyTechSeasons.js
// AHL/ECHL season lists and regular<->playoff maps from the Worker's
// /config/seasons/{ahl,echl}-seasons (HockeyTech's own season list), so a
// new season shows up without an app release. The lists used to be
// hand-written in ahlConfig.js/echlConfig.js: a 2027 Calder Cup Playoffs
// season would have had no tab and no regular-season pairing from April
// 2027 (audit 2026-10-06 §2, contract C7). The hand-written lists stay as
// the seed until the fetch answers, and if it fails.
//
// Kept: regular seasons and playoffs (not preseason or all-star), from
// `minId` on -- the oldest season the app has data for (the seed's oldest
// id), so the pickers never offer a season the pipeline never ingested.
// Labels: a regular season "2026-27"; playoffs as HockeyTech names them,
// "2026 Calder Cup Playoffs" / "2026 Kelly Cup Playoffs". Each playoffs
// season pairs with the regular season that started the year before.

const KEPT_TYPES = new Set(['regular', 'playoffs']);

export function hockeyTechSeasonLabel(row) {
  const name = String(row?.seasonName || '').trim();
  if (row?.seasonType === 'playoffs' && name) return name;
  const y = Number(row?.startYear);
  if (row?.seasonType === 'regular') {
    const m = name.match(/^(\d{4}-\d{2})\b/);
    if (m) return m[1];
    if (y) return `${y}-${String(y + 1).slice(2)}`;
  }
  return name || `Season ${row?.seasonId}`;
}

// { seasons: [{ id, label, type }] newest regular first then playoffs
// (the seed's order), playoffSeasonMap: { regularId: playoffsId } }, or
// null when the answer has nothing usable (keep the seed).
export function seasonsFromWorker(rows, { minId = 0 } = {}) {
  if (!Array.isArray(rows)) return null;
  const kept = rows
    .filter(r => Number.isInteger(r?.seasonId) && r.seasonId >= minId && KEPT_TYPES.has(r.seasonType))
    .map(r => ({ id: r.seasonId, label: hockeyTechSeasonLabel(r), type: r.seasonType, startYear: Number(r.startYear) || null }));
  if (!kept.some(s => s.type === 'regular')) return null;
  const byNewest = (a, b) => b.id - a.id;
  const regular = kept.filter(s => s.type === 'regular').sort(byNewest);
  const playoffs = kept.filter(s => s.type === 'playoffs').sort(byNewest);
  const playoffSeasonMap = {};
  for (const po of playoffs) {
    const reg = regular.find(r => r.startYear != null && po.startYear != null && r.startYear === po.startYear - 1);
    if (reg) playoffSeasonMap[reg.id] = po.id;
  }
  const strip = ({ id, label, type }) => ({ id, label, type });
  return { seasons: [...regular, ...playoffs].map(strip), playoffSeasonMap };
}

// playoffs id -> regular id, the reverse of a playoffSeasonMap.
export function reverseSeasonMap(playoffSeasonMap) {
  return Object.fromEntries(Object.entries(playoffSeasonMap).map(([regId, poId]) => [poId, Number(regId)]));
}
