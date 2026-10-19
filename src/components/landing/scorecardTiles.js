// src/components/landing/scorecardTiles.js
// The landing page's three scorecard tiles from the Worker's /scorecard --
// the same rows the app's Scorecard tab and /methodology read, so nothing
// here is typed in. Each tile shows the live record once it has graded
// predictions, else the backtest; a model with neither is left out.
//
// Game winners and starting goalies are scored by how often the pick was
// right. Playoff odds by Brier score: it picks the outcome about as often as
// its baseline, and its edge is in how close the percentages are (the
// Scorecard tab says the same, scorecard.edgeInBrier).

export const SCORECARD_TILES = [
  { model: 'game_winner', metric: 'accuracy' },
  { model: 'starting_goalie', metric: 'accuracy' },
  { model: 'playoff_odds', metric: 'brier' },
];

const graded = row => row && row.status === 'ok' && row.n > 0;

export function formatMetric(metric, value) {
  if (value == null || !Number.isFinite(value)) return null;
  return metric === 'brier' ? value.toFixed(3) : `${(value * 100).toFixed(1)}%`;
}

// [{ model, metric, kind: 'live' | 'backtest', value, n, period, baseline: { name, value } | null }]
export function scorecardTiles(data) {
  const models = data?.models;
  if (!models) return [];
  return SCORECARD_TILES.flatMap(({ model, metric }) => {
    const entry = models[model];
    const kind = graded(entry?.live) ? 'live' : graded(entry?.backtest) ? 'backtest' : null;
    if (!kind) return [];
    const row = entry[kind];
    const value = formatMetric(metric, row[metric]);
    if (!value) return [];
    const baselineValue = formatMetric(metric, row.baseline?.[metric]);
    return [{
      model,
      metric,
      kind,
      value,
      n: row.n,
      period: row.period,
      baseline: baselineValue ? { name: row.baseline.name, value: baselineValue } : null,
    }];
  });
}
