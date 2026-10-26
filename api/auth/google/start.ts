import { getClientKey, withApi } from '../../../server/http.js'
import { beginGoogleOAuth } from '../../../server/google-oauth.js'
import { enforceRateLimit } from '../../../server/rate-limit.js'

export default withApi(async (request, response) => {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET for this endpoint.' } })
    return
  }
  await enforceRateLimit({ key: getClientKey(request, 'google-login'), limit: 10, windowMs: 15 * 60 * 1000 })
  const { authorizationUrl, cookie } = beginGoogleOAuth('login')
  response.setHeader('Set-Cookie', cookie)
  response.setHeader('Location', authorizationUrl)
  response.status(302).end()
})
