// cypress/e2e/TeamPicker.cy.js
// TeamPicker previously had zero Cypress coverage. Session 34 shipped a real
// bug here — PWHL_ACTIVE_ABBRS/PWHL_EXPANSION_ABBRS were hardcoded and never
// actually read pwhlConfig.js's `comingSoon` flag, so flipping comingSoon to
// false for the 2026-27 expansion teams (DET/HAM/LV/SJS) did nothing; they
// stayed permanently disabled. Fixed by deriving both lists from `comingSoon`
// directly (see TeamPicker.jsx). This spec is the regression test that bug
// never had.

const PWHL_ABBRS = ['BOS', 'MIN', 'MTL', 'NY', 'OTT', 'TOR', 'SEA', 'VAN', 'DET', 'HAM', 'LV', 'SJS']

// Real displayColor hexes from pwhlConfig.js — used to confirm expansion
// teams render with their actual brand color, not the '#888' placeholder
// fallback TeamPicker uses when a team has no displayColor.
const EXPANSION_DISPLAY_COLORS = {
  DET: '#E3475E',
  HAM: '#E14C62',
  LV:  '#818916',
  SJS: '#0083ED',
}

function pwhlTile(abbr) {
  return cy.contains('.team-picker-abbr', abbr).parents('.team-picker-tile')
}

describe('TeamPicker', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.clear()
      },
    })
    cy.contains('Choose your league', { timeout: 10000 }).should('be.visible')
  })

  it('shows NHL and PWHL sport options', () => {
    // Visible text on this step is just the team-count description — the
    // sport identity itself is only exposed via aria-label/alt, not rendered text.
    cy.get('[aria-label="NHL"]').should('exist')
    cy.get('[aria-label="PWHL"]').should('exist')
  })

  it('PWHL option advertises all 12 teams', () => {
    cy.contains(/All 12 teams/i).should('exist')
  })

  it('shows the NHL/PWHL non-affiliation disclaimer', () => {
    cy.get('.team-picker-disclaimer').should('be.visible')
      .and('contain.text', 'not affiliated with')
      .and('contain.text', 'NHL')
      .and('contain.text', 'PWHL')
  })

  describe('PWHL team step', () => {
    beforeEach(() => {
      cy.get('[aria-label="PWHL"]').click()
      cy.contains('Choose your team', { timeout: 8000 }).should('be.visible')
    })

    it('renders all 12 PWHL teams', () => {
      PWHL_ABBRS.forEach(abbr => pwhlTile(abbr).should('exist'))
    })

    it('renders exactly 12 selectable tiles, none disabled', () => {
      cy.get('.team-picker-tile').should('have.length', 12)
      cy.get('.team-picker-tile--disabled').should('not.exist')
    })

    it('does not render a "coming soon" expansion section (no team is comingSoon right now)', () => {
      // PWHL_EXPANSION_ABBRS is empty today since every team's comingSoon is
      // false — the section is conditionally hidden entirely in that case.
      cy.contains(/2026.*Expansion/i).should('not.exist')
      cy.get('.team-picker-tile--disabled').should('not.exist')
    })

    it('expansion teams are not disabled (regression test for the Session 34 bug)', () => {
      ['DET', 'HAM', 'LV', 'SJS'].forEach(abbr => {
        pwhlTile(abbr).should('not.have.class', 'team-picker-tile--disabled')
        pwhlTile(abbr).should('not.be.disabled')
      })
    })

    it('expansion teams render with their real brand color, not a gray placeholder', () => {
      Object.entries(EXPANSION_DISPLAY_COLORS).forEach(([abbr, hex]) => {
        pwhlTile(abbr).should('have.attr', 'style').and('match', new RegExp(hex, 'i'))
        pwhlTile(abbr).should('have.attr', 'style').and('not.match', /#888/i)
      })
    })

    it('selecting an expansion team saves it and routes to PWHL', () => {
      pwhlTile('DET').click()
      cy.location('pathname', { timeout: 10000 }).should('eq', '/pwhl/shots')
      cy.window().then(win => {
        const stored = JSON.parse(win.localStorage.getItem('eyewall:pwhl_team'))
        expect(stored.abbr).to.eq('DET')
        expect(win.localStorage.getItem('eyewall:sport')).to.eq('pwhl')
      })
    })

    it('back button returns to the sport step', () => {
      cy.contains('← Back').click()
      cy.contains('Choose your league').should('be.visible')
    })
  })
})
