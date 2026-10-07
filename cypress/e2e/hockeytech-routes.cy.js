// cypress/e2e/hockeytech-routes.cy.js
//
// Smoke coverage for the AHL/ECHL tabs that had no spec at all: League,
// Schedule, News and Shot Map. ahl-team/echl-team cover the Team tab and
// hockeytech-season-pickers the season chips; this is the safety net for
// folding the AHL*/ECHL* copies into shared HockeyTech views, so it checks
// that each route renders its own league's page (not just *a* page):
// league logos come from assets.leaguestat.com/<league>/logos/, and the
// standings divisions, news footer and team names differ per league.
//
// Live Worker data, checked 2026-10-06: AHL 2026-27 (94) and ECHL 2025-26
// (73) standings have a row for every team, both schedules have games.

const LEAGUES = [
  {
    key: 'ahl',
    label: 'AHL',
    team: { abbr: 'HER', teamId: 319 },
    teamName: 'Hershey Bears',
    divisions: ['Atlantic', 'North', 'Central', 'Pacific'],
    newsFooter: /TheAHL\.com/,
  },
  {
    key: 'echl',
    label: 'ECHL',
    team: { abbr: 'ADK', teamId: 74 },
    teamName: 'Adirondack Thunder',
    divisions: ['North', 'South', 'Central', 'Mountain'],
    newsFooter: /The Hockey Writers and OurSports Central/,
  },
]

const visitAs = (path, league, team) => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('eyewall:sport', league)
      win.localStorage.setItem(`eyewall:${league}_team`, JSON.stringify(team))
    },
  })
  cy.get('.topbar', { timeout: 10000 }).should('exist')
}

// The league's own logo, not a fallback badge or another league's art.
const leagueLogo = (key, abbr) => `img[alt="${abbr}"][src*="/${key}/logos/"]`

// No error card or message once the page has settled.
const assertNoLoadFailure = () => {
  cy.get('#main-content').should('not.contain.text', 'Failed to load')
  cy.get('#main-content').should('not.contain.text', "Couldn't load")
  cy.get('.news-error').should('not.exist')
  cy.assertNoErrors()
}

LEAGUES.forEach(({ key, label, team, teamName, divisions, newsFooter }) => {
  describe(`${label} routes smoke`, () => {
    it(`/${key}/league renders the Scoreboard, then ${label} standings by division`, () => {
      visitAs(`/${key}/league`, key, team)
      cy.get('.league-view').should('exist')
      cy.get('.league-tab').eq(0).should('contain', 'Scoreboard')
      cy.get('.league-tab').contains('Standings').click()
      cy.get('.lv-div-card', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      cy.get('.lv-div-card').first().invoke('text').then(text => {
        expect(divisions.some(d => text.startsWith(d)), `first division of ${text.slice(0, 20)}`).to.equal(true)
      })
      cy.get('.lv-div-card').find(leagueLogo(key, team.abbr)).should('exist')
      cy.get('.league-tab').contains('Leaders').click()
      cy.get('body', { timeout: DATA_TIMEOUT }).should($body => {
        const settled = $body.find('.lv-leaders-card').length > 0
          || /No leader data available/.test($body.text())
        expect(settled, 'leaders cards or the leaders empty state').to.equal(true)
      })
      assertNoLoadFailure()
    })

    it(`/${key}/schedule renders the ${team.abbr} schedule`, () => {
      visitAs(`/${key}/schedule`, key, team)
      cy.contains('h2', 'Schedule', { timeout: DATA_TIMEOUT })
        .find(leagueLogo(key, team.abbr)).should('exist')
      cy.contains('p', teamName).should('exist')
      cy.get('#main-content', { timeout: DATA_TIMEOUT }).should($main => {
        const cards = $main.find('.card.cursor-pointer').length
        const empty = /No games found\./.test($main.text())
        expect(cards > 0 || empty, 'game cards or the empty state').to.equal(true)
      })
      assertNoLoadFailure()
    })

    it(`/${key}/news renders ${label} News`, () => {
      visitAs(`/${key}/news`, key, team)
      cy.contains(`${label} News`, { timeout: DATA_TIMEOUT }).should('be.visible')
      cy.contains(newsFooter).should('exist')
      cy.get('body', { timeout: DATA_TIMEOUT }).should($body => {
        const settled = $body.find('.news-feed .news-card').length > 0
          || $body.find('.news-empty').length > 0
          || $body.find('.news-error').length > 0
        expect(settled, 'news cards, the empty state or an error').to.equal(true)
      })
      assertNoLoadFailure()
    })

    it(`/${key}/shots renders the ${team.abbr} shot map`, () => {
      visitAs(`/${key}/shots`, key, team)
      cy.contains('h2', 'Shot Map', { timeout: DATA_TIMEOUT })
        .find(leagueLogo(key, team.abbr)).should('exist')
      cy.get('[data-tour="rink"]', { timeout: DATA_TIMEOUT }).should($rink => {
        const hasRink = $rink.find('svg').length > 0
        const noData = /No shot data|Shot data for this game isn't in yet/.test($rink.text())
        expect(hasRink || noData, 'the rink or its no-data message').to.equal(true)
      })
      assertNoLoadFailure()
    })
  })
})
