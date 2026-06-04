import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load .env, .env.local etc — exposes VITE_ prefixed vars to Node at config time
  const env = loadEnv(mode, process.cwd(), '')

  return {
  plugins: [react()],

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
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
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
