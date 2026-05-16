import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

const FINNHUB_TOKEN = 'd83btq9r01qjsh1kvgigd83btq9r01qjsh1kvgj0'
const NVIDIA_API_KEY = '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'

export default defineConfig({
  plugins: [react()],
  define: {
    __FINNHUB_TOKEN__: JSON.stringify(FINNHUB_TOKEN),
  },
  server: {
    port: 4173,
    proxy: {
      '/api/finnhub': {
        target: 'https://finnhub.io/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/finnhub/, ''),
      },
      '/api/nvidia': {
        target: 'https://integrate.api.nvidia.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Authorization', `Bearer ${NVIDIA_API_KEY}`)
          })
          proxy.on('error', (_err: Error, _req: IncomingMessage, res: ServerResponse) => {
            if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'nvidia_unavailable' }))
          })
        },
      },
    },
  },
})
