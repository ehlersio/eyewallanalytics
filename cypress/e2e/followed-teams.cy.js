// cypress/e2e/followed-teams.cy.js
// Following teams from any league (Settings > Your teams / Add a team;
// utils/followedTeams.js). The primary team is still the one the app runs
// as; tapping another followed team switches to it, with a reload.
// Signed out here: the account sync is covered by the unit tests.

const followed = win => JSON.parse(win.localStorage.getItem('eyewall:followed') || 'null')

function openYourTeams() {
  cy.get('button.notif-bell').click()
  cy.get('.settings-manage-teams').click()
  cy.contains('.notif-title', 'Your teams').should('be.visible')
}

describe('Following teams', () => {
  beforeEach(() => {
    cy.setTeam('CAR')
    cy.visit('/')
  })

  it('starts an existing user out following just their team', () => {
    cy.get('button.notif-bell').click()
    cy.get('.settings-team-row').should('have.length', 1).and('contain', 'Carolina Hurricanes').and('contain', 'Primary')
  })

  it('follows a team from another league, and lists it in Settings', () => {
    openYourTeams()
    cy.get('.settings-add-team').click()
    cy.get('.settings-league-pwhl').click()
    cy.contains('.settings-add-row', 'Minnesota Frost').find('.settings-follow-btn').click()
    cy.contains('.settings-add-row', 'Minnesota Frost').should('contain', 'Following')
    cy.window().then(win => {
      expect(followed(win)).to.deep.equal([{ sport: 'nhl', abbr: 'CAR' }, { sport: 'pwhl', abbr: 'MIN' }])
    })
    cy.get('.settings-back').click()
    cy.get('.settings-back').click()
    cy.get('.settings-team-row').should('have.length', 2)
    cy.contains('.settings-team-switch', 'Minnesota Frost').should('exist')
  })

  it('searches every league at once', () => {
    openYourTeams()
    cy.get('.settings-add-team').click()
    cy.get('.settings-team-search').type('hershey')
    cy.get('.settings-add-row').should('have.length', 1).and('contain', 'Hershey Bears').and('contain', 'AHL')
    cy.get('.settings-team-search').clear().type('zzzz')
    cy.contains('No teams match').should('be.visible')
  })

  it('reorders and unfollows, but never removes the primary', () => {
    cy.window().then(win => win.localStorage.setItem('eyewall:followed', JSON.stringify([
      { sport: 'nhl', abbr: 'CAR' }, { sport: 'pwhl', abbr: 'MIN' }, { sport: 'ahl', abbr: 'HER' },
    ])))
    openYourTeams()
    cy.contains('.settings-manage-row', 'Carolina Hurricanes').find('.settings-unfollow').should('be.disabled')
    cy.contains('.settings-manage-row', 'Hershey Bears').find('.settings-move-up').click()
    cy.window().then(win => {
      expect(followed(win).map(t => t.abbr)).to.deep.equal(['CAR', 'HER', 'MIN'])
    })
    cy.contains('.settings-manage-row', 'Minnesota Frost').find('.settings-unfollow').click()
    cy.get('.settings-manage-row').should('have.length', 2)
    cy.window().then(win => {
      expect(followed(win).map(t => t.abbr)).to.deep.equal(['CAR', 'HER'])
    })
  })

  it('tapping another followed team switches to it, and keeps the list', () => {
    cy.window().then(win => win.localStorage.setItem('eyewall:followed', JSON.stringify([
      { sport: 'nhl', abbr: 'CAR' }, { sport: 'pwhl', abbr: 'MIN' },
    ])))
    cy.get('button.notif-bell').click()
    cy.contains('.settings-team-switch', 'Minnesota Frost').click()
    cy.location('pathname', { timeout: DATA_TIMEOUT }).should('eq', '/pwhl/shots')
    cy.window().then(win => {
      expect(win.localStorage.getItem('eyewall:sport')).to.equal('pwhl')
      expect(JSON.parse(win.localStorage.getItem('eyewall:pwhl_team')).abbr).to.equal('MIN')
      expect(followed(win).map(t => t.abbr)).to.deep.equal(['CAR', 'MIN'])
    })
    cy.get('button.notif-bell').click()
    cy.contains('.settings-team-row', 'Minnesota Frost').should('contain', 'Primary')
  })

  it('the star makes a team primary', () => {
    cy.window().then(win => win.localStorage.setItem('eyewall:followed', JSON.stringify([
      { sport: 'nhl', abbr: 'CAR' }, { sport: 'nhl', abbr: 'BOS' },
    ])))
    openYourTeams()
    cy.contains('.settings-manage-row', 'Boston Bruins').find('.settings-make-primary').click()
    cy.location('pathname', { timeout: DATA_TIMEOUT }).should('eq', '/')
    cy.window().its('localStorage').invoke('getItem', 'eyewall:team').should('contain', '"BOS"')
  })
})

