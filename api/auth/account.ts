import { getSql } from '../../server/db.js'
import { allowMethod, ApiError, getClientKey, getJsonBody, requireSameOrigin, withApi } from '../../server/http.js'
import { parseExistingPassword, verifyPassword } from '../../server/password.js'
import { enforceRateLimit } from '../../server/rate-limit.js'
import { deleteSession, requireSessionUser } from '../../server/session.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'DELETE')
  requireSameOrigin(request)
  await enforceRateLimit({ key: getClientKey(request, 'delete-account'), limit: 3, windowMs: 60 * 60 * 1000 })

  const user = await requireSessionUser(request)
  const password = parseExistingPassword(getJsonBody(request).password)
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Password is incorrect.')
  }

  const sql = getSql()
  await sql.transaction([
    sql`
      WITH deleted_scores AS (
        DELETE FROM scores WHERE user_id = ${user.id}
        RETURNING challenge_id
      )
      DELETE FROM run_challenges
      WHERE id IN (SELECT challenge_id FROM deleted_scores)
    `,
    sql`DELETE FROM users WHERE id = ${user.id}`,
  ])
  await deleteSession(request, response)
  response.status(204).end()
})

