// cypress/e2e/landing.cy.js
// The marketing landing page (views/LandingView.jsx) and the routing gate in
// front of it (utils/landingGate.js, App.jsx):
//   /          web visitor with no saved team -> landing; team saved -> app
//   /welcome   always the landing
//   /app       no team -> team picker; team saved -> the app at /
//   anything else (a shared /game/:id, a notification's /?summary=) with no
//   team -> the team picker, never the landing
//
// cypress/support/e2e.js seeds eyewall:team before every test; the "no team"
// cases take it out again in onBeforeLoad, the way TeamPicker.cy.js does.
// The hero's replay (/nhl/goal-replay) and the scorecard are stubbed so the
// page renders the same whatever the Worker is doing. The media tests check
// the clips' attributes, the reduced-motion stills, the theme's screenshots
// and that every fingerprinted /landing/ file (and the og:image) exists.

const noTeam = (extra) => (win) => {
  win.localStorage.removeItem('eyewall:team')
  extra?.(win)
}

const SCORECARD = {
  models: {
    game_winner: {
      live: { status: 'ok', n: 136, period: '2026-27', accuracy: 0.6029, brier: 0.2335, baseline: { name: 'home_team_wins', accuracy: 0.5662, brier: 0.2456 } },
    },
    starting_goalie: {
      live: { status: 'ok', n: 194, period: '2026-27', accuracy: 0.7165, brier: 0.395, baseline: { name: 'last_games_starter', accuracy: 0.4053, brier: null } },
    },
    playoff_odds: {
      live: { status: 'pending', n: 0, period: '2026-27', accuracy: null, brier: null, baseline: null },
      backtest: { status: 'ok', n: 384, period: '2023-24 to 2025-26', accuracy: 0.7161, brier: 0.1615, baseline: { name: 'holds_a_playoff_spot', accuracy: 0.7135, brier: 0.224 } },
    },
  },
}

function stubLandingData() {
  cy.intercept('GET', '**/nhl/goal-replay/**', { fixture: 'goal-replay.json' }).as('replay')
  cy.intercept('GET', '**/scorecard', { body: SCORECARD }).as('scorecard')
}

describe('Landing page routing', () => {
  beforeEach(stubLandingData)

  it('shows the landing at / to a web visitor with no saved team', () => {
    cy.visit('/', { onBeforeLoad: noTeam() })
    cy.get('.landing-view').should('exist')
    cy.get('.landing-headline').should('contain.text', 'Every shot. Every goal.')
    cy.get('.topbar').should('not.exist')
    cy.get('.team-picker-overlay').should('not.exist')
  })

  it('keeps a returning visitor (team saved) in the app at /', () => {
    cy.visit('/')
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.get('.landing-view').should('not.exist')
  })

  it('always shows the landing at /welcome, team saved or not', () => {
    cy.visit('/welcome')
    cy.get('.landing-view').should('exist')
    cy.get('.topbar').should('not.exist')
  })

  it('/app opens the team picker when no team is saved', () => {
    cy.visit('/app', { onBeforeLoad: noTeam() })
    cy.contains('Choose your league', { timeout: 10000 }).should('be.visible')
    cy.get('.landing-view').should('not.exist')
  })

  it('/app goes straight into the app when a team is saved', () => {
    cy.visit('/app')
    cy.get('.topbar', { timeout: 10000 }).should('exist')
    cy.location('pathname').should('eq', '/')
  })

  it('a shared game link with no team still opens the team picker, not the landing', () => {
    cy.visit('/game/2025021237', { onBeforeLoad: noTeam() })
    cy.contains('Choose your league', { timeout: 10000 }).should('be.visible')
    cy.get('.landing-view').should('not.exist')
  })

  it('a notification link to / with no team opens the team picker, not the landing', () => {
    cy.visit('/?summary=2&game=2025021237', { onBeforeLoad: noTeam() })
    cy.contains('Choose your league', { timeout: 10000 }).should('be.visible')
    cy.get('.landing-view').should('not.exist')
  })
})

