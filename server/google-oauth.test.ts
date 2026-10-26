// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { ApiError, type ApiRequest } from './http.js'
import { beginGoogleOAuth, readGoogleOAuthAttempt } from './google-oauth.js'

beforeAll(() => {
  process.env.APP_ORIGIN = 'https://snake.example'
  process.env.DATABASE_URL = 'postgresql://test:test@example.invalid/snake_game'
  process.env.RATE_LIMIT_SECRET = 'test-only-rate-limit-secret-that-is-long-enough'
  process.env.GOOGLE_CLIENT_ID = 'snake-test.apps.googleusercontent.com'
  process.env.GOOGLE_CLIENT_SECRET = 'test-only-google-client-secret'
  process.env.OAUTH_STATE_SECRET = 'test-only-oauth-state-secret-that-is-long-enough'
})

describe('Google OAuth browser binding', () => {
  it('uses authorization code flow with PKCE, nonce, state, and minimal scope', () => {
    const started = beginGoogleOAuth('login')
    const url = new URL(started.authorizationUrl)

    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.pathname).toBe('/o/oauth2/v2/auth')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('openid')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toHaveLength(43)
    expect(url.searchParams.get('nonce')).toHaveLength(43)
    expect(url.searchParams.get('state')).toHaveLength(43)
    expect(url.searchParams.has('access_type')).toBe(false)
    expect(started.cookie).toMatch(/^__Host-snake_google_oauth=/)
    expect(started.cookie).toContain('; Path=/; HttpOnly; SameSite=Lax; Secure;')

    const request = requestWithCookie(started.cookie)
    const attempt = readGoogleOAuthAttempt(request, url.searchParams.get('state') || '')
    expect(attempt.intent).toBe('login')
    expect(attempt.verifier.length).toBeGreaterThanOrEqual(43)
  })

  it('rejects a mismatched state or tampered cookie', () => {
    const started = beginGoogleOAuth('login')
    const state = new URL(started.authorizationUrl).searchParams.get('state') || ''
    const request = requestWithCookie(started.cookie)

    expect(() => readGoogleOAuthAttempt(request, `${state.slice(0, -1)}x`)).toThrow(ApiError)
    const cookieName = Object.keys(request.cookies)[0]
    request.cookies[cookieName] = `${request.cookies[cookieName].slice(0, -1)}x`
    expect(() => readGoogleOAuthAttempt(request, state)).toThrow(ApiError)
  })

  it('binds account deletion to a specific local user', () => {
    const userId = '3d595f3e-9a3d-4f52-9c49-7774bf8cda43'
    const started = beginGoogleOAuth('delete', userId)
    const state = new URL(started.authorizationUrl).searchParams.get('state') || ''
    const attempt = readGoogleOAuthAttempt(requestWithCookie(started.cookie), state)

    expect(attempt).toMatchObject({ intent: 'delete', userId })
    expect(() => beginGoogleOAuth('delete', 'not-a-user-id')).toThrow(ApiError)
  })
})

function requestWithCookie(cookieHeader: string): ApiRequest {
  const [pair] = cookieHeader.split(';')
  const separator = pair.indexOf('=')
  return {
    method: 'GET',
    headers: {},
    cookies: { [pair.slice(0, separator)]: pair.slice(separator + 1) },
  }
}
