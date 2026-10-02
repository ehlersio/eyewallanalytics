// src/utils/goalieAreas.js
// A goalie's record in each of the NHL's 17 shot areas (react-hockey-rink's
// SHOT_AREAS / ShotAreaMap), and how each area is colored:
//   NHL  -- the NHL's own per-area numbers (NHL EDGE, via the Worker's
//           /nhl/edge goalie `areas`), colored by that save %'s percentile
//           among NHL goalies.
//   PWHL -- our own shots (pwhl_shot_events), classified into the same
//           areas, colored against the PWHL's save % in that area, worked out
//           from every shot on goal any PWHL goalie faced that season.
// The classifier is passed in (react-hockey-rink's shotArea) so this module
// stays plain JS for the unit tests.

import { formatNumber } from './formatters';

// An area needs this many shots on goal before it's colored or labelled --
// fewer is a coin flip (the old zone grid's minimum too).
export const MIN_AREA_SHOTS = 5;

// Percentile colors, same thresholds and colors as PercentileBar
export const PCT_COLORS = { high: '#4ade80', mid: '#fbbf24', low: '#f87171' };
export function pctColor(pct) {
  if (pct == null) return null;
  return pct >= 67 ? PCT_COLORS.high : pct >= 34 ? PCT_COLORS.mid : PCT_COLORS.low;
}

// PWHL: how far a goalie's area save % has to be from the league's in that
// area to count as better or worse than average (.020 = 2 more or fewer
// goals per 100 shots).
export const LEAGUE_DIFF = 0.02;
export function leagueDiffColor(diff) {
  if (diff == null) return null;
  return diff >= LEAGUE_DIFF ? PCT_COLORS.high : diff <= -LEAGUE_DIFF ? PCT_COLORS.low : PCT_COLORS.mid;
}

// i18n key per NHL area name (playerPopup.heatMap.goalie.areas.*)
export const AREA_KEYS = {
  Crease: 'crease',
  'Low Slot': 'lowSlot',
  'L Net Side': 'lNetSide',
  'R Net Side': 'rNetSide',
  'High Slot': 'highSlot',
  'L Circle': 'lCircle',
  'R Circle': 'rCircle',
  'Outside L': 'outsideL',
  'Outside R': 'outsideR',
  'Center Point': 'centerPoint',
  'L Point': 'lPoint',
  'R Point': 'rPoint',
  'Behind the Net': 'behindNet',
  'L Corner': 'lCorner',
  'R Corner': 'rCorner',
  'Offensive Neutral Zone': 'neutralZone',
  'Beyond Red Line': 'beyondRedLine',
};

// Hockey-style save % without the leading zero: .912, 1.000 (",912" in French)
export function formatSv(v) {
  if (v == null) return null;
  return formatNumber(v, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/^0(?=[.,])/, '');
}

// A shot attacking the left net, turned to attack the right one (the
// classifier's convention). A goalie switches ends each period, so about
// half his shots come at x < 0.
export function toAttackingRight(x, y) {
  return x < 0 ? [-x, -(y || 0)] : [x, y || 0];
}

// The Worker's /nhl/edge goalie `areas` -> rows:
//   { [area]: { shots, goals, svPct, pct, enough } }
export function nhlAreaRows(edgeAreas) {
  if (!edgeAreas) return null;
  const rows = {};
  for (const [name, a] of Object.entries(edgeAreas)) {
    const shots = a?.shots ?? 0;
    rows[name] = {
      shots,
      goals: a?.goals ?? 0,
      svPct: a?.savePctg ?? null,
      pct: a?.pct ?? null,
      enough: shots >= MIN_AREA_SHOTS && a?.savePctg != null,
    };
  }
  return rows;
}

// Tally [x, y, isGoal] shots per area: { [area]: { shots, goals } }
function tally(shots, classify) {
  const out = {};
  for (const [x, y, isGoal] of shots) {
    const name = classify(...toAttackingRight(x, y));
    const t = (out[name] ||= { shots: 0, goals: 0 });
    t.shots += 1;
    if (isGoal) t.goals += 1;
  }
  return out;
}

const sv = (t) => (t && t.shots ? (t.shots - t.goals) / t.shots : null);

// A PWHL goalie's shots against the league's, both as [x, y, isGoal]:
//   { [area]: { shots, goals, svPct, leagueSvPct, diff, enough } }
export function pwhlAreaRows(goalieShots, leagueShots, classify) {
  if (!goalieShots?.length || !leagueShots?.length) return null;
  const mine = tally(goalieShots, classify);
  const league = tally(leagueShots, classify);
  const rows = {};
  for (const [name, t] of Object.entries(mine)) {
    const svPct = sv(t);
    const leagueSvPct = sv(league[name]);
    const enough = t.shots >= MIN_AREA_SHOTS && leagueSvPct != null;
    rows[name] = {
      shots: t.shots,
      goals: t.goals,
      svPct,
      leagueSvPct,
      diff: enough ? svPct - leagueSvPct : null,
      enough,
    };
  }
  return rows;
}

// True when at least one area has enough shots to show -- otherwise the map
// isn't offered at all (no empty option).
export function hasAreaData(rows) {
  return !!rows && Object.values(rows).some((r) => r.enough);
}
