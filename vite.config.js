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
          // SeasonOverlayChart/PlayerComparisonEntry are only ever statically
          // imported from PlayerPopup.jsx/PWHLPlayerPopup.jsx, both of which
          // are themselves only reachable via lazy-loaded route chunks --
          // they'd previously landed in their own chunks purely via
          // Rollup/Rolldown's automatic "shared by 2+ async chunks"
          // heuristic, never an explicit lazy()/manualChunks boundary. That
          // heuristic's decision flipped -- both got silently absorbed into
          // the main entry chunk -- as a side effect of the unrelated
          // react-router-dom v6->v7 dependency-graph shape change, growing
          // the initial-load bundle by ~500 KiB. Pinning them explicitly so
          // this doesn't happen again on some other unrelated future bump.
          //
          // IceRink deliberately excluded from this group: unlike the other
          // two, it's ALSO statically imported by ShotMapView.jsx (the
          // eager, non-lazy default route), so it's genuinely needed on
          // initial load, not popup-only. Grouping it with these two was
          // tried first and wrongly dragged the other two into eager
          // modulepreload right alongside it -- verified via dist/index.html
          // listing player-popup-extras as a modulepreload target when
          // IceRink was included. Leaving it out lets it fall back to
          // Rollup/Rolldown's default chunking for its own (correctly eager)
          // dependency.
          if (['SeasonOverlayChart', 'PlayerComparisonEntry'].some((name) => id.includes(`/src/components/${name}.jsx`))) {
            return 'player-popup-extras'
          }
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
