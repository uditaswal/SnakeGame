import { allowMethod, ApiError, getClientKey, getJsonBody, requireSameOrigin, withApi } from '../../server/http.js'
import { hashPassword, parseExistingPassword, parseNewPassword, verifyPassword } from '../../server/password.js'
import { enforceRateLimit } from '../../server/rate-limit.js'
import { replaceUserSessions, requireSessionUser } from '../../server/session.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'POST')
  requireSameOrigin(request)
  await enforceRateLimit({ key: getClientKey(request, 'password'), limit: 5, windowMs: 15 * 60 * 1000 })

  const user = await requireSessionUser(request)
  const body = getJsonBody(request)
  const currentPassword = parseExistingPassword(body.currentPassword)
  const newPassword = parseNewPassword(body.newPassword)
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.')
  }
  if (currentPassword === newPassword) {
    throw new ApiError(400, 'PASSWORD_UNCHANGED', 'Choose a different password.')
  }

  const passwordHash = await hashPassword(newPassword)
  await replaceUserSessions(user.id, response, passwordHash)
  response.status(200).json({ ok: true })
})

