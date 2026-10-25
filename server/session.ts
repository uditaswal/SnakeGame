import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getSql } from './db.js'
import { getEnv } from './env.js'
import { ApiError, type ApiRequest, type ApiResponse } from './http.js'
import { timestampToIso, type UserRecord } from './models.js'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000
const PRODUCTION_COOKIE = '__Host-snake_session'
const DEVELOPMENT_COOKIE = 'snake_session'

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function cookieName(): string {
  return getEnv().production ? PRODUCTION_COOKIE : DEVELOPMENT_COOKIE
}

export async function createSession(userId: string, response: ApiResponse): Promise<void> {
  const sql = getSql()
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS)

  await sql.transaction([
    sql`DELETE FROM sessions WHERE expires_at <= now()`,
    sql`
      INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at)
      VALUES (${randomUUID()}, ${userId}, ${tokenHash(token)}, ${now}, ${now}, ${expiresAt})
    `,
  ])

  response.setHeader('Set-Cookie', serializeCookie(token, expiresAt))
}

export async function deleteSession(request: ApiRequest, response: ApiResponse): Promise<void> {
  const token = readSessionToken(request)
  if (token) {
    const sql = getSql()
    await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash(token)}`
  }
  response.setHeader('Set-Cookie', clearCookie())
}

export async function getSessionUser(request: ApiRequest): Promise<UserRecord | null> {
  const token = readSessionToken(request)
  if (!token) return null

  const sql = getSql()
  const rows = await sql`
    SELECT
      users.id,
      users.username,
      users.username_key AS "usernameKey",
      users.password_hash AS "passwordHash",
      users.created_at AS "createdAt",
      users.updated_at AS "updatedAt"
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${tokenHash(token)}
      AND sessions.expires_at > now()
    LIMIT 1
  ` as UserRecord[]
  return rows[0] ?? null
}

export async function requireSessionUser(request: ApiRequest): Promise<UserRecord> {
  const user = await getSessionUser(request)
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.')
  return user
}

export async function revokeUserSessions(userId: string): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`
}

export async function replaceUserSessions(userId: string, response: ApiResponse, passwordHash?: string): Promise<void> {
  const sql = getSql()
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS)
  const statements = [
    ...(passwordHash ? [sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = ${now} WHERE id = ${userId}`] : []),
    sql`DELETE FROM sessions WHERE user_id = ${userId}`,
    sql`
      INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at)
      VALUES (${randomUUID()}, ${userId}, ${tokenHash(token)}, ${now}, ${now}, ${expiresAt})
    `,
  ]
  await sql.transaction(statements)
  response.setHeader('Set-Cookie', serializeCookie(token, expiresAt))
}

export function publicUser(user: UserRecord): { id: string; username: string; createdAt: string } {
  return { id: user.id, username: user.username, createdAt: timestampToIso(user.createdAt) }
}

function readSessionToken(request: ApiRequest): string | null {
  return request.cookies[PRODUCTION_COOKIE] || request.cookies[DEVELOPMENT_COOKIE] || null
}

function serializeCookie(token: string, expiresAt: Date): string {
  const secure = getEnv().production ? '; Secure' : ''
  return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict${secure}; Expires=${expiresAt.toUTCString()}`
}

function clearCookie(): string {
  const secure = getEnv().production ? '; Secure' : ''
  return `${cookieName()}=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`
}
