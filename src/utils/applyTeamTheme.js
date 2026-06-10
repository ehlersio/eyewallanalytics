// src/utils/applyTeamTheme.js
// Applies team color tokens to :root CSS custom properties.
//
// Usage:
//   import { applyTeamTheme } from './applyTeamTheme';
//   applyTeamTheme(team);           // dark mode (default)
//   applyTeamTheme(team, 'light');  // light mode
//
// Called once on app mount and again whenever the user switches teams or theme.

/**
 * @param {object} team  — a team object from ALL_TEAMS (must have primaryColor + displayColor)
 * @param {'dark'|'light'} [mode='dark']
 */
export function applyTeamTheme(team, mode = 'dark') {
  const root = document.documentElement;

  // Apply the data-theme attribute so the CSS token block kicks in
  root.setAttribute('data-theme', mode);

  // --team-primary: mode-aware — primaryColor on light, displayColor on dark
  const color = mode === 'light' ? team.primaryColor : team.displayColor;
  root.style.setProperty('--team-primary', color);

  // --team-primary-rgb: comma-separated R,G,B for rgba() tints in CSS
  // e.g. rgba(var(--team-primary-rgb), 0.12)
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  root.style.setProperty('--team-primary-rgb', `${r},${g},${b}`);

  // --team-canvas: always uses displayColor regardless of app theme —
  // export cards (PredictionCanvas, PeriodSummary share canvas) are always
  // rendered on a hardcoded dark background, so they always need the
  // WCAG AA-compliant dark mode color, never the light mode primaryColor.
  root.style.setProperty('--team-canvas', team.displayColor);
  const ch = team.displayColor.replace('#', '');
  const cr = parseInt(ch.slice(0, 2), 16);
  const cg = parseInt(ch.slice(2, 4), 16);
  const cb = parseInt(ch.slice(4, 6), 16);
  root.style.setProperty('--team-canvas-rgb', `${cr},${cg},${cb}`);
}
