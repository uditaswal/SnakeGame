import { allowMethod, requireSameOrigin, withApi } from '../../server/http.js'
import { deleteSession } from '../../server/session.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'POST')
  requireSameOrigin(request)
  await deleteSession(request, response)
  response.status(204).end()
})

