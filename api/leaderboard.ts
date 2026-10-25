import { getSql } from '../server/db.js'
import { allowMethod, getClientKey, withApi } from '../server/http.js'
import { enforceRateLimit } from '../server/rate-limit.js'
import { timestampToIso, type DatabaseTimestamp } from '../server/models.js'

export default withApi(async (request, response) => {
  allowMethod(request, response, 'GET')
  await enforceRateLimit({ key: getClientKey(request, 'leaderboard'), limit: 120, windowMs: 15 * 60 * 1000 })
  const sql = getSql()
  const rows = await sql`
    SELECT username, score, achieved_at AS "achievedAt"
    FROM (
      SELECT DISTINCT ON (scores.user_id)
        users.username,
        scores.score,
        scores.achieved_at
      FROM scores
      JOIN users ON users.id = scores.user_id
      ORDER BY scores.user_id, scores.score DESC, scores.achieved_at ASC
    ) AS best_scores
    ORDER BY score DESC, achieved_at ASC
    LIMIT 50
  ` as Array<{ username: string; score: number; achievedAt: DatabaseTimestamp }>

  response.status(200).json({
    entries: rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      score: row.score,
      achievedAt: timestampToIso(row.achievedAt),
    })),
  })
})
