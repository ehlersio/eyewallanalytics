// ─── CAR Roster Contracts 2026-27 ────────────────────────────
// Source: CapWages player contract pages, cross-checked against ESPN's
// transactions feed (accurate as of 12 Sep 2026). Cap figures are the
// 2026-27 cap hit, which for several deals (Martinook, Staal, Chatfield,
// Carrier, Walker) steps up from their earlier-season cap hit, and for
// Slavin/Jarvis/Blake sits below AAV (deferred compensation).
// Salary cap = $104,000,000.
// yearsLeft = years remaining AFTER 2026-27 (0 = expires summer 2027)
//
// Scope: the 23-man NHL roster as CapWages carries it (22 signed + the one
// unsigned RFA), so getCapSummary()'s committed total matches CapWages'
// roster cap hit ($94,119,711). Depth one-way deals currently off the
// roster (Mike Reilly $850K, Pierre-Olivier Joseph $850K, Cayden Primeau
// $912,500) aren't included -- add them if they make the opening roster.
// Gone since the last refresh: Frederik Andersen (UFA -> EDM), and John
// Carlson (rights acquired 2026-06-27, signed with TBL 2026-07-02).
//
// playerIds were re-verified against api-web.nhle.com/v1/roster/CAR/current
// -- the previous file's ids were mostly wrong (Nadeau's old id was actually
// Bussi's, so Bussi's popup showed Nadeau's ELC).

import i18n from '../i18n';

// Update this date whenever contracts.js is manually refreshed
export const CONTRACT_DATA_DATE = 'Sep 2026';

export const CAP_CEILING    = 104_000_000;
export const CAP_FLOOR      =  77_000_000;
export const MIN_SALARY     =    850_000;
export const CURRENT_SEASON = '2026-27';

// playerId matches NHL API player ID; findContract() falls back to a
// last-name match if an id ever drifts.
export const CONTRACTS = [
  // ── Forwards ──────────────────────────────────────────
  { playerId: 8478427, name: 'Sebastian Aho',         pos: 'C',  capHit: 9_750_000, yearsLeft: 5,  expiresAfter: '2031-32', type: 'UFA' },
  { playerId: 8477940, name: 'Nikolaj Ehlers',        pos: 'LW', capHit: 8_500_000, yearsLeft: 4,  expiresAfter: '2030-31', type: 'UFA' },
  { playerId: 8480830, name: 'Andrei Svechnikov',     pos: 'LW', capHit: 7_750_000, yearsLeft: 2,  expiresAfter: '2028-29', type: 'UFA' },
  { playerId: 8482093, name: 'Seth Jarvis',           pos: 'RW', capHit: 7_420_087, yearsLeft: 5,  expiresAfter: '2031-32', type: 'UFA' },
  { playerId: 8482702, name: 'Logan Stankoven',       pos: 'C',  capHit: 6_000_000, yearsLeft: 7,  expiresAfter: '2033-34', type: 'UFA' },
  { playerId: 8482809, name: 'Jackson Blake',         pos: 'RW', capHit: 5_117_002, yearsLeft: 7,  expiresAfter: '2033-34', type: 'UFA' },
  { playerId: 8480829, name: 'Jesperi Kotkaniemi',    pos: 'C',  capHit: 4_820_000, yearsLeft: 3,  expiresAfter: '2029-30', type: 'UFA' },
  { playerId: 8475791, name: 'Taylor Hall',           pos: 'LW', capHit: 3_166_667, yearsLeft: 1,  expiresAfter: '2027-28', type: 'UFA' },
  { playerId: 8476921, name: 'Jordan Martinook',      pos: 'LW', capHit: 3_125_000, yearsLeft: 0,  expiresAfter: '2026-27', type: 'UFA' },
  { playerId: 8473533, name: 'Jordan Staal',          pos: 'C',  capHit: 2_975_000, yearsLeft: 0,  expiresAfter: '2026-27', type: 'UFA' },
  { playerId: 8477478, name: 'William Carrier',       pos: 'LW', capHit: 2_150_000, yearsLeft: 3,  expiresAfter: '2029-30', type: 'UFA' },
  { playerId: 8476873, name: 'Mark Jankowski',        pos: 'C',  capHit: 1_850_000, yearsLeft: 1,  expiresAfter: '2027-28', type: 'UFA' },
  { playerId: 8480762, name: 'Eric Robinson',         pos: 'LW', capHit: 1_700_000, yearsLeft: 2,  expiresAfter: '2028-29', type: 'UFA' },
  { playerId: 8475235, name: 'Nicolas Deslauriers',   pos: 'LW', capHit:   875_000, yearsLeft: 1,  expiresAfter: '2027-28', type: 'UFA' },

  // ── Defence ───────────────────────────────────────────
  { playerId: 8480817, name: "K'Andre Miller",        pos: 'D',  capHit: 7_500_000, yearsLeft: 6,  expiresAfter: '2032-33', type: 'UFA' },
  { playerId: 8476958, name: 'Jaccob Slavin',         pos: 'D',  capHit: 6_395_955, yearsLeft: 6,  expiresAfter: '2032-33', type: 'UFA' },
  { playerId: 8480336, name: 'Sean Walker',           pos: 'D',  capHit: 3_625_000, yearsLeft: 2,  expiresAfter: '2028-29', type: 'UFA' },
  { playerId: 8476906, name: 'Shayne Gostisbehere',   pos: 'D',  capHit: 3_200_000, yearsLeft: 0,  expiresAfter: '2026-27', type: 'UFA' },
  { playerId: 8478970, name: 'Jalen Chatfield',       pos: 'D',  capHit: 3_075_000, yearsLeft: 0,  expiresAfter: '2026-27', type: 'UFA' },
  { playerId: 8482911, name: 'Joel Nystrom',          pos: 'D',  capHit: 1_225_000, yearsLeft: 3,  expiresAfter: '2029-30', type: 'UFA' },
  // Unsigned RFA (ELC expired after 2025-26) -- $0 until he signs; not an
  // "expiring" contract, so yearsLeft is null rather than 0.
  { playerId: 8482100, name: 'Alexander Nikishin',    pos: 'D',  capHit:         0, yearsLeft: null, expiresAfter: '—',    type: 'RFA', note: 'Unsigned' },

  // ── Goalies ───────────────────────────────────────────
  { playerId: 8481611, name: 'Pyotr Kochetkov',       pos: 'G',  capHit: 2_000_000, yearsLeft: 0,  expiresAfter: '2026-27', type: 'UFA' },
  { playerId: 8483548, name: 'Brandon Bussi',         pos: 'G',  capHit: 1_900_000, yearsLeft: 2,  expiresAfter: '2028-29', type: 'UFA' },
];

