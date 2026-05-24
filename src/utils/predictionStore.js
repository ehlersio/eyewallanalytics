// ── Prediction Tracking Store ─────────────────────────────────
// Persists predictions to localStorage so we can track accuracy over time.
// Each prediction stores: gameId, gameDate, opponent, predicted win%,
// predicted score, actual outcome (filled in after game).

const KEY = 'eyewall_predictions_v1';

export function loadPredictions() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function savePrediction(pred) {
  try {
    const preds = loadPredictions();
    const idx   = preds.findIndex(p => p.gameId === pred.gameId);
    if (idx >= 0) preds[idx] = { ...preds[idx], ...pred };
    else          preds.push(pred);
    localStorage.setItem(KEY, JSON.stringify(preds));
    return true;
  } catch { return false; }
}

export function recordOutcome(gameId, carActual, oppActual) {
  const preds = loadPredictions();
  const pred  = preds.find(p => p.gameId === gameId);
  if (!pred) return;
  pred.carActual  = carActual;
  pred.oppActual  = oppActual;
  pred.carWon     = carActual > oppActual;
  pred.correct    = pred.carWon === pred.predictedCarWin;
  pred.scoreDiff  = Math.abs((pred.predictedCarScore - carActual) || 0) +
                    Math.abs((pred.predictedOppScore  - oppActual) || 0);
  localStorage.setItem(KEY, JSON.stringify(preds));
}

export function getPredictionStats() {
  const preds    = loadPredictions().filter(p => p.carActual != null);
  const total    = preds.length;
  const correct  = preds.filter(p => p.correct).length;
  const avgError = total > 0
    ? +(preds.reduce((s, p) => s + (p.scoreDiff || 0), 0) / total).toFixed(1)
    : null;
  return { total, correct, pct: total > 0 ? Math.round(correct/total*100) : null, avgError };
}
