import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim()
if (!databaseUrl) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required to run migrations.')

const sql = neon(databaseUrl)

await sql.transaction([
  sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      username varchar(20) NOT NULL,
      username_key varchar(20) NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `,
  sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash char(64) NOT NULL UNIQUE,
      created_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL
    )
  `,
  sql`
    CREATE TABLE IF NOT EXISTS run_challenges (
      id uuid PRIMARY KEY,
      token_hash char(64) NOT NULL UNIQUE,
      issued_for_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      engine_version integer NOT NULL CHECK (engine_version > 0),
      seed integer NOT NULL DEFAULT 0,
      columns integer NOT NULL DEFAULT 20 CHECK (columns BETWEEN 12 AND 60),
      rows integer NOT NULL DEFAULT 20 CHECK (rows BETWEEN 12 AND 40),
      issued_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      used_at timestamptz
    )
  `,
  sql`ALTER TABLE run_challenges ADD COLUMN IF NOT EXISTS seed integer NOT NULL DEFAULT 0`,
  sql`ALTER TABLE run_challenges ADD COLUMN IF NOT EXISTS columns integer NOT NULL DEFAULT 20`,
  sql`ALTER TABLE run_challenges ADD COLUMN IF NOT EXISTS rows integer NOT NULL DEFAULT 20`,
  sql`
    CREATE TABLE IF NOT EXISTS scores (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id uuid NOT NULL UNIQUE REFERENCES run_challenges(id),
      score integer NOT NULL CHECK (score >= 0),
      duration_ms bigint NOT NULL CHECK (duration_ms >= 0),
      ticks integer NOT NULL CHECK (ticks >= 0),
      engine_version integer NOT NULL CHECK (engine_version > 0),
      achieved_at timestamptz NOT NULL
    )
  `,
  sql`ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_score_check`,
  sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key char(64) NOT NULL,
      window_start timestamptz NOT NULL,
      count integer NOT NULL CHECK (count > 0),
      expires_at timestamptz NOT NULL,
      PRIMARY KEY (key, window_start)
    )
  `,
  sql`CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions (user_id)`,
  sql`CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at)`,
  sql`CREATE INDEX IF NOT EXISTS leaderboard_rank ON scores (score DESC, achieved_at ASC)`,
  sql`CREATE INDEX IF NOT EXISTS scores_by_user ON scores (user_id, score DESC)`,
  sql`CREATE INDEX IF NOT EXISTS challenge_expiry ON run_challenges (expires_at) WHERE used_at IS NULL`,
  sql`CREATE INDEX IF NOT EXISTS rate_limit_expiry ON rate_limits (expires_at)`,
])

console.log('Neon schema is ready.')
