// cypress/e2e/league-cap.cy.js
// League › Cap: every team's contract commitments from the Worker's
// /contracts/summary (stubbed with the real 2026-10-24 payload), and the
// hidden-tab case when the route answers `unavailable` (no dead options).

// The two bases of /contracts/summary: the roster basis (eyewall-poller
// #236) is what the table shows; the signing-team basis is the fallback
// when the roster one is unavailable.
const SUMMARY = { method: 'GET', url: /\/contracts\/summary(\?(?!.*basis=roster)|$)/ }
const ROSTER_SUMMARY = { method: 'GET', url: /\/contracts\/summary\?.*basis=roster/ }
const ROSTER_UNAVAILABLE = { season: '2026-27', basis: 'roster', asOf: null, capLimits: null, teamsKnown: 0, teams: [], unavailable: true }

describe('League › Cap', () => {
  it('shows every team\'s roster cap hit against the ceiling (the Team page\'s number)', () => {
    cy.intercept(ROSTER_SUMMARY, { fixture: 'contracts-summary-roster-2026-27.json' }).as('roster')
    cy.intercept(SUMMARY, { fixture: 'contracts-summary-2026-27.json' }).as('summary')
    cy.visit('/league')
    cy.wait('@roster')
    cy.get('.league-tab').contains(/^Cap$/, { timeout: DATA_TIMEOUT }).click()
    cy.get('.league-cap[data-basis="roster"]', { timeout: DATA_TIMEOUT }).should('exist')
    cy.contains('.league-cap .sec-label', 'Roster cap hit · 2026-27')
    cy.contains('.league-cap', 'By current roster')
    cy.contains('.league-cap', 'Not cap space.')
    cy.get('.league-cap-table th').should('contain', 'Roster').and('contain', 'Roster cap hit')
    cy.fixture('contracts-summary-roster-2026-27').then(f => {
      cy.get('.league-cap-row').should('have.length', f.teams.length)
      const top = f.teams[0]
      cy.get('.league-cap-row').first().should('contain', top.team).and('contain', `$${(top.rosterCapHit / 1e6).toFixed(1)}M`)
        .and('contain', `${top.rosterCount}`)
      // the bar is the share of the ceiling
      cy.get('.league-cap-row').first().find('.league-cap-bar').invoke('attr', 'style')
        .should('contain', `width: ${Math.round(top.rosterCapHit / f.capLimits.ceiling * 100)}%`)
      const car = f.teams.find(t => t.team === 'CAR')
      cy.get('.league-cap-row[data-team="CAR"]').should('contain', `$${(car.rosterCapHit / 1e6).toFixed(1)}M`)
      const off = f.teams.reduce((n, t) => n + t.offRosterCount, 0)
      cy.contains('.league-cap', `${off} signed players on no NHL roster`)
    })
    // the signing-team summary was not needed for the table
    cy.get('@summary.all').should('have.length', 0)
  })

  it('falls back to commitments by signing team when the roster basis is unavailable, with Arizona folded into Utah', () => {
    cy.intercept(ROSTER_SUMMARY, ROSTER_UNAVAILABLE).as('roster')
    cy.intercept(SUMMARY, { fixture: 'contracts-summary-2026-27.json' }).as('summary')
    cy.visit('/league')
    cy.wait('@roster')
    cy.wait('@summary')
    cy.get('.league-tab').contains(/^Cap$/, { timeout: DATA_TIMEOUT }).click()
    cy.get('.league-cap[data-basis="signing_team"]', { timeout: DATA_TIMEOUT }).should('exist')

    cy.contains('.league-cap .sec-label', 'Contract commitments · 2026-27')
    // Says what it is and what it is not; no "cap space" figure anywhere.
    cy.contains('.league-cap', 'By signing team')
    cy.contains('.league-cap', 'Not cap space.')
    cy.get('.league-cap').invoke('text').should('not.match', /\$[\d.]+M (of )?cap space/)
    cy.contains('.league-cap-provenance', 'as of Oct 24, 2026 · cap ceiling $104.0M')

    cy.fixture('contracts-summary-2026-27').then(f => {
      const rows = [...f.teams].sort((a, b) => b.capHitTotal - a.capHitTotal)
      // 33 entries in the payload (ARI still carries running Coyotes deals) -> 32 rows
      cy.get('.league-cap-row').should('have.length', f.teams.length - 1)
      cy.get('.league-cap-row').first().should('contain', rows[0].team)
        .and('contain', `$${(rows[0].capHitTotal / 1e6).toFixed(1)}M`)
      const uta = f.teams.find(t => t.team === 'UTA'), ari = f.teams.find(t => t.team === 'ARI')
      cy.get('.league-cap-row[data-team="UTA"]').should('contain', '*')
        .and('contain', `$${((uta.capHitTotal + ari.capHitTotal) / 1e6).toFixed(1)}M`)
      cy.get('.league-cap-row[data-team="ARI"]').should('not.exist')
      const ufa = f.teams.reduce((s, t) => s + t.expiring.ufa, 0), rfa = f.teams.reduce((s, t) => s + t.expiring.rfa, 0)
      cy.contains('.league-cap', `Expiring this summer across the league: ${ufa} UFA · ${rfa} RFA`)
    })
    cy.contains('.league-cap', 'includes deals signed as Arizona')
  })

  // The contract-value leaderboard under the team table: stubbed with
  // trimmed real 2026-10-24 payloads (40 contract rows, 34 skater lines,
  // 6 goalies) so the scores are deterministic.
  describe('contract-value leaderboard', () => {
    beforeEach(() => {
      cy.intercept(ROSTER_SUMMARY, { fixture: 'contracts-summary-roster-2026-27.json' }).as('summary')
      cy.intercept({ method: 'GET', url: /\/contracts\/players(\?|$)/ }, { fixture: 'contracts-players-2026-27.json' }).as('players')
      cy.intercept({ method: 'GET', url: /\/skater\/summary\?/ }, { fixture: 'skater-summary-2026-27.json' }).as('skaters')
      cy.intercept({ method: 'GET', url: /\/player-analytics\?/ }, { fixture: 'player-analytics-2026-27.json' }).as('analytics')
      cy.intercept({ method: 'GET', url: /\/goalie-analytics\?/ }, { fixture: 'goalie-analytics-2026-27.json' }).as('goalies')
      cy.visit('/league')
      cy.wait('@summary')
      cy.get('.league-tab').contains(/^Cap$/, { timeout: DATA_TIMEOUT }).click()
      cy.wait(['@players', '@skaters'])
      cy.get('.league-value', { timeout: DATA_TIMEOUT }).should('exist')
    })

    it('scores every rated skater, best value first, with the popup\'s labels', () => {
      cy.fixture('contracts-players-2026-27').then(players => {
        cy.fixture('skater-summary-2026-27').then(sk => {
          const capById = Object.fromEntries(players.players.map(p => [p.playerId, p]))
          const rated = sk.data.filter(s => s.gamesPlayed >= 10 && capById[s.playerId]?.capHit >= 1_200_000 && capById[s.playerId]?.contractType !== 'ELC')
          cy.contains('.league-value', `${rated.length} skaters rated, at least 10 games played`)
          cy.get('.league-value-row').should('have.length', Math.min(25, rated.length))
          // best points per $M in the fixture is first
          const best = rated.map(s => ({ s, v: (s.points / s.gamesPlayed * 82) / (capById[s.playerId].capHit / 1e6) })).sort((a, b) => b.v - a.v)[0]
          cy.get('.league-value-row').first().should('contain', best.s.skaterFullName).and('contain', `${best.s.points}`)
          cy.get('.league-value-row').first().find('td').last().invoke('text').should('match', /Exceptional|Great|Good|Fair|Below|Overpaid/)
          // ELC and no-figure players are never rated, and the footer says so
          cy.get('.league-value').should('not.contain', 'Easton Cowan').and('not.contain', 'Leon Draisaitl')
          cy.contains('.league-value', /Not rated: \d+ without a public figure, \d+ on entry-level deals, \d+ under 10 games/)
        })
      })
      cy.get('.league-value').should('not.contain', 'cap space')
    })

    it('switches to goalies (GSAX per $M, 5-game minimum) and opens the player popup from a row', () => {
      cy.get('.league-value-seg').contains('Goalies').click()
      cy.contains('.league-value', /\d+ goalies rated, at least 5 games played/)
      cy.get('.league-value-table th').should('contain', 'GSAX')
      cy.get('.league-value-row').should('have.length.gte', 3)
      cy.get('.league-value-row').first().invoke('text').should('match', /[+-]?\d+\.\d/)
      // a row opens the popup in league context
      cy.get('.league-value-seg').contains('Skaters').click()
      cy.get('.league-value-row').first().click()
      cy.get('.pp-tab', { timeout: DATA_TIMEOUT }).should('exist')
      cy.get('.pp-tab').contains('Heat Map').should('not.exist')
    })

    it('shows all rows on demand', () => {
      cy.get('.league-value-more').then($b => {
        if (!$b.length) return
        cy.wrap($b).should('contain', 'Show all').click()
        cy.get('.league-value-row').should('have.length.gt', 25)
        cy.get('.league-value-more').should('contain', 'Show top 25')
      })
    })
  })

  it('hides the Cap tab when both summaries are unavailable', () => {
    cy.intercept(ROSTER_SUMMARY, ROSTER_UNAVAILABLE).as('roster')
    cy.intercept(SUMMARY, { season: '2026-27', basis: 'signing_team', asOf: null, capLimits: null, teams: [], unavailable: true }).as('summary')
    cy.visit('/league')
    cy.wait('@roster')
    cy.wait('@summary')
    cy.get('.league-tab').contains('Draft').should('be.visible')
    cy.get('.league-tab').contains(/^Cap$/).should('not.exist')
  })
})
