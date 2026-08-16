// ── PWHL Prediction Tracking Store ────────────────────────────
// PWHL analogue of predictionStore.js. Kept as an independent store rather
// than reusing the NHL one -- predictionStore.js's fields are literal
// Carolina-era names (carActual, predictedCarWin, ...), which predate this
// app going multi-team and are documented in CLAUDE.md as harmless legacy
// naming for NHL's own "user's currently selected team," not something to
// rename. Reusing those field names for a PWHL team (which is never "CAR")
// would be actively misleading rather than harmless, so this uses neutral
// team/opp field names in its own localStorage key instead -- same
// independent-copy convention this codebase already uses for parsing/derived
// logic shared conceptually between the two leagues.
//
// Each prediction stores: gameId, gameDate, opponent, predicted win%,
// predicted score, actual outcome (filled in after game).

const KEY = 'eyewall_pwhl_predictions_v1';

export function loadPWHLPredictions() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function savePWHLPrediction(pred) {
  try {
    const preds = loadPWHLPredictions();
    const idx   = preds.findIndex(p => p.gameId === pred.gameId);
    if (idx >= 0) preds[idx] = { ...preds[idx], ...pred };
    else          preds.push(pred);
    localStorage.setItem(KEY, JSON.stringify(preds));
    return true;
  } catch { return false; }
}

export function recordPWHLOutcome(gameId, teamActual, oppActual) {
  const preds = loadPWHLPredictions();
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

export function getPWHLPredictionStats() {
  const preds    = loadPWHLPredictions().filter(p => p.teamActual != null);
  const total    = preds.length;
  const correct  = preds.filter(p => p.correct).length;
  const avgError = total > 0
    ? +(preds.reduce((s, p) => s + (p.scoreDiff || 0), 0) / total).toFixed(1)
    : null;
  return { total, correct, pct: total > 0 ? Math.round(correct/total*100) : null, avgError };
}
