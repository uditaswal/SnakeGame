import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getEnv, getGoogleOAuthEnv } from './env.js'
import { ApiError, type ApiRequest } from './http.js'

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
  { timeoutDuration: 5_000, cooldownDuration: 30_000, cacheMaxAge: 60 * 60 * 1000 },
)
const ATTEMPT_DURATION_SECONDS = 10 * 60
const PRODUCTION_COOKIE = '__Host-snake_google_oauth'
const DEVELOPMENT_COOKIE = 'snake_google_oauth'

export type GoogleOAuthIntent = 'login' | 'delete'

export type GoogleOAuthAttempt = Readonly<{
  state: string
  verifier: string
  nonce: string
  intent: GoogleOAuthIntent
  userId?: string
  expiresAt: number
}>

type GoogleTokenResponse = {
  id_token?: unknown
}

export function beginGoogleOAuth(intent: GoogleOAuthIntent, userId?: string): {
  authorizationUrl: string
  cookie: string
} {
  if (intent === 'delete' && !isUuid(userId)) {
    throw new ApiError(400, 'INVALID_OAUTH_REQUEST', 'Could not start Google verification.')
  }

  const oauth = getGoogleOAuthEnv()
  const verifier = randomBytes(64).toString('base64url')
  const attempt: GoogleOAuthAttempt = {
    state: randomBytes(32).toString('base64url'),
    verifier,
    nonce: randomBytes(32).toString('base64url'),
    intent,
    ...(userId ? { userId } : {}),
    expiresAt: Math.floor(Date.now() / 1000) + ATTEMPT_DURATION_SECONDS,
  }
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT)
  url.searchParams.set('client_id', oauth.clientId)
  url.searchParams.set('redirect_uri', callbackUrl(oauth.appOrigin))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid')
  url.searchParams.set('state', attempt.state)
  url.searchParams.set('nonce', attempt.nonce)
  url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('prompt', 'select_account')

  return {
    authorizationUrl: url.toString(),
    cookie: serializeAttemptCookie(signAttempt(attempt, oauth.stateSecret)),
  }
}

export function readGoogleOAuthAttempt(request: ApiRequest, returnedState: string): GoogleOAuthAttempt {
  const encoded = request.cookies[PRODUCTION_COOKIE] || request.cookies[DEVELOPMENT_COOKIE]
  if (!encoded || !returnedState) throw invalidAttempt()

  const segments = encoded.split('.')
  if (segments.length !== 2) throw invalidAttempt()
  const [payloadSegment, signatureSegment] = segments
  const expectedSignature = createHmac('sha256', getGoogleOAuthEnv().stateSecret)
    .update(payloadSegment)
    .digest()
  let providedSignature: Buffer
  try {
    providedSignature = Buffer.from(signatureSegment, 'base64url')
  } catch {
    throw invalidAttempt()
  }
  if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) {
    throw invalidAttempt()
  }

  let value: unknown
  try {
    value = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'))
  } catch {
    throw invalidAttempt()
  }
  if (!isAttempt(value) || value.expiresAt < Math.floor(Date.now() / 1000)) throw invalidAttempt()
  if (!safeEqual(value.state, returnedState)) throw invalidAttempt()
  return value
}

export async function exchangeGoogleCode(code: string, attempt: GoogleOAuthAttempt): Promise<string> {
  if (!code || code.length > 2048) throw invalidAttempt()
  const oauth = getGoogleOAuthEnv()
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      redirect_uri: callbackUrl(oauth.appOrigin),
      grant_type: 'authorization_code',
      code_verifier: attempt.verifier,
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new ApiError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be verified.')

  const token = await response.json() as GoogleTokenResponse
  if (typeof token.id_token !== 'string' || token.id_token.length > 20_000) {
    throw new ApiError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be verified.')
  }
  const { payload } = await jwtVerify(token.id_token, GOOGLE_JWKS, {
    algorithms: ['RS256'],
    audience: oauth.clientId,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    clockTolerance: 5,
    maxTokenAge: '10 minutes',
  })
  if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, attempt.nonce)) {
    throw new ApiError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be verified.')
  }
  if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== oauth.clientId) {
    throw new ApiError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be verified.')
  }
  if (typeof payload.sub !== 'string' || payload.sub.length < 1 || payload.sub.length > 255) {
    throw new ApiError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be verified.')
  }
  return payload.sub
}

export function clearGoogleOAuthCookie(): string {
  const secure = getEnv().secureCookies ? '; Secure' : ''
  return `${googleCookieName()}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`
}

function callbackUrl(appOrigin: string): string {
  return `${appOrigin}/api/auth/google/callback`
}

function googleCookieName(): string {
  return getEnv().secureCookies ? PRODUCTION_COOKIE : DEVELOPMENT_COOKIE
}

function serializeAttemptCookie(value: string): string {
  const secure = getEnv().secureCookies ? '; Secure' : ''
  return `${googleCookieName()}=${value}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${ATTEMPT_DURATION_SECONDS}`
}

function signAttempt(attempt: GoogleOAuthAttempt, secret: string): string {
  const payload = Buffer.from(JSON.stringify(attempt)).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function isAttempt(value: unknown): value is GoogleOAuthAttempt {
  if (!value || typeof value !== 'object') return false
  const attempt = value as Partial<GoogleOAuthAttempt>
  return typeof attempt.state === 'string'
    && attempt.state.length === 43
    && typeof attempt.verifier === 'string'
    && attempt.verifier.length >= 43
    && attempt.verifier.length <= 128
    && typeof attempt.nonce === 'string'
    && attempt.nonce.length === 43
    && (attempt.intent === 'login' || attempt.intent === 'delete')
    && (attempt.intent === 'login' || isUuid(attempt.userId))
    && Number.isInteger(attempt.expiresAt)
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function invalidAttempt(): ApiError {
  return new ApiError(400, 'INVALID_OAUTH_STATE', 'Google sign-in expired or could not be verified.')
}
