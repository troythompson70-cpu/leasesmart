import type { Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { serveCommandCenter } from './server/command-center-static.ts'
import { handleDashboardFeedRequest } from './server/dashboard-feed-http.ts'
import { handleHealthRequest } from './server/health-http.ts'
import { handleIntakeRequest } from './server/intake-http.ts'
import { markHelperUp } from './server/helper-heartbeat.ts'
import { handlePipelineApprovalRequest, startPipelineApprovalLoop } from './server/pipeline-approvals.ts'
import { writeSystemMode } from './server/system-mode.ts'
import { startWebsiteLeadCopyLoop } from './server/website-lead-copy.ts'

function localApiPlugin(): Plugin {
  return {
    name: 'tgt-local-api',
    configureServer(server) {
      markHelperUp()
      void writeSystemMode('RUN', 'helper listening').catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[system-mode] ${message}`)
      })
      startWebsiteLeadCopyLoop()
      startPipelineApprovalLoop()
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
      server.middlewares.use('/api/pipeline-approval', (req, res) => {
        void handlePipelineApprovalRequest(req, res)
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
      server.middlewares.use('/api/pipeline-approval', (req, res) => {
        void handlePipelineApprovalRequest(req, res)
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
