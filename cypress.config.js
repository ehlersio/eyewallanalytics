import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',

    defaultCommandTimeout: 10000,
    pageLoadTimeout:       20000,
    requestTimeout:        10000,

    viewportWidth:  390,
    viewportHeight: 844,

    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',

    // Generate a JSON report per spec, merged into one HTML report after the run
    reporter: 'cypress-multi-reporters',
    reporterOptions: {
      reporterEnabled: 'mochawesome',
      mochawesomeReporterOptions: {
        reportDir:    'cypress/reports/json',
        overwrite:    false,
        html:         false,   // individual HTML per spec — we merge instead
        json:         true,
        quiet:        true,
      },
    },
  },
})
