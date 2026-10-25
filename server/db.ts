import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { getEnv } from './env.js'

let sql: NeonQueryFunction<false, false> | undefined

export function getSql(): NeonQueryFunction<false, false> {
  sql ??= neon(getEnv().databaseUrl)
  return sql
}
