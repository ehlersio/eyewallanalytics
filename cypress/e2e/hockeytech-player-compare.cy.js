// cypress/e2e/hockeytech-player-compare.cy.js
// AHL/ECHL player popup Compare tab (season-over-season stat cards + a
// per-game trend chart). Every Worker call the popup makes is stubbed --
// roster, landing, career, game log, and the season list -- so the spec
// doesn't depend on which seasons have data yet or on which Worker
// version is deployed.

const LEAGUES = [
  {
    key: 'ahl', label: 'AHL', team: { abbr: 'TOR', teamId: 335 },
    regular:  { seasonId: 90, startYear: 2025, label: '2025-26' },
    playoffs: { seasonId: 92, startYear: 2026, label: '2026 Playoffs' },
  },
  {
    key: 'echl', label: 'ECHL', team: { abbr: 'FLA', teamId: 8 },
    regular:  { seasonId: 73, startYear: 2025, label: '2025-26' },
    playoffs: { seasonId: 76, startYear: 2026, label: '2026 Kelly Cup Playoffs' },
  },
]

const PLAYER = { player_id: 6681, first_name: 'Alex', last_name: 'Skater', position: 'C', jersey_number: 19 }

function gameLog(count) {
  return Array.from({ length: count }, (_, i) => ({
    game_id: 1000 + i, player_id: PLAYER.player_id,
    goals: i % 2, assists: 1, points: (i % 2) + 1, shots: 3, penalty_minutes: 0, plus_minus: 0,
  }))
}

function stubWorker(L) {
  const statLines = {
    [L.regular.seasonId]:  { gp: 40, goals: 15, assists: 20, points: 35, plus_minus: 8, shots: 110, pim: 12 },
    [L.playoffs.seasonId]: { gp: 8,  goals: 3,  assists: 2,  points: 5,  plus_minus: 1, shots: 21,  pim: 4 },
  }
  const seasonOf = (req) => Number(new URL(req.url).searchParams.get('season'))

  cy.intercept('GET', '**/config/seasons/comparison', {
    [L.key]: {
      activeTeamCount: 30,
      seasons: [
        { seasonId: L.playoffs.seasonId, seasonType: 'playoffs', startYear: L.playoffs.startYear, teamCount: 16, comparable: false },
        { seasonId: L.regular.seasonId,  seasonType: 'regular',  startYear: L.regular.startYear,  teamCount: 30, comparable: true },
      ],
    },
  })
  cy.intercept('GET', `**/${L.key}/players?*`, {
    skaters: [], goalies: [], roster: [{ ...PLAYER, team_id: L.team.teamId }],
  })
  cy.intercept('GET', `**/${L.key}/player/landing?*`, (req) => {
    req.reply({ ...PLAYER, team_id: L.team.teamId, ...(statLines[seasonOf(req)] || {}) })
  })
  cy.intercept('GET', `**/${L.key}/player/career?*`, {
    player_id: PLAYER.player_id, regularSeason: null, playoffs: null, bioPoints: [], photo: null, draft: null, recentGames: [],
  })
  cy.intercept('GET', `**/${L.key}/player-game-log?*`, (req) => {
    req.reply({ skaters: gameLog(seasonOf(req) === L.playoffs.seasonId ? 8 : 40), goalies: [] })
  }).as('gameLog')
}

LEAGUES.forEach((L) => {
  describe(`${L.label} player popup — Compare tab`, () => {
    beforeEach(() => {
      stubWorker(L)
      cy.visit(`/${L.key}/players`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', L.key)
          win.localStorage.setItem(`eyewall:${L.key}_team`, JSON.stringify(L.team))
        },
      })
      cy.contains(PLAYER.first_name, { timeout: 10000 }).click()
      cy.get('.pp-tab').contains('🆚 Compare').click()
    })

    it('asks for seasons before showing a chart', () => {
      cy.contains('Select two or more seasons above to compare.').should('be.visible')
      cy.get('.xg-overlay-section').should('not.exist')
    })

    it('shows a per-game trend chart and a stat card for each selected season', () => {
      cy.contains('.season-chip', L.regular.label).click()
      cy.contains('.season-chip', L.playoffs.label).click()

      cy.get('.xg-overlay-section').within(() => {
        // Goals, Assists, Points, +/−, Shots, PIM -- the perGame skater stats
        cy.get('select option').should('have.length', 6)
        cy.get('svg.recharts-surface').should('exist')
      })
      // Each stat card's header is a (collapse-toggle) button carrying the
      // season label; the season chips are excluded so they can't satisfy this.
      cy.get('.player-popup button:not(.season-chip)').should('contain', L.regular.label)
      cy.get('.player-popup button:not(.season-chip)').should('contain', L.playoffs.label)
      cy.contains('No data for this player').should('not.exist')
      cy.assertNoErrors()
    })

    it('requests the game log with season= (the route ignores seasonId=)', () => {
      cy.contains('.season-chip', L.regular.label).click()
      cy.wait('@gameLog').its('request.url')
        .should('include', `season=${L.regular.seasonId}`)
        .and('not.include', 'seasonId=')
    })
  })
})
