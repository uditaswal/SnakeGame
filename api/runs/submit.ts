import { createHash, randomUUID } from 'node:crypto'
import { getSql } from '../../server/db.js'
import { allowMethod, ApiError, getClientKey, getIdentifierKey, getJsonBody, requireSameOrigin, withApi } from '../../server/http.js'
import { enforceRateLimit } from '../../server/rate-limit.js'
import { validateRun } from '../../server/run-validation.js'
import { validateRunReplay, type MoveEvent } from '../../server/run-replay.js'
import { requireSessionUser } from '../../server/session.js'
import { timestampToIso, type DatabaseTimestamp } from '../../server/models.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'POST')
  requireSameOrigin(request)
  await enforceRateLimit({ key: getClientKey(request, 'score-submit'), limit: 20, windowMs: 15 * 60 * 1000 })

  const user = await requireSessionUser(request)
  await enforceRateLimit({ key: getIdentifierKey('score-user', user.id), limit: 30, windowMs: 60 * 60 * 1000 })
  const body = getJsonBody(request)
  const challengeToken = parseString(body.challenge, 'challenge')
  const score = parseInteger(body.score, 'score')
  const durationMs = parseInteger(body.durationMs, 'durationMs')
  const ticks = parseInteger(body.ticks, 'ticks')
  const engineVersion = parseInteger(body.engineVersion, 'engineVersion')
  validateRun(score, durationMs, ticks)
  const columns = parseInteger(body.columns, 'columns')
  const rows = parseInteger(body.rows, 'rows')
  const moves = parseMoves(body.moves)

  const now = new Date()
  const sql = getSql()
  const challengeHash = createHash('sha256').update(challengeToken).digest('hex')
  const challengeRows = await sql`
    SELECT seed, columns, rows, engine_version AS "engineVersion"
    FROM run_challenges
    WHERE token_hash = ${challengeHash}
      AND used_at IS NULL
      AND expires_at > ${now}
    LIMIT 1
  ` as Array<{ seed: number; columns: number; rows: number; engineVersion: number }>
  const challenge = challengeRows[0]
  if (!challenge || challenge.engineVersion !== engineVersion || challenge.columns !== columns || challenge.rows !== rows) {
    throw new ApiError(409, 'INVALID_CHALLENGE', 'This game session is no longer valid.')
  }
  validateRunReplay({
    score,
    ticks,
    durationMs,
    seed: challenge.seed,
    config: { columns, rows, initialSpeedMs: 130, minimumSpeedMs: 62, speedStepMs: 3 },
    moves,
  })
  const scoreRows = await sql`
    WITH consumed AS (
      UPDATE run_challenges
      SET used_at = ${now}
      WHERE token_hash = ${challengeHash}
        AND engine_version = ${engineVersion}
        AND used_at IS NULL
        AND expires_at > ${now}
        AND issued_at <= ${new Date(now.getTime() - durationMs + 10_000)}
        AND (issued_for_user_id IS NULL OR issued_for_user_id = ${user.id})
      RETURNING id
    )
    INSERT INTO scores (
      id, user_id, challenge_id, score, duration_ms, ticks, engine_version, achieved_at
    )
    SELECT
      ${randomUUID()}, ${user.id}, consumed.id, ${score}, ${durationMs}, ${ticks}, ${engineVersion}, ${now}
    FROM consumed
    RETURNING achieved_at AS "achievedAt"
  ` as Array<{ achievedAt: DatabaseTimestamp }>

  if (!scoreRows[0]) {
    throw new ApiError(409, 'INVALID_CHALLENGE', 'This run has expired or was already submitted.')
  }
  response.status(201).json({ saved: true, score, achievedAt: timestampToIso(scoreRows[0].achievedAt) })
})

function parseString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length < 32 || value.length > 128) {
    throw new ApiError(400, 'INVALID_RUN', `Invalid ${field}.`)
  }
  return value
}

function parseMoves(value: unknown): MoveEvent[] {
  if (!Array.isArray(value)) throw new ApiError(400, 'INVALID_RUN', 'Invalid moves.')
  return value.map((move) => {
    if (!move || typeof move !== 'object') throw new ApiError(400, 'INVALID_RUN', 'Invalid move.')
    const candidate = move as { tick?: unknown; direction?: unknown }
    const tick = parseInteger(candidate.tick, 'move tick')
    if (candidate.direction !== 'up' && candidate.direction !== 'down' && candidate.direction !== 'left' && candidate.direction !== 'right') {
      throw new ApiError(400, 'INVALID_RUN', 'Invalid move direction.')
    }
    return { tick, direction: candidate.direction }
  })
}

function parseInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new ApiError(400, 'INVALID_RUN', `Invalid ${field}.`)
  }
  return value as number
}

