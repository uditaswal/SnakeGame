import { getSql } from '../../server/db.js'
import { allowMethod, ApiError, getClientKey, getIdentifierKey, getJsonBody, requireSameOrigin, withApi } from '../../server/http.js'
import type { UserRecord } from '../../server/models.js'
import { hashPassword, verifyPassword } from '../../server/password.js'
import { enforceRateLimit } from '../../server/rate-limit.js'
import { publicUser, replaceUserSessions } from '../../server/session.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'POST')
  requireSameOrigin(request)
  await enforceRateLimit({ key: getClientKey(request, 'login'), limit: 10, windowMs: 15 * 60 * 1000 })

  const body = getJsonBody(request)
  const usernameKey = typeof body.username === 'string' ? body.username.normalize('NFKC').trim().toLowerCase() : ''
  const password = typeof body.password === 'string' && body.password.length <= 128 ? body.password : ''
  await enforceRateLimit({ key: getIdentifierKey('login-account', usernameKey || 'invalid'), limit: 20, windowMs: 60 * 60 * 1000 })
  const sql = getSql()
  const rows = usernameKey && password ? await sql`
    SELECT
      id,
      username,
      username_key AS "usernameKey",
      password_hash AS "passwordHash",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM users
    WHERE username_key = ${usernameKey}
    LIMIT 1
  ` as UserRecord[] : []
  const user = rows[0] ?? null

  let valid = false
  if (user) valid = await verifyPassword(user.passwordHash, password)
  else await hashPassword(password || 'invalid-login-padding')
  if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Username or password is incorrect.')

  await replaceUserSessions(user.id, response)
  response.status(200).json({ user: publicUser(user) })
})

