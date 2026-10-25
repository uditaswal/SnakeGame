import { getSql } from './db.js'
import { ApiError } from './http.js'

type RateLimitOptions = Readonly<{
  key: string
  limit: number
  windowMs: number
}>

export async function enforceRateLimit({ key, limit, windowMs }: RateLimitOptions): Promise<void> {
  const sql = getSql()
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs)
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2)
  const rows = await sql`
    WITH expired AS (
      DELETE FROM rate_limits WHERE expires_at <= now()
    )
    INSERT INTO rate_limits (key, window_start, count, expires_at)
    VALUES (${key}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  ` as Array<{ count: number }>

  if ((rows[0]?.count ?? 0) > limit) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Wait a few minutes and try again.')
  }
}