describe('Alerts for every followed team', () => {
  const alertTeams = win => JSON.parse(win.localStorage.getItem('eyewall:notif:teams') || '{}')

  beforeEach(() => {
    cy.setTeam('CAR')
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:followed', JSON.stringify([
          { sport: 'nhl', abbr: 'CAR' }, { sport: 'pwhl', abbr: 'MIN' },
        ]))
      },
    })
    cy.get('button.notif-bell').click()
    cy.get('.settings-alerts-row').should('contain', '2 teams').click()
  })

  it('shows one team’s alerts at a time, starting with the primary', () => {
    cy.get('.settings-alert-team-nhl-CAR').should('have.attr', 'aria-checked', 'true')
    cy.get('.settings-pref-periodEnd').should('exist')
    // The primary's alerts are the main on/off, not a switch of their own.
    cy.get('.settings-team-alerts').should('not.exist')
  })

  it('lists only the alert types a team’s league sends', () => {
    cy.get('.settings-alert-team-pwhl-MIN').click().should('have.attr', 'aria-checked', 'true')
    cy.get('.settings-pref-goal').should('exist')
    cy.get('.settings-pref-periodEnd').should('not.exist')
  })

  it('keeps each team’s choices separately', () => {
    cy.get('.settings-alert-team-pwhl-MIN').click()
    cy.get('.settings-pref-goal [role=switch]').click().should('have.attr', 'aria-checked', 'false')
    cy.get('.settings-alert-team-nhl-CAR').click()
    cy.get('.settings-pref-goal [role=switch]').should('have.attr', 'aria-checked', 'true')
    cy.window().then(win => {
      expect(alertTeams(win)['PWHL:MIN'].prefs.goal).to.equal(false)
    })
  })

  it('turns another team’s alerts off without touching the primary’s', () => {
    cy.get('.settings-alert-team-pwhl-MIN').click()
    cy.get('.settings-team-alerts [role=switch]').click().should('have.attr', 'aria-checked', 'false')
    cy.get('.settings-pref-goal').should('not.exist')
    cy.window().then(win => {
      expect(alertTeams(win)['PWHL:MIN'].on).to.equal(false)
    })
  })
})

