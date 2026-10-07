// ── PWHL Prediction Tracking Store ────────────────────────────
// The shared HockeyTech prediction store (utils/hockeyTechPredictionStore.js)
// under the PWHL's own key, 'eyewall_pwhl_predictions_v1'. Kept separate
// from the NHL store -- predictionStore.js's fields are literal Carolina-era
// names (carActual, predictedCarWin, ...), harmless legacy naming for NHL's
// own "user's currently selected team" (see CLAUDE.md), but misleading for
// a PWHL team, so this uses neutral team/opp field names.
//
// Each prediction stores: gameId, gameDate, opponent, predicted win%,
// predicted score, actual outcome (filled in after game).
import { createPredictionStore } from './hockeyTechPredictionStore';

// The store object itself, for components that take one (LocalPredictionScorecard).
export const pwhlPredictionStore = createPredictionStore('pwhl');
const store = pwhlPredictionStore;

export const loadPWHLPredictions    = store.load;
export const savePWHLPrediction     = store.save;
export const recordPWHLOutcome      = store.recordOutcome;
export const getPWHLPredictionStats = store.getStats;
