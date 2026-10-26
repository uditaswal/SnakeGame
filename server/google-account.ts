import { randomBytes, randomUUID } from 'node:crypto'
import { getSql } from './db.js'
import { ApiError } from './http.js'
import type { UserRecord } from './models.js'

export async function findOrCreateGoogleUser(subject: string): Promise<UserRecord> {
  const existing = await findGoogleUser(subject)
  if (existing) return existing

  const sql = getSql()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomBytes(6).toString('hex')
    const username = `Player_${suffix}`
    const now = new Date()
    const user: UserRecord = {
      id: randomUUID(),
      username,
      usernameKey: username.toLowerCase(),
      passwordHash: null,
      authProvider: 'google',
      providerSubject: subject,
      createdAt: now,
      updatedAt: now,
    }
    try {
      await sql`
        INSERT INTO users (
          id, username, username_key, password_hash, auth_provider, provider_subject, created_at, updated_at
        )
        VALUES (
          ${user.id}, ${user.username}, ${user.usernameKey}, NULL, ${user.authProvider}, ${subject}, ${now}, ${now}
        )
      `
      return user
    } catch (error) {
      if (!isDuplicateKey(error)) throw error
      const racedUser = await findGoogleUser(subject)
      if (racedUser) return racedUser
    }
  }
  throw new ApiError(503, 'ACCOUNT_CREATION_FAILED', 'Could not create an account. Try again.')
}

export async function googleIdentityMatches(userId: string, subject: string): Promise<boolean> {
  const sql = getSql()
  const rows = await sql`
    SELECT id
    FROM users
    WHERE id = ${userId}
      AND auth_provider = 'google'
      AND provider_subject = ${subject}
    LIMIT 1
  ` as Array<{ id: string }>
  return Boolean(rows[0])
}

async function findGoogleUser(subject: string): Promise<UserRecord | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      id,
      username,
      username_key AS "usernameKey",
      password_hash AS "passwordHash",
      auth_provider AS "authProvider",
      provider_subject AS "providerSubject",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM users
    WHERE auth_provider = 'google' AND provider_subject = ${subject}
    LIMIT 1
  ` as UserRecord[]
  return rows[0] ?? null
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
