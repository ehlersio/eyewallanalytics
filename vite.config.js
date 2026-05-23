import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    // Produce smaller chunks for faster initial load
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor libs into a separate chunk so app code
        // can be cached independently
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },

  server: {
    port: 5173,
    proxy: {
      // Dev-only proxies — in production the Netlify edge function
      // at netlify/edge-functions/nhl-proxy.js handles these routes
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
})
