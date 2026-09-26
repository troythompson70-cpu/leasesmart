import type { Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { serveCommandCenter } from './server/command-center-static.ts'
import { handleDashboardFeedRequest } from './server/dashboard-feed-http.ts'
import { handleHealthRequest } from './server/health-http.ts'
import { handleIntakeRequest } from './server/intake-http.ts'

function localApiPlugin(): Plugin {
  return {
    name: 'tgt-local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        serveCommandCenter(req, res, next)
      })
      server.middlewares.use('/api/intake', (req, res) => {
        void handleIntakeRequest(req, res)
      })
      server.middlewares.use('/api/dashboard-feed', (req, res) => {
        void handleDashboardFeedRequest(req, res)
      })
      server.middlewares.use('/api/health', (req, res) => {
        void handleHealthRequest(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        serveCommandCenter(req, res, next)
      })
      server.middlewares.use('/api/intake', (req, res) => {
        void handleIntakeRequest(req, res)
      })
      server.middlewares.use('/api/dashboard-feed', (req, res) => {
        void handleDashboardFeedRequest(req, res)
      })
      server.middlewares.use('/api/health', (req, res) => {
        void handleHealthRequest(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
