import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Each /api route → the server module + handler Vercel runs for it in production.
const DEV_API: Record<string, [module: string, handler: string]> = {
  '/api/dragon': ['/server/dragon.ts', 'handleDragon'],
  '/api/round1': ['/server/round1.ts', 'handleRound1'],
}

/** Serves /api/* during `npm run dev` with the same handlers Vercel runs in production. */
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      for (const [route, [modulePath, handlerName]] of Object.entries(DEV_API)) {
        server.middlewares.use(route, async (req, res) => {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const request = new Request(`http://localhost${route}`, {
            method: req.method,
            headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          })
          const mod = await server.ssrLoadModule(modulePath)
          const response: Response = await mod[handlerName](request, env)
          res.statusCode = response.status
          response.headers.forEach((value, name) => res.setHeader(name, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        })
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // '' prefix: the dev API also needs server-only vars like DRAGON_SECRET (never sent to the browser)
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ''))],
}))
