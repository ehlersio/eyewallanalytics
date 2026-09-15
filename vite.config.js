import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Load .env, .env.local etc — exposes VITE_ prefixed vars to Node at config time
  const env = loadEnv(mode, process.cwd(), '')

  return {
  // tailwindcss() only processes files that @import "tailwindcss" (see
  // src/components/PlayerComparisonPopup.css) -- it doesn't touch the
  // rest of the app's plain global CSS files.
  plugins: [react(), tailwindcss()],

  // ── Dev server ──────────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      '/nhl-api': {
        target: 'https://api-web.nhle.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/nhl-api/, ''),
      },
      '/nhl-stats': {
        target: 'https://api.nhle.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/nhl-stats/, ''),
      },
      '/nhl-assets': {
        target: 'https://assets.nhle.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/nhl-assets/, ''),
      },
      // Proxy Claude API — injects API key server-side, never in client bundle
      '/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/anthropic/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const key = env.VITE_ANTHROPIC_API_KEY;
            if (key) {
              proxyReq.setHeader('x-api-key', key);
              proxyReq.setHeader('anthropic-version', '2023-06-01');
              // Required when request originates from a browser Origin
              proxyReq.setHeader('anthropic-dangerous-direct-browser-access', 'true');
              // Remove Origin so Anthropic doesn't treat this as a CORS request
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
            }
          });
        },
      },
    },
  },

  // ── Production build ─────────────────────────────────────────
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // react-router-dom v7 is a thin wrapper -- its actual routing code
          // lives in a nested react-router dependency, not in
          // node_modules/react-router-dom/ itself, so that has to be matched
          // too or none of it lands in 'vendor' (react-router-dom v6->v7
          // migration).
          if (['react', 'react-dom', 'react-router-dom', 'react-router'].some((pkg) => id.includes(`/node_modules/${pkg}/`))) {
            return 'vendor'
          }
          // No manual group for popup-only components. A 'player-popup-extras'
          // group (SeasonOverlayChart/PlayerComparisonEntry) used to live
          // here, but Rolldown pulls a manual group's dependencies into it --
          // Recharts, posthog-js, i18next -- and eager code needs those, so
          // the whole 1.1 MB chunk got modulepreloaded on every first load
          // (2026-09). The real fix was real lazy() boundaries: PlayerSearch
          // lazy-loads all four player popups, and ShotMapView lazy-loads its
          // one Recharts chart (MomentumWaveChart). Check dist/index.html's
          // modulepreload list after any chunking change.
        },
      },
    },
  },

  // ── Vitest ───────────────────────────────────────────────────
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/utils/**', 'src/views/**'],
    },
  },
  }
})
