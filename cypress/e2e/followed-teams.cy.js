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
