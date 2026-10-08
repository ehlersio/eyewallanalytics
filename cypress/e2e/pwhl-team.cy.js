// cypress/e2e/pwhl-team.cy.js

const WORKER_URL = Cypress.expose('VITE_WORKER_URL') || 'https://eyewall-poller.billowing-queen-bf23.workers.dev'

const PWHL_TEST_TEAMS = ['BOS', 'MIN', 'MTL', 'TOR']

PWHL_TEST_TEAMS.forEach(abbr => {
  const teamId = { BOS: 1, MIN: 2, MTL: 3, TOR: 6 }[abbr]

  describe(`PWHL Team view — ${abbr}`, () => {
    beforeEach(() => {
      cy.visit('/pwhl/team', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'pwhl')
          win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr, teamId }))
        },
      })
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.contains(abbr, { timeout: DATA_TIMEOUT }).should('exist')
    })

    it('renders all tab buttons', () => {
      ['Overview', 'Advanced', 'Splits', 'Trends', 'Salaries', 'History'].forEach(tab =>
        cy.contains(tab).should('exist')
      )
    })

    describe('Overview tab', () => {
      it('shows team record in W–OTW–OTL–L format', () => {
        cy.get('.record-big', { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows points', () => {
        cy.contains(/pts/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows season stats grid', () => {
        cy.contains(/GF\/GP|GA\/GP/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows PP% and PK%', () => {
        cy.contains('PP%', { timeout: DATA_TIMEOUT }).should('exist')
        cy.contains('PK%').should('exist')
      })

      it('shows top scorers', () => {
        cy.contains(/Top scorers|Points leaders/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows starting goalie card', () => {
        cy.contains(/Starting goalie|Goalie/i, { timeout: DATA_TIMEOUT }).should('exist')
      })
    })

    describe('Advanced tab', () => {
      beforeEach(() => cy.contains('Advanced').click())

      it('renders shot volume section', () => {
        cy.contains(/Shot Volume|CF%|Corsi/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('renders PDO section', () => {
        cy.contains('PDO', { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('renders special teams section', () => {
        cy.contains(/Special Teams/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('renders league context section', () => {
        cy.contains(/League Context/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('playoff toggle is clickable when in playoffs', () => {
        cy.get('body').then($body => {
          if ($body.text().includes('Playoffs')) {
            cy.contains('Playoffs').click()
            cy.assertNoErrors()
            cy.contains('Regular Season').click()
          }
        })
      })
    })

    describe('Splits tab', () => {
      beforeEach(() => cy.contains('Splits').click())

      it('shows Home vs Away section', () => {
        cy.contains(/Home vs Away/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows W–OTW–OTL–L records', () => {
        cy.contains(/W–OTW–OTL–L/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows Pts% comparison', () => {
        cy.contains(/Pts%/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('playoff toggle shows when in playoffs', () => {
        cy.get('body').then($body => {
          if ($body.text().includes('Playoffs')) {
            cy.contains('Playoffs').click()
            cy.assertNoErrors()
          }
        })
      })
    })

    describe('Trends tab', () => {
      beforeEach(() => cy.contains('Trends').click())

      it('shows current streak', () => {
        cy.contains(/Current streak/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows Last 10 games', () => {
        cy.contains('Last 10 games', { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows result dots', () => {
        cy.get('[class*="result-dot"]', { timeout: DATA_TIMEOUT }).should('have.length.greaterThan', 0)
      })

      it('shows rolling win% chart', () => {
        cy.contains(/Win%|Rolling.*win/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows goal differential chart', () => {
        cy.contains(/Goal differential/i, { timeout: DATA_TIMEOUT }).should('exist')
      })
    })

    describe('Salaries tab', () => {
      beforeEach(() => cy.contains('Salaries').click())

      it('shows salary summary card', () => {
        cy.contains(/Total Payroll|Salary/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows cap ceiling', () => {
        cy.contains(/Cap Ceiling|\$1,300,000/i, { timeout: DATA_TIMEOUT }).should('exist')
      })

      it('shows CBA target', () => {
        cy.contains(/CBA Target/i, { timeout: DATA_TIMEOUT }).should('exist')
      })
    })

    describe('History tab (Phase 2 — all 12 PWHL teams)', () => {
      beforeEach(() => cy.contains('History').click())

      it('renders the Founded and Home Arena sections', () => {
        cy.contains('Founded', { timeout: DATA_TIMEOUT }).should('exist')
        cy.contains('Home Arena').should('exist')
      })

      it('renders a Current Franchise Info section with the single-entity owner', () => {
        cy.contains('Current Franchise Info', { timeout: DATA_TIMEOUT }).should('exist')
        cy.contains('Owner').should('exist')
        cy.contains(/Mark & Kimbra Walter/i).should('exist')
      })
    })

    describe('Compare Seasons', () => {
      beforeEach(() => cy.contains('🆚 Compare Seasons').click())

      it('opens the picker with multiple season options', () => {
        cy.contains('Compare Seasons').should('be.visible')
        cy.get('.season-chip', { timeout: DATA_TIMEOUT }).should('have.length.greaterThan', 1)
      })

      it('renders one comparison card per selected season', () => {
        cy.get('.season-chip', { timeout: DATA_TIMEOUT }).eq(0).click()
        cy.get('.season-chip').eq(1).click()
        cy.get('.stat-section').should('have.length', 2)
        cy.contains('GP').should('be.visible')
        cy.contains('PTS').should('be.visible')
      })
    })

    describe('Compare Teams (Session 86)', () => {
      beforeEach(() => {
        cy.contains('🆚 Compare Seasons').click()
        cy.get('[aria-label="Compare vs team"]').click()
        cy.contains('Full Stat Comparison').should('be.visible')
      })

      it('opponent picker excludes the current team', () => {
        cy.get('select[aria-label="Choose opponent team"]').find('option').then($opts => {
          const values = [...$opts].map(o => o.value).filter(Boolean)
          expect(values).not.to.include(String(teamId))
        })
      })

      it('renders one comparison card per team once an opponent and season are picked', () => {
        cy.get('select[aria-label="Choose opponent team"]').then($sel => {
          const opponent = [...$sel[0].options].map(o => o.value).find(v => v && v !== String(teamId))
          cy.wrap($sel).select(opponent)
        })
        cy.get('.season-chip', { timeout: DATA_TIMEOUT }).first().click()
        cy.get('.stat-section', { timeout: 15000 }).should('have.length', 2)
        cy.contains('GP').scrollIntoView().should('be.visible')
      })

      it('renders all-time record, or the no-meetings state, once an opponent is picked (Session 88)', () => {
        cy.get('select[aria-label="Choose opponent team"]').then($sel => {
          const opponent = [...$sel[0].options].map(o => o.value).find(v => v && v !== String(teamId))
          cy.wrap($sel).select(opponent)
        })
        cy.contains('Head-to-Head').click()
        cy.contains(/Since 2023-24|No meetings on record/i, { timeout: 15000 }).should('be.visible')
      })
    })
  })
})

// ── Expansion team (DET) — 2026-27 season hasn't started for these teams yet:
// real roster exists in HockeyTech, but no games/standings/salary rows exist,
// so every data-driven tab should show its graceful empty state, not crash
// and not show real stats. Verified against the live Worker before writing
// these assertions (see Session 38 investigation).
describe('PWHL Team view — DET (expansion, no games played yet)', () => {
  beforeEach(() => {
    cy.visit('/pwhl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'DET', teamId: 10 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    // No "{abbr} ..." headings render for this team (season stat grid, points
    // leaders, etc. are all data-driven and absent — that's the point of this
    // suite), so confirm the right team loaded via the logo's alt text instead.
    cy.get('[alt="DET"]', { timeout: DATA_TIMEOUT }).should('exist')
  })

  it('renders all tab buttons, and no Salaries tab (no salary rows in any season)', () => {
    ['Overview', 'Advanced', 'Splits', 'Trends', 'History'].forEach(tab =>
      cy.contains(tab).should('exist')
    )
    cy.contains('.team-tab', 'History', { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('.team-tab', 'Salaries').should('not.exist')
    cy.assertNoErrors()
  })

  // Unlike every other data-driven tab in this describe block, History is
  // NOT gated on games-played -- it's static reference data (founding,
  // arena, current GM/coach), so an expansion team with zero games shows
  // real content here instead of an empty state. Confirms teamHistory.js's
  // DET entry (founded 2026, no championships/records yet) renders cleanly.
  describe('History tab', () => {
    beforeEach(() => cy.contains('History').click())

    it('renders real content instead of an empty state', () => {
      cy.contains('Founded', { timeout: DATA_TIMEOUT }).should('exist')
      cy.contains('2026').should('exist')
      cy.contains('Little Caesars Arena').should('exist')
      cy.assertNoErrors()
    })

    it('does not render Championships or Franchise Records sections (none exist yet)', () => {
      cy.contains('Championships').should('not.exist')
      cy.contains('Franchise Records').should('not.exist')
    })
  })

  describe('Overview tab', () => {
    // No standings row is no games, never a made-up 0–0–0 record.
    it('says DET has no games yet instead of a 0–0–0 record', () => {
      cy.get('[data-testid="pwhl-team-no-games"]', { timeout: DATA_TIMEOUT })
        .should('contain', 'No games yet').and('contain', 'DET')
      cy.get('.record-big').should('not.exist')
      cy.contains(/^0–0–0$/).should('not.exist')
      // The playoff-odds card (Wave D) may legitimately read "0 pts now" for a
      // season with no games yet; any other "0 pts" would be a made-up record.
      cy.get('body').then($body => {
        const leaves = $body.find(':contains("0 pts")').filter((_, el) => el.children.length === 0)
        leaves.each((_, el) => { expect(el.closest('.playoff-odds-now'), '0 pts outside the odds card').to.not.equal(null) })
      })
    })

    it('does not show season stats, top scorers, or starting goalie sections', () => {
      cy.contains(/Top scorers|Points leaders/i).should('not.exist')
      cy.contains(/Starting goalie/i).should('not.exist')
      cy.assertNoErrors()
    })
  })

  describe('Advanced tab', () => {
    beforeEach(() => cy.contains('Advanced').click())

    // Session 39 fix: this used to get stuck on "Loading advanced stats…"
    // forever, because the loading guard couldn't tell "still fetching"
    // apart from "fetched, but this team has no standings row yet" (DET
    // never appears in /pwhl/standings until it plays a game). Now asserts
    // the real, distinct empty-state message instead of tolerating the
    // misleading loading text.
    it('shows the no-data empty state instead of a permanent loading message', () => {
      cy.contains(/No advanced stats yet/i, { timeout: DATA_TIMEOUT }).should('exist')
      cy.contains(/hasn.t played a game yet this season/i).should('exist')
      cy.contains(/Loading advanced stats/i).should('not.exist')
      cy.contains(/Shot Volume|CF%|Corsi/i).should('not.exist')
    })
  })

  describe('Splits tab', () => {
    beforeEach(() => cy.contains('Splits').click())

    it('shows the no-data empty state', () => {
      cy.contains(/No regular season data yet/i, { timeout: DATA_TIMEOUT }).should('exist')
      cy.contains(/Home vs Away/i).should('not.exist')
    })
  })

  describe('Trends tab', () => {
    beforeEach(() => cy.contains('Trends').click())

    it('shows the no-data empty state', () => {
      cy.contains(/No game data yet/i, { timeout: DATA_TIMEOUT }).should('exist')
      cy.contains(/Current streak/i).should('not.exist')
    })
  })

  it('never surfaces an error boundary while tabbing through', () => {
    ['Advanced', 'Splits', 'Trends', 'Overview'].forEach(tab => {
      cy.contains(tab).click()
      cy.assertNoErrors()
    })
  })

  // DET never existed as a franchise before the 2026-27 expansion -- a
  // permanent historical fact, safe to assert indefinitely. The season
  // pickers offer only seasons the team has games in (no dead options), so
  // 2025-26 is never a choice for DET, alone or against an opponent.
  // The picker has settled: chips, or the message saying there are none.
  const seasonsLoaded = () =>
    cy.get('[aria-label="Select seasons to compare"], .season-picker-empty', { timeout: DATA_TIMEOUT }).should('exist')

  describe('Compare Seasons', () => {
    beforeEach(() => cy.contains('🆚 Compare Seasons').click())

    it('offers no season DET did not play', () => {
      seasonsLoaded()
      cy.contains('.season-chip', '2025-26').should('not.exist')
      cy.contains('.season-chip', '2024-25').should('not.exist')
      cy.contains('Not yet available for this season').should('not.exist')
      cy.assertNoErrors()
    })
  })

  describe('Compare Teams (Session 86)', () => {
    beforeEach(() => {
      cy.contains('🆚 Compare Seasons').click()
      cy.get('[aria-label="Compare vs team"]').click()
    })

    it('offers no season DET and its opponent did not both play', () => {
      cy.get('select[aria-label="Choose opponent team"]').select('2') // Minnesota Frost
      seasonsLoaded()
      cy.contains('.season-chip', '2025-26').should('not.exist')
      cy.contains('Not yet available for this season').should('not.exist')
    })

    // DET has never played a game in this pipeline's history (2026-27
    // expansion) -- unlike the "either/or" assertion used for established
    // teams elsewhere, this pair is guaranteed zero real meetings, so this
    // can assert the exact empty state deterministically (Session 88).
    it('Head-to-Head shows the zero-meetings empty state for an expansion team', () => {
      cy.get('select[aria-label="Choose opponent team"]').select('2') // Minnesota Frost
      cy.contains('Head-to-Head').click()
      cy.contains('No meetings on record between these teams yet', { timeout: 15000 }).should('be.visible')
    })
  })
})

// ── Season correctness (Session 65) ─────────────────────────────
// Regression coverage for the frozen-module-load-season-constants fix.
// The existing skipIfEither/skipUnlessContentAppears skip-gate commands
// (Session 62) only distinguish "real content present" from "no data yet"
// -- they say nothing about whether that content is for the RIGHT season.
// A component that regresses back to reading a frozen constant instead of
// the live-resolved value would still show real, populated content and
// sail straight through those gates.
//
// This is a genuinely new category of coverage for this repo, not a
// bigger version of the skip-gate pattern: every existing spec asserts
// WHETHER something rendered; this is the first one that asserts WHICH
// season it rendered for, checked against the live source of truth
// (/config/seasons) rather than a value baked into the test itself. Was
// literally a hardcoded "2025-26 season" string here until this session --
// see PWHLTeamView.jsx.
describe('Season correctness — rendered label matches live /config/seasons', () => {
  it('team page season label matches the season the Worker currently resolves as current', () => {
    cy.request(`${WORKER_URL}/config/seasons`).then((res) => {
      const { startYear } = res.body.pwhl
      const expectedBase = `${startYear}-${String(startYear + 1).slice(2)}`
      cy.visit('/pwhl/team', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'pwhl')
          win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
        },
      })
      cy.get('.view-sub', { timeout: 15000 }).should('contain', expectedBase)
    })
  })
})

// The Advanced tab's league averages come from the Worker's
// /pwhl/league-averages (every team's real season totals) -- they used to be
// a hardcoded table of "2025-26 approximations".
describe('PWHL Advanced tab — league averages', () => {
  function openAdvanced() {
    cy.visit('/pwhl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
      },
    })
    cy.contains('Advanced', { timeout: DATA_TIMEOUT }).click()
  }

  it('compares against the averages the Worker returns', () => {
    cy.intercept('GET', '**/pwhl/league-averages*', {
      season: 8, teams: 8, gamesPlayed: 240,
      goalsForPerGame: 2.34, goalsAgainstPerGame: 2.34, shotsForPerGame: 27.9, shotsAgainstPerGame: 27.8,
      shPct: 0.081, svPct: 0.923, pdo: 100.4, ppPct: 0.123, pkPct: 0.877,
    }).as('leagueAvg')
    openAdvanced()
    cy.wait('@leagueAvg')
    cy.contains('avg 12.3%', { timeout: DATA_TIMEOUT }).should('exist') // PP%
    cy.contains('avg 87.7%').should('exist') // PK%
    cy.contains('avg .923').should('exist') // SV%
    cy.contains('avg 2.34').should('exist') // goals per game
  })

  it('shows no averages, rather than guesses, when there are none', () => {
    cy.intercept('GET', '**/pwhl/league-averages*', { statusCode: 404, body: { error: 'No team data for that season' } }).as('leagueAvg')
    openAdvanced()
    cy.wait('@leagueAvg')
    cy.contains(/Special Teams/i, { timeout: DATA_TIMEOUT }).should('exist')
    // CF%/FF%'s 50% is the league average by definition; nothing else has one
    cy.get('body').invoke('prop', 'innerText').then(text => {
      const avgs = text.match(/avg [^\s]+/g) || []
      expect(avgs.filter(a => a !== 'avg 50.0%')).to.deep.equal([])
    })
  })
})

// Phase 3 B7: the Advanced tab's Regular/Playoffs toggle comes with the
// team's playoff pwhl_team_seasons row (/pwhl/team-seasons/compare, the real
// MTL 2026 playoffs: 9 GP, 20 GF, 15 GA, PP .158, PK .929), and only then.
describe('PWHL Advanced tab — playoffs', () => {
  const MTL_PO_ROW = { season_id: 9, season_type: 'playoffs', gp: 9, wins: 6, losses: 3, ot_losses: 0, points: 18, goals_for: 20, goals_against: 15, pp_pct: 0.158, pk_pct: 0.929 }
  function openAdvanced(poRows) {
    cy.intercept('GET', '**/pwhl/team-seasons/compare?teamId=3&seasons=9', poRows).as('poRow')
    cy.visit('/pwhl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'MTL', teamId: 3 }))
      },
    })
    cy.contains('Advanced', { timeout: DATA_TIMEOUT }).click()
    cy.wait('@poRow')
  }

  it('shows the playoffs from the playoff row', () => {
    openAdvanced([MTL_PO_ROW])
    cy.contains('button', 'Playoffs', { timeout: DATA_TIMEOUT }).click()
    cy.contains('Goals For/GP').parent().should('contain', '2.22')   // 20 / 9
    cy.contains('Goals Against/GP').parent().should('contain', '1.67') // 15 / 9
    cy.contains('PP%').parent().should('contain', '15.8%')
    cy.contains('PK%').parent().should('contain', '92.9%')
    // Regular-season standings ranks aren't shown as playoff ones.
    cy.contains(/League context/i).should('not.exist')
    cy.contains('button', 'Regular Season').click()
    cy.contains(/League context/i).should('exist')
  })

  it('offers no Playoffs toggle when the team has no playoff row', () => {
    openAdvanced([])
    cy.contains(/Special Teams/i, { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('button', 'Playoffs').should('not.exist')
    cy.contains('Showing Regular Season stats').should('exist')
  })
})

// From the season flip (~Nov 20) to a team's first game (Dec 5) the new
// current season (2026-27, id 11) has no games: the Team tab opens on the
// team's newest season with games and says so, and Salaries falls back to
// the newest season with salary rows. /config/seasons, BOS's 2026-27
// schedule (HockeyTech's real opener time format, nothing played) and its
// 2026-27 salaries are stubbed; 2025-26 is the live Worker.
describe('PWHL Team view — new season before its first game (BOS)', () => {
  const AFTER_SWITCH = {
    seasonId: 11, seasonType: 'regular', startYear: 2026, startDate: '2026-12-04', source: 'live',
    next: null, preseason: { seasonId: 10, seasonType: 'preseason', startYear: 2026, startDate: '2026-10-01' },
  }
  const SEASON_11_BOS = [{
    game_id: 366, season_id: 11, game_date: '2026-12-05', home_team_id: 1, away_team_id: 3,
    game_state: '7:00 pm EST', home_score: 0, away_score: 0, period: null, ot: false, shootout: false,
    game_status_code: null, date_with_day: null,
  }]

  beforeEach(() => {
    cy.intercept('GET', '**/config/seasons', {
      nhl: { seasonId: '20262027' },
      pwhl: AFTER_SWITCH,
      ahl: { seasonId: 94, seasonType: 'regular' },
      echl: { seasonId: 78, seasonType: 'regular' },
    }).as('seasons')
    cy.intercept('GET', '**/pwhl/schedule?teamId=1&season=11', SEASON_11_BOS).as('season11')
    cy.intercept('GET', '**/pwhl/standings?season=11', [])
    cy.intercept('GET', '**/pwhl/salaries?teamId=1&season=2026-27', []).as('salaries2627')
    cy.visit('/pwhl/team', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'BOS', teamId: 1 }))
      },
    })
    cy.wait('@seasons')
  })

  it('opens on 2025-26 with its real record, labelled', () => {
    cy.get('[data-testid="pwhl-team-season-note"]', { timeout: DATA_TIMEOUT })
      .should('contain', "BOS hasn't played a 2026-27 game yet")
      .and('contain', 'showing 2025-26')
    cy.contains('2025-26 season').should('exist')
    cy.get('.record-big', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('[data-testid="pwhl-team-no-games"]').should('not.exist')
    cy.assertNoErrors()
  })

  it('shows 2025-26 salaries, labelled, while 2026-27 has none', () => {
    cy.contains('.team-tab', 'Salaries', { timeout: DATA_TIMEOUT }).click()
    cy.wait('@salaries2627')
    cy.contains('2025-26 Salary Summary', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('[data-testid="pwhl-salaries-season-note"]')
      .should('contain', 'No 2026-27 salaries published yet')
      .and('contain', 'showing 2025-26')
    cy.contains('Total Payroll').should('exist')
    cy.assertNoErrors()
  })
})