describe('Top-bar team switcher', () => {
  const followTwo = win => win.localStorage.setItem('eyewall:followed', JSON.stringify([
    { sport: 'nhl', abbr: 'CAR' }, { sport: 'pwhl', abbr: 'MIN' },
  ]))

  it('isn’t shown when following just one team', () => {
    cy.setTeam('CAR')
    cy.visit('/')
    cy.get('button.notif-bell').should('exist')
    cy.get('button.team-switcher').should('not.exist')
  })

  it('lists the followed teams, the current one marked, and switches to another', () => {
    cy.setTeam('CAR')
    cy.visit('/', { onBeforeLoad: followTwo })
    cy.get('button.team-switcher').click()
    cy.contains('.team-switcher-row', 'Carolina Hurricanes').should('contain', 'Current')
    cy.contains('button.team-switcher-row', 'Minnesota Frost').click()
    cy.location('pathname', { timeout: DATA_TIMEOUT }).should('eq', '/pwhl/shots')
    cy.window().its('localStorage').invoke('getItem', 'eyewall:sport').should('eq', 'pwhl')
    cy.get('button.team-switcher').click()
    cy.contains('.team-switcher-row', 'Minnesota Frost').should('contain', 'Current')
  })

  // 2026-10-09: an AHL team's pages showed the PWHL primary's logo.
  it('shows the team whose pages are on screen, not a primary from another league', () => {
    cy.visit('/ahl/shots', {
      onBeforeLoad: win => {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'MIN' }))
        win.localStorage.setItem('eyewall:ahl_team', JSON.stringify({ abbr: 'CHI' }))
        win.localStorage.setItem('eyewall:followed', JSON.stringify([
          { sport: 'pwhl', abbr: 'MIN' }, { sport: 'ahl', abbr: 'CHI' },
        ]))
      },
    })
    cy.get('button.team-switcher').should('have.attr', 'aria-label').and('contain', 'Chicago Wolves')
    cy.get('button.team-switcher').click()
    cy.contains('.team-switcher-row', 'Chicago Wolves').should('contain', 'Current')
    cy.contains('button.team-switcher-row', 'Minnesota Frost').should('exist')
  })

  it('Manage teams opens Settings on Your teams', () => {
    cy.setTeam('CAR')
    cy.visit('/', { onBeforeLoad: followTwo })
    cy.get('button.team-switcher').click()
    cy.get('.team-switcher-manage').click()
    cy.get('.team-switcher-panel').should('not.exist')
    cy.contains('.notif-popup .notif-title', 'Your teams').should('be.visible')
  })
})

describe('Team switcher: watch a followed team’s live game', () => {
  // TOR's preseason win at OTT on 2026-09-23, stubbed as live today --
  // the same real game guest-game.cy.js opens.
  const GAME_ID = 2026010036
  const TODAY = [
    { gameId: GAME_ID, gameDate: '2026-09-23', homeTeamCode: 'OTT', awayTeamCode: 'TOR',
      homeScore: 2, awayScore: 4, status: 'live', period: 3, periodType: 'REG', clock: '05:00', inIntermission: false },
  ]
  const follow = list => win => win.localStorage.setItem('eyewall:followed', JSON.stringify(list))

  beforeEach(() => cy.intercept('GET', '**/nhl/today', TODAY).as('today'))

  it('offers Live for a followed NHL team that’s playing, and opens it from their side', () => {
    cy.setTeam('CAR')
    cy.visit('/', { onBeforeLoad: follow([{ sport: 'nhl', abbr: 'CAR' }, { sport: 'nhl', abbr: 'TOR' }, { sport: 'pwhl', abbr: 'MIN' }]) })
    cy.get('button.team-switcher').click()
    cy.wait('@today')
    cy.get('.team-switcher-watch').should('have.length', 1)
      .and('have.attr', 'href', `/game/${GAME_ID}?as=TOR`)
      .click()
    cy.location('pathname').should('eq', `/game/${GAME_ID}`)
    cy.get('.guest-game-bar').should('contain', 'Viewing as TOR')
    // Watching, not switching: the saved team is still CAR.
    cy.window().then(win => expect(JSON.parse(win.localStorage.getItem('eyewall:team')).abbr).to.eq('CAR'))
  })

  it('offers nothing to watch while the primary team isn’t NHL', () => {
    cy.setPWHLTeam('MIN')
    cy.visit('/pwhl/shots', { onBeforeLoad: follow([{ sport: 'pwhl', abbr: 'MIN' }, { sport: 'nhl', abbr: 'TOR' }]) })
    cy.get('button.team-switcher').click()
    cy.contains('button.team-switcher-row', 'Toronto Maple Leafs').should('exist')
    cy.get('.team-switcher-watch').should('not.exist')
  })
})
