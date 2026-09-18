// Display logic for the Scouting tab's "Projected lines" block -- the Worker's
// /projected-lines route (eyewall-pipeline's nightly projected_lines.py).
// Pure; unit-tested in __tests__/projectedLines.test.js.

// Whether there's a projection worth showing. A null/failed fetch, the
// Worker's `unavailable`, or basis null (no projection yet -- before a team's
// first preseason game) all hide the block rather than show an empty one.
export function hasProjection(data) {
  return !!(data && !data.unavailable && data.basis && (data.lines?.length || data.pairs?.length));
}

// i18n keys under scoutingTab.projectedLines for the basis line and the
// accuracy line. The accuracy figures differ by basis (see eyewall-pipeline's
// docs/projected_lines_backtest_results.md): in-season ~7 in 10 forward
// linemate pairs / 3 in 4 D pairs, opening night ~1 in 2 / 6 in 10.
export function projectionCopyKeys(basis) {
  return basis === 'preseason'
    ? { basisKey: 'basisPreseason', accuracyKey: 'accuracyPreseason' }
    : { basisKey: 'basisLastGame', accuracyKey: 'accuracyInSeason' };
}
