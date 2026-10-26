import { deleteUserData } from '../../server/account.js'
import { allowMethod, ApiError, getClientKey, getJsonBody, requireSameOrigin, withApi } from '../../server/http.js'
import { parseExistingPassword, verifyPassword } from '../../server/password.js'
import { enforceRateLimit } from '../../server/rate-limit.js'
import { deleteSession, requireSessionUser } from '../../server/session.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'DELETE')
  requireSameOrigin(request)
  await enforceRateLimit({ key: getClientKey(request, 'delete-account'), limit: 3, windowMs: 60 * 60 * 1000 })

  const user = await requireSessionUser(request)
  if (user.authProvider !== 'password' || !user.passwordHash) {
    throw new ApiError(400, 'GOOGLE_REAUTH_REQUIRED', 'Verify with Google to delete this account.')
  }
  const password = parseExistingPassword(getJsonBody(request).password)
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Password is incorrect.')
  }

  await deleteUserData(user.id)
  await deleteSession(request, response)
  response.status(204).end()
})

