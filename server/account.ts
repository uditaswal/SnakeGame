import { getSql } from './db.js'

export async function deleteUserData(userId: string): Promise<void> {
  const sql = getSql()
  await sql.transaction([
    sql`
      WITH deleted_scores AS (
        DELETE FROM scores WHERE user_id = ${userId}
        RETURNING challenge_id
      )
      DELETE FROM run_challenges
      WHERE id IN (SELECT challenge_id FROM deleted_scores)
    `,
    sql`DELETE FROM users WHERE id = ${userId}`,
  ])
}
