import { beforeAll, describe, expect, it } from 'vitest'
import { ApiError, getJsonBody, requireSameOrigin, type ApiRequest } from './http'

beforeAll(() => {
  process.env.APP_ORIGIN = 'https://snake.example'
  process.env.DATABASE_URL = 'postgresql://test:test@example.invalid/snake_game'
  process.env.RATE_LIMIT_SECRET = 'test-only-rate-limit-secret-that-is-long-enough'
})

function request(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'POST',
    headers: { origin: 'https://snake.example', 'content-type': 'application/json' },
    body: {},
    cookies: {},
    ...overrides,
  }
}

describe('API request boundaries', () => {
  it('accepts only the configured browser origin', () => {
    expect(() => requireSameOrigin(request())).not.toThrow()
    expect(() => requireSameOrigin(request({ headers: { origin: 'https://attacker.example' } }))).toThrow(ApiError)
  })

  it('requires an application/json object body', () => {
    expect(getJsonBody(request({ body: { username: 'player' } }))).toEqual({ username: 'player' })
    expect(() => getJsonBody(request({ headers: { 'content-type': 'text/plain' } }))).toThrow('Send this request as JSON.')
    expect(() => getJsonBody(request({ body: [] }))).toThrow('Send a valid JSON object.')
  })
})
