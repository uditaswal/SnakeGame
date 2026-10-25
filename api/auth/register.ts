import { randomUUID } from 'node:crypto'
import { getSql } from '../../server/db.js'
import { allowMethod, ApiError, getClientKey, getJsonBody, requireSameOrigin, withApi } from '../../server/http.js'
import type { UserRecord } from '../../server/models.js'
import { hashPassword, parseNewPassword } from '../../server/password.js'
import { enforceRateLimit } from '../../server/rate-limit.js'
import { createSession, publicUser } from '../../server/session.js'
import { parseUsername } from '../../server/username.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'POST')
  requireSameOrigin(request)
  await enforceRateLimit({ key: getClientKey(request, 'register'), limit: 5, windowMs: 15 * 60 * 1000 })

  const body = getJsonBody(request)
  const { username, usernameKey } = parseUsername(body.username)
  const password = parseNewPassword(body.password)
  const passwordHash = await hashPassword(password)
  const now = new Date()
  const user: UserRecord = { id: randomUUID(), username, usernameKey, passwordHash, createdAt: now, updatedAt: now }

  try {
    const sql = getSql()
    await sql`
      INSERT INTO users (id, username, username_key, password_hash, created_at, updated_at)
      VALUES (${user.id}, ${user.username}, ${user.usernameKey}, ${user.passwordHash}, ${now}, ${now})
    `
  } catch (error) {
    if (isDuplicateKey(error)) throw new ApiError(409, 'USERNAME_TAKEN', 'That username is unavailable.')
    throw error
  }

  await createSession(user.id, response)
  response.status(201).json({ user: publicUser(user) })
})

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

