// src/utils/pageClasses.js
// Shared Tailwind class constant for index.css's .page (Phase 7b) -- the
// app-wide scrollable content container directly under Topbar/above
// BottomNav. Genuinely identical across all 10 real consumers (ShotMapView/
// PWHLShotMapView/TeamView/PWHLTeamView/PlayersView/PWHLPlayersView/
// ScheduleView/PWHLScheduleView/NewsView/PWHLNewsView -- confirmed via
// literal-string grep AND template-literal interpolation grep, since
// NewsView.jsx/PWHLNewsView.jsx use `${NEWS_VIEW_CLASSES} page`, not a bare
// literal), so this lives in one module rather than duplicated 10x, same
// precedent as newsViewClasses.js.
//
// height: calc(100vh - var(--topbar-height) - var(--nav-height)) already has
// a proven live precedent as a Tailwind arbitrary value -- DevReplayView.jsx/
// PWHLDevReplayView.jsx's DEV_REPLAY_CLASSES used the identical formula
// since Phase 4. --topbar-height (54px) has exactly one consumer besides
// this: Topbar.jsx's own height. --nav-height (52px) has three: this,
// App.jsx's .app-main padding-bottom, and BottomNav.css's .bottom-nav height
// calc (the still-open WebKit regression -- untouched here, this only reads
// the same --nav-height token, doesn't redefine it).
//
// No light-mode override (checked light-mode-overrides.css) and no Cypress
// selector dependency (checked cypress/e2e/*.js) -- clean conversion, no
// marker class needed.
export const PAGE_CLASSES = 'h-[calc(100vh-var(--topbar-height)-var(--nav-height))] overflow-y-auto p-3.5 max-[700px]:p-2.5';
