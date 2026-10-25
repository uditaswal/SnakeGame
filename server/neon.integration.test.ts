// @vitest-environment node

import { createHash } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createGame, createSeededRandom, getTickDelay, startGame, stepGame } from '../src/game/engine.js'
import register from '../api/auth/register.js'
import account from '../api/auth/account.js'
import session from '../api/auth/session.js'
import challenge from '../api/runs/challenge.js'
import submit from '../api/runs/submit.js'
import { getSql } from './db.js'
import { getClientKey, getIdentifierKey, type ApiRequest, type ApiResponse } from './http.js'

type JsonRecord = Record<string, unknown>

class TestResponse implements ApiResponse {
  statusCode = 200
  body: unknown
  ended = false
  readonly headers = new Map<string, string>()

  setHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), value)
    return this
  }

  status(code: number): this {
    this.statusCode = code
    return this
  }

  json(body: unknown): void {
    this.body = body
  }

  end(): void {
    this.ended = true
  }
}

const runNeonE2e = process.env.NEON_E2E === '1'

describe.runIf(runNeonE2e)('Neon production integration', () => {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
  const username = `Verify${suffix}`
  const usernameKey = username.toLowerCase()
  const password = `Test-${suffix}-password!`
  const clientIp = `198.51.100.${Number.parseInt(suffix.slice(0, 2), 16) % 250 + 1}`
  const cookies: Record<string, string> = {}
  const rateLimitKeys = new Set<string>()
  let userId: string | undefined
  let challengeHash: string | undefined

  function request(method: string, body?: JsonRecord): ApiRequest {
    return {
      method,
      headers: {
        origin: process.env.APP_ORIGIN,
        'content-type': 'application/json',
        'x-forwarded-for': clientIp,
      },
      body,
      cookies: { ...cookies },
    }
  }

  function rememberClientKey(req: ApiRequest, purpose: string): void {
    rateLimitKeys.add(getClientKey(req, purpose))
  }

  function acceptSessionCookie(response: TestResponse): void {
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeDefined()
    const [cookie] = setCookie!.split(';', 1)
    const separator = cookie.indexOf('=')
    cookies[cookie.slice(0, separator)] = cookie.slice(separator + 1)
  }

  afterAll(async () => {
    const sql = getSql()
    await sql.transaction([
      ...(userId ? [sql`DELETE FROM scores WHERE user_id = ${userId}`] : []),
      ...(challengeHash ? [sql`DELETE FROM run_challenges WHERE token_hash = ${challengeHash}`] : []),
      sql`DELETE FROM users WHERE username_key = ${usernameKey}`,
    ])
    if (rateLimitKeys.size > 0) {
      await sql.transaction(
        [...rateLimitKeys].map((key) => sql`DELETE FROM rate_limits WHERE key = ${key}`),
      )
    }
  })

  it('registers, authenticates, saves one valid run, rejects replay, and deletes the account', async () => {
    const registerRequest = request('POST', { username, password })
    rememberClientKey(registerRequest, 'register')
    const registerResponse = new TestResponse()
    await register(registerRequest, registerResponse)

    expect(registerResponse.statusCode).toBe(201)
    const registeredUser = (registerResponse.body as { user: { id: string; username: string } }).user
    expect(registeredUser.username).toBe(username)
    userId = registeredUser.id
    acceptSessionCookie(registerResponse)

    const sessionResponse = new TestResponse()
    await session(request('GET'), sessionResponse)
    expect(sessionResponse.statusCode).toBe(200)
    expect((sessionResponse.body as { user: { id: string } }).user.id).toBe(userId)

    const challengeRequest = request('POST', { columns: 12, rows: 12 })
    challengeRequest.cookies = {}
    rememberClientKey(challengeRequest, 'run-challenge')
    const challengeResponse = new TestResponse()
    await challenge(challengeRequest, challengeResponse)
    expect(challengeResponse.statusCode).toBe(201)
    const issued = challengeResponse.body as { challenge: string; engineVersion: number; columns: number; rows: number }
    challengeHash = createHash('sha256').update(issued.challenge).digest('hex')
    expect((challengeResponse.body as { seed: number }).seed).toBeGreaterThanOrEqual(0)
    expect((challengeResponse.body as { seed: number }).seed).toBeLessThanOrEqual(2_147_483_647)

    const config = { columns: issued.columns, rows: issued.rows, initialSpeedMs: 130, minimumSpeedMs: 62, speedStepMs: 3 }
    const random = createSeededRandom((challengeResponse.body as { seed: number }).seed)
    let game = startGame(createGame(config, random))
    let durationMs = 0
    while (game.status === 'running') {
      durationMs += getTickDelay(game.score, config)
      game = stepGame(game, config, random)
    }
    const run = {
      challenge: issued.challenge,
      engineVersion: issued.engineVersion,
      score: game.score,
      durationMs,
      ticks: game.ticks,
      columns: issued.columns,
      rows: issued.rows,
      moves: [],
    }
    const submitRequest = request('POST', run)
    rememberClientKey(submitRequest, 'score-submit')
    rateLimitKeys.add(getIdentifierKey('score-user', userId))
    const submitResponse = new TestResponse()
    await submit(submitRequest, submitResponse)
    expect(submitResponse.statusCode).toBe(201)
    expect(submitResponse.body).toMatchObject({ saved: true, score: game.score })

    const sql = getSql()
    const saved = await sql`
      SELECT scores.score
      FROM scores
      JOIN users ON users.id = scores.user_id
      WHERE users.username_key = ${usernameKey}
    ` as Array<{ score: number }>
    expect(saved).toEqual([{ score: game.score }])

    const replayResponse = new TestResponse()
    await submit(request('POST', run), replayResponse)
    expect(replayResponse.statusCode).toBe(409)
    expect(replayResponse.body).toMatchObject({ error: { code: 'INVALID_CHALLENGE' } })

    const deleteRequest = request('DELETE', { password })
    rememberClientKey(deleteRequest, 'delete-account')
    const deleteResponse = new TestResponse()
    await account(deleteRequest, deleteResponse)
    expect(deleteResponse.statusCode).toBe(204)
    expect(deleteResponse.ended).toBe(true)

    const remaining = await sql`
      SELECT
        (SELECT count(*)::int FROM users WHERE username_key = ${usernameKey}) AS users,
        (SELECT count(*)::int FROM scores WHERE user_id = ${userId}) AS scores,
        (SELECT count(*)::int FROM run_challenges WHERE token_hash = ${challengeHash}) AS challenges
    ` as Array<{ users: number; scores: number; challenges: number }>
    expect(remaining[0]).toEqual({ users: 0, scores: 0, challenges: 0 })
  }, 30_000)
})
