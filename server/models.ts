export type DatabaseTimestamp = string | Date

export type UserRecord = {
  id: string
  username: string
  usernameKey: string
  passwordHash: string | null
  authProvider: 'password' | 'google'
  providerSubject?: string | null
  createdAt: DatabaseTimestamp
  updatedAt: DatabaseTimestamp
}

export type SessionRecord = {
  id: string
  userId: string
  tokenHash: string
  createdAt: DatabaseTimestamp
  lastSeenAt: DatabaseTimestamp
  expiresAt: DatabaseTimestamp
}

export type ScoreRecord = {
  id: string
  userId: string
  challengeId: string
  score: number
  durationMs: number
  ticks: number
  engineVersion: number
  achievedAt: DatabaseTimestamp
}

export type RunChallengeRecord = {
  id: string
  tokenHash: string
  issuedForUserId: string | null
  engineVersion: number
  issuedAt: DatabaseTimestamp
  expiresAt: DatabaseTimestamp
  usedAt: DatabaseTimestamp | null
}

export function timestampToIso(value: DatabaseTimestamp): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}