describe('Landing page content', () => {
  beforeEach(() => {
    stubLandingData()
    cy.visit('/', { onBeforeLoad: noTeam() })
    cy.get('.landing-view').should('exist')
  })

  it('offers both calls to action, App Store first', () => {
    cy.get('.landing-hero .landing-ctas a').should('have.length', 2)
    cy.get('.landing-hero .landing-ctas a').first()
      .should('have.class', 'landing-cta-store')
      .and('have.attr', 'href', 'https://apps.apple.com/app/eyewall-analytics/id6811195260')
    cy.get('.landing-hero .landing-ctas a').last()
      .should('have.class', 'landing-cta-web')
      .and('have.attr', 'href', '/app')
      .and('contain.text', 'Use it in your browser')
    // Nav and the closing section carry the same pair.
    cy.get('.landing-nav .landing-cta-store').should('exist')
    cy.get('.landing-nav .landing-cta-web').should('have.attr', 'href', '/app')
    cy.get('.landing-get .landing-cta-store').should('exist')
    cy.get('.landing-get .landing-cta-web').should('have.attr', 'href', '/app')
  })

  it('never offers a Google Play badge', () => {
    cy.get('.landing-view').should('not.contain.text', 'Google Play')
  })

  it('plays the hero goal replay from the Worker', () => {
    cy.wait('@replay').its('request.url').should('include', '/nhl/goal-replay/2025021237/1113')
    cy.get('.landing-hero-replay .goal-tracking-replay').should('exist')
    cy.get('.landing-hero-replay .goal-tracking-player').should('have.length.greaterThan', 0)
    cy.get('.landing-hero-replay figcaption').should('contain.text', 'Jaccob Slavin')
  })

  it('shows the scorecard tiles from /scorecard', () => {
    cy.wait('@scorecard')
    cy.get('.landing-scorecard-tile').should('have.length', 3)
    cy.get('.landing-scorecard-tile').eq(0).should('contain.text', '60.3%')
    cy.get('.landing-scorecard-tile').eq(2).should('contain.text', '0.162').and('contain.text', 'Backtest')
    cy.get('.landing-scorecard a[href="/methodology"]').should('exist')
  })

  it('links the footer to the methodology, privacy and delete-account pages', () => {
    cy.get('.landing-footer a[href="/methodology"]').should('exist')
    cy.get('.landing-footer a[href="/privacy.html"]').should('exist')
    cy.get('.landing-footer a[href="/delete-account.html"]').should('exist')
    cy.get('.landing-footer a[href="https://www.instagram.com/eyewallanalytics"]').should('exist')
  })

  it('switches to French from the footer', () => {
    cy.get('.landing-language button[lang="fr"]').scrollIntoView().click()
    cy.get('.landing-headline').should('contain.text', 'Chaque tir.')
    cy.get('.landing-language button[lang="fr"]').should('have.attr', 'aria-pressed', 'true')
    cy.get('html').should('have.attr', 'lang', 'fr')
    cy.window().its('localStorage').invoke('getItem', 'eyewall:locale').should('eq', 'fr')
  })
})

describe('Landing page fallbacks', () => {
  it('draws the hero from the bundled replay when the Worker fails', () => {
    cy.intercept('GET', '**/nhl/goal-replay/**', { statusCode: 500, body: {} }).as('replay')
    cy.intercept('GET', '**/scorecard', { body: SCORECARD })
    cy.visit('/', { onBeforeLoad: noTeam() })
    cy.wait('@replay')
    cy.get('.landing-hero-replay .goal-tracking-replay', { timeout: DATA_TIMEOUT }).should('exist')
  })

  it('leaves the scorecard section out when /scorecard fails', () => {
    cy.intercept('GET', '**/nhl/goal-replay/**', { fixture: 'goal-replay.json' })
    cy.intercept('GET', '**/scorecard', { statusCode: 500, body: {} }).as('scorecard')
    cy.visit('/', { onBeforeLoad: noTeam() })
    cy.wait('@scorecard')
    cy.get('.landing-get').should('exist')
    cy.get('.landing-scorecard').should('not.exist')
  })
})

