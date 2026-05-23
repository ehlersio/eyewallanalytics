import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // NHL game/stats API
      '/nhl-api': {
        target: 'https://api-web.nhle.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/nhl-api/, ''),
      },
      // NHL stats REST API (skater/goalie leaderboards)
      '/nhl-stats': {
        target: 'https://api.nhle.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/nhl-stats/, ''),
      },
      // NHL team logos + assets CDN
      '/nhl-assets': {
        target: 'https://assets.nhle.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/nhl-assets/, ''),
      },
    },
  },
})
