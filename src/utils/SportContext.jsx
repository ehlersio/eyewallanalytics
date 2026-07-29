// utils/SportContext.jsx
// Sport switcher context — toggles the app between NHL and PWHL modes.
//
// Storage key: 'eyewall:sport' in localStorage ('nhl' | 'pwhl')
// On sport change, a full page reload is triggered so module-level constants
// (TEAM_CONFIG, CURRENT_SEASON etc.) re-initialize with the new sport's values,
// matching the same pattern used for team selection in App.jsx.

import { createContext, useContext, useState, useEffect } from 'react';
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

  // CURRENT_SEASON/PWHL_CURRENT_SEASON are `let` bindings updated in place
  // by an async fetch at module load (see teamConfig.js/pwhlConfig.js).
  // Reading them once during render isn't enough -- SportProvider holds no
  // other state, so nothing re-renders it when that update lands, and
  // `currentSeason` would otherwise freeze at whatever the fallback seed
  // was at first render. Subscribe to the same eyewall:*-season-updated
  // event those modules already dispatch, same pattern PWHLPlayersView.jsx
  // uses for its own season state.
  const [season, setSeason] = useState(pwhl ? PWHL_CURRENT_SEASON : CURRENT_SEASON);
  useEffect(() => {
    const eventName = pwhl ? 'eyewall:pwhl-season-updated' : 'eyewall:nhl-season-updated';
    function handleSeasonUpdate(e) { setSeason(e.detail); }
    window.addEventListener(eventName, handleSeasonUpdate);
    return () => window.removeEventListener(eventName, handleSeasonUpdate);
  }, [pwhl]);

  const value = {
    sport,
    setSport: setSportAndReload,
    allTeams: pwhl ? PWHL_TEAMS : ALL_TEAMS,
    currentSeason: season,
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
