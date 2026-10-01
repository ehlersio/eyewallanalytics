// src/utils/edgeFormat.js
// Display rules for NHL EDGE metrics (see edgeApi.js / eyewall-poller's
// edge.js for the shape): which metrics each kind of player shows, in what
// order, and how a value reads in the user's units.
//
// A metric is either measured -- { imperial, metric, pct, avg: { imperial,
// metric } }, a speed or a distance -- or counted -- { value, pct, avg }.

import { formatNumber, formatPercent } from './formatters';

// name -> how its value reads. 'speed' and 'distance' are measured; the rest
// counted.
export const EDGE_METRICS = {
  skater: [
    ['topSpeed', 'speed'],
    ['burstsOver20', 'count'],
    ['distancePer60', 'distance'],
    ['topShotSpeed', 'speed'],
    ['avgShotSpeed', 'speed'],
    ['highDangerShots', 'count'],
    ['offensiveZoneTimeEv', 'share'],
  ],
  goalie: [
    ['gamesAbove900Pct', 'share'],
    ['savePctg5v5Close', 'share'],
    ['longRangeSavePctg', 'share'],
  ],
};

// The values worth reading at a glance, above the percentile bars
export const EDGE_HEADLINES = {
  skater: ['topSpeed', 'topShotSpeed', 'distancePer60'],
  goalie: ['gamesAbove900Pct', 'savePctg5v5Close'],
};

const UNIT_KEY = {
  speed: { imperial: 'units.mph', metric: 'units.kph' },
  distance: { imperial: 'units.mi', metric: 'units.km' },
};

function formatOne(kind, v, units, t) {
  if (v == null) return null;
  if (kind === 'speed' || kind === 'distance') {
    return t(UNIT_KEY[kind][units], { value: formatNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
  }
  if (kind === 'share') return formatPercent(v, 1);
  return formatNumber(v, { maximumFractionDigits: 1 });
}

// { value, avg } as display strings (avg null when the NHL gave none)
export function formatEdgeMetric(kind, metric, units, t) {
  if (!metric) return null;
  const measured = kind === 'speed' || kind === 'distance';
  const value = measured ? metric[units] : metric.value;
  const avg = measured ? metric.avg?.[units] : metric.avg;
  return { value: formatOne(kind, value, units, t), avg: formatOne(kind, avg, units, t) };
}

// The [name, kind] rows of `metrics` that have data, in display order
export function presentEdgeMetrics(playerKind, metrics) {
  return (EDGE_METRICS[playerKind] || []).filter(([name]) => metrics?.[name]);
}
