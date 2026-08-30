// ── ECHL Prediction Tracking Store ────────────────────────────
// ECHL analogue of ahlPredictionStore.js -- trivial localStorage-only
// port, same neutral team/opp field-name convention.
//
// Each prediction stores: gameId, gameDate, opponent, predicted win%,
// predicted score, actual outcome (filled in after game).

const KEY = 'eyewall_echl_predictions_v1';

export function loadECHLPredictions() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveECHLPrediction(pred) {
  try {
    const preds = loadECHLPredictions();
    const idx   = preds.findIndex(p => p.gameId === pred.gameId);
    if (idx >= 0) preds[idx] = { ...preds[idx], ...pred };
    else          preds.push(pred);
    localStorage.setItem(KEY, JSON.stringify(preds));
    return true;
  } catch { return false; }
}

export function recordECHLOutcome(gameId, teamActual, oppActual) {
  const preds = loadECHLPredictions();
  const pred  = preds.find(p => p.gameId === gameId);
  if (!pred) return;
  pred.teamActual = teamActual;
  pred.oppActual  = oppActual;
  pred.teamWon    = teamActual > oppActual;
  pred.correct    = pred.teamWon === pred.predictedTeamWin;
  pred.scoreDiff  = Math.abs((pred.predictedTeamScore - teamActual) || 0) +
                    Math.abs((pred.predictedOppScore  - oppActual) || 0);
  localStorage.setItem(KEY, JSON.stringify(preds));
}

export function getECHLPredictionStats() {
  const preds    = loadECHLPredictions().filter(p => p.teamActual != null);
  const total    = preds.length;
  const correct  = preds.filter(p => p.correct).length;
  const avgError = total > 0
    ? +(preds.reduce((s, p) => s + (p.scoreDiff || 0), 0) / total).toFixed(1)
    : null;
  return { total, correct, pct: total > 0 ? Math.round(correct/total*100) : null, avgError };
}
