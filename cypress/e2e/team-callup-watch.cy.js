// cypress/e2e/team-callup-watch.cy.js
// Team page → Overview → Call-up watch (Worker /nhl/callup-watch): who's
// out by position and the AHL affiliate's players next in line. The route
// is stubbed so the card's layout is pinned regardless of the day's
// injuries; CAR's affiliate is the Chicago Wolves (HockeyTech id 330).

const skater = (o) => ({
  ahlPlayerId: o.id, nhlPlayerId: null, name: o.name, position: o.pos ?? 'C', group: o.group ?? 'F', jersey: null, birthDate: null,
  holdsRights: !!o.rights, recalls: o.recalls ?? [], lastMove: o.lastMove ?? null, ranked: o.ranked ?? true,
  current: { gp: 1, goals: 0, assists: 1, points: 1 }, previous: { gp: 60, goals: 20, assists: 30, points: 50 },
  combined: { gp: 61, points: 51, pointsPerGame: o.ppg ?? 0.84 }, lastGames: { gp: 1, goals: 0, assists: 1, points: 1 },
})

const WATCH = {
  team: 'CAR', ahlTeamId: 330, seasons: { current: 94, previous: 90 }, minGamesToRank: 5,
  groups: {
    F: {
      out: [{ playerId: 1, name: 'Seth Jarvis', status: 'injured-reserve', injuryType: 'Shoulder', returnDate: null }],
      upNow: [], hurt: [],
      candidates: [
        skater({ id: 11, name: 'Bradly Nadeau', rights: true, ppg: 1.06, recalls: [{ date: '2026-03-01', description: 'Recalled F Bradly Nadeau from Chicago (AHL).' }, { date: '2026-01-10', description: 'x' }] }),
        skater({ id: 12, name: 'Justin Robidas', rights: true, ppg: 1.02 }),
        skater({ id: 13, name: 'Felix Unger Sörum', pos: 'RW', rights: true, ppg: 0.9 }),
        skater({ id: 14, name: 'Fourth Forward', ppg: 0.5, lastMove: { date: '2026-09-25', description: 'Placed F Fourth Forward on waivers.' } }),
      ],
    },
    D: { out: [], upNow: [], hurt: [{ name: 'Hurt Defender', status: 'injured-reserve' }], candidates: [skater({ id: 21, name: 'Ronan Seeley', pos: 'D', group: 'D', rights: true, ppg: 0.33 })] },
    G: {
      out: [], upNow: [{ ahlPlayerId: 31, nhlPlayerId: 500, name: 'Pyotr Kochetkov', position: 'G' }], hurt: [],
      candidates: [{
        ahlPlayerId: 32, nhlPlayerId: null, name: 'Ruslan Khazheyev', position: 'G', group: 'G', holdsRights: true, recalls: [], lastMove: null, ranked: false,
        current: { gp: 0, svPct: null }, previous: { gp: 1, svPct: 0.909 }, combined: { gp: 1, svPct: 0.909 }, lastGames: { gp: 0, svPct: null },
      }],
    },
  },
  unplaced: [{ name: 'Mystery Player', status: 'out' }],
}

function openOverview(body) {
  cy.intercept('GET', '**/nhl/callup-watch?team=CAR&ahlTeamId=330', body).as('callup')
  cy.setTeam('CAR')
  cy.visit('/team')
  cy.wait('@callup')
}

describe('Team page — Overview tab, Call-up watch card', () => {
  it("names the affiliate and puts the position with players out first", () => {
    openOverview(WATCH)
    cy.get('.callup-watch').within(() => {
      cy.contains('Call-up watch').should('exist')
      cy.contains('From the Chicago Wolves (AHL)').should('exist')
      cy.get('.callup-group').first().should('have.attr', 'data-group', 'F')
      cy.get('[data-group="F"] .callup-out').should('contain', 'Seth Jarvis').and('contain', 'IR')
      cy.get('[data-group="D"] .callup-out').should('contain', 'No one out')
    })
  })

  it('shows the top 3 per position with their AHL line, rights and recalls; more behind a toggle', () => {
    openOverview(WATCH)
    cy.get('[data-group="F"] .callup-candidate').should('have.length', 3)
    cy.get('[data-group="F"] .callup-candidate').first()
      .should('contain', 'Bradly Nadeau').and('contain', '1.06 P/GP · 51 PTS in 61 GP')
      .and('contain', 'This season: 1 GP, 1 PTS').and('contain', 'NHL rights').and('contain', 'Recalled 2× in the past year')
    cy.get('[data-group="F"] .callup-more').should('contain', 'Show all 4').click()
    cy.get('[data-group="F"] .callup-candidate').should('have.length', 4).last()
      .should('contain', 'Sep 25: Placed F Fourth Forward on waivers.')
  })

  it('lists players already up, hurt on the affiliate, under the games bar, and of unknown position', () => {
    openOverview(WATCH)
    cy.get('[data-group="G"] .callup-up').should('contain', 'Up with CAR now: Pyotr Kochetkov')
    cy.get('[data-group="D"] .callup-hurt').should('contain', 'Injured, with CHI: Hurt Defender')
    cy.get('[data-group="G"] .callup-candidate').should('contain', '.909 SV% in 1 GP').and('contain', 'Under 5 AHL games')
    cy.get('.callup-unplaced').should('contain', 'Mystery Player')
    cy.get('.callup-watch').should('contain', 'Not a prediction')
  })

  it("says so when the route can't answer", () => {
    openOverview({ statusCode: 502, body: { error: 'x' } })
    cy.get('.callup-watch').should('contain', 'unavailable right now')
  })
})
