// utils/SportContext.jsx
// Sport switcher context — toggles the app between NHL and PWHL modes.
//
// Storage key: 'eyewall:sport' in localStorage ('nhl' | 'pwhl')
// On sport change, a full page reload is triggered so module-level constants
// (TEAM_CONFIG, CURRENT_SEASON etc.) re-initialize with the new sport's values,
// matching the same pattern used for team selection in App.jsx.

import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  // Derive sport from the CURRENT ROUTE, not from localStorage. Every PWHL
  // page lives under /pwhl/*; everything else is NHL -- App.jsx's route
  // table has no exceptions to this. This is deliberately NOT the same
  // thing as the user's stored default sport (eyewall:sport, still read/
  // written elsewhere for onboarding, favoriteTeamSync, and TeamPicker's
  // post-selection redirect) -- those two can legitimately diverge (a
  // bookmark, a shared link, browser back/forward) whenever navigation
  // happens outside the app's own sport-switch flow (TeamPicker.jsx's
  // onSelect, which writes localStorage then does a full page reload).
  // When they diverge, the DATA ON SCREEN must match the route, not a
  // stale preference: before this fix, an NHL-only route rendered while
  // localStorage said 'pwhl' (or vice versa) silently received the OTHER
  // sport's season/team shape from every useSport() consumer -- at best
  // wrong data (e.g. PlayersView.jsx's `Number(currentSeason)` silently
  // using PWHL's small numeric season ID to query NHL endpoints), at worst
  // a hard crash (LeagueView.jsx's seasonLabelFor() calling .slice() on
  // PWHL_CURRENT_SEASON, a number, since NHL's CURRENT_SEASON is always a
  // string) -- see README's Known Limitations for how this was found.
  const location = useLocation();
  const pwhl = location.pathname.startsWith('/pwhl');
  const sport = pwhl ? 'pwhl' : 'nhl';

  // CURRENT_SEASON/PWHL_CURRENT_SEASON are `let` bindings updated in place
  // by an async fetch at module load (see teamConfig.js/pwhlConfig.js).
  // Reading them once during render isn't enough -- SportProvider holds no
  // other state, so nothing re-renders it when that update lands, and
  // `currentSeason` would otherwise freeze at whatever the fallback seed
  // was at first render. Subscribe to the same eyewall:*-season-updated
  // event those modules already dispatch, same pattern PWHLPlayersView.jsx
  // uses for its own season state.
  //
  // `useState`'s initial value only runs once, at first mount -- now that
  // `pwhl` is route-derived (can change on client-side navigation between
  // an NHL and a PWHL route, without a full reload, unlike before this
  // fix when `pwhl` was static per mount), `season` needs to actively
  // RE-SEED whenever `pwhl` flips, not just once. The effect below does
  // that explicitly on every `pwhl` change (including the initial one),
  // rather than relying on `useState`'s initializer alone.
  const [season, setSeason] = useState(pwhl ? PWHL_CURRENT_SEASON : CURRENT_SEASON);
  useEffect(() => {
    setSeason(pwhl ? PWHL_CURRENT_SEASON : CURRENT_SEASON);
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
