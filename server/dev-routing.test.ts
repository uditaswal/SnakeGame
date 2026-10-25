// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { reactCspPreamble } from './vite-react-csp'

const routing = JSON.parse(readFileSync('vercel.json', 'utf8')) as { rewrites: { source: string; destination: string }[] }
const rules = routing.rewrites.map(rule => ({ ...rule, pattern: new RegExp(`^${rule.source}$`) }))
let vite: ViteDevServer
const http = createHttpServer((request, response) => {
  const path = new URL(request.url!, 'http://localhost').pathname
  const rule = rules.find(candidate => candidate.pattern.test(path))
  if (rule) request.url = rule.destination
  vite.middlewares(request, response)
})
let origin: string

beforeAll(async () => {
  vite = await createServer({ configFile: false, plugins: [react(), reactCspPreamble()], server: { middlewareMode: true, hmr: { server: http } } })
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve))
  const address = http.address() as { port: number }
  origin = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await vite?.close()
  http.closeAllConnections()
  await new Promise<void>(resolve => http.close(() => resolve()))
})

it('serves the React refresh runtime as JavaScript through the SPA rewrite rules', async () => {
  const response = await fetch(`${origin}/@react-refresh`, { headers: { accept: '*/*' } })
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toMatch(/javascript/)
  expect(await response.text()).not.toContain('<!doctype html>')
})

it('keeps API and development module requests out of the HTML fallback', () => {
  for (const path of ['/api/auth/session', '/@vite/client', '/@id/virtual-module', '/@fs/C:/project/file', '/node_modules/.vite/deps/react.js']) {
    expect(rules.some(rule => rule.pattern.test(path)), path).toBe(false)
  }
  for (const path of ['/play', '/account', '/privacy']) {
    expect(rules.some(rule => rule.pattern.test(path)), path).toBe(true)
  }
})

it('serves the refresh preamble externally before application modules under a strict CSP', async () => {
  const response = await fetch(`${origin}/`, { headers: { accept: 'text/html' } })
  expect(response.status).toBe(200)
  const html = await response.text()
  expect(html).toContain('src="/@snake/react-preamble.js"')
  expect(html.indexOf('/@snake/react-preamble.js')).toBeLessThan(html.indexOf('/src/main.tsx'))
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    expect(script[1]).toMatch(/\bsrc=/)
    expect(script[2].trim()).toBe('')
  }
  const preamble = await fetch(`${origin}/@snake/react-preamble.js`)
  expect(preamble.status).toBe(200)
  expect(preamble.headers.get('content-type')).toMatch(/javascript/)
  expect(await preamble.text()).toBe(react.preambleCode.replace('__BASE__', '/'))
})
