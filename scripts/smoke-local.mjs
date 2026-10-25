import { randomBytes } from 'node:crypto'
import { createGame, createSeededRandom, getTickDelay, startGame, stepGame } from '../src/game/engine.ts'

const origin = (process.env.APP_ORIGIN || 'http://localhost:3001').replace(/\/$/, '')
const target = new URL(origin)
if (target.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/') {
  throw new Error('Smoke test only accepts a local HTTP origin.')
}

const suffix = randomBytes(6).toString('hex')
const username = `Verify${suffix}`
const password = `Test-${randomBytes(24).toString('base64url')}`
const testClientIp = `2001:db8::${randomBytes(6).toString('hex')}`
let cookie = ''
let registered = false

async function request(path, method = 'GET', body) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      Origin: origin,
      'X-Forwarded-For': testClientIp,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';', 1)[0]
  const payload = response.status === 204 ? null : await response.json()
  return { status: response.status, payload }
}

function expectStatus(result, status, step) {
  if (result.status !== status) {
    throw new Error(`${step}: expected HTTP ${status}, received ${result.status} (${result.payload?.error?.code || 'no error code'}).`)
  }
}

try {
  const page = await fetch(`${origin}/play`, { signal: AbortSignal.timeout(20_000) })
  if (!page.ok || !page.headers.get('content-type')?.includes('text/html')) throw new Error('Play page did not return HTML.')

  expectStatus(await request('/api/auth/session'), 200, 'Guest session')
  const registration = await request('/api/auth/register', 'POST', { username, password })
  expectStatus(registration, 201, 'Register')
  registered = true
  if (registration.payload?.user?.username !== username || !cookie) throw new Error('Registration did not establish a session.')

  const session = await request('/api/auth/session')
  expectStatus(session, 200, 'Signed-in session')
  if (session.payload?.user?.username !== username) throw new Error('Signed-in session did not identify the test user.')

  const issued = await request('/api/runs/challenge', 'POST', { columns: 12, rows: 12 })
  expectStatus(issued, 201, 'Run challenge')
  const challenge = issued.payload
  const config = { columns: challenge.columns, rows: challenge.rows, initialSpeedMs: 130, minimumSpeedMs: 62, speedStepMs: 3 }
  const random = createSeededRandom(challenge.seed)
  let game = startGame(createGame(config, random))
  let durationMs = 0
  while (game.status === 'running') {
    durationMs += getTickDelay(game.score, config)
    game = stepGame(game, config, random)
  }
  const run = {
    challenge: challenge.challenge,
    engineVersion: challenge.engineVersion,
    score: game.score,
    durationMs,
    ticks: game.ticks,
    columns: config.columns,
    rows: config.rows,
    moves: [],
  }
  expectStatus(await request('/api/runs/submit', 'POST', run), 201, 'Save score')
  const leaderboard = await request('/api/leaderboard')
  expectStatus(leaderboard, 200, 'Leaderboard')
  if (!leaderboard.payload?.entries?.some(entry => entry.username === username && entry.score === game.score)) {
    throw new Error('Saved score was missing from the leaderboard.')
  }
  expectStatus(await request('/api/runs/submit', 'POST', run), 409, 'Replay rejection')

  expectStatus(await request('/api/auth/account', 'DELETE', { password }), 204, 'Account deletion')
  registered = false
  const afterDelete = await request('/api/auth/session')
  expectStatus(afterDelete, 200, 'Deleted session')
  if (afterDelete.payload?.user !== null) throw new Error('Account session persisted after deletion.')
  console.log('Local full-stack smoke test passed: page, auth, score, leaderboard, replay rejection, deletion.')
} finally {
  if (registered && cookie) {
    try {
      await request('/api/auth/account', 'DELETE', { password })
    } catch {
      console.error('Test account cleanup failed; check the local database for a Verify-prefixed test user.')
    }
  }
}
