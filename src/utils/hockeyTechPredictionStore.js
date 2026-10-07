// utils/hockeyTechPredictionStore.js
// HockeyTech-league prediction tracking (localStorage only), one store per
// league: createPredictionStore('ahl') keeps using
// 'eyewall_ahl_predictions_v1', 'echl' 'eyewall_echl_predictions_v1' and
// 'pwhl' 'eyewall_pwhl_predictions_v1' -- the keys saved predictions already
// live under. Used by each AHL/ECHL league object's `predictionStore`
// (utils/hockeyTechLeagues.js) and by pwhlPredictionStore.js.
//
// Neutral team/opp field names (no Carolina-era NHL field names). Each prediction stores: gameId, gameDate,
// opponent, predicted win%, predicted score, actual outcome (filled in after
// the game).

export function predictionStorageKey(leagueKey) {
  return `eyewall_${leagueKey}_predictions_v1`;
}

export function createPredictionStore(leagueKey) {
  const KEY = predictionStorageKey(leagueKey);

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function save(pred) {
    try {
      const preds = load();
      const idx   = preds.findIndex(p => p.gameId === pred.gameId);
      if (idx >= 0) preds[idx] = { ...preds[idx], ...pred };
      else          preds.push(pred);
      localStorage.setItem(KEY, JSON.stringify(preds));
      return true;
    } catch { return false; }
  }

  function recordOutcome(gameId, teamActual, oppActual) {
    const preds = load();
    const pred  = preds.find(p => p.gameId === gameId);
    if (!pred) return;
    pred.teamActual = teamActual;
    pred.oppActual  = oppActual;
    pred.teamWon    = teamActual > oppActual;
    pred.correct    = pred.teamWon === pred.predictedTeamWin;
    // No predicted score (goal rates were unavailable) means no error to
    // measure -- not the whole actual score counted as error.
    pred.scoreDiff  = pred.predictedTeamScore != null && pred.predictedOppScore != null
      ? Math.abs(pred.predictedTeamScore - teamActual) + Math.abs(pred.predictedOppScore - oppActual)
      : null;
    localStorage.setItem(KEY, JSON.stringify(preds));
  }

  function getStats() {
    const preds    = load().filter(p => p.teamActual != null);
    const total    = preds.length;
    const correct  = preds.filter(p => p.correct).length;
    const scored   = preds.filter(p => p.scoreDiff != null);
    const avgError = scored.length > 0
      ? +(scored.reduce((s, p) => s + p.scoreDiff, 0) / scored.length).toFixed(1)
      : null;
    return { total, correct, pct: total > 0 ? Math.round(correct/total*100) : null, avgError };
  }

  return { load, save, recordOutcome, getStats };
}
