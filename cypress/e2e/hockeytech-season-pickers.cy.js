// cypress/e2e/hockeytech-season-pickers.cy.js
// PWHL/AHL/ECHL season pickers offer only seasons the selected team has
// games in (#15, #33) and open on its newest one; AHL/ECHL upcoming away
// games read "Away", not "vs" (#34). Live Worker data, checked 2026-10-05:
// PWHL Detroit (10) has no games before 2026-27, Seattle (8) none before
// 2025-26 and no playoff games, AHL Hamilton (457) none before 2026-27.
// ECHL 2026-27 (78) is stubbed: its schedule reaches game_log once the
// pipeline ingests it, so the real answer changes on its own.

const visitAs = (path, league, team) => cy.visit(path, {
  onBeforeLoad(win) {
    win.localStorage.setItem('eyewall:sport', league)
    win.localStorage.setItem(`eyewall:${league}_team`, JSON.stringify(team))
  },
})

const DET = { abbr: 'DET', teamId: 10 }
const SEA = { abbr: 'SEA', teamId: 8 }
const HAM = { abbr: 'HAM', teamId: 457 }
const HER = { abbr: 'HER', teamId: 319 }
const ADK = { abbr: 'ADK', teamId: 74 }

const button = label => cy.contains('button', new RegExp(`^${label}$`), { timeout: DATA_TIMEOUT })

// Waits for the view's per-season schedule reads, so a "no button"
// assertion can't pass before the buttons would have appeared.
const waitForSeasonReads = (league, teamId, seasons) => {
  seasons.forEach(s => cy.intercept('GET', `**/${league}/schedule?teamId=${teamId}&season=${s}`).as(`s${s}`))
  return () => cy.wait(seasons.map(s => `@s${s}`), { timeout: DATA_TIMEOUT })
}

describe('PWHL expansion team (DET)', () => {
  it('Schedule opens on 2026-27 and offers no earlier season or Playoffs', () => {
    visitAs('/pwhl/schedule', 'pwhl', DET)
    cy.contains('h2', '2026-27', { timeout: DATA_TIMEOUT }).should('exist')
    button('2026-27').should('exist')
    ;['2025-26', '2024-25', '2023-24'].forEach(s => button(s).should('not.exist'))
    // Until Detroit's first playoff game.
    cy.contains('button', 'Playoffs').should('not.exist')
    cy.assertNoErrors()
  })

  it('Players stats offer no season it has not played', () => {
    const waitReads = waitForSeasonReads('pwhl', 10, [8, 5, 1])
    visitAs('/pwhl/players', 'pwhl', DET)
    waitReads()
    cy.contains('button', 'Stats', { timeout: DATA_TIMEOUT }).click()
    cy.contains(/No skater stats/i, { timeout: DATA_TIMEOUT }).should('exist')
    ;['2025-26', '2024-25', '2023-24'].forEach(s => button(s).should('not.exist'))
    cy.assertNoErrors()
  })

  it('Shot Map offers no season chip or Playoffs toggle', () => {
    const waitReads = waitForSeasonReads('pwhl', 10, [8, 9, 5, 6, 1, 3])
    visitAs('/pwhl/shots', 'pwhl', DET)
    waitReads()
    cy.contains(/No shot data/i, { timeout: DATA_TIMEOUT }).should('exist')
    ;['2025-26', '2024-25', '2023-24'].forEach(s => button(s).should('not.exist'))
    cy.get('.season-type-toggle').should('not.exist')
    cy.assertNoErrors()
  })
})

describe('PWHL Seattle (2025-26 only)', () => {
  it('Players stats offer 2025-26 alone', () => {
    visitAs('/pwhl/players', 'pwhl', SEA)
    cy.contains('button', 'Stats', { timeout: DATA_TIMEOUT }).click()
    button('2025-26').should('exist')
    ;['2024-25', '2023-24'].forEach(s => button(s).should('not.exist'))
  })

  it('Shot Map offers 2025-26 alone, with no Playoffs toggle', () => {
    visitAs('/pwhl/shots', 'pwhl', SEA)
    button('2025-26').should('exist')
    ;['2024-25', '2023-24'].forEach(s => button(s).should('not.exist'))
    cy.get('.season-type-toggle').should('not.exist')
  })
})