// ─── Future draft picks owned by CAR ─────────────────────────
// Source: PuckPedia/team transactions (May 2026)
export const DRAFT_PICKS = [
  // 2026
  { year: 2026, round: 1, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2026, round: 2, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2026, round: 3, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2026, round: 4, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2026, round: 5, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2026, round: 6, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2026, round: 7, from: 'CAR (own)',    note: 'Own pick' },
  // 2027
  { year: 2027, round: 1, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2027, round: 2, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2027, round: 3, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2027, round: 4, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2027, round: 5, from: 'VGK',          note: 'Received in trade' },
  { year: 2027, round: 5, from: 'CAR (own)',    note: 'Own pick' },
  // 2028
  { year: 2028, round: 1, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2028, round: 2, from: 'CAR (own)',    note: 'Own pick' },
  { year: 2028, round: 3, from: 'CAR (own)',    note: 'Own pick' },
];

// ─── Cap summary helpers ──────────────────────────────────────

export function getCapSummary() {
  const active    = CONTRACTS.filter(c => c.yearsLeft >= 0);
  const committed = active.reduce((s, c) => s + c.capHit, 0);
  const space     = CAP_CEILING - committed;
  const expiring  = CONTRACTS.filter(c => c.yearsLeft === 0);
  const ufa       = expiring.filter(c => c.type === 'UFA');
  const rfa       = expiring.filter(c => c.type === 'RFA');
  return { committed, space, expiring, ufa, rfa };
}

// ─── Find contract for a player ──────────────────────────────

export function findContract(playerId, lastName) {
  // Try exact player ID match first
  const byId = CONTRACTS.find(c => c.playerId === Number(playerId));
  if (byId) return byId;
  // Fallback: fuzzy last name match
  if (lastName) {
    const last = lastName.toLowerCase();
    return CONTRACTS.find(c => c.name.toLowerCase().includes(last)) || null;
  }
  return null;
}

