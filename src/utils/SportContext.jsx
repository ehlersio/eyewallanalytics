// utils/SportContext.jsx
// Sport switcher context — toggles the app between NHL and PWHL modes.
//
// Storage key: 'eyewall:sport' in localStorage ('nhl' | 'pwhl')
// On sport change, a full page reload is triggered so module-level constants
// (TEAM_CONFIG, CURRENT_SEASON etc.) re-initialize with the new sport's values,
// matching the same pattern used for team selection in App.jsx.

import { createContext, useContext } from 'react';
import { ALL_TEAMS, CURRENT_SEASON } from './teamConfig';
import { PWHL_TEAMS, PWHL_CURRENT_SEASON } from './pwhlConfig';

const STORAGE_KEY = 'eyewall:sport';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getSport() {
  return localStorage.getItem(STORAGE_KEY) || 'nhl';
}

export function setSportAndReload(sport) {
  localStorage.setItem(STORAGE_KEY, sport);
  window.location.reload();
}

export function isNHL() {
  return getSport() === 'nhl';
}

export function isPWHL() {
  return getSport() === 'pwhl';
}

// ── Context ───────────────────────────────────────────────────────────────────

const SportContext = createContext({
  sport: 'nhl',
  setSport: () => {},
  allTeams: ALL_TEAMS,
  currentSeason: CURRENT_SEASON,
  isPWHL: false,
  isNHL: true,
});

export function SportProvider({ children }) {
  const sport = getSport();
  const pwhl = sport === 'pwhl';

  const value = {
    sport,
    setSport: setSportAndReload,
    allTeams: pwhl ? PWHL_TEAMS : ALL_TEAMS,
    currentSeason: pwhl ? PWHL_CURRENT_SEASON : CURRENT_SEASON,
    isPWHL: pwhl,
    isNHL: !pwhl,
  };

  return (
    <SportContext.Provider value={value}>
      {children}
    </SportContext.Provider>
  );
}

export function useSport() {
  return useContext(SportContext);
}
