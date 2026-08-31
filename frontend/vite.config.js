import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Python backend runs as a separate service on :8000.
// In dev we proxy /api to it so the browser stays same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