// ─── Contract value score (skaters) ──────────────────────────
// Blended score: 60% points/$M + 40% WAR/$M (scaled to same range).
// If WAR is unavailable, falls back to points/$M only.
// ELC contracts are excluded — their tiny cap hit makes the metric
// nonsensical vs market-rate deals.
//
// WAR scaling: WAR/$M is multiplied by 6 to bring it onto the same
// axis as points/$M. A player with 3.0 WAR on a $4M deal scores
// ~4.5 on this axis — comparable to 18 pts/$M before blending.
//
// Blended scale (market-rate skaters):
//   >= 8.0  → Exceptional value
//   >= 5.0  → Great value
//   >= 3.0  → Good value
//   >= 1.8  → Fair value
//   >= 1.0  → Below average
//    < 1.0  → Overpaid
export function contractValue(points, gamesPlayed, capHit, isELC, war = null) {
  if (!capHit || !gamesPlayed) return null;
  if (isELC || capHit < 1_200_000) return null;

  const capM     = capHit / 1_000_000;
  const p82      = (points / gamesPlayed) * 82;
  const pointsPerM = p82 / capM;

  if (war != null && !isNaN(war)) {
    const warPerM   = war / capM;
    const warScaled = warPerM * 6;
    const blended   = (pointsPerM * 0.6) + (warScaled * 0.4);
    return { score: Math.round(blended * 10) / 10, method: 'blended' };
  }

  return { score: Math.round(pointsPerM * 10) / 10, method: 'points' };
}

// ─── Points per 60 ───────────────────────────────────────────
export function pointsPer60(points, toiSeconds) {
  if (!toiSeconds || !points) return null;
  const hours = toiSeconds / 3600;
  return Math.round((points / hours) * 10) / 10;
}

// ─── PDO (on-ice shooting% + save% — proxy for puck luck) ────
export function calcPDO(shootingPctg, onIceSavePctg) {
  if (shootingPctg == null || onIceSavePctg == null) return null;
  const sh = shootingPctg <= 1 ? shootingPctg * 100 : shootingPctg;
  const sv = onIceSavePctg <= 1 ? onIceSavePctg * 100 : onIceSavePctg;
  return Math.round((sh + sv) * 10) / 10;
}

// ─── Goalie contract value (GSAX/$M) ─────────────────────────
// Goals saved above expected per $1M of cap hit.
// GSAX already accounts for shot quality and volume, making it a
// more honest measure than raw SV% vs league average.
// A positive GSAX means the goalie saved more goals than an average
// goalie would have faced the same shots — negative means they allowed
// more. Dividing by cap hit tells you how much of that value you're
// getting per dollar spent.
//
// Scale:
//   >= 4.0  → Exceptional value  (elite goalie on reasonable deal)
//   >= 2.0  → Great value
//   >= 0.0  → Fair value
//   >= -2.0 → Below average
//    < -2.0 → Overpaid
export function goalieContractValue(gsax, gamesPlayed, capHit, isELC) {
  if (!capHit || !gamesPlayed || gsax == null) return null;
  if (isELC || capHit < 1_200_000) return null;
  const capM = capHit / 1_000_000;
  const score = gsax / capM;
  return Math.round(score * 10) / 10;
}

export function goalieValueLabel(score) {
  if (score == null) return null;
  if (score >=  4.0) return { label: i18n.t('playerPopup.contract.tierExceptional'), color: '#3dba7e' };
  if (score >=  2.0) return { label: i18n.t('playerPopup.contract.tierGreat'),       color: '#5ab4f0' };
  if (score >=  0.0) return { label: i18n.t('playerPopup.contract.tierFair'),        color: '#a0c878' };
  if (score >= -2.0) return { label: i18n.t('playerPopup.contract.tierBelowAvg'),    color: '#f0c030' };
  return               { label: i18n.t('playerPopup.contract.tierOverpaid'),         color: '#e04040' };
}

// ─── Value rating label ───────────────────────────────────────
export function valueLabel(score) {
  if (score == null) return null;
  if (score >= 8.0)  return { label: i18n.t('playerPopup.contract.tierExceptional'), color: '#3dba7e' };
  if (score >= 5.0)  return { label: i18n.t('playerPopup.contract.tierGreat'),       color: '#5ab4f0' };
  if (score >= 3.0)  return { label: i18n.t('playerPopup.contract.tierGood'),        color: '#a0c878' };
  if (score >= 1.8)  return { label: i18n.t('playerPopup.contract.tierFair'),        color: '#f0c030' };
  if (score >= 1.0)  return { label: i18n.t('playerPopup.contract.tierBelowAvg'),    color: '#f07830' };
  return               { label: i18n.t('playerPopup.contract.tierOverpaid'),         color: '#e04040' };
}
