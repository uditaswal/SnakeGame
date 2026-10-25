import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ApiRequest, ApiResponse } from '../../server/http.js'

const { getSql } = vi.hoisted(() => ({ getSql: vi.fn() }))

vi.mock('../../server/db.js', () => ({ getSql }))
vi.mock('../../server/rate-limit.js', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../server/session.js', () => ({
  requireSessionUser: vi.fn().mockResolvedValue({
    id: '635a92ec-cd1f-4d99-a012-f932655e4435',
    username: 'PlayerOne',
  }),
}))

import handler from './submit.js'

beforeAll(() => {
  process.env.APP_ORIGIN = 'https://snake.example'
  process.env.DATABASE_URL = 'postgresql://test:test@example.invalid/snake_game'
  process.env.RATE_LIMIT_SECRET = 'test-only-rate-limit-secret-that-is-long-enough'
})

describe('score submission boundary', () => {
  it('rejects an implausible score before querying Postgres', async () => {
    const request: ApiRequest = {
      method: 'POST',
      headers: { origin: 'https://snake.example', 'content-type': 'application/json' },
      cookies: { snake_session: 'test-session' },
      body: {
        challenge: 'a'.repeat(43),
        engineVersion: 1,
        score: 2_398,
        durationMs: 60_000,
        ticks: 1_000,
      },
    }
    const payloads: unknown[] = []
    const status = vi.fn()
    const response: ApiResponse = {
      setHeader: vi.fn(),
      status,
      json: vi.fn((payload: unknown) => { payloads.push(payload) }),
      end: vi.fn(),
    }
    status.mockReturnValue(response)

    await handler(request, response)

    expect(status).toHaveBeenCalledWith(400)
    expect(payloads).toContainEqual({
      error: { code: 'IMPLAUSIBLE_RUN', message: 'The score exceeds the board limit.' },
    })
    expect(getSql).not.toHaveBeenCalled()
  })
})