describe('AHL Hamilton (new in 2026-27)', () => {
  ;['/ahl/schedule', '/ahl/shots'].forEach(path => {
    it(`${path} offers 2026-27 and no season before it`, () => {
      visitAs(path, 'ahl', HAM)
      button('2026-27').should('exist')
      button('2025-26').should('not.exist')
      button('2026 Calder Cup Playoffs').should('not.exist')
      cy.assertNoErrors()
    })
  })

  it('Players stats offer 2026-27 alone', () => {
    visitAs('/ahl/players', 'ahl', HAM)
    cy.contains('button', 'Stats', { timeout: DATA_TIMEOUT }).click()
    button('2026-27').should('exist')
    button('2025-26').should('not.exist')
    button('2026 Calder Cup Playoffs').should('not.exist')
  })
})

describe('AHL schedule cards', () => {
  it('label an upcoming away game "Away", never "vs"', () => {
    visitAs('/ahl/schedule', 'ahl', HER)
    cy.contains('.card', /HER\s*Away/, { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('.card', /HER\s*Home/).should('exist')
    cy.contains('.card', /\bvs\b/).should('not.exist')
  })
})

describe('ECHL 2026-27 (#33)', () => {
  // HockeyTech's first two ADK games of 2026-27 (season 78, team 74).
  const game = o => ({ season_id: 78, home_score: 0, away_score: 0, period: null, ...o })
  const SEASON_78 = [
    game({ game_id: 25494, game_date: '2026-10-17', home_team_id: 74, away_team_id: 113, game_state: '7:00 pm EDT', venue_name: 'Harding Mazzotti Arena' }),
    game({ game_id: 25535, game_date: '2026-10-24', home_team_id: 113, away_team_id: 74, game_state: '6:00 pm EDT', venue_name: 'CURE Insurance Arena' }),
  ]

  it('offers no 2026-27 button while the team has no games in it', () => {
    cy.intercept('GET', '**/echl/schedule?teamId=74&season=78', []).as('s78')
    visitAs('/echl/schedule', 'echl', ADK)
    cy.wait('@s78')
    button('2025-26').should('exist')
    button('2026-27').should('not.exist')
    cy.assertNoErrors()
  })

  it('shows the 2026-27 schedule once it has games, and not on the stats views', () => {
    cy.intercept('GET', '**/echl/schedule?teamId=74&season=78', SEASON_78).as('s78')
    visitAs('/echl/schedule', 'echl', ADK)
    button('2026-27').click()
    cy.contains('.card', /ADK\s*Home\s*TRE/, { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('.card', /ADK\s*Away\s*TRE/).should('exist')

    // Nothing played yet: no stats season for it.
    visitAs('/echl/shots', 'echl', ADK)
    button('2025-26').should('exist')
    button('2026-27').should('not.exist')
    cy.assertNoErrors()
  })
})

// Contract C7: the AHL/ECHL season lists come from the Worker's
// /config/seasons/{league}-seasons at load (ahlConfig.js), not a list in
// the app, so the 2027 playoffs get a tab without an app release. Stubbed:
// the real list (fixtures/ahl-seasons-2026-10-07.json) plus a 2027 Calder
// Cup Playoffs season, and one HER game in it.
describe('AHL seasons from the Worker (C7)', () => {
  it('offers a season the app has never heard of, labelled as HockeyTech names it', () => {
    cy.fixture('ahl-seasons-2026-10-07.json').then(rows => {
      cy.intercept('GET', '**/config/seasons/ahl-seasons', [
        { seasonId: 96, seasonName: '2027 Calder Cup Playoffs', seasonType: 'playoffs', startYear: 2027, startDate: '2027-04-19', endDate: '2027-06-20' },
        ...rows,
      ]).as('ahlSeasons')
    })
    cy.intercept('GET', '**/ahl/schedule?teamId=319&season=96', [
      { game_id: 1099001, season_id: 96, game_date: '2027-04-23', home_team_id: 319, away_team_id: 384, home_score: 0, away_score: 0, game_state: '7:00 pm EDT', venue_name: 'Giant Center' },
    ]).as('s96')
    visitAs('/ahl/schedule', 'ahl', HER)
    cy.wait('@ahlSeasons')
    cy.wait('@s96', { timeout: DATA_TIMEOUT })
    button('2027 Calder Cup Playoffs').click()
    cy.contains('.card', /HER\s*Home\s*CLT/, { timeout: DATA_TIMEOUT }).should('exist')
    button('2025-26').should('exist')
    cy.assertNoErrors()
  })
})
