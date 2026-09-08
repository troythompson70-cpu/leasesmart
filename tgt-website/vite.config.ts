import type { Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { handleIntakeRequest } from './server/intake-http.ts'

function intakeApiPlugin(): Plugin {
  return {
    name: 'tgt-intake-api',
    configureServer(server) {
      server.middlewares.use('/api/intake', (req, res) => {
        void handleIntakeRequest(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/intake', (req, res) => {
        void handleIntakeRequest(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), intakeApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
