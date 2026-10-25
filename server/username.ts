import { ApiError } from './http.js'

const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/
const RESERVED = new Set([
  'admin', 'administrator', 'api', 'help', 'leaderboard', 'login', 'logout',
  'moderator', 'privacy', 'register', 'root', 'score', 'security', 'snake',
  'staff', 'support', 'system', 'udit', 'vercel',
])

export function parseUsername(value: unknown): { username: string; usernameKey: string } {
  if (typeof value !== 'string') throw new ApiError(400, 'INVALID_USERNAME', 'Enter a username.')
  const username = value.normalize('NFKC').trim()
  const usernameKey = username.toLowerCase()

  if (!USERNAME_PATTERN.test(username)) {
    throw new ApiError(400, 'INVALID_USERNAME', 'Use 3–20 letters, numbers, or underscores, starting with a letter.')
  }
  if (RESERVED.has(usernameKey)) {
    throw new ApiError(400, 'INVALID_USERNAME', 'That username is unavailable.')
  }
  return { username, usernameKey }
}

