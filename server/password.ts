import * as argon2 from 'argon2'
import { ApiError } from './http.js'

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const

const MAX_PASSWORD_LENGTH = 128
const MIN_NEW_PASSWORD_LENGTH = 15

export function parseExistingPassword(value: unknown): string {
  if (typeof value !== 'string') throw new ApiError(400, 'INVALID_PASSWORD', 'Enter a password.')
  if (value.length === 0) throw new ApiError(400, 'INVALID_PASSWORD', 'Enter a password.')
  if (value.length > MAX_PASSWORD_LENGTH) throw new ApiError(400, 'INVALID_PASSWORD', 'Use no more than 128 characters.')
  return value
}

export function parseNewPassword(value: unknown): string {
  const password = parseExistingPassword(value)
  if (password.length < MIN_NEW_PASSWORD_LENGTH) {
    throw new ApiError(400, 'INVALID_PASSWORD', 'Use at least 15 characters.')
  }
  return password
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

