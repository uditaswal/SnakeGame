import { deleteUserData } from '../../../server/account.js'
import { findOrCreateGoogleUser, googleIdentityMatches } from '../../../server/google-account.js'
import { clearGoogleOAuthCookie, exchangeGoogleCode, readGoogleOAuthAttempt } from '../../../server/google-oauth.js'
import { getQueryValue, type ApiResponse, withApi } from '../../../server/http.js'
import { clearSessionCookie, createSession } from '../../../server/session.js'

export default withApi(async (request, response) => {
  if (request.method !== 'GET') return redirectToAccount(response, 'google_error')

  const clearOAuth = clearGoogleOAuthCookie()
  try {
    const state = getQueryValue(request, 'state', 256)
    const attempt = readGoogleOAuthAttempt(request, state)
    if (getQueryValue(request, 'error', 128)) return redirectToAccount(response, 'google_error', [clearOAuth])

    const subject = await exchangeGoogleCode(getQueryValue(request, 'code'), attempt)
    if (attempt.intent === 'delete') {
      if (!attempt.userId || !(await googleIdentityMatches(attempt.userId, subject))) {
        return redirectToAccount(response, 'google_error', [clearOAuth])
      }
      await deleteUserData(attempt.userId)
      return redirectToAccount(response, 'deleted', [clearOAuth, clearSessionCookie()])
    }

    const user = await findOrCreateGoogleUser(subject)
    await createSession(user.id, response, [clearOAuth])
    return redirectToAccount(response, 'google')
  } catch {
    return redirectToAccount(response, 'google_error', [clearOAuth])
  }
})

function redirectToAccount(response: ApiResponse, result: 'google' | 'google_error' | 'deleted', cookies?: string[]): void {
  if (cookies?.length) response.setHeader('Set-Cookie', cookies)
  response.setHeader('Location', `/account?auth=${result}`)
  response.status(303).end()
}
