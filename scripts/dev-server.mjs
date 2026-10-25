import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { createServer } from 'node:net'
import { resolve } from 'node:path'

const port = Number.parseInt(process.env.PORT || String(portFromLocalOrigin() || 3000), 10)
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}

const vercelCli = resolve('node_modules', 'vercel', 'dist', 'vc.js')
await access(vercelCli)
await assertPortAvailable(port)

const localHost = portFromLocalOrigin() ? new URL(process.env.APP_ORIGIN).hostname : 'localhost'
const serviceUrl = `http://${localHost}:${port}`
const child = spawn(process.execPath, [vercelCli, 'dev', '--listen', String(port), ...process.argv.slice(2)], {
  // The CLI's optional update-check worker can time out on Windows and write
  // to a closed IPC pipe. Local startup does not need a registry version check.
  env: { ...process.env, NO_UPDATE_NOTIFIER: '1' },
  stdio: 'inherit',
  windowsHide: true,
})

let childExited = false
let announced = false

child.once('exit', (code, signal) => {
  childExited = true
  if (!announced && code !== 0) {
    console.error(`Development server stopped before becoming ready${signal ? ` (${signal})` : ''}.`)
  }
  process.exitCode = code ?? 1
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal))
}

const deadline = Date.now() + 60_000
while (!childExited && Date.now() < deadline) {
  try {
    const response = await fetch(serviceUrl, { redirect: 'manual', signal: AbortSignal.timeout(2000) })
    const contentType = response.headers.get('content-type') || ''
    if (response.ok && contentType.includes('text/html')) {
      announced = true
      console.log(`\nService started at ${serviceUrl}`)
      break
    }
  } catch {
    // The Vercel proxy is still starting.
  }
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
}

if (!childExited && !announced) {
  console.warn(`Server process is still running, but ${serviceUrl} was not reachable after 60 seconds.`)
}

async function assertPortAvailable(portToCheck) {
  const url = `http://127.0.0.1:${portToCheck}`
  let existingHttpService = false
  try {
    await fetch(url, { signal: AbortSignal.timeout(750) })
    existingHttpService = true
  } catch {
    // No HTTP service responded; verify that the socket can be bound as well.
  }
  if (existingHttpService) {
    throw new Error(`Port ${portToCheck} is already serving HTTP. Stop that service or set a different PORT.`)
  }

  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer()
    probe.unref()
    probe.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        rejectPort(new Error(`Port ${portToCheck} is already in use. Stop that service or set a different PORT.`))
        return
      }
      rejectPort(error)
    })
    probe.listen({ host: '127.0.0.1', port: portToCheck }, () => probe.close(resolvePort))
  })
}

function portFromLocalOrigin() {
  if (!process.env.APP_ORIGIN) return null
  try {
    const origin = new URL(process.env.APP_ORIGIN)
    if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname)) return null
    const portFromOrigin = Number.parseInt(origin.port || '80', 10)
    return Number.isInteger(portFromOrigin) && portFromOrigin >= 1 && portFromOrigin <= 65_535 ? portFromOrigin : null
  } catch {
    return null
  }
}
