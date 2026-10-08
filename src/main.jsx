import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import { i18nReady } from './i18n'
import 'react-hockey-rink/styles.css'
import './index.css'
import './light-mode-overrides.css'
import './tailwind.css'
import App from './App.jsx'
import { TEAM_CONFIG } from './utils/teamConfig'
import { initCaptureMode } from './utils/captureMode'

initCaptureMode()

// Initialise PostHog — only in production builds (not local dev)
if (import.meta.env.PROD) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host:          'https://us.i.posthog.com',
    capture_pageview:  false,  // handled manually via PageTracker in App.jsx
    capture_pageleave: true,
    persistence:       'localStorage',
    // Neither is used (no recordings or surveys are set up in PostHog), and
    // each would otherwise fetch its own script after load.
    disable_session_recording: true,
    disable_surveys:           true,
  });

  // Tag every event with the environment so staging and prod can be filtered
  // separately in the PostHog dashboard, and with the selected NHL team so
  // any insight breaks down by team (a team switch reloads the page, so
  // this is always the current pick).
  posthog.register({
    environment: window.location.hostname === 'eyewallanalytics.com'
      ? 'production'
      : 'staging',
    team: TEAM_CONFIG.abbr,
  });
}

// After the language's strings are in (French is its own chunk, see
// i18n/index.js), so nothing renders in English first; a failed load still
// renders, in English.
i18nReady.catch(() => {}).finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
