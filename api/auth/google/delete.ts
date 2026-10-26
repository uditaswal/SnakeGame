import { beginGoogleOAuth } from '../../../server/google-oauth.js'
import { allowMethod, ApiError, getClientKey, getJsonBody, requireSameOrigin, withApi } from '../../../server/http.js'
import { enforceRateLimit } from '../../../server/rate-limit.js'
import { requireSessionUser } from '../../../server/session.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'POST')
  requireSameOrigin(request)
  await enforceRateLimit({ key: getClientKey(request, 'google-delete'), limit: 3, windowMs: 60 * 60 * 1000 })

  const user = await requireSessionUser(request)
  if (user.authProvider !== 'google') {
    throw new ApiError(400, 'PASSWORD_REAUTH_REQUIRED', 'Use your password to delete this account.')
  }
  const confirmation = getJsonBody(request).confirmation
  if (typeof confirmation !== 'string' || confirmation !== user.username) {
    throw new ApiError(400, 'INVALID_CONFIRMATION', 'Type your exact username to confirm deletion.')
  }

  const { authorizationUrl, cookie } = beginGoogleOAuth('delete', user.id)
  response.setHeader('Set-Cookie', cookie)
  response.status(200).json({ authorizationUrl })
})
