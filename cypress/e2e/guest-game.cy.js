// cypress/e2e/guest-game.cy.js
// Following a Scoreboard game as either team, without changing the
// favorite: a live NHL game's team rows open /game/:gameId?as=, the game
// view from that team's side (GuestGameView.jsx / GameTeamContext.jsx).
//
// The Scoreboard is stubbed so there's always a live game to tap. The
// guest view itself loads real data: 2026010036 is TOR's preseason win at
// OTT on 2026-09-23, so the view shows that game's final from TOR's side.

const GUEST_GAME_ID = 2026010036
const TODAY = [
  { gameId: GUEST_GAME_ID, gameDate: '2026-09-23', homeTeamCode: 'OTT', awayTeamCode: 'TOR',
    homeScore: 2, awayScore: 4, status: 'live', period: 3, periodType: 'REG', clock: '05:00', inIntermission: false },
  { gameId: 2026010099, gameDate: '2026-09-23', homeTeamCode: 'CAR', awayTeamCode: 'NSH',
    homeScore: 1, awayScore: 0, status: 'live', period: 2, periodType: 'REG', clock: '12:00', inIntermission: false },
  { gameId: 2026010098, gameDate: '2026-09-23', homeTeamCode: 'PHI', awayTeamCode: 'BOS',
    homeScore: 0, awayScore: 0, status: 'pre', startTimeUTC: '2026-09-23T23:00:00Z' },
]

const teamPrimary = win => win.getComputedStyle(win.document.documentElement).getPropertyValue('--team-primary').trim()

describe('Scoreboard → guest game view', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/nhl/today', TODAY).as('today')
    cy.visit('/league')
    cy.wait('@today')
  })

  it('makes only live games’ team rows tappable', () => {
    cy.get('.scoreboard-team-link').should('have.length', 4)
    cy.contains('.scoreboard-team-link', 'Flyers').should('not.exist')
    cy.contains('.scoreboard-team-link', 'Bruins').should('not.exist')
  })

  it('sends the favorite’s own row to the favorite’s view', () => {
    cy.contains('.scoreboard-team-link', 'Canes').should('have.attr', 'href', '/')
    cy.contains('.scoreboard-team-link', 'Predators')
      .should('have.attr', 'href', '/game/2026010099?as=NSH')
  })

  it('opens the game from the tapped team’s side and leaves the favorite alone', () => {
    cy.window().then(win => cy.wrap(teamPrimary(win)).as('favoriteColor'))
    cy.contains('.scoreboard-team-link', 'Maple Leafs').click()

    cy.location('pathname').should('eq', `/game/${GUEST_GAME_ID}`)
    cy.location('search').should('eq', '?as=TOR')
    cy.get('.guest-game-bar').should('contain', 'Viewing as TOR')
    cy.get('.score-card', { timeout: DATA_TIMEOUT }).should('contain', 'TOR').and('contain', 'OTT')
    // One game, not TOR's season: no season or game pickers.
    cy.get('.season-selector').should('not.exist')

    cy.get('@favoriteColor').then(favoriteColor => {
      cy.window().then(win => expect(teamPrimary(win)).not.to.eq(favoriteColor))
    })
    cy.window().then(win => {
      expect(JSON.parse(win.localStorage.getItem('eyewall:team')).abbr).to.eq('CAR')
    })

    cy.get('.guest-game-back').should('contain', 'Back to CAR').click()
    cy.location('pathname').should('eq', '/')
    cy.get('.guest-game-bar').should('not.exist')
    cy.get('@favoriteColor').then(favoriteColor => {
      cy.window().then(win => expect(teamPrimary(win)).to.eq(favoriteColor))
    })
  })
})

describe('Guest game links', () => {
  it('redirects a link it can’t open to the favorite’s view', () => {
    for (const path of [`/game/${GUEST_GAME_ID}`, `/game/${GUEST_GAME_ID}?as=XYZ`, '/game/abc?as=TOR', `/game/${GUEST_GAME_ID}?as=CAR`]) {
      cy.visit(path)
      cy.location('pathname').should('eq', '/')
      cy.get('.guest-game-bar').should('not.exist')
    }
  })
})

describe('Other leagues’ Scoreboards', () => {
  it('leave team rows untappable -- their game views don’t take a guest team', () => {
    cy.setPWHLTeam('BOS')
    cy.intercept('GET', '**/pwhl/today*', [
      { gameId: 900, gameDate: '2026-09-23', homeTeamCode: 'BOS', awayTeamCode: 'MTL',
        homeScore: 1, awayScore: 1, status: 'live', period: 2, clock: '10:00', inIntermission: false },
    ]).as('pwhlToday')
    cy.visit('/pwhl/league')
    cy.wait('@pwhlToday')
    cy.contains('LIVE').should('exist')
    cy.get('.scoreboard-team-link').should('not.exist')
  })
})
