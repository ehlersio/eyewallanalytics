import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
})
