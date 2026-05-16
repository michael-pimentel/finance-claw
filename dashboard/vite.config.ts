import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

const GATEWAY = 'http://127.0.0.1:18789'
const TOKEN = 'finance-claw-dev-token'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      '/api': {
        target: GATEWAY,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Authorization', `Bearer ${TOKEN}`)
          })
          // Log proxy errors so gateway connection issues surface clearly
          proxy.on('error', (_err: Error, _req: IncomingMessage, res: ServerResponse) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
            }
            res.end(JSON.stringify({ error: 'gateway_unavailable', message: 'OpenClaw gateway not reachable at port 18789. Run: pnpm start' }))
          })
        },
      },
    },
  },
})
