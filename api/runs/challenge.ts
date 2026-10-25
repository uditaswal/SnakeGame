import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getSql } from '../../server/db.js'
import { allowMethod, ApiError, getClientKey, getJsonBody, requireSameOrigin, withApi } from '../../server/http.js'
import { enforceRateLimit } from '../../server/rate-limit.js'
import { getSessionUser } from '../../server/session.js'

const ENGINE_VERSION = 2
const CHALLENGE_LIFETIME_MS = 2 * 60 * 60 * 1000
const MIN_COLUMNS = 12
const MAX_COLUMNS = 60
const MIN_ROWS = 12
const MAX_ROWS = 40

export default withApi(async (request, response) => {
  allowMethod(request, response, 'POST')
  requireSameOrigin(request)
  await enforceRateLimit({ key: getClientKey(request, 'run-challenge'), limit: 30, windowMs: 15 * 60 * 1000 })

  const user = await getSessionUser(request)
  const body = getJsonBody(request)
  const columns = parseDimension(body.columns, 'columns', MIN_COLUMNS, MAX_COLUMNS)
  const rows = parseDimension(body.rows, 'rows', MIN_ROWS, MAX_ROWS)
  const token = randomBytes(32).toString('base64url')
  // Postgres integer is signed 32-bit; an unsigned seed fails to insert about
  // half the time. The game PRNG accepts this positive 31-bit range.
  const seed = createChallengeSeed()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS)
  const sql = getSql()
  await sql.transaction([
    sql`DELETE FROM run_challenges WHERE expires_at <= now() AND used_at IS NULL`,
    sql`
      INSERT INTO run_challenges (
        id, token_hash, issued_for_user_id, engine_version, seed, columns, rows, issued_at, expires_at, used_at
      ) VALUES (
        ${randomUUID()},
        ${createHash('sha256').update(token).digest('hex')},
        ${user?.id ?? null},
        ${ENGINE_VERSION},
        ${seed},
        ${columns},
        ${rows},
        ${now},
        ${expiresAt},
        NULL
      )
    `,
  ])

  response.status(201).json({ challenge: token, engineVersion: ENGINE_VERSION, seed, columns, rows, expiresAt: expiresAt.toISOString() })
})

export function createChallengeSeed(): number {
  return randomBytes(4).readUInt32BE(0) & 0x7fffffff
}

function parseDimension(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ApiError(400, 'INVALID_BOARD', `Invalid ${field}.`)
  }
  return value as number
}