describe('Landing page media', () => {
  beforeEach(stubLandingData)

  it('autoplays the two clips muted and inline, each with a poster', () => {
    cy.visit('/', { onBeforeLoad: noTeam() })
    cy.get('video.landing-clip').should('have.length', 2).each($video => {
      expect($video.prop('muted'), 'muted').to.equal(true)
      expect($video.prop('autoplay'), 'autoplay').to.equal(true)
      expect($video.prop('loop'), 'loop').to.equal(true)
      expect($video.attr('playsinline'), 'playsinline').to.not.equal(undefined)
      expect($video.attr('preload')).to.equal('none')
      expect($video.attr('poster')).to.match(/^\/landing\/[a-z-]+\.[0-9a-f]{8}\.jpg$/)
    })
    cy.get('.landing-feature-live video.landing-clip').should('exist')
    cy.get('.landing-feature-replays video.landing-clip').should('exist')
  })

  it('serves every landing file under a fingerprinted name that exists', () => {
    cy.visit('/', { onBeforeLoad: noTeam() })
    cy.get('.landing-view img[src^="/landing/"], .landing-view video').each($el => {
      ;[$el.attr('src'), $el.attr('poster')].filter(Boolean).forEach(src => {
        expect(src).to.match(/^\/landing\/[a-z-]+\.[0-9a-f]{8}\.(jpg|png|mp4)$/)
        cy.request(src).its('status').should('eq', 200)
      })
    })
    cy.get('meta[property="og:image"]').invoke('attr', 'content').then(url => {
      expect(url).to.match(/^https:\/\/eyewallanalytics\.com\/landing\/og\.[0-9a-f]{8}\.png$/)
      cy.request(new URL(url).pathname).its('status').should('eq', 200)
    })
  })

  it('shows the stills instead of the clips under reduced motion', () => {
    cy.visit('/', {
      onBeforeLoad: noTeam(win => {
        const real = win.matchMedia.bind(win)
        win.matchMedia = query => (query.includes('prefers-reduced-motion')
          ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }
          : real(query))
      }),
    })
    cy.get('.landing-view').should('exist')
    cy.get('video.landing-clip').should('not.exist')
    cy.get('.landing-feature-live img.landing-shot-dark').should('have.length', 1)
    cy.get('.landing-feature-replays img.landing-shot-dark').should('have.length', 2)
  })

  ;['dark', 'light'].forEach(scheme => {
    const other = scheme === 'dark' ? 'light' : 'dark'
    it(`shows the ${scheme} screenshots in the ${scheme} theme`, () => {
      cy.visit('/', {
        onBeforeLoad: noTeam(win => { win.__eyewallSystemScheme = scheme }),
      })
      cy.get('html').should('have.attr', 'data-theme', scheme)
      cy.get(`.landing-feature-teams img.landing-shot-${scheme}`).scrollIntoView().should('be.visible')
      cy.get(`.landing-feature-teams img.landing-shot-${other}`).should('not.be.visible')
      cy.get(`.landing-leagues img.landing-shot-${scheme}`).should('have.length', 2)
    })
  })
})

describe('Landing page on a phone', () => {
  beforeEach(() => {
    stubLandingData()
    cy.viewport(375, 812)
  })

  ;['dark', 'light'].forEach(scheme => {
    it(`has no horizontal scroll at 375 px (${scheme})`, () => {
      cy.visit('/', {
        onBeforeLoad: noTeam(win => { win.__eyewallSystemScheme = scheme }),
      })
      cy.get('.landing-view').should('exist')
      cy.get('html').should('have.attr', 'data-theme', scheme)
      cy.get('.landing-hero-replay .goal-tracking-replay').should('exist')
      cy.scrollTo('bottom')
      cy.get('.landing-footer').should('be.visible')
      cy.document().then(doc => {
        expect(doc.documentElement.scrollWidth, 'page width').to.be.at.most(doc.documentElement.clientWidth)
      })
    })
  })
})
