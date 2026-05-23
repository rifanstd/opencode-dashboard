import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-sync',
      configureServer(server) {
        server.middlewares.use('/api/sync', (_req, res) => {
          res.setHeader('Content-Type', 'application/json')
          const scriptPath = path.join(__dirname, 'scripts', 'sync-opencode-data.js')
          const child = spawn('node', [scriptPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
          })

          let stdout = ''
          let stderr = ''

          child.stdout.on('data', (data) => {
            stdout += data.toString()
          })

          child.stderr.on('data', (data) => {
            stderr += data.toString()
          })

          child.on('close', (code) => {
            if (code === 0) {
              res.statusCode = 200
              res.end(JSON.stringify({ success: true, message: 'Sync completed successfully' }))
            } else {
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, message: stderr || stdout || 'Sync failed' }))
            }
          })

          child.on('error', (err) => {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, message: err.message }))
          })
        })
      },
    },
  ],
})
