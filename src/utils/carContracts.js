// ─── CAR Roster Contracts 2025-26 ────────────────────────────
// Source: PuckPedia / NCSportsNetwork (accurate as of May 2026)
// Cap figures are cap hit (AAV). Salary cap = $95,500,000.
// yearsLeft = years remaining AFTER 2025-26 (0 = expires this summer)

export const CAP_CEILING    = 95_500_000;
export const CAP_FLOOR      = 65_000_000;
export const MIN_SALARY     =    775_000;
export const CURRENT_SEASON = '2025-26';

// keyed by last name (lowercase) for fuzzy matching with roster API
// playerId matches NHL API player ID
export const CONTRACTS = [
  // ── Forwards ──────────────────────────────────────────
  { playerId: 8481600, name: 'Sebastian Aho',         pos: 'C',  capHit: 9_750_000, yearsLeft: 6,  expiresAfter: '2031-32', type: 'UFA' },
  { playerId: 8481533, name: 'Nikolaj Ehlers',        pos: 'LW', capHit: 8_500_000, yearsLeft: 5,  expiresAfter: '2030-31', type: 'UFA' },
  { playerId: 8481543, name: 'Andrei Svechnikov',     pos: 'LW', capHit: 7_750_000, yearsLeft: 3,  expiresAfter: '2028-29', type: 'UFA' },
  { playerId: 8483413, name: 'Seth Jarvis',           pos: 'RW', capHit: 7_420_087, yearsLeft: 6,  expiresAfter: '2031-32', type: 'UFA' },
  { playerId: 8484144, name: 'Logan Stankoven',       pos: 'C',  capHit:   814_167, yearsLeft: 0,  expiresAfter: '2025-26', type: 'RFA', note: 'ELC' }, // new 8yr/$6M starts 2026-27
  { playerId: 8484158, name: 'Jackson Blake',         pos: 'RW', capHit:   905_833, yearsLeft: 0,  expiresAfter: '2025-26', type: 'RFA', note: 'ELC' }, // new 8yr/$5.1M starts 2026-27
  { playerId: 8481590, name: 'Jesperi Kotkaniemi',    pos: 'C',  capHit: 4_820_000, yearsLeft: 4,  expiresAfter: '2029-30', type: 'UFA' },
  { playerId: 8476918, name: 'Taylor Hall',           pos: 'LW', capHit: 3_166_667, yearsLeft: 2,  expiresAfter: '2027-28', type: 'UFA' },
  { playerId: 8476392, name: 'Jordan Martinook',      pos: 'LW', capHit: 3_050_000, yearsLeft: 1,  expiresAfter: '2026-27', type: 'UFA' },
  { playerId: 8474612, name: 'Jordan Staal',          pos: 'C',  capHit: 2_900_000, yearsLeft: 1,  expiresAfter: '2026-27', type: 'UFA' },
  { playerId: 8481528, name: 'William Carrier',       pos: 'LW', capHit: 2_000_000, yearsLeft: 4,  expiresAfter: '2029-30', type: 'UFA' },
  { playerId: 8479999, name: 'Eric Robinson',         pos: 'LW', capHit: 1_700_000, yearsLeft: 3,  expiresAfter: '2028-29', type: 'UFA' },
  { playerId: 8483548, name: 'Bradly Nadeau',         pos: 'C',  capHit:   886_167, yearsLeft: 7,  expiresAfter: '2032-33', type: 'RFA', note: 'ELC' },
  // Mark Jankowski — expired summer 2025, not on 2025-26 roster

  // ── Defence ───────────────────────────────────────────
  { playerId: 8475753, name: 'Jaccob Slavin',         pos: 'D',  capHit: 6_461_000, yearsLeft: 7,  expiresAfter: '2032-33', type: 'UFA' },
  { playerId: 8480797, name: "K'Andre Miller",        pos: 'D',  capHit: 7_500_000, yearsLeft: 7,  expiresAfter: '2032-33', type: 'UFA' },
  { playerId: 8481553, name: 'Sean Walker',           pos: 'D',  capHit: 3_600_000, yearsLeft: 4,  expiresAfter: '2030-31', type: 'UFA' },
  { playerId: 8476419, name: 'Shayne Gostisbehere',   pos: 'D',  capHit: 3_200_000, yearsLeft: 2,  expiresAfter: '2027-28', type: 'UFA' },
  { playerId: 8479380, name: 'Jalen Chatfield',       pos: 'D',  capHit: 3_000_000, yearsLeft: 1,  expiresAfter: '2026-27', type: 'UFA' },
  { playerId: 8484932, name: 'Alexander Nikishin',    pos: 'D',  capHit:   925_000, yearsLeft: 2,  expiresAfter: '2027-28', type: 'RFA', note: 'ELC' },
  { playerId: 8476369, name: 'Mike Reilly',           pos: 'D',  capHit:   775_000, yearsLeft: 0,  expiresAfter: '2025-26', type: 'UFA' },

  // ── Goalies ───────────────────────────────────────────
  { playerId: 8475883, name: 'Frederik Andersen',     pos: 'G',  capHit: 2_750_000, yearsLeft: 1,  expiresAfter: '2026-27', type: 'UFA' },
  { playerId: 8483671, name: 'Pyotr Kochetkov',       pos: 'G',  capHit: 2_000_000, yearsLeft: 2,  expiresAfter: '2027-28', type: 'RFA' },
  { playerId: 8483596, name: 'Brandon Bussi',         pos: 'G',  capHit:   775_000, yearsLeft: 0,  expiresAfter: '2025-26', type: 'RFA' },
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

// ─── Contract value score ─────────────────────────────────────
// Points per $M of cap hit, projected to 82 games.
// ELC contracts (note: 'ELC' or capHit < $1.2M) are excluded —
// their tiny cap hit makes the metric nonsensical vs market deals.
// Scale for market-rate skaters:
//   >= 8.0 pts/$M  → Exceptional value  (e.g. Slavin calibre deal)
//   >= 5.0         → Great value
//   >= 3.0         → Good value         (typical star contract)
//   >= 1.8         → Fair value
//   >= 1.0         → Below average
//    < 1.0         → Overpaid
export function contractValue(points, gamesPlayed, capHit, isELC) {
  if (!capHit || !gamesPlayed) return null;
  if (isELC || capHit < 1_200_000) return null;
  const p82  = (points / gamesPlayed) * 82;
  const pPerM = p82 / (capHit / 1_000_000);
  return Math.round(pPerM * 10) / 10;
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

// ─── Goalie contract value ───────────────────────────────────
// For goalies we use SV% relative to league average ($910 = league avg).
// A goalie playing above avg on a reasonable contract is good value.
// capHit in dollars, svPctg as decimal (0.xxx)
export function goalieContractValue(svPctg, gamesPlayed, capHit, isELC) {
  if (!capHit || !gamesPlayed || svPctg == null) return null;
  if (isELC || capHit < 1_200_000) return null;
  // Normalise SV% to 0-100 scale
  const sv = svPctg <= 1 ? svPctg * 1000 : svPctg; // e.g. 0.912 → 912
  const leagueAvg = 910; // approx NHL starter average
  const svAboveAvg = sv - leagueAvg; // e.g. 915 → +5, 905 → -5
  // Cap hit per game as a proxy for "what you're paying"
  const capPerGame = capHit / 82;
  // Simple score: SV points above avg per $1M spent
  const score = (svAboveAvg / (capHit / 1_000_000));
  return Math.round(score * 10) / 10;
}

export function goalieValueLabel(score) {
  if (score == null) return null;
  if (score >=  2.0) return { label: 'Exceptional value', color: '#3dba7e' };
  if (score >=  1.0) return { label: 'Great value',       color: '#5ab4f0' };
  if (score >=  0.0) return { label: 'Fair value',        color: '#a0c878' };
  if (score >= -1.0) return { label: 'Below average',     color: '#f0c030' };
  return               { label: 'Overpaid',               color: '#e04040' };
}

// ─── Value rating label ───────────────────────────────────────
export function valueLabel(score) {
  if (score == null) return null;
  if (score >= 8.0)  return { label: 'Exceptional value', color: '#3dba7e' };
  if (score >= 5.0)  return { label: 'Great value',       color: '#5ab4f0' };
  if (score >= 3.0)  return { label: 'Good value',        color: '#a0c878' };
  if (score >= 1.8)  return { label: 'Fair value',        color: '#f0c030' };
  if (score >= 1.0)  return { label: 'Below average',     color: '#f07830' };
  return               { label: 'Overpaid',               color: '#e04040' };
}
