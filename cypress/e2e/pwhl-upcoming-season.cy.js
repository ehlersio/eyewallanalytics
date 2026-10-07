// cypress/e2e/pwhl-upcoming-season.cy.js
// The PWHL Schedule offers the upcoming season (/config/seasons pwhl.next,
// served by eyewall-poller since 2026-10) once the selected team has games
// in it, and labels a season with no hand-written PWHL_SEASONS entry from
// its start year ("2026-27", never "11"). /config/seasons and the season-11
// schedule are stubbed: the deployed Worker may predate `next`, and season
// 11's games only reach pwhl_game_log once the pipeline ingests them. The
// stubbed games are HockeyTech's real 2026-27 opener (SEA @ VAN, Dec 5,
// game 365) and the next SEA game it listed on 2026-10-01.

const SEA = { abbr: 'SEA', teamId: 8 }

const PRESEASON_10 = { seasonId: 10, seasonType: 'preseason', startYear: 2026, startDate: '2026-10-01' }
const BEFORE_SWITCH = {
  seasonId: 8, seasonType: 'regular', startYear: 2025, startDate: '2025-11-21', source: 'live',
  next: { seasonId: 11, seasonType: 'regular', startYear: 2026, startDate: '2026-12-04', preseason: PRESEASON_10 },
  preseason: { seasonId: 7, seasonType: 'preseason', startYear: 2025, startDate: '2025-06-01' },
}
const AFTER_SWITCH = {
  seasonId: 11, seasonType: 'regular', startYear: 2026, startDate: '2026-12-04', source: 'live',
  next: null, preseason: PRESEASON_10,
}

const game = (o) => ({
  season_id: 11, home_score: 0, away_score: 0, period: null, ot: false, shootout: false,
  game_status_code: null, date_with_day: null, ...o,
})
const SEASON_11_SEA = [
  game({ game_id: 365, game_date: '2026-12-05', home_team_id: 9, away_team_id: 8, game_state: '3:00 pm EST', venue_name: 'Pacific Coliseum', venue_city: 'Vancouver' }),
  game({ game_id: 369, game_date: '2026-12-09', home_team_id: 8, away_team_id: 4, game_state: '10:00 pm EST', venue_name: 'Climate Pledge Arena', venue_city: 'Seattle' }),
]

function visitSchedule({ pwhl, season11, extra = {} }) {
  cy.intercept('GET', '**/config/seasons', {
    nhl: { seasonId: '20262027' },
    pwhl,
    ahl: { seasonId: 94, seasonType: 'regular' },
    echl: { seasonId: 73, seasonType: 'regular' },
  }).as('seasons')
  cy.intercept('GET', '**/pwhl/schedule?teamId=8&season=11', season11).as('season11')
  cy.intercept('GET', '**/pwhl/standings?season=11', []).as('standings11')
  Object.entries(extra).forEach(([season, rows]) => {
    cy.intercept('GET', `**/pwhl/schedule?teamId=8&season=${season}`, rows).as(`season${season}`)
  })
  cy.visit('/pwhl/schedule', {
    onBeforeLoad(win) {
      win.localStorage.setItem('eyewall:sport', 'pwhl')
      win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify(SEA))
    },
  })
  cy.get('.topbar', { timeout: 10000 }).should('exist')
  cy.wait('@seasons')
}

describe('PWHL Schedule — upcoming season', () => {
  it('offers 2026-27 next to the current season once the team has games in it', () => {
    visitSchedule({ pwhl: BEFORE_SWITCH, season11: SEASON_11_SEA })
    cy.wait('@season11')

    // The current season stays the default.
    cy.contains('h2', '2025-26 Schedule', { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('button', /^2026-27$/, { timeout: DATA_TIMEOUT }).should('exist').click()

    cy.contains('h2', '2026-27 Schedule').should('exist')
    cy.contains('.card', 'VAN', { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('.card', 'NY').should('exist')
    cy.contains('No games found').should('not.exist')
    cy.assertNoErrors()

    // Back to the current season.
    cy.contains('button', /^2025-26$/).click()
    cy.contains('h2', '2025-26 Schedule').should('exist')
  })

  // The Elo chip (contract C6): only on a row the Worker gives `winProb`.
  it('shows the Elo win-probability chip only on games with a win probability', () => {
    const [first, second] = SEASON_11_SEA
    visitSchedule({ pwhl: BEFORE_SWITCH, season11: [{ ...first, winProb: { home: 0.58, away: 0.42, source: 'elo' } }, second] })
    cy.wait('@season11')
    cy.contains('button', /^2026-27$/, { timeout: DATA_TIMEOUT }).click()
    cy.contains('.card', 'VAN', { timeout: DATA_TIMEOUT }).should('exist')
    // SEA is away at VAN: VAN .58 is the more likely winner.
    cy.get('[data-testid="win-prob-chip"]').should('have.length', 1)
      .and('have.text', '⚠ VAN 58%')
      .and('have.attr', 'title', 'Elo win probability: VAN 58% likely to win')
    cy.contains('.card', 'NY').find('[data-testid="win-prob-chip"]').should('not.exist')
    cy.assertNoErrors()
  })

  it('offers no 2026-27 button while the team has no games in it', () => {
    visitSchedule({ pwhl: BEFORE_SWITCH, season11: [] })
    cy.wait('@season11')
    cy.contains('button', /^2025-26$/, { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('button', /^2026-27$/).should('not.exist')
    cy.assertNoErrors()
  })

  it('labels the new season from its start year once it is current', () => {
    visitSchedule({ pwhl: AFTER_SWITCH, season11: SEASON_11_SEA })

    cy.contains('h2', '2026-27 Schedule', { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('h2', /\b11 Schedule/).should('not.exist')
    // One 2026-27 button (the current season), not a second "upcoming" one.
    cy.get('button').filter((_, el) => el.textContent.trim() === '2026-27').should('have.length', 1)
    cy.contains('.card', 'VAN', { timeout: DATA_TIMEOUT }).should('exist')
    cy.assertNoErrors()
  })

  // A year on, with no pwhlConfig.js edit: the 2027-28 preseason (a
  // hypothetical id 13) is offered -- and selected -- once SEA has games
  // in it, beside the hand-listed 2026-27 one.
  it('offers a new preseason, labelled from data, once the team has games in it', () => {
    visitSchedule({
      pwhl: {
        ...AFTER_SWITCH,
        next: {
          seasonId: 14, seasonType: 'regular', startYear: 2027, startDate: '2027-11-20',
          preseason: { seasonId: 13, seasonType: 'preseason', startYear: 2027, startDate: '2027-10-01' },
        },
      },
      season11: SEASON_11_SEA,
      extra: {
        13: [game({ season_id: 13, game_id: 401, game_date: '2027-11-13', home_team_id: 8, away_team_id: 9, game_state: '7:00 pm EST', venue_name: 'Climate Pledge Arena' })],
        14: [],
      },
    })
    cy.wait('@season13')
    cy.contains('button', 'Preseason').first().click()
    cy.contains('button', '2027-28 Preseason', { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('button', '2026-27 Preseason').should('exist')
    cy.contains('.card', 'VAN', { timeout: DATA_TIMEOUT }).should('exist')
    // 2027-28 has no SEA games yet: no button for it on the Regular Season tab.
    cy.contains('button', 'Regular Season').click()
    cy.contains('button', /^2027-28$/).should('not.exist')
    cy.assertNoErrors()
  })
})
