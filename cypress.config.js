import { defineConfig } from 'cypress'
import { configureVisualRegression } from 'cypress-visual-regression'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    env: {
      WORKER_URL: 'https://eyewall-poller.billowing-queen-bf23.workers.dev',
    },

    defaultCommandTimeout: 10000,
    pageLoadTimeout:       30000,
    requestTimeout:        10000,

    viewportWidth:  390,
    viewportHeight: 844,

    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',

    reporter: 'cypress-multi-reporters',
    reporterOptions: {
      reporterEnabled: 'mochawesome',
      mochawesomeReporterOptions: {
        reportDir:    'cypress/reports/json',
        overwrite:    false,
        html:         false,
        json:         true,
        quiet:        true,
      },
    },

    // ── Visual regression (Session 94, Phase 0) ────────────────
    // 'regression' compares against the committed baselines by default;
    // pass `--expose visualRegressionType=base` to (re)generate baselines
    // after a verified, intentional visual change.
    screenshotsFolder: './cypress/snapshots/actual',
    expose: {
      visualRegressionType: 'regression',
    },
    setupNodeEvents(on) {
      configureVisualRegression(on)
    },
  },
})
