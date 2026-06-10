import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import './index.css'
import './light-mode-overrides.css'
import App from './App.jsx'

// Initialise PostHog — only in production builds (not local dev)
if (import.meta.env.PROD) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host:          'https://us.i.posthog.com',
    capture_pageview:  false,  // handled manually via PageTracker in App.jsx
    capture_pageleave: true,
    persistence:       'localStorage',
  });

  // Tag every event with the environment so staging and prod can be filtered
  // separately in the PostHog dashboard
  posthog.register({
    environment: window.location.hostname === 'eyewallanalytics.com'
      ? 'production'
      : 'staging',
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
