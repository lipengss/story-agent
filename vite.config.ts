import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'

/** Proxy middleware to forward LLM API calls without CORS issues */
function llmProxyPlugin() {
  return {
    name: 'llm-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/llm-proxy', async (req: any, res: any) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Target-Url, X-Forwarded-Headers',
          })
          res.end()
          return
        }
        if (req.method !== 'POST') {
          res.writeHead(405); res.end(); return
        }
        const targetUrl = req.headers['x-target-url']
        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'Missing X-Target-Url header' } }))
          return
        }
        let body = ''
        req.on('data', (chunk: any) => (body += chunk))
        req.on('end', async () => {
          try {
            const fwdHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
            try { Object.assign(fwdHeaders, JSON.parse(req.headers['x-forwarded-headers'] || '{}')) } catch {}
            const response = await fetch(targetUrl, { method: 'POST', headers: fwdHeaders, body })
            const text = await response.text()
            res.writeHead(response.status, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            })
            res.end(text)
          } catch (e: any) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: { message: `Proxy error: ${e.message}` } }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  // Relative base for Electron file:// protocol compatibility
  base: './',
  build: {
    emptyOutDir: true,
  },
  plugins: [
    vue(),
    llmProxyPlugin(),
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart(args) {
          args.startup()
        },
      },
      preload: {
        input: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
})