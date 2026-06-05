import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',

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
  },
})
