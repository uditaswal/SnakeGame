import { allowMethod, withApi } from '../../server/http.js'
import { isGoogleOAuthConfigured } from '../../server/env.js'
import { getSessionUser, publicUser } from '../../server/session.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'GET')
  const user = await getSessionUser(request)
  response.status(200).json({
    user: user ? publicUser(user) : null,
    providers: { google: isGoogleOAuthConfigured() },
  })
})

