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

LEAGUES.forEach(({ key, label, team, teamName, divisions, newsFooter, newsSources, upcoming, final }) => {
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

    // HockeyTechLeagueView's leader rows open the league's player popup.
    it(`/${key}/league leader rows open the ${label} player popup`, () => {
      visitAs(`/${key}/league`, key, team)
      cy.get('.league-tab').contains('Leaders').click()
      cy.get('.lv-leaders-row', { timeout: DATA_TIMEOUT }).first().then($row => {
        const name = $row.find('span').eq(1).text()
        cy.wrap($row).click()
        cy.get('.pp-last', { timeout: DATA_TIMEOUT }).should($last => {
          expect(name).to.contain($last.text())
        })
      })
      cy.get('.pp-tab').should('have.length.at.least', 2)
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

    // Calendar cells and the box-score table (HockeyTechCalendarView /
    // HockeyTechBoxScoreTable). Date is pinned to mid-January so the
    // calendar opens on a month of the completed 2025-26 season.
    it(`/${key}/schedule calendar opens a 2025-26 box score`, () => {
      cy.clock(new Date('2026-01-15T17:00:00Z').getTime(), ['Date'])
      visitAs(`/${key}/schedule`, key, team)
      cy.contains('button', /^2025-26$/, { timeout: DATA_TIMEOUT }).click()
      cy.get('.view-mode-toggle button').eq(1).click()
      cy.contains('.cal-month-label', 'January 2026').should('exist')
      cy.get('.cal-cell.has-game', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      cy.get('.cal-cell.has-game').first().find(`img[src*="/${key}/logos/"]`).should('exist')
      cy.get('.cal-cell.has-game.win, .cal-cell.has-game.loss').first().click()
      cy.get('.pgs-card').should('exist')
      cy.get('.pbs-row', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 5)
      cy.get('.pbs-goalie-row').should('have.length.at.least', 1)
      // HockeyTechGameStatsPopup around it: league logos in the header,
      // period scoring, and the opponent toggle swaps the table.
      cy.get('.pgs-header').find(`img[src*="/${key}/logos/"]`).should('have.length', 2)
      cy.get('.pgs-period-row', { timeout: DATA_TIMEOUT }).should('have.length', 3)
      cy.get('.pbs-row').first().invoke('text').then(first => {
        cy.get('.pgs-toggle-btn').eq(1).click()
        cy.get('.pbs-row').first().invoke('text').should('not.eq', first)
      })
      assertNoLoadFailure()
    })

    // HockeyTechScheduleView fills in a saved prediction's outcome once its
    // game is Final, in the league's own prediction store key.
    it(`/${key}/schedule records a 2025-26 prediction's outcome`, () => {
      const storeKey = `eyewall_${key}_predictions_v1`
      cy.visit(`/${key}/schedule`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', key)
          win.localStorage.setItem(`eyewall:${key}_team`, JSON.stringify(team))
          win.localStorage.setItem(storeKey, JSON.stringify([{ gameId: final.game_id, predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 2 }]))
        },
      })
      cy.contains('button', /^2025-26$/, { timeout: DATA_TIMEOUT }).click()
      cy.window().its('localStorage').invoke('getItem', storeKey).should(raw => {
        const [pred] = JSON.parse(raw)
        expect(pred.teamActual, 'teamActual').to.be.a('number')
        expect(pred.oppActual, 'oppActual').to.be.a('number')
        expect(pred.correct).to.equal(pred.teamWon === true)
      })
      assertNoLoadFailure()
    })

    // HockeyTechGamePreviewPopup. The schedule is stubbed to one upcoming
    // game so the test doesn't depend on where the season is; its preview
    // and prediction come from the live Worker.
    it(`/${key}/schedule opens the preview for an upcoming game`, () => {
      cy.intercept('GET', `**/${key}/schedule?teamId=${team.teamId}&season=*`, {
        body: [{ ...upcoming, home_score: 0, away_score: 0, game_state: '7:00 pm EDT' }],
      })
      visitAs(`/${key}/schedule`, key, team)
      cy.contains('.card', upcoming.venue_name, { timeout: DATA_TIMEOUT }).click()
      cy.get('.pgp-card').should('exist')
      cy.get('.pgp-header').find(leagueLogo(key, team.abbr)).should('exist')
      cy.get('.pgp-card').contains('Prediction').should('exist')
      cy.get('.pgp-winpct', { timeout: DATA_TIMEOUT }).first().should('contain', '%')
      assertNoLoadFailure()
    })

    // HockeyTechPlayersView: roster grid, then the 2025-26 stats tables.
    it(`/${key}/players renders the ${team.abbr} roster and 2025-26 stats`, () => {
      visitAs(`/${key}/players`, key, team)
      cy.contains('h2', 'Roster', { timeout: DATA_TIMEOUT }).find(leagueLogo(key, team.abbr)).should('exist')
      cy.contains('.sec-label', 'Defencemen', { timeout: DATA_TIMEOUT }).should('exist')
      cy.get(`img[src*="leaguestat.com/${key}/"]`).should('have.length.at.least', 5)
      cy.contains('button', 'Stats').click()
      cy.contains('button', /^2025-26$/, { timeout: DATA_TIMEOUT }).click()
      cy.get('table tbody tr', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 10)
      cy.contains('button', /^Goalies$/).click()
      cy.contains('th', 'Goalie').should('exist')
      cy.get('table tbody tr').should('have.length.at.least', 1)
      assertNoLoadFailure()
    })

    // HockeyTechTeamView: header, then every tab renders (Overview record,
    // Stats rows, Splits/Trends cards) with no load failure.
    it(`/${key}/team renders every ${team.abbr} tab`, () => {
      // TeamPicker stores the whole team config, display name included.
      visitAs(`/${key}/team`, key, { ...team, displayName: teamName })
      cy.contains('h2', teamName, { timeout: DATA_TIMEOUT }).should('exist')
      cy.get('.team-view').find(leagueLogo(key, team.abbr)).should('exist')
      cy.get('.records-row', { timeout: DATA_TIMEOUT }).should('contain', 'pts')
      cy.contains('.team-tab', 'Stats').click()
      cy.get('.adv-stat-row', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      cy.contains('.team-tab', 'Splits').click()
      cy.get('.team-view .card', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      cy.contains('.team-tab', 'Trends').click()
      cy.get('.team-view .card', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
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

    // HockeyTechNewsView's per-league source badges and filter chips, on a
    // stubbed feed with one article per source.
    it(`/${key}/news badges and filters by ${label} source`, () => {
      const ids = Object.keys(newsSources)
      // The Worker's route only: the page itself is also at /<league>/news.
      cy.intercept('GET', `${Cypress.expose('WORKER_URL')}/${key}/news`, {
        body: ids.map((source, i) => ({
          id: `${source}-${i}`, source, sourceName: newsSources[source], title: `Story ${i} from ${source}`,
          url: 'https://example.com/', excerpt: 'Excerpt', publishedAt: new Date(Date.now() - 3600e3).toISOString(),
        })),
      })
      visitAs(`/${key}/news`, key, team)
      cy.get('.news-card', { timeout: DATA_TIMEOUT }).should('have.length', ids.length)
      cy.get('.news-source-badge').then($b => {
        expect([...$b].map(b => b.textContent).sort()).to.deep.equal(Object.values(newsSources).sort())
      })
      cy.contains('.news-chip', newsSources[ids[0]]).click()
      cy.get('.news-card').should('have.length', 1).and('contain', `from ${ids[0]}`)
      cy.contains('.news-chip', /^All/).click()
      cy.get('.news-card').should('have.length', ids.length)
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

    // Live-game care brought over from the NHL ShotMapView (Phase 2 #9):
    // a live game holds a screen wake lock, and returning to the app or a
    // push re-checks today's games at once instead of on the next poll.
    it(`/${key}/shots keeps the screen on and re-checks on resume and push`, () => {
      const workerUrl = Cypress.expose('WORKER_URL')
      let todayCalls = 0
      cy.intercept('GET', `${workerUrl}/${key}/today*`, req => {
        todayCalls++
        req.reply([{ gameId: 777, gameDate: '2026-10-10', homeTeamId: team.teamId, awayTeamId: 1, homeTeamCode: team.abbr, awayTeamCode: 'OPP', homeScore: 1, awayScore: 0, status: 'live' }])
      }).as('today')
      cy.intercept('GET', `${workerUrl}/${key}/live/777`, { body: { gameId: 777, homeTeamId: team.teamId, awayTeamId: 1, homeScore: 1, awayScore: 0, gameStatus: 'live', events: [] } })
      cy.visit(`/${key}/shots`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', key)
          win.localStorage.setItem(`eyewall:${key}_team`, JSON.stringify(team))
          const request = cy.stub().resolves({ released: false, release: () => Promise.resolve(), addEventListener() {} }).as('wakeLock')
          Object.defineProperty(win.navigator, 'wakeLock', { value: { request }, configurable: true })
        },
      })
      cy.wait('@today', { timeout: DATA_TIMEOUT })
      cy.get('@wakeLock', { timeout: DATA_TIMEOUT }).should('have.been.calledWith', 'screen')

      // Settle (StrictMode double-mounts on the dev server), then count.
      cy.wait(1000).then(() => {
        const before = todayCalls
        cy.document().then(doc => doc.dispatchEvent(new Event('visibilitychange')))
        cy.wrap(null, { timeout: 5000 }).should(() => expect(todayCalls).to.be.greaterThan(before))
      })
      cy.wait(500).then(() => {
        const before = todayCalls
        cy.window().then(win => win.dispatchEvent(new win.Event('eyewall:push-received')))
        cy.wrap(null, { timeout: 5000 }).should(() => expect(todayCalls).to.be.greaterThan(before))
      })
    })

    // The win popup on a real game's end (audit 2026-10-06 §14: it never
    // fired). /today says live, then final; once final the page stops
    // polling /live but fetches the ended game once more, and the win
    // pops up exactly once.
    it(`/${key}/shots shows the win popup once when the followed team's live game ends in a win`, () => {
      const workerUrl = Cypress.expose('WORKER_URL')
      let status = 'live'
      const game = () => ({ gameId: 777, gameDate: '2026-10-10', homeTeamId: team.teamId, awayTeamId: 1, homeTeamCode: team.abbr, awayTeamCode: 'OPP', homeScore: status === 'final' ? 2 : 1, awayScore: 1, status })
      cy.intercept('GET', `${workerUrl}/${key}/today*`, req => req.reply([game()])).as('today')
      cy.intercept('GET', `${workerUrl}/${key}/live/777`, req => req.reply({
        gameId: 777, homeTeamId: team.teamId, awayTeamId: 1,
        homeScore: status === 'final' ? 2 : 1, awayScore: 1,
        gameStatus: status, events: [],
      })).as('live')
      visitAs(`/${key}/shots`, key, team)
      cy.wait('@live', { timeout: DATA_TIMEOUT })
      cy.get('.win-popup').should('not.exist')

      cy.wait(1000).then(() => { status = 'final' })
      cy.window().then(win => win.dispatchEvent(new win.Event('eyewall:push-received')))
      cy.get('.win-popup', { timeout: DATA_TIMEOUT }).should('contain', `${team.abbr} 2 – `)
      cy.get('.win-popup').click({ force: true })
      cy.get('.win-popup').should('not.exist')

      // Another re-check of a game already celebrated stays quiet.
      cy.window().then(win => win.dispatchEvent(new win.Event('eyewall:push-received')))
      cy.wait('@today')
      cy.wait(1500)
      cy.get('.win-popup').should('not.exist')
      cy.assertNoErrors()
    })

    // HockeyTechGameEvents' popups, fired from the dev-only debug panel
    // (5 taps on the header), the way pwhl-shots-live.cy.js does for PWHL.
    it(`/${key}/shots debug panel fires the ${label} event popups`, () => {
      visitAs(`/${key}/shots`, key, team)
      cy.contains('h2', 'Shot Map', { timeout: DATA_TIMEOUT })
      Cypress._.times(5, () => cy.contains('h2', 'Shot Map').click())
      cy.contains(`${label} Event Debug`, { timeout: 4000 }).should('exist')
      cy.contains('⚡ PP Goal').click()
      cy.get('.goal-popup').should('contain', 'Power Play').click({ force: true })
      cy.contains('🟠 Major').click()
      cy.get('.penalty-popup').should('contain', 'POWER').and('contain', 'Major').click({ force: true })
      cy.contains('🏒 Puck Drop').click()
      cy.get('.puck-drop-popup').should('contain', "Let's go!").click({ force: true })
      cy.contains('🏆 Win').click()
      cy.get('.win-popup').should('contain', team.abbr)
      cy.assertNoErrors()
    })
  })
})
