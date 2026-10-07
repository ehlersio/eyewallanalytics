// cypress/support/hockeytech.js
// Shared fixtures and helpers for the AHL/ECHL route specs
// (cypress/e2e/hockeytech-{league,schedule,players,team,news,shots}.cy.js),
// split from hockeytech-routes.cy.js so each tab group runs and shards on
// its own.
//
// Smoke coverage for the AHL/ECHL tabs: it checks that each route renders
// its own league's page (not just *a* page): league logos come from
// assets.leaguestat.com/<league>/logos/, and the standings divisions, news
// footer and team names differ per league.
//
// Live Worker data, checked 2026-10-06: AHL 2026-27 (94) and ECHL 2025-26
// (73) standings have a row for every team, both schedules have games.

export const LEAGUES = [
  {
    key: 'ahl',
    label: 'AHL',
    team: { abbr: 'HER', teamId: 319 },
    teamName: 'Hershey Bears',
    divisions: ['Atlantic', 'North', 'Central', 'Pacific'],
    newsFooter: /TheAHL\.com/,
    newsSources: { 'official-ahl': 'TheAHL.com', 'hockeywriters-ahl': 'The Hockey Writers', 'osc-ahl': 'OurSports Central' },
    // A real game (Worker /ahl/preview and /ahl/prediction answer for it).
    // A completed 2025-26 game for the prediction-outcome check.
    final: { game_id: 1027785 },
    upcoming: { game_id: 1029113, season_id: 94, game_date: '2026-10-10', home_team_id: 319, away_team_id: 380, venue_name: 'Giant Center' },
  },
  {
    key: 'echl',
    label: 'ECHL',
    team: { abbr: 'ADK', teamId: 74 },
    teamName: 'Adirondack Thunder',
    divisions: ['North', 'South', 'Central', 'Mountain'],
    newsFooter: /The Hockey Writers and OurSports Central/,
    newsSources: { 'hockeywriters-echl': 'The Hockey Writers', 'osc-echl': 'OurSports Central' },
    final: { game_id: 24323 },
    upcoming: { game_id: 25494, season_id: 78, game_date: '2026-10-17', home_team_id: 74, away_team_id: 113, venue_name: 'Harding Mazzotti Arena' },
  },
]

export const visitAs = (path, league, team) => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('eyewall:sport', league)
      win.localStorage.setItem(`eyewall:${league}_team`, JSON.stringify(team))
    },
  })
  cy.get('.topbar', { timeout: 10000 }).should('exist')
}

// The league's own logo, not a fallback badge or another league's art.
export const leagueLogo = (key, abbr) => `img[alt="${abbr}"][src*="/${key}/logos/"]`

// No error card or message once the page has settled.
export const assertNoLoadFailure = () => {
  cy.get('#main-content').should('not.contain.text', 'Failed to load')
  cy.get('#main-content').should('not.contain.text', "Couldn't load")
  cy.get('.news-error').should('not.exist')
  cy.assertNoErrors()
}
