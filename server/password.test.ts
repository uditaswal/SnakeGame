import { describe, expect, it } from 'vitest'
import { hashPassword, parseExistingPassword, parseNewPassword, verifyPassword } from './password'

describe('password security', () => {
  it('stores an Argon2id hash and verifies only the matching password', async () => {
    const password = 'correct horse battery staple'
    const hash = await hashPassword(password)

    expect(hash).toMatch(/^\$argon2id\$/)
    await expect(verifyPassword(hash, password)).resolves.toBe(true)
    await expect(verifyPassword(hash, 'a different password')).resolves.toBe(false)
  })

  it('requires stronger new passwords without rejecting existing short passwords', () => {
    expect(parseExistingPassword('legacy')).toBe('legacy')
    expect(() => parseExistingPassword('')).toThrow('Enter a password.')
    expect(() => parseNewPassword('fourteen-chars')).toThrow('Use at least 15 characters.')
    expect(parseNewPassword('fifteen-chars-ok')).toBe('fifteen-chars-ok')
    expect(() => parseNewPassword('x'.repeat(129))).toThrow('Use no more than 128 characters.')
  })
})
