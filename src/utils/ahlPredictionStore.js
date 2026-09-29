// ── AHL Prediction Tracking Store ────────────────────────────
// AHL analogue of pwhlPredictionStore.js -- trivial localStorage-only
// port, same neutral team/opp field-name convention (no Carolina-era
// NHL field names).
//
// Each prediction stores: gameId, gameDate, opponent, predicted win%,
// predicted score, actual outcome (filled in after game).

const KEY = 'eyewall_ahl_predictions_v1';

export function loadAHLPredictions() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveAHLPrediction(pred) {
  try {
    const preds = loadAHLPredictions();
    const idx   = preds.findIndex(p => p.gameId === pred.gameId);
    if (idx >= 0) preds[idx] = { ...preds[idx], ...pred };
    else          preds.push(pred);
    localStorage.setItem(KEY, JSON.stringify(preds));
    return true;
  } catch { return false; }
}

export function recordAHLOutcome(gameId, teamActual, oppActual) {
  const preds = loadAHLPredictions();
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

export function getAHLPredictionStats() {
  const preds    = loadAHLPredictions().filter(p => p.teamActual != null);
  const total    = preds.length;
  const correct  = preds.filter(p => p.correct).length;
  const scored   = preds.filter(p => p.scoreDiff != null);
  const avgError = scored.length > 0
    ? +(scored.reduce((s, p) => s + p.scoreDiff, 0) / scored.length).toFixed(1)
    : null;
  return { total, correct, pct: total > 0 ? Math.round(correct/total*100) : null, avgError };
}
